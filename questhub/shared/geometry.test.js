import { describe, test, expect } from 'vitest';
import { tokenSize, tokenCenter, gapBetween, withinReach } from './geometry.js';

describe('token geometry', () => {
  test('size defaults to 1 and centre is the middle of the footprint', () => {
    expect(tokenSize({})).toBe(1);
    expect(tokenCenter({ x: 3, y: 4 })).toEqual({ x: 3.5, y: 4.5 });
    expect(tokenCenter({ x: 3, y: 4, size: 2 })).toEqual({ x: 4, y: 5 });
  });

  test('gap between footprints', () => {
    expect(gapBetween({ x: 0, y: 0 }, { x: 1, y: 0 })).toBe(0);            // adjacent
    expect(gapBetween({ x: 0, y: 0 }, { x: 1, y: 1 })).toBe(0);            // diagonal
    expect(gapBetween({ x: 0, y: 0 }, { x: 2, y: 0 })).toBe(1);            // one empty cell
    expect(gapBetween({ x: 0, y: 0, size: 2 }, { x: 2, y: 1 })).toBe(0);   // large token touching
    expect(gapBetween({ x: 0, y: 0, size: 2 }, { x: 4, y: 0 })).toBe(2);
  });

  test('reach: melee only when touching, bows reach across the room', () => {
    expect(withinReach({ x: 0, y: 0 }, { x: 1, y: 1 }, 5)).toBe(true);
    expect(withinReach({ x: 0, y: 0 }, { x: 2, y: 0 }, 5)).toBe(false);
    expect(withinReach({ x: 0, y: 0 }, { x: 2, y: 0 }, 10)).toBe(true);    // polearm
    expect(withinReach({ x: 0, y: 0 }, { x: 6, y: 0 }, 30)).toBe(true);    // 6 cells = 30 ft
    expect(withinReach({ x: 0, y: 0 }, { x: 7, y: 0 }, 30)).toBe(false);
  });
});
