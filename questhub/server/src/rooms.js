import { customAlphabet, nanoid } from 'nanoid';
import { getDb } from './db.js';

// 6-char uppercase room codes, no ambiguous chars
const roomCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

// ---------------------------------------------------------------- rooms

export function createRoom({ name }) {
  const db = getDb();
  const id = roomCode();
  const dmSecret = nanoid(32);
  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO rooms (id, name, dm_secret, created_at)
      VALUES (?, ?, ?, ?)
    `).run(id, name || 'Untitled Quest', dmSecret, Date.now());
    const scene = createScene(id, { name: 'Scene 1' });
    db.prepare('UPDATE rooms SET dm_scene_id = ? WHERE id = ?').run(scene.id, id);
  });
  tx();
  return { id, dmSecret };
}

export function getRoom(id) {
  return getDb().prepare('SELECT * FROM rooms WHERE id = ?').get(id);
}

export function verifyDm(roomId, dmSecret) {
  const room = getRoom(roomId);
  return room && room.dm_secret === dmSecret;
}

export function setDmScene(roomId, sceneId) {
  getDb().prepare('UPDATE rooms SET dm_scene_id = ? WHERE id = ?').run(sceneId, roomId);
}

// ---------------------------------------------------------------- scenes

const SCENE_FIELDS = ['map_image_url', 'grid_size', 'grid_w', 'grid_h', 'offset_x', 'offset_y', 'feet_per_cell', 'grid_type'];

export function createScene(roomId, s = {}) {
  const db = getDb();
  const id = nanoid(12);
  db.prepare(`
    INSERT INTO scenes (id, room_id, name, map_image_url, grid_size, grid_w, grid_h,
      offset_x, offset_y, feet_per_cell, grid_type, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, roomId,
    (s.name || 'New scene').slice(0, 60),
    s.map_image_url ?? null,
    s.grid_size ?? 64, s.grid_w ?? 30, s.grid_h ?? 20,
    s.offset_x ?? 0, s.offset_y ?? 0,
    s.feet_per_cell ?? 5,
    s.grid_type === 'free' ? 'free' : 'square',
    Date.now(),
  );
  return getScene(id);
}

export function getScene(id) {
  return getDb().prepare('SELECT * FROM scenes WHERE id = ?').get(id) || null;
}

export function listScenes(roomId) {
  return getDb().prepare('SELECT * FROM scenes WHERE room_id = ? ORDER BY created_at').all(roomId)
    .map(s => ({
      id: s.id, name: s.name, mapImageUrl: s.map_image_url, gridType: s.grid_type,
      tokenCount: getDb().prepare('SELECT COUNT(*) AS n FROM tokens WHERE scene_id = ?').get(s.id).n,
    }));
}

