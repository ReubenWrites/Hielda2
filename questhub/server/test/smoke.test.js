import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { io as ioClient } from 'socket.io-client';
import { createApp } from '../src/index.js';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

let server, baseUrl, io;

beforeAll(async () => {
  // Isolated data dir per run
  process.env.QUESTHUB_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'questhub-test-'));
  const app = createApp();
  server = app.server;
  io = app.io;
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  baseUrl = `http://localhost:${port}`;
});

afterAll(async () => {
  // Drop any client a failing test left open so close() cannot hang.
  await new Promise((resolve) => io.close(resolve));
});

async function call(method, p, body) {
  const res = await fetch(`${baseUrl}${p}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${p} -> ${res.status}`);
  return res.json();
}

function connect() {
  return ioClient(baseUrl, { transports: ['websocket'], forceNew: true });
}

function once(socket, event) {
  return new Promise((resolve) => socket.once(event, resolve));
}

function emitAck(socket, event, payload) {
  return new Promise((resolve) => socket.emit(event, payload, resolve));
}

async function dmFor(roomName) {
  const { id: roomId, dmSecret } = await call('POST', '/api/rooms', { name: roomName });
  const dm = connect();
  await once(dm, 'connect');
  const join = await emitAck(dm, 'room:join', { roomId, name: 'GM', asDm: true, dmSecret });
  return { roomId, dmSecret, dm, join };
}

async function playerFor(roomId, name) {
  const p = connect();
  await once(p, 'connect');
  const join = await emitAck(p, 'room:join', { roomId, name });
  return { socket: p, join };
}

// 1x1 PNG
const TINY_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

async function uploadTiny() {
  const form = new FormData();
  form.append('image', new Blob([TINY_PNG], { type: 'image/png' }), 'x.png');
  return (await fetch(`${baseUrl}/api/upload`, { method: 'POST', body: form })).json();
}

describe('REST API', () => {
  test('health check', async () => {
    const r = await call('GET', '/api/health');
    expect(r.ok).toBe(true);
  });

  test('create + fetch room', async () => {
    const created = await call('POST', '/api/rooms', { name: 'Goblin Cave' });
    expect(created.id).toMatch(/^[A-Z0-9]{6}$/);
    expect(typeof created.dmSecret).toBe('string');
    const fetched = await call('GET', `/api/rooms/${created.id}`);
    expect(fetched.room.name).toBe('Goblin Cave');
    expect(fetched.room.dm_secret).toBeUndefined();
  });
});

