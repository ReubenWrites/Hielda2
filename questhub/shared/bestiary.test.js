import { describe, test, expect } from 'vitest';
import { BESTIARY, findMonster } from './bestiary.js';

describe('bestiary', () => {
  test('has a useful number of entries', () => {
    expect(BESTIARY.length).toBeGreaterThanOrEqual(20);
  });

  test('every entry is complete and sane', () => {
    const keys = new Set();
    for (const m of BESTIARY) {
      expect(m.key).toBeTruthy();
      expect(keys.has(m.key)).toBe(false);
      keys.add(m.key);
      expect(m.name).toBeTruthy();
      expect(m.hp).toBeGreaterThan(0);
      expect(m.ac).toBeGreaterThanOrEqual(8);
      expect(m.sight).toBeGreaterThan(0);
      expect(m.color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  test('findMonster works', () => {
    expect(findMonster('wolf').name).toBe('Wolf');
    expect(findMonster('nope')).toBeNull();
  });
});
