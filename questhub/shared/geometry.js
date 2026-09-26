// Token geometry shared by client and server.
//
// A token's (x, y) is the top-left cell it occupies; `size` is how many
// cells it spans per side (1 = Medium, 2 = Large, 3 = Huge, 4 = Gargantuan).

export function tokenSize(t) {
  const s = Number(t?.size);
  return Number.isFinite(s) && s > 0 ? s : 1;
}

export function tokenCenter(t) {
  const s = tokenSize(t);
  return { x: t.x + s / 2, y: t.y + s / 2 };
}

// Gap between the two tokens' footprints in cells (Chebyshev), 0 = touching.
export function gapBetween(a, b) {
  const sa = tokenSize(a), sb = tokenSize(b);
  const dx = Math.max(0, Math.max(a.x - (b.x + sb), b.x - (a.x + sa)));
  const dy = Math.max(0, Math.max(a.y - (b.y + sb), b.y - (a.y + sa)));
  return Math.max(dx, dy);
}

// Can `attacker` hit `target` with `reachFt` of reach on a grid of feetPerCell?
// Adjacent (gap 0, even diagonally) always counts as within 5 ft.
export function withinReach(attacker, target, reachFt = 5, feetPerCell = 5) {
  const gap = gapBetween(attacker, target);
  if (gap <= 0.01) return true;
  // Distance is measured from footprint edge to footprint edge; a gap of
  // one cell means the far cell's centre is 2 cells away, i.e. 10 ft.
  return (gap + 1) * feetPerCell <= reachFt + 0.01;
}
