// Distance measurement + formatting.

const FEET_PER_MILE = 5280;

export function formatFeet(ft) {
  if (!Number.isFinite(ft)) return '?';
  if (ft < 1000) {
    return `${Math.round(ft)} ft`;
  }
  const mi = ft / FEET_PER_MILE;
  if (mi < 0.1) return `${Math.round(ft)} ft`;
  return mi < 10 ? `${(Math.round(mi * 10) / 10)} mi` : `${Math.round(mi)} mi`;
}

// Feet covered by a move.
//   square grids: each path step is one square.
//   free (overland) maps: euclidean distance through the waypoints.
// `from` is the token's current position, `path` the proposed steps (token coords).
export function measureMoveFeet({ from, path, feetPerCell = 5, gridType = 'square' }) {
  if (!Array.isArray(path) || path.length === 0) return 0;
  if (gridType !== 'free') return path.length * feetPerCell;
  let total = 0;
  let prev = from;
  for (const p of path) {
    total += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
  }
  return total * feetPerCell;
}
