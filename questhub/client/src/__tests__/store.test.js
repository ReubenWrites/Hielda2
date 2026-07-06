import { describe, test, expect, beforeEach } from 'vitest';
import { useStore } from '../state/store.js';

beforeEach(() => {
  useStore.setState({
    role: null, you: null, dmSecret: null,
    room: null, tokens: [], walls: [], proposals: [], chat: [],
    selectedTokenId: null, tool: 'select', spell: null, status: null,
  });
});

describe('store', () => {
  test('hydrate populates room state', () => {
    useStore.getState().hydrate({
      role: 'dm',
      you: { id: 's1', name: 'GM' },
      state: {
        room: { id: 'ABC123', name: 'Test', grid_size: 64, grid_w: 30, grid_h: 20 },
        tokens: [{ id: 't1', name: 'Goblin', x: 0, y: 0 }],
        walls: [{ id: 'w1', x1: 0, y1: 0, x2: 5, y2: 0, isDoor: false, doorOpen: false }],
      },
      chat: [{ id: 'm1', from: 'system', type: 'system', text: 'joined', ts: 1 }],
      proposals: [],
    });
    const s = useStore.getState();
    expect(s.role).toBe('dm');
    expect(s.room.id).toBe('ABC123');
    expect(s.tokens).toHaveLength(1);
    expect(s.walls).toHaveLength(1);
    expect(s.chat).toHaveLength(1);
  });

  test('upsertToken adds then updates', () => {
    const s = useStore.getState();
    s.upsertToken({ id: 't1', name: 'A', x: 0, y: 0 });
    s.upsertToken({ id: 't1', x: 5 });
    expect(useStore.getState().tokens).toHaveLength(1);
    expect(useStore.getState().tokens[0].x).toBe(5);
    expect(useStore.getState().tokens[0].name).toBe('A');
  });

  test('removeToken clears selection if matching', () => {
    const s = useStore.getState();
    s.upsertToken({ id: 't1' });
    s.setSelected('t1');
    s.removeToken('t1');
    expect(useStore.getState().tokens).toHaveLength(0);
    expect(useStore.getState().selectedTokenId).toBe(null);
  });

  test('appendChat caps history at 200', () => {
    const s = useStore.getState();
    for (let i = 0; i < 250; i++) s.appendChat({ id: `m${i}`, text: `${i}`, type: 'chat' });
    expect(useStore.getState().chat.length).toBeLessThanOrEqual(200);
    // most recent kept
    expect(useStore.getState().chat[useStore.getState().chat.length - 1].text).toBe('249');
  });

  test('setSpell flips tool to cast-spell', () => {
    const s = useStore.getState();
    s.setSpell({ kind: 'fireball', color: 0xff0000 });
    expect(useStore.getState().tool).toBe('cast-spell');
    expect(useStore.getState().spell.kind).toBe('fireball');
    s.setSpell(null);
    expect(useStore.getState().tool).toBe('select');
    expect(useStore.getState().spell).toBe(null);
  });
});
