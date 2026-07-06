import { describe, test, expect } from 'vitest';
import { computeVisibleCells, isBlocked, segmentsIntersect } from './vision.js';

describe('segmentsIntersect', () => {
  test('crossing segments intersect', () => {
    expect(segmentsIntersect(
      { x: 0, y: 0 }, { x: 10, y: 10 },
      { x: 0, y: 10 }, { x: 10, y: 0 }
    )).toBe(true);
  });

  test('non-crossing segments do not intersect', () => {
    expect(segmentsIntersect(
      { x: 0, y: 0 }, { x: 1, y: 0 },
      { x: 0, y: 1 }, { x: 1, y: 1 }
    )).toBe(false);
  });

  test('parallel segments return false', () => {
    expect(segmentsIntersect(
      { x: 0, y: 0 }, { x: 5, y: 0 },
      { x: 0, y: 1 }, { x: 5, y: 1 }
    )).toBe(false);
  });

  test('wall ending exactly at target does not block', () => {
    // Ray 0,0 -> 5,0, wall touches at endpoint 5,0
    expect(segmentsIntersect(
      { x: 0, y: 0 }, { x: 5, y: 0 },
      { x: 5, y: -1 }, { x: 5, y: 0 }
    )).toBe(false);
  });
});

describe('computeVisibleCells', () => {
  test('no walls: cells within radius are visible', () => {
    const vis = computeVisibleCells({
      origin: { x: 5.5, y: 5.5 },
      radius: 2,
      walls: [],
      gridW: 12,
      gridH: 12,
    });
    expect(vis.has('5,5')).toBe(true);
    expect(vis.has('5,4')).toBe(true);
    expect(vis.has('6,5')).toBe(true);
    // Beyond radius
    expect(vis.has('5,9')).toBe(false);
  });

  test('wall blocks cells behind it', () => {
    // Vertical wall at x=4 from y=0 to y=10
    const walls = [{ x1: 4, y1: 0, x2: 4, y2: 10 }];
    const vis = computeVisibleCells({
      origin: { x: 2.5, y: 5.5 },
      radius: 5,
      walls,
      gridW: 10,
      gridH: 10,
    });
    // Cell at (1,5) on the same side as the origin should be visible
    expect(vis.has('1,5')).toBe(true);
    // Cell at (5,5) on the far side of the wall should be blocked
    expect(vis.has('5,5')).toBe(false);
    expect(vis.has('6,5')).toBe(false);
  });

  test('origin cell always visible', () => {
    const vis = computeVisibleCells({
      origin: { x: 0.5, y: 0.5 },
      radius: 0,
      walls: [],
      gridW: 5,
      gridH: 5,
    });
    expect(vis.has('0,0')).toBe(true);
  });

  test('respects grid bounds', () => {
    const vis = computeVisibleCells({
      origin: { x: 0.5, y: 0.5 },
      radius: 10,
      walls: [],
      gridW: 3,
      gridH: 3,
    });
    // No cell outside 0..2
    for (const k of vis) {
      const [x, y] = k.split(',').map(Number);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(3);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThan(3);
    }
  });
});

describe('isBlocked', () => {
  test('returns true when wall crosses ray', () => {
    expect(isBlocked(
      { x: 0, y: 0 }, { x: 4, y: 0 },
      [{ x1: 2, y1: -1, x2: 2, y2: 1 }]
    )).toBe(true);
  });

  test('returns false when no walls', () => {
    expect(isBlocked({ x: 0, y: 0 }, { x: 4, y: 0 }, [])).toBe(false);
  });
});
