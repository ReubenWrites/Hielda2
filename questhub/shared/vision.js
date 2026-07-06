// Vision / line-of-sight helpers.
//
// Inputs:
//   origin: { x, y } in grid-cell units (can be fractional, usually +0.5 for cell center)
//   radius: in grid cells
//   walls: array of { x1, y1, x2, y2 } segments in grid units
//   cells: optional set of cells to test; otherwise we test the bounding box of the radius
//
// Output:
//   Set of "x,y" cell keys visible from origin (cells whose center is inside the radius AND not blocked).
//
// Algorithm: for each candidate cell center, raycast from origin and check if any wall segment
// intersects the line strictly between the two endpoints. If none, cell is visible.

export function segmentsIntersect(a, b, c, d) {
  // a-b: ray; c-d: wall segment
  const r = { x: b.x - a.x, y: b.y - a.y };
  const s = { x: d.x - c.x, y: d.y - c.y };
  const denom = r.x * s.y - r.y * s.x;
  if (denom === 0) return false; // parallel — treat as non-blocking (avoid edge weirdness)
  const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / denom;
  const u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / denom;
  // Strict inequality on the ray side (t < 1) so a wall ending exactly at the target doesn't block;
  // inclusive on wall endpoints so a wall touching is still treated as blocking.
  return t > 1e-9 && t < 1 - 1e-9 && u >= -1e-9 && u <= 1 + 1e-9;
}

export function isBlocked(origin, target, walls) {
  for (const w of walls) {
    if (segmentsIntersect(origin, target, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 })) return true;
  }
  return false;
}

export function computeVisibleCells({ origin, radius, walls, gridW, gridH }) {
  const visible = new Set();
  const minX = Math.max(0, Math.floor(origin.x - radius));
  const maxX = Math.min(gridW - 1, Math.ceil(origin.x + radius));
  const minY = Math.max(0, Math.floor(origin.y - radius));
  const maxY = Math.min(gridH - 1, Math.ceil(origin.y + radius));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const cx = x + 0.5;
      const cy = y + 0.5;
      const dx = cx - origin.x;
      const dy = cy - origin.y;
      if (dx * dx + dy * dy > radius * radius) continue;
      if (!isBlocked(origin, { x: cx, y: cy }, walls)) visible.add(`${x},${y}`);
    }
  }
  // Origin cell is always visible.
  visible.add(`${Math.floor(origin.x)},${Math.floor(origin.y)}`);
  return visible;
}

export function unionVisible(setsIterable) {
  const out = new Set();
  for (const s of setsIterable) for (const k of s) out.add(k);
  return out;
}
