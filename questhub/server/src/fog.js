// Server-side "explored" fog memory, per player per scene.
//
// The client computes what a player can see *right now* (instant feedback
// while dragging). The server is the source of truth for what they have
// *ever* seen: after any change that can alter vision it recomputes each
// player's visible cells and merges them into a persistent explored set.
// Explored-but-not-visible cells render dimly on the player's map with no
// tokens shown — the classic "remembered corridor" effect.

import { computeVisibleCells, unionVisible } from '@questhub/shared/vision';
import { tokenCenter } from '@questhub/shared/geometry';
import { getDb } from './db.js';
import { getSceneState } from './rooms.js';

export function getExplored(roomId, sceneId) {
  const rows = getDb().prepare('SELECT owner, cells FROM explored WHERE room_id = ? AND scene_id = ?')
    .all(roomId, sceneId);
  const out = {};
  for (const r of rows) {
    try { out[r.owner] = JSON.parse(r.cells); } catch { out[r.owner] = []; }
  }
  return out;
}

export function resetExplored(roomId, sceneId) {
  if (sceneId) getDb().prepare('DELETE FROM explored WHERE room_id = ? AND scene_id = ?').run(roomId, sceneId);
  else getDb().prepare('DELETE FROM explored WHERE room_id = ?').run(roomId);
}

// Restore a saved explored set (quest import).
export function setExplored(roomId, sceneId, owner, cells) {
  getDb().prepare(`
    INSERT INTO explored (room_id, scene_id, owner, cells) VALUES (?, ?, ?, ?)
    ON CONFLICT(room_id, scene_id, owner) DO UPDATE SET cells = excluded.cells
  `).run(roomId, sceneId, owner, JSON.stringify(Array.isArray(cells) ? cells : []));
}

// Recompute vision for every player-owned token in a scene and grow the
// explored sets. Returns { owner: cells[] } for owners whose set changed.
export function updateExplored(roomId, sceneId) {
  const state = getSceneState(roomId, sceneId);
  if (!state || state.room.grid_type === 'free') return {};
  const blocking = state.walls
    .filter(w => !(w.isDoor && w.doorOpen))
    .map(w => ({ x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2 }));
  const byOwner = new Map();
  for (const t of state.tokens) {
    if (!t.owner || t.owner === 'dm') continue;
    if (!byOwner.has(t.owner)) byOwner.set(t.owner, []);
    byOwner.get(t.owner).push(t);
  }
  const existing = getExplored(roomId, sceneId);
  const db = getDb();
  const upsert = db.prepare(`
    INSERT INTO explored (room_id, scene_id, owner, cells) VALUES (?, ?, ?, ?)
    ON CONFLICT(room_id, scene_id, owner) DO UPDATE SET cells = excluded.cells
  `);
  const changed = {};
  for (const [owner, tokens] of byOwner) {
    const visible = unionVisible(tokens.map(t => computeVisibleCells({
      origin: tokenCenter(t),
      radius: t.sightRadius || 6,
      walls: blocking,
      gridW: state.room.grid_w,
      gridH: state.room.grid_h,
    })));
    const merged = new Set(existing[owner] || []);
    const before = merged.size;
    for (const c of visible) merged.add(c);
    if (merged.size !== before) {
      const arr = Array.from(merged);
      upsert.run(roomId, sceneId, owner, JSON.stringify(arr));
      changed[owner] = arr;
    }
  }
  return changed;
}
