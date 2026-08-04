// Grid calibration from two clicked corners of a single map square.
//
// p1, p2: opposite corners of ONE square, in map-native pixels.
// mapW, mapH: the map image's natural dimensions.
// Returns { gridSize, offsetX, offsetY, gridW, gridH } or null if degenerate.

export function computeGridFromSquare(p1, p2, mapW, mapH) {
  const dx = Math.abs(p2.x - p1.x);
  const dy = Math.abs(p2.y - p1.y);
  if (dx < 4 || dy < 4) return null;
  const gridSize = Math.round((dx + dy) / 2);
  if (gridSize < 8) return null;
  const left = Math.min(p1.x, p2.x);
  const top = Math.min(p1.y, p2.y);
  const offsetX = Math.round(((left % gridSize) + gridSize) % gridSize);
  const offsetY = Math.round(((top % gridSize) + gridSize) % gridSize);
  const gridW = Math.max(1, Math.ceil(((mapW || gridSize * 30) - offsetX) / gridSize));
  const gridH = Math.max(1, Math.ceil(((mapH || gridSize * 20) - offsetY) / gridSize));
  return { gridSize, offsetX, offsetY, gridW, gridH };
}