describe('socket flow', () => {
  test('DM joins, creates token, player sees it', async () => {
    const { roomId, dm, join } = await dmFor('Test Room');
    expect(join.role).toBe('dm');
    expect(join.state.room.scene_id).toBeTruthy();
    expect(join.state.scenes).toHaveLength(1);

    const { socket: player, join: pj } = await playerFor(roomId, 'Aragorn');
    expect(pj.role).toBe('player');

    const tokenCreatedOnPlayer = once(player, 'token:created');
    const dmCreate = await emitAck(dm, 'token:create', { name: 'Goblin', x: 5, y: 5, color: '#f00' });
    expect(dmCreate.ok).toBe(true);
    const received = await tokenCreatedOnPlayer;
    expect(received.name).toBe('Goblin');
    expect(received.x).toBe(5);
    dm.close(); player.close();
  });

  test('player cannot create tokens', async () => {
    const { id: roomId } = await call('POST', '/api/rooms', { name: 'No-DM Test' });
    const { socket: player } = await playerFor(roomId, 'Bilbo');
    const result = await emitAck(player, 'token:create', { name: 'Cheater' });
    expect(result.error).toMatch(/DM only/i);
    player.close();
  });

  test('move proposal: player proposes, DM approves', async () => {
    const { roomId, dm } = await dmFor('Move Test');
    const { socket: player, join: pj } = await playerFor(roomId, 'Frodo');
    const tCreate = await emitAck(dm, 'token:create', { name: 'Frodo', owner: pj.you.id, x: 0, y: 0 });
    const tokenId = tCreate.token.id;

    const proposedOnDm = once(dm, 'move:proposed');
    const proposeRes = await emitAck(player, 'move:propose', {
      tokenId, path: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }],
    });
    expect(proposeRes.ok).toBe(true);
    const proposal = await proposedOnDm;
    expect(proposal.path.length).toBe(3);

    const approvedOnPlayer = once(player, 'move:approved');
    const approveRes = await emitAck(dm, 'move:approve', { proposalId: proposal.id, stopAtIndex: 1 });
    expect(approveRes.ok).toBe(true);
    const approved = await approvedOnPlayer;
    expect(approved.path.length).toBe(2);
    expect(approved.interrupted).toBe(true);
    dm.close(); player.close();
  });

  test('token hp/ac fields roundtrip', async () => {
    const { dm } = await dmFor('HP Test');
    const created = await emitAck(dm, 'token:create', { name: 'Wolf', x: 1, y: 1, hp: 11, maxHp: 11, ac: 13 });
    expect(created.token.hp).toBe(11);
    expect(created.token.ac).toBe(13);
    const updated = await emitAck(dm, 'token:update', { id: created.token.id, hp: 4 });
    expect(updated.token.hp).toBe(4);
    expect(updated.token.maxHp).toBe(11);
    dm.close();
  });

  test('initiative: roll, next, end', async () => {
    const { dm } = await dmFor('Init Test');
    const a = await emitAck(dm, 'token:create', { name: 'A', x: 0, y: 0 });
    const b = await emitAck(dm, 'token:create', { name: 'B', x: 1, y: 0 });
    const rolled = await emitAck(dm, 'init:roll', { tokenIds: [a.token.id, b.token.id] });
    expect(rolled.initiative.order).toHaveLength(2);
    expect(rolled.initiative.order[0].roll).toBeGreaterThanOrEqual(rolled.initiative.order[1].roll);
    const nextUpdate = once(dm, 'init:updated');
    await emitAck(dm, 'init:next', {});
    expect((await nextUpdate).turn).toBe(1);
    const endUpdate = once(dm, 'init:updated');
    await emitAck(dm, 'init:end', {});
    expect(await endUpdate).toBeNull();
    dm.close();
  });

  test('asset create/delete broadcast', async () => {
    const { dm } = await dmFor('Asset Test');
    const created = await emitAck(dm, 'asset:create', { kind: 'map', name: 'Death House', url: '/uploads/x.png' });
    expect(created.asset.kind).toBe('map');
    const del = await emitAck(dm, 'asset:delete', { id: created.asset.id });
    expect(del.ok).toBe(true);
    dm.close();
  });

  test('presence: players listed to the room', async () => {
    const { roomId, dm, join } = await dmFor('Presence Test');
    expect(join.presence.some(p => p.name === 'GM' && p.role === 'dm')).toBe(true);
    const presenceUpdate = once(dm, 'presence:updated');
    const { socket: player } = await playerFor(roomId, 'Seren');
    const list = await presenceUpdate;
    expect(list.some(p => p.name === 'Seren' && p.role === 'player')).toBe(true);
    const afterLeave = once(dm, 'presence:updated');
    player.close();
    expect((await afterLeave).some(p => p.name === 'Seren')).toBe(false);
    dm.close();
  });

  test('feet per cell + grid type config roundtrips', async () => {
    const { dm } = await dmFor('Scale Test');
    const updated = once(dm, 'map:updated');
    await emitAck(dm, 'map:config', { feetPerCell: 1320, gridType: 'free' });
    const room = await updated;
    expect(room.feet_per_cell).toBe(1320);
    expect(room.grid_type).toBe('free');
    const t = await emitAck(dm, 'token:create', { name: 'Wolf', x: 1.25, y: 2.75, emoji: '🐺' });
    expect(t.token.emoji).toBe('🐺');
    expect(t.token.x).toBe(1.25);
    dm.close();
  });

  test('handout broadcast to players, DM-only to send', async () => {
    const { roomId, dm } = await dmFor('Handout Test');
    const { socket: player } = await playerFor(roomId, 'Seren');
    const denied = await emitAck(player, 'handout:show', { url: '/uploads/x.png' });
    expect(denied.error).toMatch(/DM only/i);
    const seen = once(player, 'handout:show');
    await emitAck(dm, 'handout:show', { url: '/uploads/gates.jpg', title: 'The Gates of Barovia' });
    expect((await seen).title).toBe('The Gates of Barovia');
    const hidden = once(player, 'handout:hide');
    await emitAck(dm, 'handout:hide', {});
    await hidden;
    dm.close(); player.close();
  });

  test('tap-to-attack: adjacent only, rolls d20, announces hit/miss vs AC', async () => {
    const { roomId, dm } = await dmFor('Attack Test');
    const { socket: seren } = await playerFor(roomId, 'Seren');
    await emitAck(dm, 'token:create', { name: 'Seren', owner: 'Seren', x: 2, y: 2 });
    const wolf = (await emitAck(dm, 'token:create', { name: 'Wolf', x: 6, y: 2, ac: 13, hp: 11, maxHp: 11 })).token;
    const far = await emitAck(seren, 'attack', { targetId: wolf.id });
    expect(far.error).toMatch(/next to it/i);
    await emitAck(dm, 'token:move', { id: wolf.id, x: 3, y: 3 }); // diagonal neighbour
    const fx = once(seren, 'spell:effect');
    const chat = once(dm, 'chat:message');
    const res = await emitAck(seren, 'attack', { targetId: wolf.id });
    expect(res.ok).toBe(true);
    expect(res.roll).toBeGreaterThanOrEqual(1);
    expect(typeof res.hit).toBe('boolean');
    expect((await fx).kind).toBe('slash');
    const msg = await chat;
    expect(msg.text).toMatch(/Seren attacks Wolf: 1d20\[\d+\] = \d+ — (HIT|miss)/);
    dm.close(); seren.close();
  });

  test('turn economy: only on your turn, movement budget, attack count, spell uses action, player ends turn', async () => {
    const { roomId, dm } = await dmFor('Turn Rules');
    const { socket: seren } = await playerFor(roomId, 'Seren');
    const s = (await emitAck(dm, 'token:create', { name: 'Seren', owner: 'Seren', x: 2, y: 2, speed: 30, attacks: 1 })).token;
    const w = (await emitAck(dm, 'token:create', { name: 'Wolf', x: 3, y: 2, ac: 13, hp: 11, maxHp: 11 })).token;
    // Force a known order: wolf first, Seren second (roll then fix up via remove/add is random) — instead
    // check whichever is first and step to Seren if needed.
    const rolled = await emitAck(dm, 'init:roll', { tokenIds: [w.id, s.id] });
    expect(rolled.initiative.round).toBe(1);
    expect(rolled.initiative.turnState).toEqual({ movedFt: 0, actionUsed: false, attacksUsed: 0 });
    let init = rolled.initiative;
    if (init.order[init.turn].tokenId !== s.id) {
      const denied = await emitAck(seren, 'move:propose', { tokenId: s.id, path: [{ x: 2, y: 3 }] });
      expect(denied.error).toMatch(/not your turn/i);
      const playerNext = await emitAck(seren, 'init:next', {});
      expect(playerNext.error).toMatch(/not your turn/i);
      const upd = once(dm, 'init:updated');
      await emitAck(dm, 'init:next', {});
      init = await upd;
    }
    expect(init.order[init.turn].tokenId).toBe(s.id);
    // 7 squares = 35 ft > 30 ft speed
    const tooFar = await emitAck(seren, 'move:propose', { tokenId: s.id, path: Array.from({ length: 7 }, (_, i) => ({ x: 2, y: 3 + i })) });
    expect(tooFar.error).toMatch(/30 ft of movement left/);
    // 4 squares = 20 ft ok; approve spends it
    const ok = await emitAck(seren, 'move:propose', { tokenId: s.id, path: [{ x: 2, y: 3 }, { x: 2, y: 4 }, { x: 2, y: 5 }, { x: 3, y: 5 }] });
    expect(ok.ok).toBe(true);
    expect(ok.proposal.distFt).toBe(20);
    const spent = once(dm, 'init:updated');
    await emitAck(dm, 'move:approve', { proposalId: ok.proposal.id });
    expect((await spent).turnState.movedFt).toBe(20);
    const overBudget = await emitAck(seren, 'move:propose', { tokenId: s.id, path: [{ x: 3, y: 6 }, { x: 3, y: 7 }, { x: 3, y: 8 }] });
    expect(overBudget.error).toMatch(/10 ft of movement left/);
    // Attack: move wolf adjacent, one attack allowed, second refused
    await emitAck(dm, 'token:move', { id: w.id, x: 4, y: 5 });
    const a1 = await emitAck(seren, 'attack', { targetId: w.id });
    expect(a1.ok).toBe(true);
    const a2 = await emitAck(seren, 'attack', { targetId: w.id });
    expect(a2.error).toMatch(/no attacks left/i);
    // Spell after attacking: action already used
    const cast = await emitAck(seren, 'spell:cast', { kind: 'fireball', from: { x: 0, y: 0 }, to: { x: 1, y: 1 } });
    expect(cast.error).toMatch(/already used your action/i);
    // Player ends their own turn → fresh budget for the next creature
    const ended = once(dm, 'init:updated');
    const end = await emitAck(seren, 'init:next', {});
    expect(end.ok).toBe(true);
    const after = await ended;
    expect(after.order[after.turn].tokenId).toBe(w.id);
    expect(after.turnState.movedFt).toBe(0);
    // Deleting the wolf drops it from the order and combat ends when nobody is left
    await emitAck(dm, 'token:delete', { id: w.id });
    const state = await emitAck(dm, 'init:add', { tokenId: s.id }); // still Seren in order
    expect(state.initiative.order.map(e => e.tokenId)).toEqual([s.id]);
    dm.close(); seren.close();
  });

  test('chat /r rolls dice', async () => {
    const { roomId, dm } = await dmFor('Dice Test');
    const { socket: player } = await playerFor(roomId, 'P');
    const seen = once(player, 'chat:message');
    await emitAck(dm, 'chat:send', { text: '/r 1d20+3' });
    const msg = await seen;
    expect(msg.type).toBe('roll');
    expect(msg.roll.total).toBeGreaterThanOrEqual(4);
    expect(msg.roll.total).toBeLessThanOrEqual(23);
    dm.close(); player.close();
  });
});

