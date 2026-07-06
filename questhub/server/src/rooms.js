import { customAlphabet, nanoid } from 'nanoid';
import { getDb } from './db.js';

// 6-char uppercase room codes, no ambiguous chars
const roomCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

export function createRoom({ name }) {
  const db = getDb();
  const id = roomCode();
  const dmSecret = nanoid(32);
  db.prepare(`
    INSERT INTO rooms (id, name, dm_secret, created_at)
    VALUES (?, ?, ?, ?)
  `).run(id, name || 'Untitled Quest', dmSecret, Date.now());
  return { id, dmSecret };
}

export function getRoom(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
}

export function updateRoomMap(roomId, fields) {
  const db = getDb();
  const allowed = ['map_image_url', 'grid_size', 'grid_w', 'grid_h', 'offset_x', 'offset_y'];
  const sets = [];
  const vals = [];
  for (const k of allowed) {
    if (k in fields) {
      sets.push(`${k} = ?`);
      vals.push(fields[k]);
    }
  }
  if (sets.length === 0) return;
  vals.push(roomId);
  db.prepare(`UPDATE rooms SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
}

export function getRoomState(roomId) {
  const db = getDb();
  const room = getRoom(roomId);
  if (!room) return null;
  const tokens = db.prepare('SELECT * FROM tokens WHERE room_id = ?').all(roomId);
  const walls = db.prepare('SELECT * FROM walls WHERE room_id = ?').all(roomId);
  const { dm_secret, ...publicRoom } = room;
  return {
    room: publicRoom,
    tokens: tokens.map(serializeToken),
    walls: walls.map(serializeWall),
  };
}

export function verifyDm(roomId, dmSecret) {
  const room = getRoom(roomId);
  return room && room.dm_secret === dmSecret;
}

export function createToken(roomId, t) {
  const db = getDb();
  const id = nanoid(12);
  db.prepare(`
    INSERT INTO tokens (id, room_id, name, image_url, color, owner, x, y, sight_radius, visible_to_players)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, roomId,
    t.name || 'Token',
    t.imageUrl || null,
    t.color || '#5b9bd5',
    t.owner || 'dm',
    t.x ?? 0, t.y ?? 0,
    t.sightRadius ?? 6,
    t.visibleToPlayers === false ? 0 : 1,
  );
  return getToken(id);
}

export function getToken(id) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM tokens WHERE id = ?').get(id);
  return row ? serializeToken(row) : null;
}

export function updateToken(id, fields) {
  const db = getDb();
  const map = {
    name: 'name', imageUrl: 'image_url', color: 'color', owner: 'owner',
    x: 'x', y: 'y', sightRadius: 'sight_radius',
    visibleToPlayers: 'visible_to_players',
    ddbCharacterId: 'ddb_character_id', ddbData: 'ddb_data',
  };
  const sets = [];
  const vals = [];
  for (const [k, col] of Object.entries(map)) {
    if (k in fields) {
      let v = fields[k];
      if (k === 'visibleToPlayers') v = v ? 1 : 0;
      if (k === 'ddbData' && typeof v !== 'string' && v != null) v = JSON.stringify(v);
      sets.push(`${col} = ?`);
      vals.push(v);
    }
  }
  if (sets.length === 0) return getToken(id);
  vals.push(id);
  db.prepare(`UPDATE tokens SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return getToken(id);
}

export function deleteToken(id) {
  getDb().prepare('DELETE FROM tokens WHERE id = ?').run(id);
}

export function createWall(roomId, w) {
  const db = getDb();
  const id = nanoid(12);
  db.prepare(`
    INSERT INTO walls (id, room_id, x1, y1, x2, y2, is_door, door_open)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, roomId, w.x1, w.y1, w.x2, w.y2, w.isDoor ? 1 : 0, w.doorOpen ? 1 : 0);
  return serializeWall(getDb().prepare('SELECT * FROM walls WHERE id = ?').get(id));
}

export function deleteWall(id) {
  getDb().prepare('DELETE FROM walls WHERE id = ?').run(id);
}

export function toggleDoor(id) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM walls WHERE id = ?').get(id);
  if (!row || !row.is_door) return null;
  const open = row.door_open ? 0 : 1;
  db.prepare('UPDATE walls SET door_open = ? WHERE id = ?').run(open, id);
  return serializeWall({ ...row, door_open: open });
}

function serializeToken(row) {
  return {
    id: row.id,
    roomId: row.room_id,
    name: row.name,
    imageUrl: row.image_url,
    color: row.color,
    owner: row.owner,
    x: row.x,
    y: row.y,
    sightRadius: row.sight_radius,
    visibleToPlayers: !!row.visible_to_players,
    ddbCharacterId: row.ddb_character_id,
    ddbData: row.ddb_data ? safeParse(row.ddb_data) : null,
  };
}

function serializeWall(row) {
  return {
    id: row.id,
    roomId: row.room_id,
    x1: row.x1, y1: row.y1, x2: row.x2, y2: row.y2,
    isDoor: !!row.is_door,
    doorOpen: !!row.door_open,
  };
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}
