import { nanoid } from 'nanoid';
import { rollDice, formatRoll } from '@questhub/shared/dice';
import {
  getRoom, getRoomState, verifyDm, updateRoomMap,
  createToken, updateToken, deleteToken, getToken,
  createWall, deleteWall, toggleDoor,
} from './rooms.js';
import { fetchDdbCharacter } from './dndbeyond.js';

// In-memory transient state, keyed by roomId.
const sessions = new Map(); // roomId -> { proposals: Map(id -> proposal), chat: [] }

function getSession(roomId) {
  let s = sessions.get(roomId);
  if (!s) {
    s = { proposals: new Map(), chat: [] };
    sessions.set(roomId, s);
  }
  return s;
}

function pushChat(roomId, msg) {
  const s = getSession(roomId);
  s.chat.push(msg);
  if (s.chat.length > 200) s.chat.splice(0, s.chat.length - 200);
}

export function attachSockets(io) {
  io.on('connection', (socket) => {
    socket.data = { roomId: null, role: null, name: 'Guest', id: socket.id };

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
        const state = getRoomState(roomId);
        const session = getSession(roomId);
        cb?.({
          ok: true,
          role,
          you: { id: socket.id, name: socket.data.name },
          state,
          chat: session.chat.slice(-50),
          proposals: Array.from(session.proposals.values()),
        });
        broadcastSystem(io, roomId, `${socket.data.name} joined as ${role}`);
      } catch (e) {
        cb?.({ error: e.message });
      }
    });

    socket.on('disconnect', () => {
      if (socket.data.roomId) {
        broadcastSystem(io, socket.data.roomId, `${socket.data.name} left`);
      }
    });

    // ---- DM-only events ----
    const dmOnly = (fn) => (...args) => {
      const cb = typeof args[args.length - 1] === 'function' ? args[args.length - 1] : null;
      if (socket.data.role !== 'dm') return cb?.({ error: 'DM only' });
      return fn(...args);
    };

    socket.on('map:config', dmOnly((cfg, cb) => {
      const fields = {};
      if (cfg.mapImageUrl !== undefined) fields.map_image_url = cfg.mapImageUrl;
      if (cfg.gridSize !== undefined) fields.grid_size = cfg.gridSize;
      if (cfg.gridW !== undefined) fields.grid_w = cfg.gridW;
      if (cfg.gridH !== undefined) fields.grid_h = cfg.gridH;
      if (cfg.offsetX !== undefined) fields.offset_x = cfg.offsetX;
      if (cfg.offsetY !== undefined) fields.offset_y = cfg.offsetY;
      updateRoomMap(socket.data.roomId, fields);
      io.to(socket.data.roomId).emit('map:updated', getRoomState(socket.data.roomId).room);
      cb?.({ ok: true });
    }));

    socket.on('token:create', dmOnly((t, cb) => {
      const token = createToken(socket.data.roomId, t);
      io.to(socket.data.roomId).emit('token:created', token);
      cb?.({ ok: true, token });
    }));

    socket.on('token:update', dmOnly((t, cb) => {
      const token = updateToken(t.id, t);
      io.to(socket.data.roomId).emit('token:updated', token);
      cb?.({ ok: true, token });
    }));

    socket.on('token:delete', dmOnly(({ id }, cb) => {
      deleteToken(id);
      io.to(socket.data.roomId).emit('token:deleted', { id });
      cb?.({ ok: true });
    }));

    socket.on('token:move', dmOnly(({ id, x, y, animate }, cb) => {
      const token = updateToken(id, { x, y });
      io.to(socket.data.roomId).emit('token:moved', { id, x, y, animate: animate !== false });
      cb?.({ ok: true, token });
    }));

    socket.on('wall:create', dmOnly((w, cb) => {
      const wall = createWall(socket.data.roomId, w);
      io.to(socket.data.roomId).emit('wall:created', wall);
      cb?.({ ok: true, wall });
    }));

    socket.on('wall:delete', dmOnly(({ id }, cb) => {
      deleteWall(id);
      io.to(socket.data.roomId).emit('wall:deleted', { id });
      cb?.({ ok: true });
    }));

    socket.on('door:toggle', dmOnly(({ id }, cb) => {
      const wall = toggleDoor(id);
      if (wall) io.to(socket.data.roomId).emit('wall:updated', wall);
      cb?.({ ok: true, wall });
    }));

    socket.on('ddb:link', dmOnly(async ({ tokenId, characterId, manualData }, cb) => {
      try {
        const data = manualData || await fetchDdbCharacter(characterId);
        const t = updateToken(tokenId, {
          ddbCharacterId: characterId || null,
          ddbData: data,
          name: data.name || undefined,
        });
        io.to(socket.data.roomId).emit('token:updated', t);
        cb?.({ ok: true, token: t });
      } catch (e) {
        cb?.({ error: e.message });
      }
    }));

    // ---- Player events ----

    socket.on('move:propose', ({ tokenId, path }, cb) => {
      if (!socket.data.roomId) return cb?.({ error: 'Not in a room' });
      const token = getToken(tokenId);
      if (!token) return cb?.({ error: 'Token not found' });
      if (socket.data.role !== 'dm' && token.owner !== socket.id && token.owner !== socket.data.name) {
        return cb?.({ error: 'You do not own this token' });
      }
      if (!Array.isArray(path) || path.length < 1) return cb?.({ error: 'Path required' });
      const proposal = {
        id: nanoid(10),
        tokenId,
        proposedBy: socket.data.name,
        path: path.slice(0, 50).map(p => ({ x: p.x, y: p.y })),
        createdAt: Date.now(),
      };
      getSession(socket.data.roomId).proposals.set(proposal.id, proposal);
      io.to(socket.data.roomId).emit('move:proposed', proposal);
      cb?.({ ok: true, proposal });
    });

    socket.on('move:approve', dmOnly(({ proposalId, stopAtIndex }, cb) => {
      const session = getSession(socket.data.roomId);
      const proposal = session.proposals.get(proposalId);
      if (!proposal) return cb?.({ error: 'Proposal not found' });
      session.proposals.delete(proposalId);
      const path = typeof stopAtIndex === 'number'
        ? proposal.path.slice(0, Math.max(1, stopAtIndex + 1))
        : proposal.path;
      const finalCell = path[path.length - 1];
      updateToken(proposal.tokenId, { x: finalCell.x, y: finalCell.y });
      io.to(socket.data.roomId).emit('move:approved', {
        proposalId,
        tokenId: proposal.tokenId,
        path,
        interrupted: typeof stopAtIndex === 'number',
      });
      cb?.({ ok: true });
    }));

    socket.on('move:reject', dmOnly(({ proposalId }, cb) => {
      getSession(socket.data.roomId).proposals.delete(proposalId);
      io.to(socket.data.roomId).emit('move:rejected', { proposalId });
      cb?.({ ok: true });
    }));

    socket.on('move:interrupt', dmOnly(({ proposalId, atIndex }, cb) => {
      // Used while an approved move is animating client-side; broadcast a stop signal.
      io.to(socket.data.roomId).emit('move:interrupt', { proposalId, atIndex });
      cb?.({ ok: true });
    }));

    // ---- Chat & dice ----

    socket.on('chat:send', ({ text }, cb) => {
      if (!socket.data.roomId) return cb?.({ error: 'Not in a room' });
      const clean = String(text || '').slice(0, 1000).trim();
      if (!clean) return cb?.({ error: 'Empty message' });
      // /r 1d20+5 shortcut
      const m = /^\/(r|roll)\s+(.+)$/i.exec(clean);
      if (m) {
        try {
          const result = rollDice(m[2]);
          const msg = {
            id: nanoid(10),
            roomId: socket.data.roomId,
            from: socket.data.name,
            type: 'roll',
            text: formatRoll(result),
            roll: result,
            ts: Date.now(),
          };
          pushChat(socket.data.roomId, msg);
          io.to(socket.data.roomId).emit('chat:message', msg);
          cb?.({ ok: true });
        } catch (e) {
          cb?.({ error: e.message });
        }
        return;
      }
      const msg = {
        id: nanoid(10),
        roomId: socket.data.roomId,
        from: socket.data.name,
        type: 'chat',
        text: clean,
        ts: Date.now(),
      };
      pushChat(socket.data.roomId, msg);
      io.to(socket.data.roomId).emit('chat:message', msg);
      cb?.({ ok: true });
    });

    socket.on('dice:roll', ({ expr, whisperToDm }, cb) => {
      if (!socket.data.roomId) return cb?.({ error: 'Not in a room' });
      try {
        const result = rollDice(expr);
        const msg = {
          id: nanoid(10),
          roomId: socket.data.roomId,
          from: socket.data.name,
          type: 'roll',
          text: formatRoll(result),
          roll: result,
          ts: Date.now(),
        };
        if (whisperToDm) {
          msg.whisper = true;
          for (const [sid, s] of io.sockets.sockets) {
            if (s.data?.roomId === socket.data.roomId && (s.data.role === 'dm' || sid === socket.id)) {
              s.emit('chat:message', msg);
            }
          }
        } else {
          pushChat(socket.data.roomId, msg);
          io.to(socket.data.roomId).emit('chat:message', msg);
        }
        cb?.({ ok: true, roll: result });
      } catch (e) {
        cb?.({ error: e.message });
      }
    });

    // ---- Spells / animations ----
    socket.on('spell:cast', ({ kind, from, to, color }, cb) => {
      if (!socket.data.roomId) return cb?.({ error: 'Not in a room' });
      // Everyone can request a spell effect for now; DM can lock this down later if desired.
      io.to(socket.data.roomId).emit('spell:effect', {
        id: nanoid(8),
        kind,
        from,
        to,
        color,
        by: socket.data.name,
        ts: Date.now(),
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