describe('scenes', () => {
  test('DM creates a scene and switches; players follow their token', async () => {
    const { roomId, dm } = await dmFor('Scenes Test');
    const { socket: seren, join: sj } = await playerFor(roomId, 'Seren');
    const scene1 = sj.state.room.scene_id;

    // Seren's token lives on scene 1
    await emitAck(dm, 'token:create', { name: 'Seren', owner: 'Seren', x: 2, y: 2 });

    // DM makes scene 2 and lands on it; Seren stays on scene 1
    const created = await emitAck(dm, 'scene:create', { name: 'Death House' });
    expect(created.ok).toBe(true);
    const scene2 = created.scene.id;
    const dmState = await emitAck(dm, 'scene:switch', { sceneId: scene2 });
    expect(dmState.ok).toBe(true);

    // A token created now goes on scene 2 and must NOT reach Seren
    let leaked = false;
    seren.once('token:created', () => { leaked = true; });
    await emitAck(dm, 'token:create', { name: 'Ghost', x: 1, y: 1 });
    await new Promise(r => setTimeout(r, 150));
    expect(leaked).toBe(false);

    // Teleporting Seren's token to scene 2 moves Seren's view there
    const tokens = (await emitAck(dm, 'scene:switch', { sceneId: scene1 })) && null;
    const enter = once(seren, 'scene:enter');
    const list = await new Promise(res => dm.emit('scene:switch', { sceneId: scene1 }, () => res()));
    const serenToken = (await new Promise(res => {
      const s = connect();
      s.on('connect', () => s.emit('room:join', { roomId, name: 'Probe' }, (r) => { res(r.state.tokens); s.close(); }));
    })).find(t => t.owner === 'Seren');
    await emitAck(dm, 'token:teleport', { id: serenToken.id, sceneId: scene2, x: 3, y: 3 });
    const entered = await enter;
    expect(entered.state.room.scene_id).toBe(scene2);
    expect(entered.state.room.scene_name).toBe('Death House');
    expect(entered.state.tokens.some(t => t.name === 'Ghost')).toBe(true);
    expect(entered.state.tokens.find(t => t.owner === 'Seren').x).toBe(3);
    dm.close(); seren.close();
  });

  test('cannot delete the only scene; can delete a spare', async () => {
    const { dm, join } = await dmFor('Delete Scene');
    const denied = await emitAck(dm, 'scene:delete', { sceneId: join.state.room.scene_id });
    expect(denied.error).toMatch(/only scene/i);
    const c = await emitAck(dm, 'scene:create', { name: 'Spare' });
    const ok = await emitAck(dm, 'scene:delete', { sceneId: c.scene.id });
    expect(ok.ok).toBe(true);
    dm.close();
  });
});

