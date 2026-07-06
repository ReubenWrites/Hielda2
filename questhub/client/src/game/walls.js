import { cellToWorld } from './grid.js';

// Walls and doors are stored in grid-cell coordinates.
// When a door is open it does NOT block vision.

export function drawWalls(graphics, walls, room) {
  graphics.clear();
  if (!room) return;
  for (const w of walls) {
    const a = cellToWorld(w.x1, w.y1, room);
    const b = cellToWorld(w.x2, w.y2, room);
    graphics.moveTo(a.x, a.y).lineTo(b.x, b.y);
    if (w.isDoor) {
      graphics.stroke({
        width: 4,
        color: w.doorOpen ? 0x66cc66 : 0xcc8833,
      });
    } else {
      graphics.stroke({ width: 4, color: 0xeeeeee });
    }
  }
}

// Walls that block vision (closed doors + plain walls).
export function blockingWalls(walls) {
  return walls
    .filter(w => !(w.isDoor && w.doorOpen))
    .map(w => ({ x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2 }));
}
