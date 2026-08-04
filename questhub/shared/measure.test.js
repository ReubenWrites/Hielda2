import { describe, test, expect } from 'vitest';
import { formatFeet, measureMoveFeet } from './measure.js';

describe('formatFeet', () => {
  test('small distances in feet', () => {
    expect(formatFeet(15)).toBe('15 ft');
    expect(formatFeet(995)).toBe('995 ft');
  });

  test('large distances in miles', () => {
    expect(formatFeet(5280)).toBe('1 mi');
    expect(formatFeet(6336)).toBe('1.2 mi');
    expect(formatFeet(66000)).toBe('13 mi');
  });

  test('quarter-mile squares read naturally', () => {
    // 3 squares on the Barovia overland (1 sq = 1320 ft)
    expect(formatFeet(3 * 1320)).toBe('0.8 mi');
  });
});

describe('measureMoveFeet', () => {
  test('square grid: steps × feet per square', () => {
    expect(measureMoveFeet({
      from: { x: 0, y: 0 },
      path: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }],
      feetPerCell: 5,
      gridType: 'square',
    })).toBe(15);
  });

  test('free map: euclidean distance', () => {
    expect(measureMoveFeet({
      from: { x: 0, y: 0 },
      path: [{ x: 3, y: 4 }],
      feetPerCell: 1320,
      gridType: 'free',
    })).toBe(5 * 1320);
  });

  test('empty path is zero', () => {
    expect(measureMoveFeet({ from: { x: 0, y: 0 }, path: [], gridType: 'free' })).toBe(0);
  });
});
