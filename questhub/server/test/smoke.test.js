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

// Resolve with the first chat message matching `re` (ignores unrelated system lines).
function waitChat(socket, re) {
  return new Promise((resolve) => {
    const h = (m) => { if (re.test(m.text)) { socket.off('chat:message', h); resolve(m); } };
    socket.on('chat:message', h);
  });
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
    const chat = waitChat(dm, /attacks Wolf/);
    const res = await emitAck(seren, 'attack', { targetId: wolf.id });
    expect(res.ok).toBe(true);
    expect(res.roll).toBeGreaterThanOrEqual(1);
    expect(typeof res.hit).toBe('boolean');
    expect((await fx).kind).toBe('slash');
    const msg = await chat;
    expect(msg.text).toMatch(/Seren attacks Wolf: d20 \d+ — (HIT|miss)/);
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

  test('DM attacks with a named token; 0 HP announces and leaves initiative', async () => {
    const { roomId, dm } = await dmFor('DM Attack');
    const { socket: seren } = await playerFor(roomId, 'Seren');
    const s = (await emitAck(dm, 'token:create', { name: 'Seren', owner: 'Seren', x: 2, y: 2, ac: 14, hp: 12, maxHp: 12 })).token;
    const w = (await emitAck(dm, 'token:create', { name: 'Wolf', x: 9, y: 9, hp: 11, maxHp: 11 })).token;
    const self = await emitAck(dm, 'attack', { targetId: w.id, attackerId: w.id });
    expect(self.error).toMatch(/cannot attack itself/i);
    const chat = waitChat(seren, /attacks Seren/);
    const res = await emitAck(dm, 'attack', { targetId: s.id, attackerId: w.id }); // range doesn't matter for the DM
    expect(res.ok).toBe(true);
    expect((await chat).text).toMatch(/Wolf attacks Seren: d20 \d+ — (HIT|miss)/);
    // Down at 0 HP
    await emitAck(dm, 'init:roll', { tokenIds: [s.id, w.id] });
    const downMsg = new Promise(res => seren.on('chat:message', m => { if (/is down/.test(m.text)) res(m); }));
    const initUpd = once(dm, 'init:updated');
    await emitAck(dm, 'token:update', { id: w.id, hp: 0 });
    expect((await downMsg).text).toMatch(/Wolf is down/);
    const init = await initUpd;
    expect(init.order.map(e => e.tokenId)).toEqual([s.id]);
    dm.close(); seren.close();
  });

  test('hold freezes player actions; interrupt snaps a walker; approve-to a route step', async () => {
    const { roomId, dm } = await dmFor('Hold Test');
    const { socket: seren, join: sj } = await playerFor(roomId, 'Seren');
    expect(sj.paused).toBe(false);
    const s = (await emitAck(dm, 'token:create', { name: 'Seren', owner: 'Seren', x: 2, y: 2 })).token;
    const held = once(seren, 'hold:updated');
    const h = await emitAck(dm, 'hold:toggle', {});
    expect(h.paused).toBe(true);
    expect((await held).paused).toBe(true);
    const blocked = await emitAck(seren, 'move:propose', { tokenId: s.id, path: [{ x: 3, y: 2 }] });
    expect(blocked.error).toMatch(/hold on/i);
    // DM snaps the walker mid-route
    const snapped = once(seren, 'token:moved');
    await emitAck(dm, 'move:interrupt', { tokenId: s.id, x: 4, y: 2 });
    const m = await snapped;
    expect(m.animate).toBe(false);
    expect(m.x).toBe(4);
    await emitAck(dm, 'hold:toggle', {});
    // Approve only up to step 2 of a 4-step route (the DM clicked on the route)
    const prop = await emitAck(seren, 'move:propose', { tokenId: s.id, path: [{ x: 5, y: 2 }, { x: 6, y: 2 }, { x: 7, y: 2 }, { x: 8, y: 2 }] });
    expect(prop.ok).toBe(true);
    const approved = once(seren, 'move:approved');
    await emitAck(dm, 'move:approve', { proposalId: prop.proposal.id, stopAtIndex: 1 });
    const a = await approved;
    expect(a.path).toEqual([{ x: 5, y: 2 }, { x: 6, y: 2 }]);
    expect(a.interrupted).toBe(true);
    dm.close(); seren.close();
  });

  test('sheets: player edits own sheet only, notes never leak, HP mirrors to token', async () => {
    const { roomId, dm } = await dmFor('Sheet Test');
    const { socket: seren, join: sj } = await playerFor(roomId, 'Seren');
    const { socket: mira } = await playerFor(roomId, 'Mira');
    const ch = (await emitAck(dm, 'char:create', {
      name: 'Seren', kind: 'pc', owner: 'Seren', hp: 12, maxHp: 12, notes: 'SECRET: is secretly a Vistani spy',
      sheet: { level: 3, abilities: { STR: 10, DEX: 16, CON: 14, INT: 12, WIS: 13, CHA: 8 }, skillProfs: ['Stealth'], attacks: [{ id: 'r', name: 'Rapier', dice: '1d8', ability: 'finesse' }] },
    })).character;
    const tok = (await emitAck(dm, 'char:place', { characterId: ch.id, x: 2, y: 2 })).token;
    // Join payload for the owner carries the sheet without notes
    const { socket: seren2, join: sj2 } = await playerFor(roomId, 'Seren');
    expect(sj2.mySheets).toHaveLength(1);
    expect(sj2.mySheets[0].notes).toBeUndefined();
    expect(sj2.mySheets[0].sheet.abilities.DEX).toBe(16);
    seren2.close();
    // Derived AC/initiative/reach landed on the token when placed from a sheet with abilities
    const placedTok = (await new Promise(res => { const s = connect(); s.on('connect', () => s.emit('room:join', { roomId, name: 'Probe' }, r => { res(r.state.tokens); s.close(); })); })).find(t => t.id === tok.id);
    expect(placedTok.initBonus).toBe(0); // not yet synced: place copies the row; sheet:update below syncs
    // Another player cannot touch it
    const denied = await emitAck(mira, 'sheet:update', { characterId: ch.id, patch: { hp: 1 } });
    expect(denied.error).toMatch(/not your character/i);
    // Owner takes damage on the sheet → token follows, floor at 0, ceiling at max
    const upd = once(dm, 'token:updated');
    const r1 = await emitAck(seren, 'sheet:update', { characterId: ch.id, patch: { hp: 7 } });
    expect(r1.ok).toBe(true);
    expect((await upd).hp).toBe(7);
    const r2 = await emitAck(seren, 'sheet:update', { characterId: ch.id, patch: { hp: 99 } });
    expect(r2.character.hp).toBe(12);
    // Owner can't write DM-only fields; they are silently ignored
    const r3 = await emitAck(seren, 'sheet:update', { characterId: ch.id, patch: { notes: 'hacked', owner: 'Mira', tempHp: 5 } });
    expect(r3.character.notes).toBeUndefined();
    expect(r3.character.owner).toBe('Seren');
    expect(r3.character.sheet.tempHp).toBe(5);
    const dmView = (await emitAck(dm, 'char:update', { id: ch.id })).character;
    expect(dmView.notes).toBe('SECRET: is secretly a Vistani spy');
    // Temporary DEX bonus → derived AC and initiative reach the token
    const synced = once(dm, 'token:updated');
    await emitAck(seren, 'sheet:update', { characterId: ch.id, patch: { tempBonuses: { DEX: 2 } } });
    const t2 = await synced;
    expect(t2.ac).toBe(10 + 4);
    expect(t2.initBonus).toBe(4);
    dm.close(); seren.close(); mira.close();
  });

  test('attacks with a sheet weapon roll damage, eat temp HP first, and can drop a creature', async () => {
    const { roomId, dm } = await dmFor('Damage Test');
    const { socket: seren } = await playerFor(roomId, 'Seren');
    const ch = (await emitAck(dm, 'char:create', {
      name: 'Seren', kind: 'pc', owner: 'Seren', hp: 12, maxHp: 12,
      sheet: { level: 5, abilities: { STR: 10, DEX: 16, CON: 14, INT: 12, WIS: 13, CHA: 8 },
        attacks: [{ id: 'r', name: 'Rapier', dice: '1d8', ability: 'finesse', magic: 1 }], tempHp: 4 },
    })).character;
    const serenTok = (await emitAck(dm, 'char:place', { characterId: ch.id, x: 2, y: 2 })).token;
    // A wolf with AC 0 so every swing hits; 5 HP so a rapier (1d8+4 ≥ 5) always drops it
    const wolf = (await emitAck(dm, 'token:create', { name: 'Wolf', x: 3, y: 2, ac: 0, hp: 5, maxHp: 5, attackSpec: { name: 'Bite', toHit: 4, damage: '2d4+2' } })).token;
    const chat = waitChat(seren, /attacks Wolf/);
    const res = await emitAck(seren, 'attack', { targetId: wolf.id });
    expect(res.ok).toBe(true);
    expect(res.hit).toBe(true);
    expect(res.damage).toBeGreaterThanOrEqual(5);
    expect((await chat).text).toMatch(/Seren attacks Wolf with Rapier: d20 \d+\+7 = \d+ — HIT! 🎯 for \d+ damage/);
    const wolfNow = (await new Promise(res => { const s = connect(); s.on('connect', () => s.emit('room:join', { roomId, name: 'Probe' }, r => { res(r.state.tokens); s.close(); })); })).find(t => t.id === wolf.id);
    expect(wolfNow.hp).toBe(0);
    // Wolf (DM attack tool) bites Seren: temp HP absorbs first
    await emitAck(dm, 'token:update', { id: wolf.id, hp: 5 });
    await emitAck(dm, 'token:update', { id: serenTok.id, ac: 0 });
    const r2 = await emitAck(dm, 'attack', { targetId: serenTok.id, attackerId: wolf.id });
    expect(r2.hit).toBe(true);
    expect(r2.damage).toBeGreaterThanOrEqual(4);
    const after = (await emitAck(dm, 'char:update', { id: ch.id })).character;
    expect(after.sheet.tempHp).toBe(0);
    expect(after.hp).toBe(12 - Math.max(0, r2.damage - 4));
    dm.close(); seren.close();
  });

  test('rests and the end-of-session checklist', async () => {
    const { roomId, dm } = await dmFor('Rest Test');
    const { socket: seren } = await playerFor(roomId, 'Seren');
    const ch = (await emitAck(dm, 'char:create', {
      name: 'Seren', kind: 'pc', owner: 'Seren', hp: 5, maxHp: 12,
      sheet: {
        slots: { 1: { max: 4, used: 3 } }, tempHp: 2, conditions: ['Poisoned'],
        inventory: [{ id: 'a', name: 'Rope', qty: 1 }, { id: 'b', name: 'Torch', qty: 3 }], money: { gp: 10, sp: 0, cp: 0 },
        ddbSnapshot: { hp: 12, slots: { 1: { max: 4, used: 0 } }, inventory: [{ name: 'Torch', qty: 5 }], money: { gp: 12, sp: 0, cp: 0 }, xp: 0 },
      },
    })).character;
    const summary = await emitAck(dm, 'session:end', {});
    const lines = summary.summary.find(c => c.name === 'Seren').lines;
    expect(lines).toContain('HP: 12 → 5 / 12');
    expect(lines).toContain('Level 1 spell slots used: 0 → 3');
    expect(lines).toContain('New item: Rope');
    expect(lines).toContain('Torch: 5 → 3');
    expect(lines).toContain('GP: 12 → 10');
    expect(lines).toContain('Conditions: Poisoned');
    // Players get the checklist too
    const gotSummary = once(seren, 'session:summary');
    await emitAck(dm, 'session:end', {});
    expect((await gotSummary).summary[0].lines.length).toBeGreaterThan(0);
    // Long rest restores everything
    const rested = await (async () => { const p = once(dm, 'char:updated'); await emitAck(seren, 'rest', { characterId: ch.id, kind: 'long' }); return p; })();
    expect(rested.hp).toBe(12);
    expect(rested.sheet.slots[1].used).toBe(0);
    expect(rested.sheet.tempHp).toBe(0);
    expect(rested.sheet.conditions).toEqual([]);
    dm.close(); seren.close();
  });

  test('re-syncing from D&D Beyond after a level-up keeps what happened at the table', async () => {
    const { roomId, dm } = await dmFor('Resync Test');
    const ch = (await emitAck(dm, 'char:create', { name: 'Seren', kind: 'pc', owner: 'Seren' })).character;
    const v1 = {
      name: 'Seren', level: 4, classes: [{ name: 'Rogue', level: 4 }], hp: { current: 30, max: 30, temp: 0 }, ac: 15, speed: 30,
      senses: { darkvision: 60 }, abilities: { STR: 10, DEX: 16, CON: 14, INT: 12, WIS: 13, CHA: 8 }, initBonus: 3, proficiency: 2,
      slots: { 1: { max: 3, used: 0 } }, inventory: [{ id: 'x', name: 'Rapier', qty: 1 }], spells: [], attacks: [{ id: 'x', name: 'Rapier', dice: '1d8', ability: 'finesse', reach: 5 }],
      money: { gp: 0, sp: 0, cp: 0 }, xp: 2700, armour: { base: 12, maxDex: null, shield: 0, bonus: 0 }, skillProfs: [], expertise: [], saveProfs: [],
    };
    const first = await emitAck(dm, 'char:ddb-link', { characterId: ch.id, ddbId: '1', manualData: v1 });
    expect(first.ok).toBe(true);
    expect(first.character.maxHp).toBe(30);
    // Play happens: damage, a slot spent, loot found
    await emitAck(dm, 'sheet:update', { characterId: ch.id, patch: { hp: 18, slots: { 1: { max: 3, used: 2 } }, inventory: [...first.character.sheet.inventory, { id: 'loot', name: 'Silver dagger', qty: 1 }] } });
    // Level up on DDB: more HP, a 2nd-level slot, new proficiency
    const v2 = { ...v1, level: 5, classes: [{ name: 'Rogue', level: 5 }], hp: { current: 38, max: 38, temp: 0 }, proficiency: 3,
      slots: { 1: { max: 4, used: 0 }, 2: { max: 2, used: 0 } }, skillProfs: ['Animal Handling'] };
    const second = await emitAck(dm, 'char:ddb-link', { characterId: ch.id, manualData: v2 });
    const c2 = second.character;
    expect(c2.maxHp).toBe(38);
    expect(c2.hp).toBe(38 - 12);                       // damage taken carried over
    expect(c2.sheet.slots[1]).toEqual({ max: 4, used: 2 }); // slot usage kept, new max
    expect(c2.sheet.slots[2]).toEqual({ max: 2, used: 0 });
    expect(c2.sheet.inventory.some(i => i.name === 'Silver dagger')).toBe(true); // table loot kept
    expect(c2.sheet.skillProfs).toEqual(['Animal Handling']);
    expect(c2.initBonus).toBe(3);
    dm.close();
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
