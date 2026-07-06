import { describe, test, expect } from 'vitest';
import { computeFog, tokenVisibleToViewer } from '../game/fog.js';

const room = { grid_w: 10, grid_h: 10, grid_size: 64 };

describe('computeFog', () => {
  test('DM gets null (no fog)', () => {
    const set = computeFog({ role: 'dm', you: { name: 'GM' }, tokens: [], walls: [], room });
    expect(set).toBeNull();
  });

  test('player with no tokens sees nothing', () => {
    const set = computeFog({ role: 'player', you: { name: 'P' }, tokens: [], walls: [], room });
    expect(set.size).toBe(0);
  });

  test("player sees cells around their token", () => {
    const tokens = [{ id: 't1', owner: 'P', x: 5, y: 5, sightRadius: 2 }];
    const set = computeFog({ role: 'player', you: { name: 'P' }, tokens, walls: [], room });
    expect(set.has('5,5')).toBe(true);
    expect(set.has('4,5')).toBe(true);
    expect(set.has('5,4')).toBe(true);
    expect(set.has('9,9')).toBe(false);
  });

  test('player does not see through walls', () => {
    const tokens = [{ id: 't1', owner: 'P', x: 2, y: 5, sightRadius: 5 }];
    const walls = [{ x1: 4, y1: 0, x2: 4, y2: 10 }];
    const set = computeFog({ role: 'player', you: { name: 'P' }, tokens, walls, room });
    expect(set.has('2,5')).toBe(true); // own cell
    expect(set.has('6,5')).toBe(false); // behind wall
  });

  test('open door does not block', () => {
    const tokens = [{ id: 't1', owner: 'P', x: 2, y: 5, sightRadius: 5 }];
    const walls = [{ x1: 4, y1: 0, x2: 4, y2: 10, isDoor: true, doorOpen: true }];
    const set = computeFog({ role: 'player', you: { name: 'P' }, tokens, walls, room });
    expect(set.has('6,5')).toBe(true);
  });
});

describe('tokenVisibleToViewer', () => {
  test('DM (no visibleSet) sees everything', () => {
    expect(tokenVisibleToViewer({ x: 0, y: 0 }, null, { name: 'GM' })).toBe(true);
  });

  test('player sees own token even outside visible set', () => {
    const set = new Set();
    expect(tokenVisibleToViewer({ owner: 'P', x: 99, y: 99 }, set, { name: 'P' })).toBe(true);
  });

  test('player does not see hidden DM token', () => {
    const set = new Set(['5,5']);
    expect(tokenVisibleToViewer({ owner: 'dm', x: 5, y: 5, visibleToPlayers: false }, set, { name: 'P' })).toBe(false);
  });

  test('player sees visible token within their fog', () => {
    const set = new Set(['5,5']);
    expect(tokenVisibleToViewer({ owner: 'dm', x: 5, y: 5, visibleToPlayers: true }, set, { name: 'P' })).toBe(true);
  });
});
