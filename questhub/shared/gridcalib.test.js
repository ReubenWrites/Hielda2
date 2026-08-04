import { describe, test, expect } from 'vitest';
import { computeGridFromSquare } from './gridcalib.js';

describe('computeGridFromSquare', () => {
  test('computes grid from one square', () => {
    // Square from (150, 220) to (225, 295): 75px pitch, offset 0 (150 % 75), 220 % 75 = 70
    const g = computeGridFromSquare({ x: 150, y: 220 }, { x: 225, y: 295 }, 2400, 3300);
    expect(g.gridSize).toBe(75);
    expect(g.offsetX).toBe(0);
    expect(g.offsetY).toBe(70);
    expect(g.gridW).toBe(32);
    expect(g.gridH).toBe(Math.ceil((3300 - 70) / 75));
  });

  test('corner order does not matter', () => {
    const a = computeGridFromSquare({ x: 100, y: 100 }, { x: 150, y: 150 }, 1000, 1000);
    const b = computeGridFromSquare({ x: 150, y: 150 }, { x: 100, y: 100 }, 1000, 1000);
    expect(a).toEqual(b);
  });

  test('rejects degenerate clicks', () => {
    expect(computeGridFromSquare({ x: 10, y: 10 }, { x: 11, y: 12 }, 1000, 1000)).toBeNull();
  });

  test('averages non-square drags', () => {
    const g = computeGridFromSquare({ x: 0, y: 0 }, { x: 70, y: 80 }, 1000, 1000);
    expect(g.gridSize).toBe(75);
  });
});
