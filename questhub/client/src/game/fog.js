import { computeVisibleCells, unionVisible } from '@questhub/shared/vision';
import { blockingWalls } from './walls.js';
import { tokenCenter } from '@questhub/shared/geometry';

// Compute the set of cells visible to a viewer.
//
// For the DM: returns null (no fog).
// For a player: union of visible cells across every token they own.
export function computeFog({ role, you, tokens, walls, room }) {
  if (role === 'dm' || !room) return null;
  // Free/overland maps have no fog — sight radius is meaningless at
  // miles-per-square scale. 'all' still hides DM-hidden tokens (unlike null).
  if (room.grid_type === 'free') return 'all';
  const myTokens = tokens.filter(t => t.owner === you?.name || t.owner === you?.id);
  if (myTokens.length === 0) return new Set(); // player with no tokens sees nothing
  const bw = blockingWalls(walls);
  const sets = myTokens.map(t => computeVisibleCells({
    origin: tokenCenter(t),
    radius: t.sightRadius || 6,
    walls: bw,
    gridW: room.grid_w,
    gridH: room.grid_h,
  }));
  return unionVisible(sets);
}

export function drawFog(graphics, visibleSet, room, extent = null, exploredSet = null) {
  graphics.clear();
  if (!visibleSet || visibleSet === 'all' || !room) return; // DM or overland: no fog
  const { grid_size, grid_w, grid_h, offset_x = 0, offset_y = 0 } = room;
  // Pass 1: never-seen cells are near-black.
  for (let y = 0; y < grid_h; y++) {
    for (let x = 0; x < grid_w; x++) {
      const key = `${x},${y}`;
      if (visibleSet.has(key)) continue;
      if (exploredSet?.has(key)) continue;
      graphics.rect(offset_x + x * grid_size, offset_y + y * grid_size, grid_size, grid_size);
    }
  }
  // Cover any map area outside the grid bounds (maps render at native size,
  // which can exceed the configured grid).
  if (extent) {
    const gx0 = offset_x, gy0 = offset_y;
    const gx1 = offset_x + grid_w * grid_size, gy1 = offset_y + grid_h * grid_size;
    if (gy0 > 0) graphics.rect(0, 0, extent.w, gy0);
    if (gy1 < extent.h) graphics.rect(0, gy1, extent.w, extent.h - gy1);
    if (gx0 > 0) graphics.rect(0, gy0, gx0, gy1 - gy0);
    if (gx1 < extent.w) graphics.rect(gx1, gy0, extent.w - gx1, gy1 - gy0);
  }
  graphics.fill({ color: 0x000000, alpha: 0.92 });
  // Pass 2: remembered-but-not-currently-visible cells are dimmed, not hidden.
  if (exploredSet && exploredSet.size) {
    let any = false;
    for (const key of exploredSet) {
      if (visibleSet.has(key)) continue;
      const [x, y] = key.split(',').map(Number);
      if (x < 0 || y < 0 || x >= grid_w || y >= grid_h) continue;
      graphics.rect(offset_x + x * grid_size, offset_y + y * grid_size, grid_size, grid_size);
      any = true;
    }
    if (any) graphics.fill({ color: 0x05050c, alpha: 0.62 });
  }
}

export function tokenVisibleToViewer(token, visibleSet, you) {
  if (!visibleSet) return true; // DM sees everything
  if (token.owner === you?.name || token.owner === you?.id) return true; // own token
  if (token.visibleToPlayers === false) return false; // DM hid it
  if (visibleSet === 'all') return true; // overland: no fog, but hidden stays hidden
  const c = tokenCenter(token);
  return visibleSet.has(`${Math.floor(c.x - 1e-9)},${Math.floor(c.y - 1e-9)}`);
}
