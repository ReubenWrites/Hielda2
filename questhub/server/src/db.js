import Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import { config } from './config.js';

let db = null;

export function getDb() {
  if (db) return db;
  db = new Database(config.dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}

function migrate(d) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      dm_secret TEXT NOT NULL,
      map_image_url TEXT,
      grid_size INTEGER NOT NULL DEFAULT 64,
      grid_w INTEGER NOT NULL DEFAULT 30,
      grid_h INTEGER NOT NULL DEFAULT 20,
      offset_x INTEGER NOT NULL DEFAULT 0,
      offset_y INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    -- A scene is one map with its own walls, tokens and explored fog.
    CREATE TABLE IF NOT EXISTS scenes (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      map_image_url TEXT,
      grid_size INTEGER NOT NULL DEFAULT 64,
      grid_w INTEGER NOT NULL DEFAULT 30,
      grid_h INTEGER NOT NULL DEFAULT 20,
      offset_x INTEGER NOT NULL DEFAULT 0,
      offset_y INTEGER NOT NULL DEFAULT 0,
      feet_per_cell REAL NOT NULL DEFAULT 5,
      grid_type TEXT NOT NULL DEFAULT 'square',
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS scenes_room_idx ON scenes(room_id);

    -- The cast: PCs, NPCs and monsters with a sheet that persists across
    -- scenes. Tokens are instances of a character on a particular map.
    CREATE TABLE IF NOT EXISTS characters (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'npc',
      emoji TEXT,
      color TEXT NOT NULL DEFAULT '#8d99ae',
      image_url TEXT,
      owner TEXT NOT NULL DEFAULT 'dm',
      hp REAL,
      max_hp REAL,
      ac INTEGER,
      sight_radius REAL NOT NULL DEFAULT 6,
      notes TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS characters_room_idx ON characters(room_id);

    CREATE TABLE IF NOT EXISTS tokens (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      image_url TEXT,
      color TEXT NOT NULL DEFAULT '#5b9bd5',
      owner TEXT NOT NULL DEFAULT 'dm',
      x REAL NOT NULL DEFAULT 0,
      y REAL NOT NULL DEFAULT 0,
      sight_radius REAL NOT NULL DEFAULT 6,
      visible_to_players INTEGER NOT NULL DEFAULT 1,
      ddb_character_id TEXT,
      ddb_data TEXT
    );
    CREATE INDEX IF NOT EXISTS tokens_room_idx ON tokens(room_id);

    CREATE TABLE IF NOT EXISTS walls (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      x1 REAL NOT NULL,
      y1 REAL NOT NULL,
      x2 REAL NOT NULL,
      y2 REAL NOT NULL,
      is_door INTEGER NOT NULL DEFAULT 0,
      door_open INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS walls_room_idx ON walls(room_id);

    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      kind TEXT NOT NULL DEFAULT 'token',
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS assets_room_idx ON assets(room_id);

    -- Explored fog memory per player per scene.
    CREATE TABLE IF NOT EXISTS explored (
      room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      scene_id TEXT NOT NULL,
      owner TEXT NOT NULL,
      cells TEXT NOT NULL,
      PRIMARY KEY (room_id, scene_id, owner)
    );
  `);

  // Additive migrations for databases created before these columns existed.
  ensureColumn(d, 'tokens', 'hp', 'hp REAL');
  ensureColumn(d, 'tokens', 'max_hp', 'max_hp REAL');
  ensureColumn(d, 'tokens', 'ac', 'ac INTEGER');
  ensureColumn(d, 'tokens', 'emoji', 'emoji TEXT');
  ensureColumn(d, 'tokens', 'scene_id', 'scene_id TEXT');
  ensureColumn(d, 'tokens', 'character_id', 'character_id TEXT');
  ensureColumn(d, 'walls', 'scene_id', 'scene_id TEXT');
  ensureColumn(d, 'rooms', 'feet_per_cell', 'feet_per_cell REAL NOT NULL DEFAULT 5');
  ensureColumn(d, 'rooms', 'grid_type', "grid_type TEXT NOT NULL DEFAULT 'square'");
  ensureColumn(d, 'rooms', 'dm_scene_id', 'dm_scene_id TEXT');
  ensureColumn(d, 'assets', 'grid_json', 'grid_json TEXT');
  d.exec('CREATE INDEX IF NOT EXISTS tokens_scene_idx ON tokens(scene_id)');
  d.exec('CREATE INDEX IF NOT EXISTS walls_scene_idx ON walls(scene_id)');

  // Rooms from before scenes existed: wrap their single map in a scene.
  const legacy = d.prepare('SELECT * FROM rooms WHERE dm_scene_id IS NULL').all();
  const insertScene = d.prepare(`
    INSERT INTO scenes (id, room_id, name, map_image_url, grid_size, grid_w, grid_h,
      offset_x, offset_y, feet_per_cell, grid_type, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const tx = d.transaction(() => {
    for (const r of legacy) {
      const sid = nanoid(12);
      insertScene.run(sid, r.id, 'Scene 1', r.map_image_url, r.grid_size, r.grid_w, r.grid_h,
        r.offset_x, r.offset_y, r.feet_per_cell ?? 5, r.grid_type ?? 'square', Date.now());
      d.prepare('UPDATE rooms SET dm_scene_id = ? WHERE id = ?').run(sid, r.id);
      d.prepare('UPDATE tokens SET scene_id = ? WHERE room_id = ? AND scene_id IS NULL').run(sid, r.id);
      d.prepare('UPDATE walls SET scene_id = ? WHERE room_id = ? AND scene_id IS NULL').run(sid, r.id);
    }
  });
  tx();
}

function ensureColumn(d, table, col, ddl) {
  const cols = d.pragma(`table_info(${table})`).map(c => c.name);
  if (!cols.includes(col)) d.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
}

// Test/util only.
export function _resetDb() {
  if (db) db.close();
  db = null;
}
