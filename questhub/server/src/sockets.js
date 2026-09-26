import { nanoid } from 'nanoid';
import { rollDice, formatRoll } from '@questhub/shared/dice';
import { measureMoveFeet, formatFeet } from '@questhub/shared/measure';
import {
  getRoom, getScene, getSceneState, verifyDm, setDmScene,
  createScene, updateScene, deleteScene, listScenes, playerSceneFor,
  createToken, updateToken, deleteToken, getToken, moveTokenToScene, placeCharacter,
  createWall, getWall, deleteWall, toggleDoor,
  createAsset, deleteAsset, getAsset, updateAssetGrid,
  createCharacter, updateCharacter, deleteCharacter, listCharacters, getCharacter,
} from './rooms.js';
import { fetchDdbCharacter } from './dndbeyond.js';
import { detectGrid } from './gridDetect.js';
import { uploadPath } from './uploads.js';
import { getExplored, resetExplored, updateExplored } from './fog.js';
import { getDb } from './db.js';

// In-memory transient state, keyed by roomId.
const sessions = new Map(); // roomId -> { proposals: Map(id -> proposal), chat: [], initiative }

function getSession(roomId) {
  let s = sessions.get(roomId);
  if (!s) {
    s = { proposals: new Map(), chat: [], initiative: null, paused: false };
    sessions.set(roomId, s);
  }
  return s;
}

// While the DM holds the action, players' game actions are refused.
function holdGate(session, socket) {
  return socket.data.role !== 'dm' && session.paused ? 'Hold on — the DM has paused the action' : null;
}

function pushChat(roomId, msg) {
  const s = getSession(roomId);
  s.chat.push(msg);
  if (s.chat.length > 200) s.chat.splice(0, s.chat.length - 200);
}

// ---- Turn economy (5e-lite): during combat a player may act only on their
// token's turn, move up to its speed, and either attack (up to `attacks`
// times) or cast once. The DM is never restricted.
const freshTurn = () => ({ movedFt: 0, actionUsed: false, attacksUsed: 0 });

function currentEntry(session) {
  const init = session.initiative;
  return init && init.order.length ? init.order[init.turn] : null;
}

// Returns an error string if `token` may not act now for this socket, else null.
function turnGate(session, socket, token) {
  if (socket.data.role === 'dm') return null;
  const init = session.initiative;
  if (!init || init.order.length === 0) return null; // no combat: free exploration
  const cur = currentEntry(session);
  const inCombat = init.order.some(e => e.tokenId === token.id);
  if (!inCombat) return null; // not a combatant (e.g. a scene-side NPC) — unrestricted
  if (cur.tokenId !== token.id) return `Not your turn — it's ${cur.name}'s`;
  return null;
}

function advanceTurn(session) {
  const init = session.initiative;
  if (!init || init.order.length === 0) return;
  init.turn = (init.turn + 1) % init.order.length;
  if (init.turn === 0) init.round += 1;
  init.turnState = freshTurn();
}

function rollEntry(token) {
  return { tokenId: token.id, name: token.name, emoji: token.emoji || null, color: token.color, owner: token.owner, roll: 1 + Math.floor(Math.random() * 20) };
}

function roomPresence(io, roomId, { excludeId } = {}) {
  const list = [];
  for (const [id, s] of io.sockets.sockets) {
    if (s.data?.roomId !== roomId || id === excludeId) continue;
    list.push({ socketId: id, name: s.data.name, role: s.data.role, sceneId: s.data.sceneId });
  }
  return list;
}

// Socket.io room for "everyone looking at this scene".
const sceneRoom = (roomId, sceneId) => `${roomId}#${sceneId}`;
const emitScene = (io, roomId, sceneId, event, payload) =>
  io.to(sceneRoom(roomId, sceneId)).emit(event, payload);

function emitDm(io, roomId, event, payload) {
  for (const [, s] of io.sockets.sockets) {
    if (s.data?.roomId === roomId && s.data.role === 'dm') s.emit(event, payload);
  }
}

// Recompute player vision in a scene after anything that can change it and
// push the grown "explored" sets to that scene's viewers.
function refreshFog(io, roomId, sceneId) {
  if (!sceneId) return;
  const changed = updateExplored(roomId, sceneId);
  for (const [owner, cells] of Object.entries(changed)) {
    emitScene(io, roomId, sceneId, 'fog:explored', { owner, cells });
  }
}

function cellCenterPx(room, t) {
  return {
    x: (room.offset_x || 0) + (t.x + 0.5) * room.grid_size,
    y: (room.offset_y || 0) + (t.y + 0.5) * room.grid_size,
  };
}

// Dramatic entrance: an effect at the token plus a chat line if players are watching.
function announceAppearance(io, roomId, token) {
  const state = getSceneState(roomId, token.sceneId);
  if (!state) return;
  emitScene(io, roomId, token.sceneId, 'spell:effect', {
    id: nanoid(8), kind: 'appear', to: cellCenterPx(state.room, token), by: 'DM', ts: Date.now(),
  });
  const playersWatching = roomPresence(io, roomId).some(p => p.role === 'player' && p.sceneId === token.sceneId);
  if (playersWatching && token.owner === 'dm') {
    broadcastSystem(io, roomId, `${token.emoji ? token.emoji + ' ' : ''}${token.name} appears!`);
  }
}

