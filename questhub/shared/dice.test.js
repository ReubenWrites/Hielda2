import { describe, test, expect } from 'vitest';
import { parseDice, rollDice, formatRoll } from './dice.js';

const fixedRng = (sequence) => {
  let i = 0;
  return () => {
    const v = sequence[i % sequence.length];
    i++;
    return v;
  };
};

describe('parseDice', () => {
  test('parses simple NdM', () => {
    const t = parseDice('1d20');
    expect(t).toEqual([{ kind: 'dice', sign: 1, n: 1, d: 20, keepMode: null, keepCount: null }]);
  });

  test('parses NdM+K', () => {
    const t = parseDice('2d6+3');
    expect(t[0]).toMatchObject({ kind: 'dice', n: 2, d: 6 });
    expect(t[1]).toMatchObject({ kind: 'const', sign: 1, value: 3 });
  });

  test('parses negative modifier', () => {
    const t = parseDice('1d8-1');
    expect(t[1]).toMatchObject({ kind: 'const', sign: -1, value: 1 });
  });

  test('parses advantage (2d20kh1)', () => {
    const t = parseDice('2d20kh1');
    expect(t[0]).toMatchObject({ n: 2, d: 20, keepMode: 'h', keepCount: 1 });
  });

  test('rejects empty', () => {
    expect(() => parseDice('')).toThrow();
  });

  test('rejects garbage', () => {
    expect(() => parseDice('hello')).toThrow();
  });

  test('rejects zero dice', () => {
    expect(() => parseDice('0d20')).toThrow();
  });
});

describe('rollDice', () => {
  test('rolls 1d20+5 deterministically', () => {
    // rng returns 0.5 -> floor(0.5*20)+1 = 11
    const r = rollDice('1d20+5', () => 0.5);
    expect(r.total).toBe(16);
    expect(r.terms[0].rolls).toEqual([11]);
  });

  test('advantage keeps high', () => {
    // first roll: 0.05 -> 2, second roll: 0.95 -> 20 (with d=20: floor(0.95*20)+1=20)
    const r = rollDice('2d20kh1', fixedRng([0.05, 0.95]));
    expect(r.terms[0].rolls).toEqual([2, 20]);
    expect(r.terms[0].kept).toEqual([20]);
    expect(r.total).toBe(20);
  });

  test('disadvantage keeps low', () => {
    const r = rollDice('2d20kl1', fixedRng([0.95, 0.05]));
    expect(r.terms[0].kept).toEqual([2]);
    expect(r.total).toBe(2);
  });

  test('negative modifier subtracts', () => {
    const r = rollDice('1d6-2', () => 0.999);
    // floor(0.999*6)+1 = 6
    expect(r.total).toBe(4);
  });

  test('multi-term', () => {
    const r = rollDice('1d4+1d6+2', fixedRng([0, 0]));
    // 1d4 -> 1, 1d6 -> 1, +2 -> 4
    expect(r.total).toBe(4);
  });
});

describe('formatRoll', () => {
  test('formats a roll readably', () => {
    const r = rollDice('1d20+5', () => 0.5);
    const s = formatRoll(r);
    expect(s).toMatch(/1d20\[11\]\+5 = 16/);
  });
});
