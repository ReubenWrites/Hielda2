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
  assets: [],
  proposals: [],
  chat: [],
  initiative: null,       // { order: [{tokenId, name, roll}], turn } | null
  presence: [],           // [{ socketId, name, role }]
  viewAs: null,           // DM only: player name whose view is being previewed

  // Local UI state
  selectedTokenId: null,
  tool: 'select',         // 'select' | 'add-token' | 'draw-wall' | 'draw-door' | 'erase-wall' | 'toggle-door' | 'cast-spell'
  spell: null,            // when picking a target for a cast: { kind, color }
  spawnTemplate: null,    // pending token blueprint while tool === 'add-token'
  status: null,           // transient banner message

  setStatus: (text, ttl = 3000) => {
    set({ status: text });
    if (ttl) setTimeout(() => {
      if (get().status === text) set({ status: null });
    }, ttl);
  },

  hydrate: ({ role, you, state, chat, proposals, initiative, presence }) => set({
    presence: presence || [],
    role,
    you,
    room: state.room,
    tokens: state.tokens,
    walls: state.walls,
    assets: state.assets || [],
    chat: chat || [],
    proposals: proposals || [],
    initiative: initiative || null,
  }),

  resync: (state) => set({
    room: state.room,
    tokens: state.tokens,
    walls: state.walls,
    assets: state.assets || [],
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

  upsertAsset: (a) => set((s) => {
    const i = s.assets.findIndex(x => x.id === a.id);
    if (i === -1) return { assets: [...s.assets, a] };
    const next = s.assets.slice();
    next[i] = { ...next[i], ...a };
    return { assets: next };
  }),

  removeAsset: (id) => set((s) => ({ assets: s.assets.filter(a => a.id !== id) })),

  setInitiative: (initiative) => set({ initiative }),
  setPresence: (presence) => set({ presence }),
  setViewAs: (viewAs) => set({ viewAs }),
  handout: null,          // { url, title } currently splashed on screen
  setHandout: (handout) => set({ handout }),

  addProposal: (p) => set((s) => ({
    proposals: [...s.proposals.filter(x => x.id !== p.id), p],
  })),

  removeProposal: (id) => set((s) => ({ proposals: s.proposals.filter(p => p.id !== id) })),

  appendChat: (msg) => set((s) => ({ chat: [...s.chat.slice(-199), msg] })),

  setSelected: (id) => set({ selectedTokenId: id }),
  setTool: (tool) => set({ tool, spell: null, spawnTemplate: null }),
  setSpell: (spell) => set({ spell, tool: spell ? 'cast-spell' : 'select', spawnTemplate: null }),
  setSpawnTemplate: (tpl) => set({ spawnTemplate: tpl, tool: tpl ? 'add-token' : 'select', spell: null }),
  setDmSecret: (s) => set({ dmSecret: s }),
}));
