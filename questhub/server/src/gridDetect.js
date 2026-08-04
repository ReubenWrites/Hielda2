// Automatic map-grid detection.
//
// Battle maps usually have a printed square grid. We find it by:
//  1. downsampling + grayscaling the image,
//  2. building edge-strength profiles for columns and rows
//     (grid lines create periodic spikes),
//  3. autocorrelating each profile to find the dominant period (the pitch),
//  4. checking the half-period to avoid locking onto a harmonic,
//  5. finding the phase (offset) that lines up with the strongest edges.
//
// Returns { gridSize, offsetX, offsetY, gridW, gridH, confidence } in native
// pixels, or null when no convincing period exists (e.g. gridless art maps).

import sharp from 'sharp';

const MAX_ANALYSIS_WIDTH = 1600;
const MIN_PITCH_PX = 20;   // native px — smaller squares than this are noise
const MAX_PITCH_PX = 400;

export async function detectGrid(filePath) {
  const meta = await sharp(filePath).metadata();
  const W = meta.width, H = meta.height;
  if (!W || !H) return null;
  const scale = W > MAX_ANALYSIS_WIDTH ? MAX_ANALYSIS_WIDTH / W : 1;
  const w = Math.max(1, Math.round(W * scale));
  const h = Math.max(1, Math.round(H * scale));
  const buf = await sharp(filePath)
    .grayscale()
    .resize(w, h, { fit: 'fill' })
    .raw()
    .toBuffer();

  const colProf = new Float64Array(w - 1);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w - 1; x++) {
      colProf[x] += Math.abs(buf[row + x + 1] - buf[row + x]);
    }
  }
  const rowProf = new Float64Array(h - 1);
  for (let y = 0; y < h - 1; y++) {
    let s = 0;
    const rowA = y * w, rowB = (y + 1) * w;
    for (let x = 0; x < w; x++) s += Math.abs(buf[rowB + x] - buf[rowA + x]);
    rowProf[y] = s;
  }

  const minLag = Math.max(6, Math.floor(MIN_PITCH_PX * scale));
  const maxLagX = Math.min(Math.floor(colProf.length / 3), Math.ceil(MAX_PITCH_PX * scale));
  const maxLagY = Math.min(Math.floor(rowProf.length / 3), Math.ceil(MAX_PITCH_PX * scale));
  const gx = bestPeriod(colProf, minLag, maxLagX);
  const gy = bestPeriod(rowProf, minLag, maxLagY);
  if (!gx || !gy) return null;

  // The two axes must agree (square grid).
  const diff = Math.abs(gx.lag - gy.lag) / Math.max(gx.lag, gy.lag);
  if (diff > 0.12) return null;

  const pitchScaled = (gx.lag + gy.lag) / 2;
  const gridSize = Math.round(pitchScaled / scale);
  const offsetX = Math.round(gx.off / scale) % gridSize;
  const offsetY = Math.round(gy.off / scale) % gridSize;
  const confidence = Math.min(gx.conf, gy.conf);
  return {
    gridSize,
    offsetX,
    offsetY,
    gridW: Math.max(1, Math.ceil((W - offsetX) / gridSize)),
    gridH: Math.max(1, Math.ceil((H - offsetY) / gridSize)),
    imageW: W,
    imageH: H,
    confidence,
  };
}

function bestPeriod(prof, minLag, maxLag) {
  const n = prof.length;
  if (maxLag <= minLag) return null;
  const mean = prof.reduce((a, b) => a + b, 0) / n;
  const cent = Float64Array.from(prof, v => v - mean);
  const variance = cent.reduce((a, b) => a + b * b, 0) / n;
  if (variance === 0) return null;

  const score = (lag) => {
    let s = 0, c = 0;
    for (let i = 0; i + lag < n; i++) { s += cent[i] * cent[i + lag]; c++; }
    return c > 0 ? (s / c) / variance : -Infinity;
  };

  let bestLag = 0, bestScore = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    const s = score(lag);
    if (s > bestScore) { bestScore = s; bestLag = lag; }
  }
  if (bestScore <= 0) return null;

  // Harmonic check: a lag of N×pitch scores as well as the pitch itself, so
  // walk down the integer divisors and take the SMALLEST one that still
  // scores nearly as well — that's the fundamental period.
  for (let k = Math.floor(bestLag / minLag); k >= 2; k--) {
    const cand = Math.round(bestLag / k);
    if (cand >= minLag && score(cand) >= bestScore * 0.72) {
      bestLag = cand;
      break;
    }
  }

  // Phase: which offset lines up with the strongest edges.
  let bestOff = 0, bestSum = -Infinity;
  for (let off = 0; off < bestLag; off++) {
    let s = 0, c = 0;
    for (let i = off; i < n; i += bestLag) { s += prof[i]; c++; }
    const avg = s / c;
    if (avg > bestSum) { bestSum = avg; bestOff = off; }
  }
  return { lag: bestLag, off: bestOff, conf: bestScore };
}