// Move a socket's view to a scene and send it everything it needs to render.
function enterScene(io, socket, sceneId) {
  const roomId = socket.data.roomId;
  if (socket.data.sceneId) socket.leave(sceneRoom(roomId, socket.data.sceneId));
  socket.data.sceneId = sceneId;
  socket.join(sceneRoom(roomId, sceneId));
  const state = getSceneState(roomId, sceneId);
  socket.emit('scene:enter', { state, explored: getExplored(roomId, sceneId) });
  io.to(roomId).emit('presence:updated', roomPresence(io, roomId));
}

// Players follow their character: after anything that moves tokens between
// scenes (or changes ownership) make sure each player is viewing the right map.
function syncPlayers(io, roomId) {
  for (const [, s] of io.sockets.sockets) {
    if (s.data?.roomId !== roomId || s.data.role !== 'player') continue;
    const desired = playerSceneFor(roomId, s.data.name, s.id);
    if (desired && desired !== s.data.sceneId) enterScene(io, s, desired);
  }
}

// After a quest import every viewer re-enters the scene they should be on.
export function resyncRoom(io, roomId) {
  const room = getRoom(roomId);
  if (!room) return;
  for (const [, s] of io.sockets.sockets) {
    if (s.data?.roomId !== roomId) continue;
    const target = s.data.role === 'dm' ? room.dm_scene_id : playerSceneFor(roomId, s.data.name, s.id);
    enterScene(io, s, target);
    if (s.data.role === 'dm') s.emit('chars:updated', listCharacters(roomId));
  }
  io.to(roomId).emit('scenes:updated', listScenes(roomId));
}