describe('fog memory', () => {
  test('explored cells accumulate as a player moves and survive rejoin', async () => {
    const { roomId, dm } = await dmFor('Fog Test');
    const { socket: seren } = await playerFor(roomId, 'Seren');
    const explored1 = once(seren, 'fog:explored');
    await emitAck(dm, 'token:create', { name: 'Seren', owner: 'Seren', x: 2, y: 2, sightRadius: 2 });
    const e1 = await explored1;
    expect(e1.owner).toBe('Seren');
    expect(e1.cells).toContain('2,2');
    expect(e1.cells).not.toContain('10,2');
    const token = (await new Promise(res => {
      const s = connect();
      s.on('connect', () => s.emit('room:join', { roomId, name: 'Probe' }, (r) => { res(r.state.tokens); s.close(); }));
    }))[0];
    const explored2 = once(seren, 'fog:explored');
    await emitAck(dm, 'token:move', { id: token.id, x: 10, y: 2 });
    const e2 = await explored2;
    expect(e2.cells).toContain('2,2');   // remembered
    expect(e2.cells).toContain('10,2');  // newly seen
    // Rejoin: explored comes back with the join payload
    seren.close();
    const { socket: again, join } = await playerFor(roomId, 'Seren');
    expect(join.explored.Seren).toContain('2,2');
    again.close(); dm.close();
  });

  test('player can only open a door beside their character', async () => {
    const { roomId, dm } = await dmFor('Door Test');
    const { socket: seren } = await playerFor(roomId, 'Seren');
    await emitAck(dm, 'token:create', { name: 'Seren', owner: 'Seren', x: 0, y: 0 });
    const door = (await emitAck(dm, 'wall:create', { x1: 8, y1: 0, x2: 8, y2: 1, isDoor: true })).wall;
    const far = await emitAck(seren, 'door:toggle', { id: door.id });
    expect(far.error).toMatch(/next to the door/i);
    const token = (await new Promise(res => {
      const s = connect();
      s.on('connect', () => s.emit('room:join', { roomId, name: 'Probe' }, (r) => { res(r.state.tokens); s.close(); }));
    }))[0];
    await emitAck(dm, 'token:move', { id: token.id, x: 7, y: 0 });
    const near = await emitAck(seren, 'door:toggle', { id: door.id });
    expect(near.ok).toBe(true);
    expect(near.wall.doorOpen).toBe(true);
    dm.close(); seren.close();
  });
});

