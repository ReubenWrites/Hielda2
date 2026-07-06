import { Graphics } from 'pixi.js';

export function buildGrid({ grid_size: gridSize, grid_w: gridW, grid_h: gridH, offset_x: offsetX = 0, offset_y: offsetY = 0 }) {
  const g = new Graphics();
  const W = gridW * gridSize;
  const H = gridH * gridSize;
  for (let x = 0; x <= gridW; x++) {
    g.moveTo(offsetX + x * gridSize, offsetY);
    g.lineTo(offsetX + x * gridSize, offsetY + H);
  }
  for (let y = 0; y <= gridH; y++) {
    g.moveTo(offsetX, offsetY + y * gridSize);
    g.lineTo(offsetX + W, offsetY + y * gridSize);
  }
  g.stroke({ width: 1, color: 0xffffff, alpha: 0.12 });
  return g;
}

export function worldToCell(worldX, worldY, room) {
  const { grid_size, offset_x = 0, offset_y = 0 } = room;
  return {
    x: (worldX - offset_x) / grid_size,
    y: (worldY - offset_y) / grid_size,
  };
}

export function cellToWorld(cellX, cellY, room) {
  const { grid_size, offset_x = 0, offset_y = 0 } = room;
  return {
    x: offset_x + cellX * grid_size,
    y: offset_y + cellY * grid_size,
  };
}

export function snapCell(cellX, cellY) {
  return { x: Math.floor(cellX), y: Math.floor(cellY) };
}

// Bresenham-style line of cells from a (inclusive) to b (inclusive), in grid coordinates.
export function lineCells(a, b) {
  const cells = [];
  let x0 = Math.floor(a.x), y0 = Math.floor(a.y);
  const x1 = Math.floor(b.x), y1 = Math.floor(b.y);
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  // Cap to avoid runaway when dragging far off-map
  let safety = 200;
  while (safety-- > 0) {
    cells.push({ x: x0, y: y0 });
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
  return cells;
}