export function updateScene(sceneId, fields) {
  const db = getDb();
  const sets = [];
  const vals = [];
  for (const k of [...SCENE_FIELDS, 'name']) {
    if (k in fields) {
      sets.push(`${k} = ?`);
      vals.push(fields[k]);
    }
  }
  if (sets.length === 0) return getScene(sceneId);
  vals.push(sceneId);
  db.prepare(`UPDATE scenes SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return getScene(sceneId);
}

// Deleting the last scene is refused; tokens and walls in it go with it.
export function deleteScene(roomId, sceneId) {
  const db = getDb();
  const count = db.prepare('SELECT COUNT(*) AS n FROM scenes WHERE room_id = ?').get(roomId).n;
  if (count <= 1) return false;
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM tokens WHERE scene_id = ?').run(sceneId);
    db.prepare('DELETE FROM walls WHERE scene_id = ?').run(sceneId);
    db.prepare('DELETE FROM explored WHERE scene_id = ?').run(sceneId);
    db.prepare('DELETE FROM scenes WHERE id = ?').run(sceneId);
    const room = getRoom(roomId);
    if (room.dm_scene_id === sceneId) {
      const next = db.prepare('SELECT id FROM scenes WHERE room_id = ? ORDER BY created_at LIMIT 1').get(roomId);
      db.prepare('UPDATE rooms SET dm_scene_id = ? WHERE id = ?').run(next.id, roomId);
    }
  });
  tx();
  return true;
}

// The scene a player should be looking at: where their character is, or
// the DM's current scene if they have no token yet.
export function playerSceneFor(roomId, playerName, socketId) {
  const db = getDb();
  const t = db.prepare(`
    SELECT scene_id FROM tokens WHERE room_id = ? AND (owner = ? OR owner = ?) AND scene_id IS NOT NULL
    ORDER BY rowid LIMIT 1
  `).get(roomId, playerName, socketId || '');
  if (t?.scene_id) return t.scene_id;
  return getRoom(roomId)?.dm_scene_id ?? null;
}

// Everything a client needs to render one scene. `room` carries the room
// identity plus the scene's map/grid fields so the client treats "the room
// I'm looking at" as one object.
export function getSceneState(roomId, sceneId) {
  const db = getDb();
  const room = getRoom(roomId);
  const scene = getScene(sceneId);
  if (!room || !scene) return null;
  const tokens = db.prepare('SELECT * FROM tokens WHERE scene_id = ?').all(sceneId);
  const walls = db.prepare('SELECT * FROM walls WHERE scene_id = ?').all(sceneId);
  const assets = db.prepare('SELECT * FROM assets WHERE room_id = ? ORDER BY created_at').all(roomId);
  return {
    room: composeRoom(room, scene),
    tokens: tokens.map(serializeToken),
    walls: walls.map(serializeWall),
    assets: assets.map(serializeAsset),
    scenes: listScenes(roomId),
  };
}

function composeRoom(room, scene) {
  return {
    id: room.id,
    name: room.name,
    scene_id: scene.id,
    scene_name: scene.name,
    dm_scene_id: room.dm_scene_id,
    map_image_url: scene.map_image_url,
    grid_size: scene.grid_size,
    grid_w: scene.grid_w,
    grid_h: scene.grid_h,
    offset_x: scene.offset_x,
    offset_y: scene.offset_y,
    feet_per_cell: scene.feet_per_cell,
    grid_type: scene.grid_type,
  };
}

// ---------------------------------------------------------------- characters

export function createCharacter(roomId, c) {
  const db = getDb();
  const id = nanoid(12);
  db.prepare(`
    INSERT INTO characters (id, room_id, name, kind, emoji, color, image_url, owner,
      hp, max_hp, ac, sight_radius, notes, created_at, speed, attacks, size, reach, init_bonus)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, roomId,
    (c.name || 'Character').slice(0, 60),
    ['pc', 'npc', 'monster'].includes(c.kind) ? c.kind : 'npc',
    c.emoji || null,
    c.color || '#8d99ae',
    c.imageUrl || null,
    c.owner || 'dm',
    c.hp ?? null, c.maxHp ?? null, c.ac ?? null,
    c.sightRadius ?? 6,
    (c.notes || '').slice(0, 5000),
    Date.now(),
    c.speed ?? 30,
    c.attacks ?? 1,
    c.size ?? 1,
    c.reach ?? 5,
    c.initBonus ?? 0,
  );
  return getCharacter(id);
}

export function getCharacter(id) {
  const row = getDb().prepare('SELECT * FROM characters WHERE id = ?').get(id);
  return row ? serializeCharacter(row) : null;
}

export function listCharacters(roomId) {
  return getDb().prepare('SELECT * FROM characters WHERE room_id = ? ORDER BY kind, name').all(roomId)
    .map(serializeCharacter);
}

