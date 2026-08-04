import { describe, test, expect, beforeAll } from 'vitest';
import sharp from 'sharp';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { detectGrid } from '../src/gridDetect.js';

let gridFile, plainFile;

beforeAll(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'questhub-grid-'));

  // Synthetic battle map: 820x620, dark grid lines every 50px starting at offset 10.
  const W = 820, H = 620, PITCH = 50, OFF = 10;
  const buf = Buffer.alloc(W * H * 3, 235);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const onGrid = ((x - OFF) % PITCH === 0 && x >= OFF) || ((y - OFF) % PITCH === 0 && y >= OFF);
      if (onGrid) {
        const i = (y * W + x) * 3;
        buf[i] = 90; buf[i + 1] = 85; buf[i + 2] = 80;
      }
    }
  }
  gridFile = path.join(dir, 'grid.png');
  await sharp(buf, { raw: { width: W, height: H, channels: 3 } }).png().toFile(gridFile);

  // Gridless: uniform noise
  const noise = Buffer.alloc(W * H * 3);
  let seed = 12345;
  for (let i = 0; i < noise.length; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    noise[i] = 120 + (seed % 60);
  }
  plainFile = path.join(dir, 'plain.png');
  await sharp(noise, { raw: { width: W, height: H, channels: 3 } }).png().toFile(plainFile);
});

describe('detectGrid', () => {
  test('finds a 50px grid with offset', async () => {
    const r = await detectGrid(gridFile);
    expect(r).not.toBeNull();
    expect(Math.abs(r.gridSize - 50)).toBeLessThanOrEqual(1);
    expect(Math.abs(r.offsetX - 10)).toBeLessThanOrEqual(2);
    expect(Math.abs(r.offsetY - 10)).toBeLessThanOrEqual(2);
    expect(r.confidence).toBeGreaterThan(0.2);
  });

  test('rejects a gridless image', async () => {
    const r = await detectGrid(plainFile);
    if (r) expect(r.confidence).toBeLessThan(0.2);
  });
});
