import Database from 'better-sqlite3';
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
  `);

  // Additive migrations for databases created before these columns existed.
  ensureColumn(d, 'tokens', 'hp', 'hp REAL');
  ensureColumn(d, 'tokens', 'max_hp', 'max_hp REAL');
  ensureColumn(d, 'tokens', 'ac', 'ac INTEGER');
  ensureColumn(d, 'tokens', 'emoji', 'emoji TEXT');
  ensureColumn(d, 'rooms', 'feet_per_cell', 'feet_per_cell REAL NOT NULL DEFAULT 5');
  ensureColumn(d, 'rooms', 'grid_type', "grid_type TEXT NOT NULL DEFAULT 'square'");
  ensureColumn(d, 'assets', 'grid_json', 'grid_json TEXT');
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