export function updateCharacter(id, fields) {
  const db = getDb();
  const map = {
    name: 'name', kind: 'kind', emoji: 'emoji', color: 'color', imageUrl: 'image_url',
    owner: 'owner', hp: 'hp', maxHp: 'max_hp', ac: 'ac', sightRadius: 'sight_radius', notes: 'notes',
    speed: 'speed', attacks: 'attacks', size: 'size', reach: 'reach', initBonus: 'init_bonus',
    ddbCharacterId: 'ddb_character_id', ddbSyncedAt: 'ddb_synced_at',
  };
  const sets = [];
  const vals = [];
  for (const [k, col] of Object.entries(map)) {
    if (k in fields) {
      let v = fields[k];
      if (k === 'notes') v = String(v || '').slice(0, 5000);
      sets.push(`${col} = ?`);
      vals.push(v);
    }
  }
  if (sets.length) {
    vals.push(id);
    db.prepare(`UPDATE characters SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  }
  // Keep placed tokens' identity in step with their sheet.
  const c = getCharacter(id);
  if (c) {
    db.prepare(`UPDATE tokens SET name = ?, emoji = ?, color = ?, owner = ?, sight_radius = ?, speed = ?, attacks = ?,
      size = ?, reach = ?, init_bonus = ? WHERE character_id = ?`)
      .run(c.name, c.emoji, c.color, c.owner, c.sightRadius, c.speed, c.attacks, c.size, c.reach, c.initBonus, id);
    if ('imageUrl' in fields) db.prepare('UPDATE tokens SET image_url = ? WHERE character_id = ?').run(c.imageUrl, id);
  }
  return c;
}

export function deleteCharacter(id) {
  const db = getDb();
  db.prepare('UPDATE tokens SET character_id = NULL WHERE character_id = ?').run(id);
  db.prepare('DELETE FROM characters WHERE id = ?').run(id);
}

// ---------------------------------------------------------------- tokens

export function createToken(roomId, sceneId, t) {
  const db = getDb();
  const id = nanoid(12);
  db.prepare(`
    INSERT INTO tokens (id, room_id, scene_id, character_id, name, image_url, color, owner, x, y,
      sight_radius, visible_to_players, hp, max_hp, ac, emoji, speed, attacks, size, reach, init_bonus)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, roomId, sceneId,
    t.characterId || null,
    t.name || 'Token',
    t.imageUrl || null,
    t.color || '#5b9bd5',
    t.owner || 'dm',
    t.x ?? 0, t.y ?? 0,
    t.sightRadius ?? 6,
    t.visibleToPlayers === false ? 0 : 1,
    t.hp ?? null,
    t.maxHp ?? null,
    t.ac ?? null,
    t.emoji || null,
    t.speed ?? 30,
    t.attacks ?? 1,
    t.size ?? 1,
    t.reach ?? 5,
    t.initBonus ?? 0,
  );
  return getToken(id);
}

// Stamp a character sheet onto a scene.
export function placeCharacter(roomId, sceneId, characterId, { x, y }) {
  const c = getCharacter(characterId);
  if (!c) return null;
  return createToken(roomId, sceneId, {
    characterId: c.id, name: c.name, imageUrl: c.imageUrl, color: c.color, owner: c.owner,
    x, y, sightRadius: c.sightRadius, hp: c.hp, maxHp: c.maxHp, ac: c.ac, emoji: c.emoji,
    speed: c.speed, attacks: c.attacks, size: c.size, reach: c.reach, initBonus: c.initBonus,
  });
}

export function getToken(id) {
  const row = getDb().prepare('SELECT * FROM tokens WHERE id = ?').get(id);
  return row ? serializeToken(row) : null;
}

export function updateToken(id, fields) {
  const db = getDb();
  const map = {
    name: 'name', imageUrl: 'image_url', color: 'color', owner: 'owner',
    x: 'x', y: 'y', sightRadius: 'sight_radius',
    visibleToPlayers: 'visible_to_players',
    hp: 'hp', maxHp: 'max_hp', ac: 'ac', emoji: 'emoji',
    speed: 'speed', attacks: 'attacks', size: 'size', reach: 'reach', initBonus: 'init_bonus',
    characterId: 'character_id',
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
  const t = getToken(id);
  // HP tracked on a token with a sheet flows back to the sheet.
  if (t?.characterId && ('hp' in fields || 'maxHp' in fields || 'ac' in fields)) {
    db.prepare('UPDATE characters SET hp = ?, max_hp = ?, ac = ? WHERE id = ?')
      .run(t.hp, t.maxHp, t.ac, t.characterId);
  }
  return t;
}

export function moveTokenToScene(id, sceneId, { x, y }) {
  getDb().prepare('UPDATE tokens SET scene_id = ?, x = ?, y = ? WHERE id = ?').run(sceneId, x ?? 0, y ?? 0, id);
  return getToken(id);
}

export function deleteToken(id) {
  getDb().prepare('DELETE FROM tokens WHERE id = ?').run(id);
}

// ---------------------------------------------------------------- walls

export function createWall(roomId, sceneId, w) {
  const db = getDb();
  const id = nanoid(12);
  db.prepare(`
    INSERT INTO walls (id, room_id, scene_id, x1, y1, x2, y2, is_door, door_open)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, roomId, sceneId, w.x1, w.y1, w.x2, w.y2, w.isDoor ? 1 : 0, w.doorOpen ? 1 : 0);
  return serializeWall(db.prepare('SELECT * FROM walls WHERE id = ?').get(id));
}

export function getWall(id) {
  const row = getDb().prepare('SELECT * FROM walls WHERE id = ?').get(id);
  return row ? serializeWall(row) : null;
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

// ---------------------------------------------------------------- assets

export function createAsset(roomId, a) {
  const db = getDb();
  const id = nanoid(12);
  db.prepare(`
    INSERT INTO assets (id, room_id, kind, name, url, created_at, grid_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, roomId, ['map', 'token', 'handout'].includes(a.kind) ? a.kind : 'token',
    (a.name || 'Asset').slice(0, 60), a.url, Date.now(),
    a.grid ? JSON.stringify(a.grid) : null);
  return serializeAsset(db.prepare('SELECT * FROM assets WHERE id = ?').get(id));
}

export function getAsset(id) {
  const row = getDb().prepare('SELECT * FROM assets WHERE id = ?').get(id);
  return row ? serializeAsset(row) : null;
}

export function deleteAsset(id) {
  getDb().prepare('DELETE FROM assets WHERE id = ?').run(id);
}

// Remember a map's calibrated grid on its library asset so "Use as map"
// restores the alignment instantly next time.
export function updateAssetGrid(id, grid) {
  const db = getDb();
  db.prepare('UPDATE assets SET grid_json = ? WHERE id = ?').run(JSON.stringify(grid), id);
  return serializeAsset(db.prepare('SELECT * FROM assets WHERE id = ?').get(id));
}

// ---------------------------------------------------------------- import

// Wholesale replace of a room's contents — used by quest import.
export function replaceRoomContents(roomId, { scenes = [], characters = [], assets = [] }) {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM tokens WHERE room_id = ?').run(roomId);
    db.prepare('DELETE FROM walls WHERE room_id = ?').run(roomId);
    db.prepare('DELETE FROM explored WHERE room_id = ?').run(roomId);
    db.prepare('DELETE FROM assets WHERE room_id = ?').run(roomId);
    db.prepare('DELETE FROM characters WHERE room_id = ?').run(roomId);
    db.prepare('DELETE FROM scenes WHERE room_id = ?').run(roomId);
    for (const a of assets) createAsset(roomId, a);
    const charIdMap = new Map();
    for (const c of characters) {
      const created = createCharacter(roomId, c);
      if (c.id) charIdMap.set(c.id, created.id);
    }
    let first = null;
    for (const s of scenes) {
      const scene = createScene(roomId, s);
      if (!first) first = scene;
      for (const w of s.walls || []) createWall(roomId, scene.id, w);
      for (const t of s.tokens || []) {
        createToken(roomId, scene.id, {
          ...t,
          characterId: t.characterId ? (charIdMap.get(t.characterId) || null) : null,
        });
      }
    }
    if (!first) first = createScene(roomId, { name: 'Scene 1' });
    db.prepare('UPDATE rooms SET dm_scene_id = ? WHERE id = ?').run(first.id, roomId);
  });
  tx();
}

// ---------------------------------------------------------------- serializers

function serializeToken(row) {
  return {
    id: row.id,
    roomId: row.room_id,
    sceneId: row.scene_id,
    characterId: row.character_id,
    name: row.name,
    imageUrl: row.image_url,
    color: row.color,
    owner: row.owner,
    x: row.x,
    y: row.y,
    sightRadius: row.sight_radius,
    visibleToPlayers: !!row.visible_to_players,
    hp: row.hp,
    maxHp: row.max_hp,
    ac: row.ac,
    emoji: row.emoji,
    speed: row.speed ?? 30,
    attacks: row.attacks ?? 1,
    size: row.size ?? 1,
    reach: row.reach ?? 5,
    initBonus: row.init_bonus ?? 0,
    ddbCharacterId: row.ddb_character_id,
    ddbData: row.ddb_data ? safeParse(row.ddb_data) : null,
  };
}

function serializeWall(row) {
  return {
    id: row.id,
    roomId: row.room_id,
    sceneId: row.scene_id,
    x1: row.x1, y1: row.y1, x2: row.x2, y2: row.y2,
    isDoor: !!row.is_door,
    doorOpen: !!row.door_open,
  };
}

function serializeAsset(row) {
  return {
    id: row.id,
    roomId: row.room_id,
    kind: row.kind,
    name: row.name,
    url: row.url,
    grid: row.grid_json ? safeParse(row.grid_json) : null,
  };
}

function serializeCharacter(row) {
  return {
    id: row.id,
    roomId: row.room_id,
    name: row.name,
    kind: row.kind,
    emoji: row.emoji,
    color: row.color,
    imageUrl: row.image_url,
    owner: row.owner,
    hp: row.hp,
    maxHp: row.max_hp,
    ac: row.ac,
    sightRadius: row.sight_radius,
    notes: row.notes,
    speed: row.speed ?? 30,
    attacks: row.attacks ?? 1,
    size: row.size ?? 1,
    reach: row.reach ?? 5,
    initBonus: row.init_bonus ?? 0,
    ddbCharacterId: row.ddb_character_id || null,
    ddbSyncedAt: row.ddb_synced_at || null,
  };
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}
