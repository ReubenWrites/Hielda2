import { create } from 'zustand';

export const useStore = create((set, get) => ({
  // Identity
  role: null,             // 'dm' | 'player' | null
  you: null,              // { id, name }
  dmSecret: null,         // stored client-side if you created the room

  // Room state from server. `room` = room identity + the scene being viewed.
  room: null,             // { id, name, scene_id, scene_name, map_image_url, grid_*, feet_per_cell, grid_type }
  scenes: [],             // [{ id, name, mapImageUrl, gridType, tokenCount }]
  tokens: [],
  walls: [],
  assets: [],
  characters: [],         // DM only: the cast with sheets/notes
  proposals: [],
  chat: [],
  initiative: null,       // { order: [{tokenId, name, roll}], turn } | null
  presence: [],           // [{ socketId, name, role, sceneId }]
  viewAs: null,           // DM only: player name whose view is being previewed
  explored: {},           // { owner: string[] } explored cells for the viewed scene

  // Local UI state
  selectedTokenId: null,
  tool: 'select',         // 'select' | 'add-token' | 'draw-wall' | 'draw-door' | 'erase-wall' | 'toggle-door' | 'align-grid' | 'cast-spell'
  spell: null,            // when picking a target for a cast: { kind, color }
  spawnTemplate: null,    // pending token blueprint while tool === 'add-token'
  status: null,           // transient banner message
  handout: null,          // { url, title } currently splashed on screen

  setStatus: (text, ttl = 3000) => {
    set({ status: text });
    if (ttl) setTimeout(() => {
      if (get().status === text) set({ status: null });
    }, ttl);
  },

  hydrate: ({ role, you, state, chat, proposals, initiative, presence, explored, characters, paused, mySheets }) => set({
    paused: !!paused,
    mySheets: mySheets || [],
    role,
    you,
    room: state.room,
    scenes: state.scenes || [],
    tokens: state.tokens,
    walls: state.walls,
    assets: state.assets || [],
    characters: characters || [],
    chat: chat || [],
    proposals: proposals || [],
    initiative: initiative || null,
    presence: presence || [],
    explored: explored || {},
  }),

  // Switching maps: everything scene-scoped is replaced in one go.
  enterScene: ({ state, explored }) => set({
    room: state.room,
    scenes: state.scenes || [],
    tokens: state.tokens,
    walls: state.walls,
    assets: state.assets || [],
    explored: explored || {},
    selectedTokenId: null,
  }),

  setRoom: (room) => set({ room }),
  setScenes: (scenes) => set({ scenes }),

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

  upsertCharacter: (c) => set((s) => {
    const i = s.characters.findIndex(x => x.id === c.id);
    if (i === -1) return { characters: [...s.characters, c] };
    const next = s.characters.slice();
    next[i] = { ...next[i], ...c };
    return { characters: next };
  }),

  removeCharacter: (id) => set((s) => ({ characters: s.characters.filter(c => c.id !== id) })),
  setCharacters: (characters) => set({ characters }),

  setExplored: (owner, cells) => set((s) => ({ explored: { ...s.explored, [owner]: cells } })),
  resetExplored: () => set({ explored: {} }),

  setInitiative: (initiative) => set({ initiative }),
  setPresence: (presence) => set({ presence }),
  setViewAs: (viewAs) => set({ viewAs }),
  setHandout: (handout) => set({ handout }),
  paused: false,          // DM has called a hold: players' actions are frozen
  setPaused: (paused) => set({ paused }),
  mySheets: [],           // players: their own characters (no DM notes)
  upsertMySheet: (c) => set((s) => {
    const i = s.mySheets.findIndex(x => x.id === c.id);
    if (i === -1) return { mySheets: [...s.mySheets, c] };
    const next = s.mySheets.slice(); next[i] = c; return { mySheets: next };
  }),
  sessionSummary: null,
  setSessionSummary: (sessionSummary) => set({ sessionSummary }),

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