export function attachSockets(io) {
  io.on('connection', (socket) => {
    socket.data = { roomId: null, sceneId: null, role: null, name: 'Guest', id: socket.id };

    socket.on('room:join', ({ roomId, name, asDm, dmSecret }, cb) => {
      try {
        const room = getRoom(roomId);
        if (!room) return cb?.({ error: 'Room not found' });
        let role = 'player';
        if (asDm) {
          if (!verifyDm(roomId, dmSecret)) return cb?.({ error: 'Invalid DM secret' });
          role = 'dm';
        }
        socket.join(roomId);
        socket.data.roomId = roomId;
        socket.data.role = role;
        socket.data.name = (name || '').trim().slice(0, 32) || (role === 'dm' ? 'DM' : 'Guest');
        const sceneId = role === 'dm'
          ? room.dm_scene_id
          : playerSceneFor(roomId, socket.data.name, socket.id);
        socket.data.sceneId = sceneId;
        socket.join(sceneRoom(roomId, sceneId));
        // Same person in a second tab (or a quick refresh) shouldn't spam chat.
        const alreadyHere = roomPresence(io, roomId, { excludeId: socket.id })
          .some(p => p.name === socket.data.name && p.role === role);
        const state = getSceneState(roomId, sceneId);
        const session = getSession(roomId);
        cb?.({
          ok: true,
          role,
          you: { id: socket.id, name: socket.data.name },
          state,
          chat: session.chat.slice(-50),
          proposals: Array.from(session.proposals.values()),
          initiative: session.initiative,
          presence: roomPresence(io, roomId),
          explored: getExplored(roomId, sceneId),
          characters: role === 'dm' ? listCharacters(roomId) : [],
          paused: session.paused,
        });
        if (!alreadyHere) broadcastSystem(io, roomId, `${socket.data.name} joined as ${role}`);
        io.to(roomId).emit('presence:updated', roomPresence(io, roomId));
      } catch (e) {
        cb?.({ error: e.message });
      }
    });

    socket.on('disconnect', () => {
      if (socket.data.roomId) {
        const remaining = roomPresence(io, socket.data.roomId, { excludeId: socket.id });
        const stillHere = remaining.some(p => p.name === socket.data.name && p.role === socket.data.role);
        if (!stillHere) broadcastSystem(io, socket.data.roomId, `${socket.data.name} left`);
        io.to(socket.data.roomId).emit('presence:updated', remaining);
      }
    });

    // ---- DM-only events ----
    const dmOnly = (fn) => (...args) => {
      const cb = typeof args[args.length - 1] === 'function' ? args[args.length - 1] : null;
      if (socket.data.role !== 'dm') return cb?.({ error: 'DM only' });
      return fn(...args);
    };
    const R = () => socket.data.roomId;
    const S = () => socket.data.sceneId;

    // ---- Scenes ----

    socket.on('scene:create', dmOnly(({ name, assetId } = {}, cb) => {
      const fields = { name: name || 'New scene' };
      if (assetId) {
        const asset = getAsset(assetId);
        if (asset) {
          fields.map_image_url = asset.url;
          if (!fields.name || fields.name === 'New scene') fields.name = asset.name;
          if (asset.grid) {
            fields.grid_size = asset.grid.gridSize; fields.grid_w = asset.grid.gridW; fields.grid_h = asset.grid.gridH;
            fields.offset_x = asset.grid.offsetX; fields.offset_y = asset.grid.offsetY;
            fields.feet_per_cell = asset.grid.feetPerCell ?? 5; fields.grid_type = asset.grid.gridType ?? 'square';
          }
        }
      }
      const scene = createScene(R(), fields);
      setDmScene(R(), scene.id);
      enterScene(io, socket, scene.id);
      io.to(R()).emit('scenes:updated', listScenes(R()));
      syncPlayers(io, R());
      cb?.({ ok: true, scene: { id: scene.id, name: scene.name, needsGrid: !!assetId && !getAsset(assetId)?.grid } });
    }));

    socket.on('scene:switch', dmOnly(({ sceneId }, cb) => {
      const scene = getScene(sceneId);
      if (!scene || scene.room_id !== R()) return cb?.({ error: 'Scene not found' });
      setDmScene(R(), sceneId);
      enterScene(io, socket, sceneId);
      syncPlayers(io, R());
      cb?.({ ok: true });
    }));

    socket.on('scene:rename', dmOnly(({ sceneId, name }, cb) => {
      const scene = getScene(sceneId);
      if (!scene || scene.room_id !== R()) return cb?.({ error: 'Scene not found' });
      updateScene(sceneId, { name: String(name || '').slice(0, 60) || scene.name });
      io.to(R()).emit('scenes:updated', listScenes(R()));
      emitScene(io, R(), sceneId, 'map:updated', getSceneState(R(), sceneId).room);
      cb?.({ ok: true });
    }));

    socket.on('scene:delete', dmOnly(({ sceneId }, cb) => {
      const scene = getScene(sceneId);
      if (!scene || scene.room_id !== R()) return cb?.({ error: 'Scene not found' });
      if (!deleteScene(R(), sceneId)) return cb?.({ error: 'Cannot delete the only scene' });
      const room = getRoom(R());
      for (const [, s] of io.sockets.sockets) {
        if (s.data?.roomId === R() && s.data.sceneId === sceneId) enterScene(io, s, room.dm_scene_id);
      }
      io.to(R()).emit('scenes:updated', listScenes(R()));
      syncPlayers(io, R());
      cb?.({ ok: true });
    }));

    // ---- Map / grid (applies to the scene the DM is looking at) ----

    socket.on('map:config', dmOnly((cfg, cb) => {
      const fields = {};
      if (cfg.mapImageUrl !== undefined) fields.map_image_url = cfg.mapImageUrl;
      if (cfg.gridSize !== undefined) fields.grid_size = cfg.gridSize;
      if (cfg.gridW !== undefined) fields.grid_w = cfg.gridW;
      if (cfg.gridH !== undefined) fields.grid_h = cfg.gridH;
      if (cfg.offsetX !== undefined) fields.offset_x = cfg.offsetX;
      if (cfg.offsetY !== undefined) fields.offset_y = cfg.offsetY;
      if (cfg.feetPerCell !== undefined) fields.feet_per_cell = cfg.feetPerCell;
      if (cfg.gridType !== undefined) fields.grid_type = cfg.gridType === 'free' ? 'free' : 'square';
      updateScene(S(), fields);
      const state = getSceneState(R(), S());
      emitScene(io, R(), S(), 'map:updated', state.room);
      // Cell coordinates change meaning when the grid geometry changes, so
      // explored memory for this scene starts over.
      const geometryTouched = ['grid_size', 'offset_x', 'offset_y', 'grid_type', 'map_image_url']
        .some(k => k in fields);
      if (geometryTouched) {
        resetExplored(R(), S());
        emitScene(io, R(), S(), 'fog:reset');
        refreshFog(io, R(), S());
      }
      // Remember grid calibration on the matching library asset so it
      // reapplies automatically next time this map is used.
      const gridTouched = ['grid_size', 'grid_w', 'grid_h', 'offset_x', 'offset_y', 'feet_per_cell', 'grid_type']
        .some(k => k in fields);
      if (gridTouched && state.room.map_image_url) {
        const asset = state.assets.find(a => a.kind === 'map' && a.url === state.room.map_image_url);
        if (asset) {
          const updated = updateAssetGrid(asset.id, {
            gridSize: state.room.grid_size, gridW: state.room.grid_w, gridH: state.room.grid_h,
            offsetX: state.room.offset_x, offsetY: state.room.offset_y,
            feetPerCell: state.room.feet_per_cell, gridType: state.room.grid_type,
          });
          io.to(R()).emit('asset:updated', updated);
        }
      }
      if ('map_image_url' in fields) io.to(R()).emit('scenes:updated', listScenes(R()));
      cb?.({ ok: true });
    }));

    socket.on('map:detect-grid', dmOnly(async ({ url }, cb) => {
      try {
        if (!url?.startsWith('/uploads/')) return cb?.({ error: 'Not an uploaded image' });
        const result = await detectGrid(uploadPath(url.slice('/uploads/'.length)));
        cb?.({ ok: true, grid: result });
      } catch (e) {
        cb?.({ error: e.message });
      }
    }));

    // ---- Tokens ----

    socket.on('token:create', dmOnly((t, cb) => {
      const token = createToken(R(), S(), t);
      emitScene(io, R(), S(), 'token:created', token);
      refreshFog(io, R(), S());
      syncPlayers(io, R());
      if (token.visibleToPlayers) announceAppearance(io, R(), token);
      io.to(R()).emit('scenes:updated', listScenes(R()));
      cb?.({ ok: true, token });
    }));

    socket.on('token:update', dmOnly((t, cb) => {
      const before = getToken(t.id);
      if (!before) return cb?.({ error: 'Token not found' });
      const token = updateToken(t.id, t);
      emitScene(io, R(), token.sceneId, 'token:updated', token);
      refreshFog(io, R(), token.sceneId);
      if (before.owner !== token.owner) syncPlayers(io, R());
      // Revealing a hidden token (ambush!) gets the same drama as a new arrival.
      if (!before.visibleToPlayers && token.visibleToPlayers) announceAppearance(io, R(), token);
      // Dropping to 0 HP: announce, and leave the initiative order.
      const wasUp = !(before.maxHp > 0 && before.hp != null && before.hp <= 0);
      const isDown = token.maxHp > 0 && token.hp != null && token.hp <= 0;
      if (wasUp && isDown) {
        broadcastSystem(io, R(), `💀 ${token.emoji ? token.emoji + ' ' : ''}${token.name} is down!`);
        const session = getSession(R());
        if (session.initiative?.order.some(e => e.tokenId === token.id)) {
          const curId = currentEntry(session)?.tokenId;
          session.initiative.order = session.initiative.order.filter(e => e.tokenId !== token.id);
          if (session.initiative.order.length === 0) session.initiative = null;
          else if (curId === token.id) {
            session.initiative.turn = session.initiative.turn % session.initiative.order.length;
            session.initiative.turnState = freshTurn();
          } else {
            session.initiative.turn = Math.max(0, session.initiative.order.findIndex(e => e.tokenId === curId));
          }
          io.to(R()).emit('init:updated', session.initiative);
        }
      } else if (!wasUp && !isDown) {
        broadcastSystem(io, R(), `${token.name} is back on their feet`);
      }
      cb?.({ ok: true, token });
    }));

    socket.on('token:delete', dmOnly(({ id }, cb) => {
      const token = getToken(id);
      if (!token) return cb?.({ ok: true });
      deleteToken(id);
      emitScene(io, R(), token.sceneId, 'token:deleted', { id });
      refreshFog(io, R(), token.sceneId);
      syncPlayers(io, R());
      // A dead combatant leaves the initiative order.
      const session = getSession(R());
      if (session.initiative?.order.some(e => e.tokenId === id)) {
        const curId = currentEntry(session)?.tokenId;
        session.initiative.order = session.initiative.order.filter(e => e.tokenId !== id);
        if (session.initiative.order.length === 0) session.initiative = null;
        else if (curId === id) {
          session.initiative.turn = session.initiative.turn % session.initiative.order.length;
          session.initiative.turnState = freshTurn();
        } else {
          session.initiative.turn = Math.max(0, session.initiative.order.findIndex(e => e.tokenId === curId));
        }
        io.to(R()).emit('init:updated', session.initiative);
      }
      io.to(R()).emit('scenes:updated', listScenes(R()));
      cb?.({ ok: true });
    }));

    socket.on('token:move', dmOnly(({ id, x, y, animate }, cb) => {
      const token = updateToken(id, { x, y });
      if (!token) return cb?.({ error: 'Token not found' });
      emitScene(io, R(), token.sceneId, 'token:moved', { id, x, y, animate: animate !== false });
      refreshFog(io, R(), token.sceneId);
      cb?.({ ok: true, token });
    }));

    // Send a token to another scene (e.g. the party walks into the next map).
    socket.on('token:teleport', dmOnly(({ id, sceneId, x, y }, cb) => {
      const token = getToken(id);
      const target = getScene(sceneId);
      if (!token || !target || target.room_id !== R()) return cb?.({ error: 'Token or scene not found' });
      const from = token.sceneId;
      const moved = moveTokenToScene(id, sceneId, { x: x ?? 1, y: y ?? 1 });
      emitScene(io, R(), from, 'token:deleted', { id });
      emitScene(io, R(), sceneId, 'token:created', moved);
      refreshFog(io, R(), from);
      refreshFog(io, R(), sceneId);
      syncPlayers(io, R());
      if (moved.visibleToPlayers) announceAppearance(io, R(), moved);
      io.to(R()).emit('scenes:updated', listScenes(R()));
      cb?.({ ok: true, token: moved });
    }));

    // ---- Walls & doors ----

    socket.on('wall:create', dmOnly((w, cb) => {
      const wall = createWall(R(), S(), w);
      emitScene(io, R(), S(), 'wall:created', wall);
      refreshFog(io, R(), S());
      cb?.({ ok: true, wall });
    }));

    socket.on('wall:delete', dmOnly(({ id }, cb) => {
      const wall = getWall(id);
      if (!wall) return cb?.({ ok: true });
      deleteWall(id);
      emitScene(io, R(), wall.sceneId, 'wall:deleted', { id });
      refreshFog(io, R(), wall.sceneId);
      cb?.({ ok: true });
    }));

    // Doors: DM always; players only when one of their tokens is beside it.
    socket.on('door:toggle', ({ id }, cb) => {
      if (!R()) return cb?.({ error: 'Not in a room' });
      const door = getWall(id);
      if (!door || !door.isDoor) return cb?.({ error: 'Not a door' });
      if (socket.data.role !== 'dm') {
        const held = holdGate(getSession(R()), socket);
        if (held) return cb?.({ error: held });
        const state = getSceneState(R(), door.sceneId);
        const mid = { x: (door.x1 + door.x2) / 2, y: (door.y1 + door.y2) / 2 };
        const near = state.tokens.some(t =>
          (t.owner === socket.data.name || t.owner === socket.id) &&
          Math.hypot(t.x + 0.5 - mid.x, t.y + 0.5 - mid.y) <= 1.6);
        if (!near) return cb?.({ error: 'Move next to the door first' });
      }
      const wall = toggleDoor(id);
      if (wall) {
        emitScene(io, R(), wall.sceneId, 'wall:updated', wall);
        refreshFog(io, R(), wall.sceneId);
        if (socket.data.role !== 'dm') {
          broadcastSystem(io, R(), `${socket.data.name} ${wall.doorOpen ? 'opens' : 'closes'} a door`);
        }
      }
      cb?.({ ok: true, wall });
    });

    socket.on('fog:reset', dmOnly((_payload, cb) => {
      resetExplored(R(), S());
      emitScene(io, R(), S(), 'fog:reset');
      refreshFog(io, R(), S());
      cb?.({ ok: true });
    }));

    // ---- Library ----

    socket.on('asset:create', dmOnly((a, cb) => {
      if (!a?.url || typeof a.url !== 'string') return cb?.({ error: 'Asset url required' });
      const asset = createAsset(R(), a);
      io.to(R()).emit('asset:created', asset);
      cb?.({ ok: true, asset });
    }));

    socket.on('asset:delete', dmOnly(({ id }, cb) => {
      deleteAsset(id);
      io.to(R()).emit('asset:deleted', { id });
      cb?.({ ok: true });
    }));

    // ---- Cast (characters with persistent sheets) — DM eyes only ----

    socket.on('char:create', dmOnly((c, cb) => {
      const ch = createCharacter(R(), c);
      emitDm(io, R(), 'char:created', ch);
      cb?.({ ok: true, character: ch });
    }));

    socket.on('char:update', dmOnly((c, cb) => {
      const ch = updateCharacter(c.id, c);
      if (!ch) return cb?.({ error: 'Character not found' });
      emitDm(io, R(), 'char:updated', ch);
      // Placed tokens mirror the sheet — refresh them wherever they are.
      const tokens = getDb().prepare('SELECT id FROM tokens WHERE character_id = ?').all(ch.id);
      for (const { id } of tokens) {
        const t = getToken(id);
        emitScene(io, R(), t.sceneId, 'token:updated', t);
        refreshFog(io, R(), t.sceneId);
      }
      syncPlayers(io, R());
      cb?.({ ok: true, character: ch });
    }));

    socket.on('char:delete', dmOnly(({ id }, cb) => {
      deleteCharacter(id);
      emitDm(io, R(), 'char:deleted', { id });
      cb?.({ ok: true });
    }));

    socket.on('char:place', dmOnly(({ characterId, x, y }, cb) => {
      const token = placeCharacter(R(), S(), characterId, { x: x ?? 0, y: y ?? 0 });
      if (!token) return cb?.({ error: 'Character not found' });
      emitScene(io, R(), S(), 'token:created', token);
      refreshFog(io, R(), S());
      syncPlayers(io, R());
      if (token.visibleToPlayers) announceAppearance(io, R(), token);
      io.to(R()).emit('scenes:updated', listScenes(R()));
      cb?.({ ok: true, token });
    }));

    // Promote an ad-hoc token into a cast member with a sheet.
    socket.on('token:save-as-character', dmOnly(({ tokenId, kind }, cb) => {
      const t = getToken(tokenId);
      if (!t) return cb?.({ error: 'Token not found' });
      if (t.characterId && getCharacter(t.characterId)) return cb?.({ ok: true, character: getCharacter(t.characterId) });
      const ch = createCharacter(R(), {
        name: t.name, kind: kind || (t.owner !== 'dm' ? 'pc' : 'npc'), emoji: t.emoji, color: t.color,
        imageUrl: t.imageUrl, owner: t.owner, hp: t.hp, maxHp: t.maxHp, ac: t.ac, sightRadius: t.sightRadius,
      });
      const updated = updateToken(tokenId, { characterId: ch.id });
      emitDm(io, R(), 'char:created', ch);
      emitScene(io, R(), updated.sceneId, 'token:updated', updated);
      cb?.({ ok: true, character: ch, token: updated });
    }));

    // ---- Hold / interrupt ----

    socket.on('hold:toggle', dmOnly((_payload, cb) => {
      const session = getSession(R());
      session.paused = !session.paused;
      io.to(R()).emit('hold:updated', { paused: session.paused });
      broadcastSystem(io, R(), session.paused ? '⏸ Hold! The DM interrupts…' : '▶ Play on');
      cb?.({ ok: true, paused: session.paused });
    }));

    // Stop a walking token where it is right now (the DM's client knows the
    // animation position). Snaps everyone to that spot.
    socket.on('move:interrupt', dmOnly(({ tokenId, x, y }, cb) => {
      const token = updateToken(tokenId, { x, y });
      if (!token) return cb?.({ error: 'Token not found' });
      emitScene(io, R(), token.sceneId, 'token:moved', { id: tokenId, x, y, animate: false });
      refreshFog(io, R(), token.sceneId);
      cb?.({ ok: true, token });
    }));

    // ---- Initiative / combat ----

    socket.on('init:roll', dmOnly(({ tokenIds }, cb) => {
      const session = getSession(R());
      const entries = [];
      for (const tid of tokenIds || []) {
        const t = getToken(tid);
        if (!t) continue;
        entries.push(rollEntry(t));
      }
      if (entries.length === 0) return cb?.({ error: 'No tokens to roll for' });
      entries.sort((a, b) => b.roll - a.roll);
      session.initiative = { order: entries, turn: 0, round: 1, turnState: freshTurn() };
      io.to(R()).emit('init:updated', session.initiative);
      broadcastSystem(io, R(), `⚔️ Combat! Initiative: ${entries.map(e => `${e.name} (${e.roll})`).join(', ')}`);
      cb?.({ ok: true, initiative: session.initiative });
    }));

    // Next turn: the DM always; a player only to end their own token's turn.
    socket.on('init:next', (_payload, cb) => {
      if (!R()) return cb?.({ error: 'Not in a room' });
      const session = getSession(R());
      if (!session.initiative) return cb?.({ error: 'No combat running' });
      const held = holdGate(session, socket);
      if (held) return cb?.({ error: held });
      const cur = currentEntry(session);
      if (socket.data.role !== 'dm' && !(cur && (cur.owner === socket.data.name || cur.owner === socket.id))) {
        return cb?.({ error: "It's not your turn" });
      }
      advanceTurn(session);
      io.to(R()).emit('init:updated', session.initiative);
      cb?.({ ok: true });
    });

    socket.on('init:add', dmOnly(({ tokenId }, cb) => {
      const session = getSession(R());
      const t = getToken(tokenId);
      if (!t) return cb?.({ error: 'Token not found' });
      if (!session.initiative) session.initiative = { order: [], turn: 0, round: 1, turnState: freshTurn() };
      const init = session.initiative;
      if (init.order.some(e => e.tokenId === tokenId)) return cb?.({ ok: true, initiative: init });
      const entry = rollEntry(t);
      // Insert in roll order without disturbing whose turn it is.
      const curId = currentEntry(session)?.tokenId;
      init.order.push(entry);
      init.order.sort((a, b) => b.roll - a.roll);
      init.turn = Math.max(0, init.order.findIndex(e => e.tokenId === curId));
      io.to(R()).emit('init:updated', init);
      broadcastSystem(io, R(), `${t.emoji ? t.emoji + ' ' : ''}${t.name} joins the fight (initiative ${entry.roll})`);
      cb?.({ ok: true, initiative: init });
    }));

    socket.on('init:remove', dmOnly(({ tokenId }, cb) => {
      const session = getSession(R());
      const init = session.initiative;
      if (!init) return cb?.({ ok: true });
      const curId = currentEntry(session)?.tokenId;
      init.order = init.order.filter(e => e.tokenId !== tokenId);
      if (init.order.length === 0) {
        session.initiative = null;
        io.to(R()).emit('init:updated', null);
        return cb?.({ ok: true });
      }
      if (curId === tokenId) {
        init.turn = init.turn % init.order.length;
        init.turnState = freshTurn();
      } else {
        init.turn = Math.max(0, init.order.findIndex(e => e.tokenId === curId));
      }
      io.to(R()).emit('init:updated', init);
      cb?.({ ok: true, initiative: init });
    }));

    socket.on('init:end', dmOnly((_payload, cb) => {
      const session = getSession(R());
      session.initiative = null;
      io.to(R()).emit('init:updated', null);
      broadcastSystem(io, R(), 'Combat ended — explore freely');
      cb?.({ ok: true });
    }));

    socket.on('ddb:link', dmOnly(async ({ tokenId, characterId, manualData }, cb) => {
      try {
        const data = manualData || await fetchDdbCharacter(characterId);
        const t = updateToken(tokenId, {
          ddbCharacterId: characterId || null,
          ddbData: data,
          name: data.name || undefined,
        });
        emitScene(io, R(), t.sceneId, 'token:updated', t);
        cb?.({ ok: true, token: t });
      } catch (e) {
        cb?.({ error: e.message });
      }
    }));

    // ---- Player events ----

    socket.on('move:propose', ({ tokenId, path }, cb) => {
      if (!R()) return cb?.({ error: 'Not in a room' });
      const token = getToken(tokenId);
      if (!token) return cb?.({ error: 'Token not found' });
      if (socket.data.role !== 'dm' && token.owner !== socket.id && token.owner !== socket.data.name) {
        return cb?.({ error: 'You do not own this token' });
      }
      if (!Array.isArray(path) || path.length < 1) return cb?.({ error: 'Path required' });
      const session = getSession(R());
      const held = holdGate(session, socket);
      if (held) return cb?.({ error: held });
      const gate = turnGate(session, socket, token);
      if (gate) return cb?.({ error: gate });
      const scene = getScene(token.sceneId);
      const distFt = measureMoveFeet({
        from: { x: token.x, y: token.y }, path, feetPerCell: scene?.feet_per_cell || 5, gridType: scene?.grid_type,
      });
      if (socket.data.role !== 'dm' && session.initiative?.order.some(e => e.tokenId === token.id)) {
        const left = (token.speed ?? 30) - session.initiative.turnState.movedFt;
        if (distFt > left + 0.01) {
          return cb?.({ error: left <= 0 ? 'No movement left this turn' : `Only ${formatFeet(left)} of movement left this turn` });
        }
      }
      const proposal = {
        id: nanoid(10),
        tokenId,
        sceneId: token.sceneId,
        proposedBy: socket.data.name,
        path: path.slice(0, 50).map(p => ({ x: p.x, y: p.y })),
        distFt,
        createdAt: Date.now(),
      };
      getSession(R()).proposals.set(proposal.id, proposal);
      io.to(R()).emit('move:proposed', proposal);
      cb?.({ ok: true, proposal });
    });

    socket.on('move:approve', dmOnly(({ proposalId, stopAtIndex }, cb) => {
      const session = getSession(R());
      const proposal = session.proposals.get(proposalId);
      if (!proposal) return cb?.({ error: 'Proposal not found' });
      session.proposals.delete(proposalId);
      const path = typeof stopAtIndex === 'number'
        ? proposal.path.slice(0, Math.max(1, stopAtIndex + 1))
        : proposal.path;
      const finalCell = path[path.length - 1];
      const before = getToken(proposal.tokenId);
      const token = updateToken(proposal.tokenId, { x: finalCell.x, y: finalCell.y });
      io.to(R()).emit('move:approved', {
        proposalId,
        tokenId: proposal.tokenId,
        path,
        interrupted: typeof stopAtIndex === 'number',
      });
      // Spend the mover's movement budget for this turn.
      const cur = currentEntry(session);
      if (before && cur && cur.tokenId === proposal.tokenId) {
        const scene = getScene(before.sceneId);
        session.initiative.turnState.movedFt += measureMoveFeet({
          from: { x: before.x, y: before.y }, path, feetPerCell: scene?.feet_per_cell || 5, gridType: scene?.grid_type,
        });
        io.to(R()).emit('init:updated', session.initiative);
      }
      if (token) refreshFog(io, R(), token.sceneId);
      cb?.({ ok: true });
    }));

    socket.on('move:reject', dmOnly(({ proposalId }, cb) => {
      getSession(R()).proposals.delete(proposalId);
      io.to(R()).emit('move:rejected', { proposalId });
      cb?.({ ok: true });
    }));


    // ---- Tap-to-attack: a player clicks an enemy beside their character ----
    socket.on('attack', ({ targetId, attackerId }, cb) => {
      if (!R()) return cb?.({ error: 'Not in a room' });
      const target = getToken(targetId);
      if (!target) return cb?.({ error: 'Target not found' });
      const state = getSceneState(R(), target.sceneId);
      // Players attack with whichever of their tokens is adjacent; the DM
      // names the attacker explicitly (any token, any range).
      const attacker = socket.data.role === 'dm' && attackerId
        ? state.tokens.find(t => t.id === attackerId)
        : state.tokens.find(t =>
          (t.owner === socket.data.name || t.owner === socket.id) &&
          Math.max(Math.abs(t.x - target.x), Math.abs(t.y - target.y)) <= 1.01);
      if (socket.data.role !== 'dm' && !attacker) return cb?.({ error: 'Move next to it to attack' });
      if (socket.data.role === 'dm' && attackerId && !attacker) return cb?.({ error: 'Attacker not on this map' });
      if (attacker && attacker.id === target.id) return cb?.({ error: 'A creature cannot attack itself' });
      const session = getSession(R());
      const held = holdGate(session, socket);
      if (held) return cb?.({ error: held });
      if (attacker) {
        const gate = turnGate(session, socket, attacker);
        if (gate) return cb?.({ error: gate });
        if (socket.data.role !== 'dm' && session.initiative?.order.some(e => e.tokenId === attacker.id)) {
          const ts = session.initiative.turnState;
          if (ts.actionUsed && ts.attacksUsed === 0) return cb?.({ error: 'You already used your action this turn' });
          if (ts.attacksUsed >= (attacker.attacks ?? 1)) return cb?.({ error: 'No attacks left this turn — end your turn' });
          ts.attacksUsed += 1;
          ts.actionUsed = true;
          io.to(R()).emit('init:updated', session.initiative);
        }
      }
      const who = attacker || state.tokens.find(t => t.id !== target.id) || { name: socket.data.name };
      const roll = rollDice('1d20');
      const verdict = target.ac != null
        ? (roll.total >= target.ac ? ' — HIT! 🎯' : ' — miss')
        : '';
      emitScene(io, R(), target.sceneId, 'spell:effect', {
        id: nanoid(8), kind: 'slash', to: cellCenterPx(state.room, target), by: socket.data.name, ts: Date.now(),
      });
      const msg = {
        id: nanoid(10), roomId: R(), from: socket.data.name, type: 'roll',
        text: `⚔️ ${who.name} attacks ${target.name}: ${formatRoll(roll)}${verdict}`, roll, ts: Date.now(),
      };
      pushChat(R(), msg);
      io.to(R()).emit('chat:message', msg);
      cb?.({ ok: true, roll: roll.total, hit: target.ac != null ? roll.total >= target.ac : null });
    });

    // ---- Chat & dice ----

    socket.on('chat:send', ({ text }, cb) => {
      if (!R()) return cb?.({ error: 'Not in a room' });
      const clean = String(text || '').slice(0, 1000).trim();
      if (!clean) return cb?.({ error: 'Empty message' });
      // /r 1d20+5 shortcut
      const m = /^\/(r|roll)\s+(.+)$/i.exec(clean);
      if (m) {
        try {
          const result = rollDice(m[2]);
          const msg = {
            id: nanoid(10), roomId: R(), from: socket.data.name,
            type: 'roll', text: formatRoll(result), roll: result, ts: Date.now(),
          };
          pushChat(R(), msg);
          io.to(R()).emit('chat:message', msg);
          cb?.({ ok: true });
        } catch (e) {
          cb?.({ error: e.message });
        }
        return;
      }
      const msg = { id: nanoid(10), roomId: R(), from: socket.data.name, type: 'chat', text: clean, ts: Date.now() };
      pushChat(R(), msg);
      io.to(R()).emit('chat:message', msg);
      cb?.({ ok: true });
    });

    socket.on('dice:roll', ({ expr, whisperToDm, label }, cb) => {
      if (!R()) return cb?.({ error: 'Not in a room' });
      try {
        const result = rollDice(expr);
        const msg = {
          id: nanoid(10), roomId: R(), from: socket.data.name,
          type: 'roll', text: `${label ? label + ': ' : ''}${formatRoll(result)}`, roll: result, ts: Date.now(),
        };
        if (whisperToDm) {
          msg.whisper = true;
          for (const [sid, s] of io.sockets.sockets) {
            if (s.data?.roomId === R() && (s.data.role === 'dm' || sid === socket.id)) s.emit('chat:message', msg);
          }
        } else {
          pushChat(R(), msg);
          io.to(R()).emit('chat:message', msg);
        }
        cb?.({ ok: true, roll: result });
      } catch (e) {
        cb?.({ error: e.message });
      }
    });

    // ---- Handouts: flash an image on every screen ----

    socket.on('handout:show', dmOnly(({ url, title }, cb) => {
      if (!url || typeof url !== 'string') return cb?.({ error: 'Image url required' });
      io.to(R()).emit('handout:show', { url, title: (title || '').slice(0, 80) });
      cb?.({ ok: true });
    }));

    socket.on('handout:hide', dmOnly((_payload, cb) => {
      io.to(R()).emit('handout:hide');
      cb?.({ ok: true });
    }));

    // ---- Spells / animations (scene-scoped: only viewers of this map see them) ----
    socket.on('spell:cast', ({ kind, from, to, color }, cb) => {
      if (!R()) return cb?.({ error: 'Not in a room' });
      // A player's cast is their action for the turn during combat.
      if (socket.data.role !== 'dm') {
        const session = getSession(R());
        const held = holdGate(session, socket);
        if (held) return cb?.({ error: held });
        const init = session.initiative;
        if (init && init.order.length) {
          const state = getSceneState(R(), S());
          const mine = state?.tokens.find(t =>
            (t.owner === socket.data.name || t.owner === socket.id) && init.order.some(e => e.tokenId === t.id));
          if (mine) {
            const gate = turnGate(session, socket, mine);
            if (gate) return cb?.({ error: gate });
            if (init.turnState.actionUsed) return cb?.({ error: 'You already used your action this turn' });
            init.turnState.actionUsed = true;
            init.turnState.attacksUsed = mine.attacks ?? 1;
            io.to(R()).emit('init:updated', init);
          }
        }
      }
      emitScene(io, R(), S(), 'spell:effect', {
        id: nanoid(8), kind, from, to, color, by: socket.data.name, ts: Date.now(),
      });
      cb?.({ ok: true });
    });
  });
}

function broadcastSystem(io, roomId, text) {
  const msg = { id: nanoid(10), roomId, from: 'system', type: 'system', text, ts: Date.now() };
  pushChat(roomId, msg);
  io.to(roomId).emit('chat:message', msg);
}
