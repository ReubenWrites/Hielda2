import { computeVisibleCells, unionVisible } from '@questhub/shared/vision';
import { blockingWalls } from './walls.js';

// Compute the set of cells visible to a viewer.
//
// For the DM: returns null (no fog).
// For a player: union of visible cells across every token they own.
export function computeFog({ role, you, tokens, walls, room }) {
  if (role === 'dm' || !room) return null;
  const myTokens = tokens.filter(t => t.owner === you?.name || t.owner === you?.id);
  if (myTokens.length === 0) return new Set(); // player with no tokens sees nothing
  const bw = blockingWalls(walls);
  const sets = myTokens.map(t => computeVisibleCells({
    origin: { x: t.x + 0.5, y: t.y + 0.5 },
    radius: t.sightRadius || 6,
    walls: bw,
    gridW: room.grid_w,
    gridH: room.grid_h,
  }));
  return unionVisible(sets);
}

export function drawFog(graphics, visibleSet, room) {
  graphics.clear();
  if (!visibleSet || !room) return; // DM: no fog
  const { grid_size, grid_w, grid_h, offset_x = 0, offset_y = 0 } = room;
  // Draw the non-visible cells as near-opaque black.
  for (let y = 0; y < grid_h; y++) {
    for (let x = 0; x < grid_w; x++) {
      if (visibleSet.has(`${x},${y}`)) continue;
      graphics.rect(offset_x + x * grid_size, offset_y + y * grid_size, grid_size, grid_size);
    }
  }
  graphics.fill({ color: 0x000000, alpha: 0.92 });
}

export function tokenVisibleToViewer(token, visibleSet, you) {
  if (!visibleSet) return true; // DM sees everything
  if (token.owner === you?.name || token.owner === you?.id) return true; // own token
  if (token.visibleToPlayers === false) return false; // DM hid it
  return visibleSet.has(`${Math.floor(token.x)},${Math.floor(token.y)}`);
}