describe('cast', () => {
  test('character sheet notes persist across placements and scenes', async () => {
    const { dm } = await dmFor('Cast Test');
    const c = await emitAck(dm, 'char:create', {
      name: 'Ismark', kind: 'npc', emoji: '🧔', notes: 'Gruff accent, grieving', hp: 30, maxHp: 30,
    });
    expect(c.character.notes).toBe('Gruff accent, grieving');
    const placed = await emitAck(dm, 'char:place', { characterId: c.character.id, x: 2, y: 2 });
    expect(placed.token.characterId).toBe(c.character.id);
    expect(placed.token.name).toBe('Ismark');
    expect(placed.token.emoji).toBe('🧔');
    // HP damage on the token flows back to the sheet
    await emitAck(dm, 'token:update', { id: placed.token.id, hp: 12 });
    // Rename on the sheet flows to the token
    const seenUpdate = once(dm, 'token:updated');
    const upd = await emitAck(dm, 'char:update', { id: c.character.id, name: 'Ismark Kolyanovich', notes: 'Gruff accent; secretly hopeful' });
    expect(upd.character.hp).toBe(12);
    expect((await seenUpdate).name).toBe('Ismark Kolyanovich');
    // Place him on a second scene too — same sheet
    const s2 = await emitAck(dm, 'scene:create', { name: 'Village' });
    const placed2 = await emitAck(dm, 'char:place', { characterId: c.character.id, x: 0, y: 0 });
    expect(placed2.token.sceneId).toBe(s2.scene.id);
    expect(placed2.token.name).toBe('Ismark Kolyanovich');
    dm.close();
  });

  test('save token as character, players never receive cast data', async () => {
    const { roomId, dm } = await dmFor('SaveAs Test');
    const { socket: seren, join } = await playerFor(roomId, 'Seren');
    expect(join.characters).toEqual([]);
    let leaked = false;
    seren.once('char:created', () => { leaked = true; });
    const t = await emitAck(dm, 'token:create', { name: 'Morgantha', x: 1, y: 1 });
    const saved = await emitAck(dm, 'token:save-as-character', { tokenId: t.token.id });
    expect(saved.character.name).toBe('Morgantha');
    expect(saved.token.characterId).toBe(saved.character.id);
    await new Promise(r => setTimeout(r, 100));
    expect(leaked).toBe(false);
    dm.close(); seren.close();
  });
});

