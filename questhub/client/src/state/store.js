import { create } from 'zustand';

export const useStore = create((set, get) => ({
  // Identity
  role: null,             // 'dm' | 'player' | null
  you: null,              // { id, name }
  dmSecret: null,         // stored client-side if you created the room

  // Room state from server
  room: null,             // { id, name, map_image_url, grid_size, grid_w, grid_h, offset_x, offset_y }
  tokens: [],
  walls: [],
  proposals: [],
  chat: [],

  // Local UI state
  selectedTokenId: null,
  tool: 'select',         // 'select' | 'add-token' | 'draw-wall' | 'draw-door' | 'erase-wall' | 'toggle-door' | 'cast-spell'
  spell: null,            // when picking a target for a cast: { kind, color }
  status: null,           // transient banner message

  setStatus: (text, ttl = 3000) => {
    set({ status: text });
    if (ttl) setTimeout(() => {
      if (get().status === text) set({ status: null });
    }, ttl);
  },

  hydrate: ({ role, you, state, chat, proposals }) => set({
    role,
    you,
    room: state.room,
    tokens: state.tokens,
    walls: state.walls,
    chat: chat || [],
    proposals: proposals || [],
  }),

  setRoom: (room) => set({ room }),

  upsertToken: (t) => set((s) => {
    const i = s.tokens.findIndex(x => x.id === t.id);
    if (i === -1) return { tokens: [...s.tokens, t] };
    const next = s.tokens.slice();
    next[i] = { ...next[i], ...t };
    return { tokens: next };
  }),

  removeToken: (id) => set((s) => ({
    tokens: s.tokens.filter(t => t.id !== id),
    selectedTokenId: s.selectedTokenId === id ? null : s.selectedTokenId,
  })),

  upsertWall: (w) => set((s) => {
    const i = s.walls.findIndex(x => x.id === w.id);
    if (i === -1) return { walls: [...s.walls, w] };
    const next = s.walls.slice();
    next[i] = { ...next[i], ...w };
    return { walls: next };
  }),

  removeWall: (id) => set((s) => ({ walls: s.walls.filter(w => w.id !== id) })),

  addProposal: (p) => set((s) => ({
    proposals: [...s.proposals.filter(x => x.id !== p.id), p],
  })),

  removeProposal: (id) => set((s) => ({ proposals: s.proposals.filter(p => p.id !== id) })),

  appendChat: (msg) => set((s) => ({ chat: [...s.chat.slice(-199), msg] })),

  setSelected: (id) => set({ selectedTokenId: id }),
  setTool: (tool) => set({ tool, spell: null }),
  setSpell: (spell) => set({ spell, tool: spell ? 'cast-spell' : 'select' }),
  setDmSecret: (s) => set({ dmSecret: s }),
}));