describe('quest files', () => {
  test('v2 export/import carries scenes, cast, library, calibration', async () => {
    const { roomId, dmSecret, dm } = await dmFor('Campaign');
    const up = await uploadTiny();
    await emitAck(dm, 'asset:create', { kind: 'handout', name: 'Gates', url: up.url });
    const mapAsset = (await emitAck(dm, 'asset:create', { kind: 'map', name: 'Barovia', url: up.url })).asset;
    await emitAck(dm, 'map:config', { mapImageUrl: up.url, gridType: 'free', feetPerCell: 1320, gridSize: 80 });
    await emitAck(dm, 'token:create', { name: 'Strahd', x: 3, y: 4, hp: 144, maxHp: 144, ac: 16 });
    await emitAck(dm, 'wall:create', { x1: 0, y1: 0, x2: 5, y2: 0 });
    await emitAck(dm, 'char:create', { name: 'Ireena', kind: 'npc', notes: 'Soft-spoken, brave' });
    await emitAck(dm, 'scene:create', { name: 'Death House', assetId: mapAsset.id });
    await emitAck(dm, 'token:create', { name: 'Ghost', x: 1, y: 1 });
    // A player has explored part of Death House
    await emitAck(dm, 'map:config', { gridType: 'square' });
    await emitAck(dm, 'token:create', { name: 'Seren', owner: 'Seren', x: 4, y: 4, sightRadius: 2 });
    dm.close();

    const quest = await (await fetch(`${baseUrl}/api/rooms/${roomId}/export?secret=${dmSecret}`)).json();
    expect(quest.version).toBe(2);
    expect(quest.scenes).toHaveLength(2);
    expect(quest.scenes[0].tokens).toHaveLength(1);
    expect(quest.scenes[0].walls).toHaveLength(1);
    expect(quest.scenes[0].grid_type).toBe('free');
    expect(quest.scenes[0].feet_per_cell).toBe(1320);
    expect(quest.scenes[1].name).toBe('Death House');
    expect(quest.scenes[1].explored.Seren).toContain('4,4');
    expect(quest.characters).toHaveLength(1);
    expect(quest.assets).toHaveLength(2);
    expect(quest.assets.every(a => a.dataUrl?.startsWith('data:image/png'))).toBe(true);
    expect(quest.assets.find(a => a.kind === 'map').grid.feetPerCell).toBe(1320);

    const bad = await fetch(`${baseUrl}/api/rooms/${roomId}/export?secret=nope`);
    expect(bad.status).toBe(403);

    const roomB = await call('POST', '/api/rooms', { name: 'Target' });
    const imp = await fetch(`${baseUrl}/api/rooms/${roomB.id}/import`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: roomB.dmSecret, data: quest }),
    });
    expect(imp.ok).toBe(true);
    const dm2 = connect();
    await once(dm2, 'connect');
    const join = await emitAck(dm2, 'room:join', { roomId: roomB.id, name: 'GM', asDm: true, dmSecret: roomB.dmSecret });
    expect(join.state.scenes).toHaveLength(2);
    expect(join.state.scenes[1].name).toBe('Death House');
    expect(join.characters).toHaveLength(1);
    expect(join.characters[0].notes).toBe('Soft-spoken, brave');
    // The DM was on Death House when they saved, so that's where they land.
    expect(join.state.room.scene_name).toBe('Death House');
    expect(join.state.tokens.map(t => t.name).sort()).toEqual(['Ghost', 'Seren']);
    // …and Seren's memory of Death House came back with the file.
    expect(join.explored.Seren).toContain('4,4');
    const back = once(dm2, 'scene:enter');
    await emitAck(dm2, 'scene:switch', { sceneId: join.state.scenes[0].id });
    const first = await back;
    expect(first.state.room.grid_type).toBe('free');
    expect(first.state.tokens[0].name).toBe('Strahd');
    expect(first.state.tokens[0].hp).toBe(144);
    expect(first.state.assets.map(a => a.kind).sort()).toEqual(['handout', 'map']);
    dm2.close();
  });

  test('v1 quest files still import as a single scene', async () => {
    const roomB = await call('POST', '/api/rooms', { name: 'Legacy' });
    const v1 = {
      version: 1, kind: 'questhub-quest', name: 'Old',
      grid: { grid_size: 70, grid_w: 10, grid_h: 10, offset_x: 0, offset_y: 0 },
      mapImageDataUrl: null,
      walls: [{ x1: 0, y1: 0, x2: 2, y2: 0, isDoor: false, doorOpen: false }],
      tokens: [{ name: 'Wolf', x: 1, y: 1, owner: 'dm', color: '#fff', sightRadius: 6, visibleToPlayers: true }],
      assets: [],
    };
    const imp = await fetch(`${baseUrl}/api/rooms/${roomB.id}/import`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: roomB.dmSecret, data: v1 }),
    });
    expect(imp.ok).toBe(true);
    const dm = connect();
    await once(dm, 'connect');
    const join = await emitAck(dm, 'room:join', { roomId: roomB.id, name: 'GM', asDm: true, dmSecret: roomB.dmSecret });
    expect(join.state.room.grid_size).toBe(70);
    expect(join.state.tokens[0].name).toBe('Wolf');
    dm.close();
  });
});
