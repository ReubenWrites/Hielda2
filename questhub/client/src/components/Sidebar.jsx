import { useState, useRef, useEffect } from 'react';
import { useStore } from '../state/store.js';
import { uploadImage, emit } from '../net/socket.js';
import { BESTIARY } from '@questhub/shared/bestiary';
import { computeFog, tokenVisibleToViewer } from '../game/fog.js';
import SheetPanel from './SheetPanel.jsx';

export default function Sidebar({ onCopyInvite }) {
  const role = useStore(s => s.role);
  const room = useStore(s => s.room);
  const tokens = useStore(s => s.tokens);
  const tool = useStore(s => s.tool);
  const setTool = useStore(s => s.setTool);
  const selectedTokenId = useStore(s => s.selectedTokenId);
  const setSelected = useStore(s => s.setSelected);

  const [tab, setTab] = useState('characters');

  // Role arrives async after the socket join; land DMs on their tools tab.
  const mySheets = useStore(s => s.mySheets);
  useEffect(() => {
    if (role === 'dm') setTab('dm');
    else if (role === 'player' && mySheets.length) setTab('sheet');
  }, [role, mySheets.length]);

  return (
    <div className="side">
      <div className="head">
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{room?.name}</div>
          <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            📍 {room?.scene_name || 'Scene'}
          </div>
        </div>
        <button onClick={onCopyInvite} title="Copy invite link" style={{ padding: '4px 8px' }}>
          <span className="code">{room?.id}</span>
        </button>
      </div>

      <div style={{ overflow: 'hidden', display: 'grid', gridTemplateRows: 'auto 1fr' }}>
        <div className="tabs">
          {role === 'dm' && <button className={tab === 'dm' ? 'active' : ''} onClick={() => setTab('dm')}>DM</button>}
          {role === 'dm' && <button className={tab === 'cast' ? 'active' : ''} onClick={() => setTab('cast')}>Cast</button>}
          {role === 'dm' && <button className={tab === 'library' ? 'active' : ''} onClick={() => setTab('library')}>Library</button>}
          {role !== 'dm' && <button className={tab === 'sheet' ? 'active' : ''} onClick={() => setTab('sheet')}>Sheet</button>}
          <button className={tab === 'characters' ? 'active' : ''} onClick={() => setTab('characters')}>Tokens</button>
          <button className={tab === 'chat' ? 'active' : ''} onClick={() => setTab('chat')}>Chat</button>
        </div>
        <div className="body">
          {tab === 'dm' && role === 'dm' && <DmTab tool={tool} setTool={setTool} />}
          {tab === 'cast' && role === 'dm' && <CastTab />}
          {tab === 'library' && role === 'dm' && <LibraryTab />}
          {tab === 'sheet' && role !== 'dm' && <MySheetTab />}
          {tab === 'characters' && (
            <TokenListTab
              tokens={tokens}
              selectedId={selectedTokenId}
              setSelected={setSelected}
              role={role}
            />
          )}
          {tab === 'chat' && <ChatTab />}
        </div>
      </div>
    </div>
  );
}

// Try automatic grid detection on a freshly-set map; report what happened.
export async function autoDetectGrid(url, setStatus) {
  try {
    const r = await emit('map:detect-grid', { url });
    if (r.grid && r.grid.confidence > 0.2) {
      await emit('map:config', {
        gridSize: r.grid.gridSize, gridW: r.grid.gridW, gridH: r.grid.gridH,
        offsetX: r.grid.offsetX, offsetY: r.grid.offsetY,
      });
      setStatus(`Grid detected: ${r.grid.gridSize}px squares (${r.grid.gridW}×${r.grid.gridH})`, 5000);
      return true;
    }
    setStatus('No grid detected on this map — use the 📐 Align Grid tool (click 2 corners of one square)', 8000);
    return false;
  } catch (e) {
    setStatus(`Grid detection failed: ${e.message}`, 5000);
    return false;
  }
}

// One-click player setup: make sure the player has a character sheet in the
// cast (creating a PC if not), then arm placement of that character.
export async function armPlayerCharacter(name, setStatus) {
  const clean = name.trim();
  const s = useStore.getState();
  let ch = s.characters.find(c => c.owner === clean && c.kind === 'pc')
    || s.characters.find(c => c.owner === clean);
  if (!ch) {
    try {
      const r = await emit('char:create', {
        name: clean, kind: 'pc', owner: clean, color: '#f0c040', sightRadius: 6, hp: 10, maxHp: 10,
        notes: '',
      });
      ch = r.character;
      setStatus?.(`${clean} added to the cast — click the map to place them`);
    } catch (e) {
      setStatus?.(e.message, 5000);
      return;
    }
  }
  useStore.getState().setSpawnTemplate({ characterId: ch.id, name: ch.name, single: true });
}

function DmTab({ tool, setTool }) {
  const room = useStore(s => s.room);
  const tokens = useStore(s => s.tokens);
  const initiative = useStore(s => s.initiative);
  const dmSecret = useStore(s => s.dmSecret);
  const spawnTemplate = useStore(s => s.spawnTemplate);
  const setSpawnTemplate = useStore(s => s.setSpawnTemplate);
  const fileRef = useRef(null);
  const loadRef = useRef(null);
  const setStatus = useStore(s => s.setStatus);
  const [monsterQuery, setMonsterQuery] = useState('');

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { url } = await uploadImage(file, (pct) => setStatus(`Uploading map — ${pct}%`, 10000));
      await emit('map:config', { mapImageUrl: url });
      setStatus('Map uploaded — detecting grid…');
      await autoDetectGrid(url, setStatus);
    } catch (err) {
      setStatus(`Upload failed: ${err.message}`, 8000);
    } finally {
      e.target.value = '';
    }
  }

  async function setGrid(updates) {
    await emit('map:config', updates);
  }

  function addPlayerToken() {
    const name = window.prompt('Player name — exactly as they type it when joining:', 'Seren');
    if (!name?.trim()) return;
    armPlayerCharacter(name, setStatus);
  }

  async function saveQuest() {
    try {
      const res = await fetch(`/api/rooms/${room.id}/export?secret=${encodeURIComponent(dmSecret)}`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${(room.name || 'quest').replace(/[^\w -]/g, '')}.questhub.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      setStatus('Quest saved to your Downloads (all scenes, cast and library)');
    } catch (e) {
      setStatus(e.message, 5000);
    }
  }

  async function loadQuest(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const res = await fetch(`/api/rooms/${room.id}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: dmSecret, data }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Import failed');
      setStatus(`Quest loaded — ${j.scenes} scene${j.scenes === 1 ? '' : 's'}`);
    } catch (err) {
      setStatus(`Load failed: ${err.message}`, 6000);
    } finally {
      e.target.value = '';
    }
  }

  const monsters = BESTIARY.filter(m =>
    m.name.toLowerCase().includes(monsterQuery.toLowerCase()));

  return (
    <>
      <PlayersSection />
      <ScenesSection />
      <div className="tool-section">
        <h3>Quest file</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <button onClick={saveQuest}>💾 Save quest</button>
          <button onClick={() => loadRef.current?.click()}>📂 Load quest</button>
        </div>
        <button style={{ width: '100%', marginTop: 6 }}
          title="Show everyone what changed on each character since the last D&D Beyond sync"
          onClick={() => emit('session:end').catch(e => setStatus(e.message, 4000))}>
          📜 End session — update D&D Beyond together
        </button>
        <input ref={loadRef} type="file" accept=".json,application/json" onChange={loadQuest} style={{ display: 'none' }} />
      </div>

      <div className="tool-section">
        <h3>This scene's map</h3>
        <button onClick={() => fileRef.current?.click()} style={{ width: '100%', marginBottom: 8 }}>
          Upload map image
        </button>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} style={{ display: 'none' }} />
        <div className="field">
          <label>Grid style</label>
          <select value={room?.grid_type || 'square'}
            onChange={e => setGrid({ gridType: e.target.value })}>
            <option value="square">Squares — battle maps (fog of war on)</option>
            <option value="free">Free — overland / hex maps (no fog, smooth movement)</option>
          </select>
        </div>
        <div className="field">
          <label>Map scale — quick presets</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
            <button onClick={() => setGrid({ feetPerCell: 5 })}
              style={room?.feet_per_cell === 5 ? { borderColor: 'var(--accent)' } : {}}>5 ft</button>
            <button onClick={() => setGrid({ feetPerCell: 10 })}
              style={room?.feet_per_cell === 10 ? { borderColor: 'var(--accent)' } : {}}>10 ft</button>
            <button onClick={() => setGrid({ feetPerCell: 1320 })}
              style={room?.feet_per_cell === 1320 ? { borderColor: 'var(--accent)' } : {}}>¼ mile</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <NumberField label="Square px" value={room?.grid_size ?? 64} onChange={v => setGrid({ gridSize: v })} min={16} max={512} />
          <NumberField label="Ft per square" value={room?.feet_per_cell ?? 5} onChange={v => setGrid({ feetPerCell: v })} min={1} max={10000} />
          <NumberField label="Squares wide" value={room?.grid_w ?? 30} onChange={v => setGrid({ gridW: v })} min={4} max={400} />
          <NumberField label="Squares tall" value={room?.grid_h ?? 20} onChange={v => setGrid({ gridH: v })} min={4} max={400} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
          Wrong size tokens = grid mismatch. Use 📐 Align Grid: click two opposite
          corners of ONE printed square (on hex/overland maps, drag across one hex
          or the scale bar — it just sets the reference size).
        </div>
        <button onClick={() => emit('fog:reset').then(() => setStatus('Explored fog reset for this scene'))}
          style={{ width: '100%', marginTop: 8 }} title="Players forget everything they've seen on this map">
          🌫 Reset explored fog
        </button>
      </div>

      <div className="tool-section">
        <h3>Tools</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <ToolButton t="select" tool={tool} setTool={setTool}>Select / Move</ToolButton>
          <ToolButton t="add-token" tool={tool} setTool={setTool}>Add Token</ToolButton>
          <ToolButton t="draw-wall" tool={tool} setTool={setTool}>Draw Wall</ToolButton>
          <ToolButton t="draw-door" tool={tool} setTool={setTool}>Draw Door</ToolButton>
          <ToolButton t="toggle-door" tool={tool} setTool={setTool}>Open/Close Door</ToolButton>
          <ToolButton t="erase-wall" tool={tool} setTool={setTool}>Erase Wall</ToolButton>
          <ToolButton t="align-grid" tool={tool} setTool={setTool}>📐 Align Grid</ToolButton>
        </div>
        <button onClick={addPlayerToken} style={{ width: '100%', marginTop: 6 }}>
          ⭐ Add player token
        </button>
        {tool !== 'select' && (
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
            Press Esc or pick Select to return to normal mode.
          </div>
        )}
      </div>

      <div className="tool-section">
        <h3>Combat</h3>
        {!initiative ? (
          <button style={{ width: '100%' }}
            onClick={() => emit('init:roll', { tokenIds: tokens.map(t => t.id) })
              .catch(e => setStatus(e.message, 4000))}>
            🎲 Roll initiative (everyone on this map)
          </button>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            Combat is running — use the bar at the top of the map. Select a token
            to add or remove it from the fight.
          </div>
        )}
      </div>

      <div className="tool-section">
        <h3>Bestiary</h3>
        <input placeholder="Search monsters…" value={monsterQuery}
          onChange={e => setMonsterQuery(e.target.value)} style={{ marginBottom: 6 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 260, overflowY: 'auto' }}>
          {monsters.map(m => (
            <button key={m.key}
              onClick={() => spawnTemplate?.key === m.key
                ? setSpawnTemplate(null)
                : setSpawnTemplate({
                    key: m.key, name: m.name, color: m.color, emoji: m.emoji,
                    sightRadius: m.sight, hp: m.hp, maxHp: m.hp, ac: m.ac,
                    speed: m.speed ?? 30, attacks: m.attacks ?? 1,
                    size: m.size ?? 1, reach: m.reach ?? 5, initBonus: m.initBonus ?? 0,
                    attackSpec: m.attack || null,
                  })}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                ...(spawnTemplate?.key === m.key
                  ? { borderColor: 'var(--accent)', background: 'rgba(240,165,0,0.15)' } : {}),
              }}>
              <span>{m.emoji} {m.name}</span>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>AC {m.ac} · {m.hp} hp</span>
            </button>
          ))}
        </div>
        {spawnTemplate && !spawnTemplate.characterId && (
          <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 6 }}>
            Click the map to place {spawnTemplate.name} — keep clicking for more, Esc to stop.
          </div>
        )}
      </div>
    </>
  );
}

function MySheetTab() {
  const mySheets = useStore(s => s.mySheets);
  if (!mySheets.length) {
    return <div style={{ color: 'var(--muted)', fontSize: 13 }}>
      No character yet — ask the DM to add you (they click ⭐ Token next to your name).
    </div>;
  }
  return <>{mySheets.map(c => <SheetPanel key={c.id} character={c} />)}</>;
}

function PlayersSection() {
  const presence = useStore(s => s.presence);
  const tokens = useStore(s => s.tokens);
  const scenes = useStore(s => s.scenes);
  const room = useStore(s => s.room);
  const viewAs = useStore(s => s.viewAs);
  const setViewAs = useStore(s => s.setViewAs);
  const setStatus = useStore(s => s.setStatus);

  const online = presence.filter(p => p.role === 'player');
  const onlineByName = new Map(online.map(p => [p.name, p]));
  // Players = everyone online now + every token owner on this map (so the DM
  // can preview a player's view even while they're offline).
  const names = new Set(onlineByName.keys());
  for (const t of tokens) {
    if (t.owner && t.owner !== 'dm') names.add(t.owner);
  }
  const unique = [...names].map(name => {
    const p = onlineByName.get(name);
    const sceneName = p ? scenes.find(sc => sc.id === p.sceneId)?.name : null;
    return { name, online: !!p, sceneName, here: !p || p.sceneId === room?.scene_id };
  });

  return (
    <div className="tool-section">
      <h3>Players</h3>
      {unique.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
          Nobody yet — share the invite code (top right). Players appear here
          when they join, with one-click token setup.
        </div>
      )}
      {unique.map(p => {
        const hasToken = tokens.some(t => t.owner === p.name);
        return (
          <div key={p.name} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 8px', background: 'var(--panel-2)', borderRadius: 6, marginBottom: 4,
          }}>
            <span style={{ flex: 1, fontSize: 13, minWidth: 0 }}>
              {p.online ? '🟢' : '⚪'} <strong>{p.name}</strong>
              {!p.online && <span style={{ color: 'var(--muted)', fontSize: 11 }}> · offline</span>}
              {p.online && p.sceneName && !p.here && (
                <span style={{ color: 'var(--accent-2)', fontSize: 11 }}> · in {p.sceneName}</span>
              )}
              {!hasToken && p.here && <span style={{ color: 'var(--accent)', fontSize: 11 }}> · no token here!</span>}
            </span>
            <button style={{ fontSize: 11, padding: '3px 8px' }}
              title={`Create ${p.name}'s character (sheet + token) — then click the map to place it`}
              onClick={() => armPlayerCharacter(p.name, setStatus)}>
              ⭐ Token
            </button>
            <button style={{ fontSize: 11, padding: '3px 8px' }}
              className={viewAs === p.name ? 'primary' : ''}
              title={`See exactly what ${p.name} sees`}
              onClick={() => setViewAs(viewAs === p.name ? null : p.name)}>
              👁 View
            </button>
          </div>
        );
      })}
    </div>
  );
}

function ScenesSection() {
  const scenes = useStore(s => s.scenes);
  const room = useStore(s => s.room);
  const setStatus = useStore(s => s.setStatus);

  async function newScene() {
    const name = window.prompt('Scene name (e.g. "Death House — ground floor"):', 'New scene');
    if (name === null) return;
    try {
      await emit('scene:create', { name: name.trim() || 'New scene' });
      setStatus('New blank scene — upload a map or pick one from the Library');
    } catch (e) { setStatus(e.message, 4000); }
  }
  async function rename(sc) {
    const name = window.prompt('Rename scene:', sc.name);
    if (!name?.trim()) return;
    await emit('scene:rename', { sceneId: sc.id, name: name.trim() }).catch(e => setStatus(e.message, 4000));
  }
  async function remove(sc) {
    if (!window.confirm(`Delete scene "${sc.name}" and everything on it?`)) return;
    await emit('scene:delete', { sceneId: sc.id }).catch(e => setStatus(e.message, 4000));
  }

  return (
    <div className="tool-section">
      <h3>Scenes (maps)</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {scenes.map(sc => {
          const current = sc.id === room?.scene_id;
          return (
            <div key={sc.id} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px',
              background: 'var(--panel-2)', borderRadius: 6,
              border: `1px solid ${current ? 'var(--accent)' : 'transparent'}`,
            }}>
              {sc.mapImageUrl
                ? <img src={sc.mapImageUrl} alt="" style={{ width: 34, height: 26, objectFit: 'cover', borderRadius: 3 }} />
                : <div style={{ width: 34, height: 26, borderRadius: 3, background: '#11111a' }} />}
              <span style={{ flex: 1, fontSize: 12, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {current ? '📍 ' : ''}{sc.name}
                <span style={{ color: 'var(--muted)' }}> · {sc.tokenCount} token{sc.tokenCount === 1 ? '' : 's'}</span>
              </span>
              {!current && (
                <button style={{ fontSize: 10, padding: '2px 6px' }} className="primary"
                  onClick={() => emit('scene:switch', { sceneId: sc.id }).catch(e => setStatus(e.message, 4000))}>
                  Go
                </button>
              )}
              <button style={{ fontSize: 10, padding: '2px 5px' }} title="Rename" onClick={() => rename(sc)}>✎</button>
              {scenes.length > 1 && (
                <button style={{ fontSize: 10, padding: '2px 5px' }} title="Delete scene" onClick={() => remove(sc)}>✕</button>
              )}
            </div>
          );
        })}
      </div>
      <button onClick={newScene} style={{ width: '100%', marginTop: 6 }}>＋ New blank scene</button>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
        Tip: in the Library, every map has a "＋ Scene" button. Players automatically
        see whichever scene their character is on.
      </div>
    </div>
  );
}

const KIND_LABEL = { pc: '⭐ Player characters', npc: '🎭 NPCs', monster: '👹 Monsters' };

function CastTab() {
  const characters = useStore(s => s.characters);
  const setStatus = useStore(s => s.setStatus);
  const spawnTemplate = useStore(s => s.spawnTemplate);
  const setSpawnTemplate = useStore(s => s.setSpawnTemplate);
  const [draft, setDraft] = useState({ name: '', kind: 'npc', emoji: '', color: '#8d99ae', notes: '' });
  const [openId, setOpenId] = useState(null);

  async function create(e) {
    e.preventDefault();
    if (!draft.name.trim()) return;
    try {
      await emit('char:create', {
        ...draft, name: draft.name.trim(),
        owner: draft.kind === 'pc' ? draft.name.trim() : 'dm',
        hp: draft.kind === 'pc' ? 10 : null, maxHp: draft.kind === 'pc' ? 10 : null,
      });
      setDraft({ name: '', kind: draft.kind, emoji: '', color: '#8d99ae', notes: '' });
      setStatus(`${draft.name.trim()} added to the cast`);
    } catch (err) { setStatus(err.message, 4000); }
  }

  const groups = ['pc', 'npc', 'monster'].map(k => [k, characters.filter(c => c.kind === k)]);

  return (
    <>
      <div className="tool-section">
        <h3>New character</h3>
        <form onSubmit={create}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: 6 }}>
            <div className="field" style={{ margin: 0 }}>
              <label>Name</label>
              <input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="Ismark Kolyanovich" />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>Type</label>
              <select value={draft.kind} onChange={e => setDraft({ ...draft, kind: e.target.value })}>
                <option value="npc">NPC</option>
                <option value="pc">Player</option>
                <option value="monster">Monster</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 6, marginTop: 6 }}>
            <div className="field" style={{ margin: 0 }}>
              <label>Emoji</label>
              <input value={draft.emoji} onChange={e => setDraft({ ...draft, emoji: e.target.value })} placeholder="🧔" />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>Colour</label>
              <input type="color" value={draft.color} onChange={e => setDraft({ ...draft, color: e.target.value })} style={{ height: 36, padding: 2 }} />
            </div>
          </div>
          <div className="field" style={{ marginTop: 6 }}>
            <label>Notes (DM only) — accent, motives, secrets, voice</label>
            <textarea rows={3} value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })}
              placeholder="Gruff Eastern-European accent. Grieving sister. Wants the party to escort Ireena." />
          </div>
          <button className="primary" type="submit" style={{ width: '100%', marginTop: 6 }}>Add to cast</button>
        </form>
      </div>

      {groups.map(([kind, list]) => list.length > 0 && (
        <div className="tool-section" key={kind}>
          <h3>{KIND_LABEL[kind]}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {list.map(c => (
              <CharacterCard key={c.id} c={c}
                open={openId === c.id}
                onToggle={() => setOpenId(openId === c.id ? null : c.id)}
                placing={spawnTemplate?.characterId === c.id}
                onPlace={() => spawnTemplate?.characterId === c.id
                  ? setSpawnTemplate(null)
                  : setSpawnTemplate({ characterId: c.id, name: c.name, single: c.kind !== 'monster' })} />
            ))}
          </div>
        </div>
      ))}
      {characters.length === 0 && (
        <div style={{ color: 'var(--muted)', fontSize: 12 }}>
          Your cast is empty. Add NPCs here with their accent and secrets, then
          place them on any scene — the notes follow them everywhere.
        </div>
      )}
    </>
  );
}

function CharacterCard({ c, open, onToggle, placing, onPlace }) {
  const setStatus = useStore(s => s.setStatus);
  const [notes, setNotes] = useState(c.notes || '');
  useEffect(() => { setNotes(c.notes || ''); }, [c.notes]);
  function save(fields) {
    emit('char:update', { id: c.id, ...fields }).catch(e => setStatus(e.message, 4000));
  }
  return (
    <div style={{ background: 'var(--panel-2)', borderRadius: 6, border: `1px solid ${placing ? 'var(--accent)' : 'transparent'}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px' }}>
        <div style={{ width: 24, height: 24, borderRadius: '50%', background: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
          {c.emoji || c.name.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={onToggle}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</div>
          {!open && c.notes && (
            <div style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.notes}</div>
          )}
        </div>
        <button style={{ fontSize: 10, padding: '3px 7px' }} className={placing ? 'primary' : ''}
          title="Click, then click the map to place" onClick={onPlace}>{placing ? 'Placing…' : '📍 Place'}</button>
        <button style={{ fontSize: 10, padding: '3px 6px' }} title={open ? 'Collapse' : 'Edit sheet'} onClick={onToggle}>{open ? '▴' : '✎'}</button>
      </div>
      {open && (
        <div style={{ padding: '0 8px 8px' }}>
          <div className="field">
            <label>Name</label>
            <input value={c.name} onChange={e => save({ name: e.target.value })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            <div className="field"><label>HP</label>
              <input type="number" value={c.hp ?? ''} placeholder="—" onChange={e => save({ hp: e.target.value === '' ? null : parseFloat(e.target.value) })} /></div>
            <div className="field"><label>Max</label>
              <input type="number" value={c.maxHp ?? ''} placeholder="—" onChange={e => save({ maxHp: e.target.value === '' ? null : parseFloat(e.target.value) })} /></div>
            <div className="field"><label>AC</label>
              <input type="number" value={c.ac ?? ''} placeholder="—" onChange={e => save({ ac: e.target.value === '' ? null : parseInt(e.target.value, 10) })} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <div className="field"><label>Emoji</label>
              <input value={c.emoji || ''} onChange={e => save({ emoji: e.target.value || null })} /></div>
            <div className="field"><label>Owner (player name or dm)</label>
              <input value={c.owner} onChange={e => save({ owner: e.target.value })} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <div className="field"><label>Speed (ft)</label>
              <input type="number" min={0} step={5} value={c.speed ?? 30} onChange={e => save({ speed: parseFloat(e.target.value) || 0 })} /></div>
            <div className="field"><label>Attacks / action</label>
              <input type="number" min={1} max={6} value={c.attacks ?? 1} onChange={e => save({ attacks: Math.max(1, parseInt(e.target.value, 10) || 1) })} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            <div className="field"><label>Size</label>
              <select value={String(c.size ?? 1)} onChange={e => save({ size: parseFloat(e.target.value) })}>
                <option value="1">Medium</option><option value="2">Large</option>
                <option value="3">Huge</option><option value="4">Gargantuan</option>
              </select></div>
            <div className="field"><label>Reach (ft)</label>
              <input type="number" min={5} step={5} value={c.reach ?? 5} onChange={e => save({ reach: Math.max(5, parseFloat(e.target.value) || 5) })} /></div>
            <div className="field"><label>Init bonus</label>
              <input type="number" value={c.initBonus ?? 0} onChange={e => save({ initBonus: parseInt(e.target.value, 10) || 0 })} /></div>
          </div>
          <DdbLink character={c} setStatus={setStatus} />
          <div className="field">
            <label>Notes (DM only)</label>
            <textarea rows={4} value={notes} onChange={e => setNotes(e.target.value)}
              onBlur={() => notes !== c.notes && save({ notes })} />
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>Saves when you click away.</div>
          </div>
          <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
            <SheetPanel character={c} dm />
          </div>
          <button className="danger" style={{ width: '100%' }}
            onClick={() => window.confirm(`Remove ${c.name} from the cast? Placed tokens stay on their maps.`) &&
              emit('char:delete', { id: c.id }).catch(e => setStatus(e.message, 4000))}>
            Remove from cast
          </button>
        </div>
      )}
    </div>
  );
}

// Pull a character's numbers from D&D Beyond (public characters only; unofficial API).
function DdbLink({ character, setStatus }) {
  const [id, setId] = useState(character.ddbCharacterId || '');
  const [busy, setBusy] = useState(false);
  async function sync() {
    if (!id.trim()) return;
    setBusy(true);
    try {
      const r = await emit('char:ddb-link', { characterId: character.id, ddbId: id.trim() });
      const got = Object.keys(r.stats || {}).filter(k => k !== 'imageUrl');
      setStatus(`Synced ${character.name} from D&D Beyond (${got.join(', ') || 'no stats found'})`, 6000);
    } catch (e) {
      setStatus(`D&D Beyond: ${e.message} — is the character set to Public?`, 8000);
    } finally { setBusy(false); }
  }
  return (
    <div className="field">
      <label>D&D Beyond character ID {character.ddbSyncedAt ? `· synced ${new Date(character.ddbSyncedAt).toLocaleTimeString()}` : ''}</label>
      <div style={{ display: 'flex', gap: 6 }}>
        <input value={id} onChange={e => setId(e.target.value)} placeholder="digits from the character URL" />
        <button disabled={busy} onClick={sync}>{character.ddbCharacterId ? '🔄 Refresh' : 'Link'}</button>
      </div>
      <div style={{ fontSize: 10, color: 'var(--muted)' }}>
        Pulls name, HP, speed, darkvision and initiative. One-way: QuestHub keeps HP during play.
      </div>
    </div>
  );
}

function LibraryTab() {
  const assets = useStore(s => s.assets);
  const setStatus = useStore(s => s.setStatus);
  const setSpawnTemplate = useStore(s => s.setSpawnTemplate);
  const spawnTemplate = useStore(s => s.spawnTemplate);
  const mapRef = useRef(null);
  const tokRef = useRef(null);
  const handRef = useRef(null);
  const [busy, setBusy] = useState(false);

  function showHandout(a) {
    emit('handout:show', { url: a.url, title: a.name })
      .then(() => setStatus(`Showing "${a.name}" to everyone`))
      .catch(e => setStatus(e.message, 4000));
  }

  async function newSceneFrom(a) {
    try {
      const r = await emit('scene:create', { name: a.name, assetId: a.id });
      if (a.grid) setStatus(`New scene "${a.name}" — saved grid applied`);
      else {
        setStatus(`New scene "${a.name}" — detecting grid…`);
        await autoDetectGrid(a.url, setStatus);
      }
      return r;
    } catch (e) { setStatus(e.message, 4000); }
  }

  async function handleFiles(e, kind) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setBusy(true);
    let done = 0;
    try {
      for (const file of files) {
        const { url } = await uploadImage(file, (pct) =>
          setStatus(`Uploading ${file.name} — ${pct}% (${done + 1}/${files.length})`, 10000));
        await emit('asset:create', { kind, name: file.name.replace(/\.[^.]+$/, ''), url });
        done++;
      }
      setStatus(`Uploaded ${done} ${kind}${done === 1 ? '' : 's'} ✓`);
    } catch (err) {
      setStatus(`Upload failed after ${done} of ${files.length}: ${err.message}`, 8000);
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  }

  const maps = assets.filter(a => a.kind === 'map');
  const tokenArt = assets.filter(a => a.kind === 'token');
  const handouts = assets.filter(a => a.kind === 'handout');

  return (
    <>
      <Collapsible title="Maps" count={maps.length}>
        <button disabled={busy} onClick={() => mapRef.current?.click()} style={{ width: '100%', marginBottom: 6 }}>
          {busy ? 'Uploading…' : '⬆ Upload maps (multi-select ok)'}
        </button>
        <input ref={mapRef} type="file" accept="image/*" multiple onChange={e => handleFiles(e, 'map')} style={{ display: 'none' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 6 }}>
          {maps.map(a => (
            <AssetCard key={a.id} asset={a}
              onShow={() => showHandout(a)}
              actionLabel="＋ Scene"
              onUse={() => newSceneFrom(a)}
              secondaryLabel={a.grid ? 'Use here ✓' : 'Use here'}
              onSecondary={async () => {
                try {
                  await emit('map:config', { mapImageUrl: a.url });
                  if (a.grid) {
                    await emit('map:config', {
                      gridSize: a.grid.gridSize, gridW: a.grid.gridW, gridH: a.grid.gridH,
                      offsetX: a.grid.offsetX, offsetY: a.grid.offsetY,
                      feetPerCell: a.grid.feetPerCell ?? 5,
                      gridType: a.grid.gridType ?? 'square',
                    });
                    setStatus(`Map: ${a.name} (saved alignment applied)`);
                  } else {
                    setStatus(`Map: ${a.name} — detecting grid…`);
                    await autoDetectGrid(a.url, setStatus);
                  }
                } catch (e) {
                  setStatus(e.message, 4000);
                }
              }} />
          ))}
        </div>
        {maps.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 12 }}>Upload your battle maps once. "＋ Scene" makes a new map screen from one; "Use here" swaps this scene's map.</div>}
      </Collapsible>

      <Collapsible title="Handouts" count={handouts.length}>
        <button disabled={busy} onClick={() => handRef.current?.click()} style={{ width: '100%', marginBottom: 6 }}>
          {busy ? 'Uploading…' : '⬆ Upload handout images'}
        </button>
        <input ref={handRef} type="file" accept="image/*" multiple onChange={e => handleFiles(e, 'handout')} style={{ display: 'none' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: 6 }}>
          {handouts.map(a => (
            <AssetTile key={a.id} asset={a} title={`Show "${a.name}" to everyone`}
              onUse={() => showHandout(a)} />
          ))}
        </div>
        {handouts.length === 0 && (
          <div style={{ color: 'var(--muted)', fontSize: 12 }}>
            Scene art, villain portraits, letters… click one mid-game to flash it
            on every player's screen.
          </div>
        )}
      </Collapsible>

      <Collapsible title="Token art" count={tokenArt.length}>
        <button disabled={busy} onClick={() => tokRef.current?.click()} style={{ width: '100%', marginBottom: 6 }}>
          {busy ? 'Uploading…' : '⬆ Upload token images'}
        </button>
        <input ref={tokRef} type="file" accept="image/*" multiple onChange={e => handleFiles(e, 'token')} style={{ display: 'none' }} />
        {spawnTemplate?.assetId && (
          <div style={{ fontSize: 12, color: 'var(--accent)', marginBottom: 6 }}>
            Placing {spawnTemplate.name} — click the map (Esc to stop)
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(56px, 1fr))', gap: 6 }}>
          {tokenArt.map(a => (
            <AssetTile key={a.id} asset={a}
              title={`Place "${a.name}" on the map`}
              active={spawnTemplate?.assetId === a.id}
              onUse={() => spawnTemplate?.assetId === a.id
                ? setSpawnTemplate(null)
                : setSpawnTemplate({ assetId: a.id, name: a.name, imageUrl: a.url, color: '#8d99ae', sightRadius: 6 })} />
          ))}
        </div>
        {tokenArt.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 12 }}>Upload character/monster art, then stamp them onto the board.</div>}
      </Collapsible>
    </>
  );
}

// Collapsible section: header click folds the content away. Count shown when collapsed.
function Collapsible({ title, count, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="tool-section">
      <h3 onClick={() => setOpen(o => !o)} style={{ cursor: 'pointer', userSelect: 'none' }}>
        {open ? '▾' : '▸'} {title}{!open && count != null ? ` (${count})` : ''}
      </h3>
      {open && children}
    </div>
  );
}

// Small square tile for dense grids (token art): click = action, hover ✕ = delete.
function AssetTile({ asset, onUse, active, title }) {
  const setStatus = useStore(s => s.setStatus);
  return (
    <div style={{ position: 'relative' }}>
      <img src={asset.url} alt={asset.name} title={title || asset.name}
        onClick={onUse}
        style={{
          width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block',
          borderRadius: 6, cursor: 'pointer',
          border: `2px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        }} />
      <button title="Delete"
        onClick={() => window.confirm(`Delete "${asset.name}" from library?`) &&
          emit('asset:delete', { id: asset.id }).catch(e => setStatus(e.message, 4000))}
        style={{
          position: 'absolute', top: 2, right: 2, fontSize: 9, padding: '1px 4px',
          background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: 4,
        }}>✕</button>
    </div>
  );
}

function AssetCard({ asset, actionLabel, onUse, active, onShow, secondaryLabel, onSecondary }) {
  const setStatus = useStore(s => s.setStatus);
  return (
    <div style={{
      background: 'var(--panel-2)', borderRadius: 6, overflow: 'hidden',
      border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
    }}>
      <img src={asset.url} alt={asset.name}
        style={{ width: '100%', height: 70, objectFit: 'cover', display: 'block', cursor: 'pointer' }}
        onClick={onUse} />
      <div style={{ padding: '4px 6px' }}>
        <div style={{ fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{asset.name}</div>
        <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
          <button onClick={onUse} className="primary" style={{ fontSize: 10, padding: '2px 6px', flex: 1 }}>{actionLabel}</button>
          {onSecondary && (
            <button onClick={onSecondary} style={{ fontSize: 10, padding: '2px 6px', flex: 1 }}>{secondaryLabel}</button>
          )}
          {onShow && (
            <button title="Flash on every player's screen" onClick={onShow}
              style={{ fontSize: 10, padding: '2px 6px' }}>📣</button>
          )}
          <button title="Delete"
            onClick={() => window.confirm(`Delete "${asset.name}" from library?`) &&
              emit('asset:delete', { id: asset.id }).catch(e => setStatus(e.message, 4000))}
            style={{ fontSize: 10, padding: '2px 6px' }}>✕</button>
        </div>
      </div>
    </div>
  );
}

function ToolButton({ t, tool, setTool, children }) {
  return (
    <button
      onClick={() => setTool(tool === t ? 'select' : t)}
      style={tool === t ? { borderColor: 'var(--accent)', background: 'rgba(240,165,0,0.15)' } : {}}
    >{children}</button>
  );
}

function NumberField({ label, value, onChange, min, max }) {
  return (
    <div className="field" style={{ margin: 0 }}>
      <label>{label}</label>
      <input type="number" min={min} max={max} value={value}
        onChange={e => onChange(parseInt(e.target.value, 10))} />
    </div>
  );
}

function TokenListTab({ tokens, selectedId, setSelected, role }) {
  const setStatus = useStore(s => s.setStatus);
  const you = useStore(s => s.you);
  const walls = useStore(s => s.walls);
  const room = useStore(s => s.room);
  // Players only get listed what they can actually see right now — the
  // sidebar must not leak a monster lurking in the fog.
  let filtered = tokens;
  if (role !== 'dm') {
    const vis = computeFog({ role, you, tokens, walls, room });
    filtered = tokens.filter(t => tokenVisibleToViewer(t, vis, you));
  }
  if (filtered.length === 0) {
    return <div style={{ color: 'var(--muted)' }}>
      {role === 'dm' ? 'No tokens on this map yet.' : 'Nothing in sight.'}
    </div>;
  }
  return (
    <div className="token-list">
      {filtered.map(t => (
        <div key={t.id}
          className={`token-row ${selectedId === t.id ? 'selected' : ''}`}
          title="Click to select · double-click to centre the map on it"
          onClick={() => setSelected(t.id === selectedId ? null : t.id)}
          onDoubleClick={() => {
            setSelected(t.id);
            window.dispatchEvent(new CustomEvent('questhub:focus-token', { detail: { id: t.id } }));
          }}
        >
          <div className="swatch" style={{ background: t.color || '#5b9bd5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>
            {t.emoji || ''}
          </div>
          <div>
            <div className="name">{t.name}{t.characterId && role === 'dm' ? ' 📇' : ''}</div>
            <div className="meta">
              {t.owner === 'dm' ? 'DM' : t.owner}
              {t.maxHp > 0 && (role === 'dm' || t.owner === you?.name) && ` · ${t.hp ?? '?'}/${t.maxHp} hp`}
              {t.ac != null && role === 'dm' && ` · AC ${t.ac}`}
            </div>
          </div>
          <div className="chip">{t.owner === 'dm' ? 'NPC' : 'PC'}</div>
        </div>
      ))}
      {role === 'dm' && selectedId && <TokenEditor tokenId={selectedId} setStatus={setStatus} />}
    </div>
  );
}

function TokenEditor({ tokenId, setStatus }) {
  const token = useStore(s => s.tokens.find(t => t.id === tokenId));
  const character = useStore(s => s.characters.find(c => c.id === token?.characterId));
  const scenes = useStore(s => s.scenes);
  const room = useStore(s => s.room);
  const [ddbId, setDdbId] = useState('');
  const [notes, setNotes] = useState(character?.notes || '');
  useEffect(() => { setNotes(character?.notes || ''); }, [character?.notes]);
  if (!token) return null;

  function update(fields) {
    emit('token:update', { id: tokenId, ...fields }).catch(e => setStatus(e.message, 5000));
  }
  function adjustHp(delta) {
    const next = Math.max(0, Math.min((token.maxHp ?? 999), (token.hp ?? 0) + delta));
    update({ hp: next });
  }
  function remove() {
    if (!confirm(`Delete token "${token.name}"?`)) return;
    emit('token:delete', { id: tokenId }).catch(e => setStatus(e.message, 5000));
  }
  async function linkDdb() {
    try {
      await emit('ddb:link', { tokenId, characterId: ddbId.trim() });
      setStatus('Character linked from D&D Beyond');
    } catch (e) {
      setStatus(`Link failed: ${e.message}`, 6000);
    }
  }
  async function saveAsCharacter() {
    try {
      await emit('token:save-as-character', { tokenId });
      setStatus(`${token.name} added to the cast — notes live in the Cast tab and here`);
    } catch (e) { setStatus(e.message, 5000); }
  }
  async function teleport(sceneId) {
    if (!sceneId) return;
    const target = scenes.find(s => s.id === sceneId);
    try {
      await emit('token:teleport', { id: tokenId, sceneId, x: 1, y: 1 });
      setStatus(`${token.name} sent to ${target?.name}`);
    } catch (e) { setStatus(e.message, 5000); }
  }

  return (
    <div style={{ marginTop: 12, padding: 10, background: 'var(--panel-2)', borderRadius: 8 }}>
      <h3 style={{ fontSize: 12, color: 'var(--muted)' }}>Edit token</h3>
      {character ? (
        <div className="field">
          <label>📇 Sheet notes (DM only) — {character.name}</label>
          <textarea rows={4} value={notes} onChange={e => setNotes(e.target.value)}
            onBlur={() => notes !== character.notes &&
              emit('char:update', { id: character.id, notes }).catch(e => setStatus(e.message, 4000))}
            placeholder="Accent, motives, secrets…" />
          <div style={{ fontSize: 10, color: 'var(--muted)' }}>Follows this character onto every map. Saves when you click away.</div>
        </div>
      ) : (
        <button onClick={saveAsCharacter} style={{ width: '100%', marginBottom: 10 }}
          title="Give this token a persistent sheet with notes that follow it across maps">
          📇 Save as character (adds notes sheet)
        </button>
      )}
      <div className="field">
        <label>Name</label>
        <input value={token.name} onChange={e => update({ name: e.target.value })} />
      </div>
      <div className="field">
        <label>Owner (player name or "dm")</label>
        <input value={token.owner} onChange={e => update({ owner: e.target.value })} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        <div className="field">
          <label>HP</label>
          <input type="number" value={token.hp ?? ''} placeholder="—"
            onChange={e => update({ hp: e.target.value === '' ? null : parseFloat(e.target.value) })} />
        </div>
        <div className="field">
          <label>Max HP</label>
          <input type="number" value={token.maxHp ?? ''} placeholder="—"
            onChange={e => update({ maxHp: e.target.value === '' ? null : parseFloat(e.target.value) })} />
        </div>
        <div className="field">
          <label>AC</label>
          <input type="number" value={token.ac ?? ''} placeholder="—"
            onChange={e => update({ ac: e.target.value === '' ? null : parseInt(e.target.value, 10) })} />
        </div>
      </div>
      {token.maxHp > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, marginBottom: 10 }}>
          <button onClick={() => adjustHp(-5)}>−5</button>
          <button onClick={() => adjustHp(-1)}>−1</button>
          <button onClick={() => adjustHp(1)}>+1</button>
          <button onClick={() => adjustHp(5)}>+5</button>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <div className="field">
          <label>Speed (ft / turn)</label>
          <input type="number" min={0} max={200} step={5} value={token.speed ?? 30}
            onChange={e => update({ speed: parseFloat(e.target.value) || 0 })} />
        </div>
        <div className="field">
          <label>Attacks per action</label>
          <input type="number" min={1} max={6} value={token.attacks ?? 1}
            onChange={e => update({ attacks: Math.max(1, parseInt(e.target.value, 10) || 1) })} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        <div className="field">
          <label>Size</label>
          <select value={String(token.size ?? 1)} onChange={e => update({ size: parseFloat(e.target.value) })}>
            <option value="1">Medium (1×1)</option>
            <option value="2">Large (2×2)</option>
            <option value="3">Huge (3×3)</option>
            <option value="4">Gargantuan (4×4)</option>
          </select>
        </div>
        <div className="field">
          <label>Reach (ft)</label>
          <input type="number" min={5} step={5} value={token.reach ?? 5}
            onChange={e => update({ reach: Math.max(5, parseFloat(e.target.value) || 5) })} />
        </div>
        <div className="field">
          <label>Init bonus</label>
          <input type="number" min={-5} max={15} value={token.initBonus ?? 0}
            onChange={e => update({ initBonus: parseInt(e.target.value, 10) || 0 })} />
        </div>
      </div>
      <CombatMembership tokenId={tokenId} name={token.name} setStatus={setStatus} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <div className="field">
          <label>Sight (squares)</label>
          <input type="number" min={0} max={30} value={token.sightRadius}
            onChange={e => update({ sightRadius: parseFloat(e.target.value) })} />
        </div>
        <div className="field">
          <label>Colour</label>
          <input type="color" value={token.color || '#5b9bd5'}
            onChange={e => update({ color: e.target.value })}
            style={{ height: 36, padding: 2 }} />
        </div>
      </div>
      <div className="field">
        <label>
          <input type="checkbox" checked={token.visibleToPlayers}
            onChange={e => update({ visibleToPlayers: e.target.checked })} /> Visible to players
          {!token.visibleToPlayers && <span style={{ color: 'var(--muted)' }}> (ticking it triggers a dramatic reveal)</span>}
        </label>
      </div>
      {scenes.length > 1 && (
        <div className="field">
          <label>Send to another scene</label>
          <select value="" onChange={e => teleport(e.target.value)}>
            <option value="">Choose a scene…</option>
            {scenes.filter(s => s.id !== room?.scene_id).map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}
      <div className="field">
        <label>Link to D&D Beyond character ID</label>
        <div style={{ display: 'flex', gap: 6 }}>
          <input value={ddbId} onChange={e => setDdbId(e.target.value)} placeholder="e.g. 12345678" />
          <button onClick={linkDdb}>Link</button>
        </div>
        {token.ddbData && (
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>
            <div>{token.ddbData.name} · Level {token.ddbData.level}</div>
            {token.ddbData.classes.length > 0 && (
              <div>{token.ddbData.classes.map(c => `${c.name} ${c.level}`).join(', ')}</div>
            )}
            {token.ddbData.hp?.max != null && (
              <div>HP {token.ddbData.hp.current ?? '?'} / {token.ddbData.hp.max}</div>
            )}
            {token.ddbData.senses?.darkvision > 0 && <div>Darkvision {token.ddbData.senses.darkvision} ft</div>}
          </div>
        )}
      </div>
      <button className="danger" onClick={remove} style={{ width: '100%' }}>Delete token</button>
    </div>
  );
}

function CombatMembership({ tokenId, name, setStatus }) {
  const initiative = useStore(s => s.initiative);
  if (!initiative) return null;
  const inCombat = initiative.order.some(e => e.tokenId === tokenId);
  return (
    <div className="field">
      {inCombat ? (
        <button style={{ width: '100%' }}
          onClick={() => emit('init:remove', { tokenId }).catch(e => setStatus(e.message, 4000))}>
          ⚔️ Remove {name} from combat
        </button>
      ) : (
        <button style={{ width: '100%' }} className="primary"
          onClick={() => emit('init:add', { tokenId }).catch(e => setStatus(e.message, 4000))}>
          ⚔️ Add {name} to combat (rolls initiative)
        </button>
      )}
    </div>
  );
}

const DICE = [4, 6, 8, 10, 12, 20, 100];

// Big friendly dice buttons — no /r syntax needed.
function DicePanel() {
  const setStatus = useStore(s => s.setStatus);
  const [mod, setMod] = useState(0);
  const [adv, setAdv] = useState('none'); // none | adv | dis
  function roll(sides) {
    let expr = sides === 20 && adv !== 'none' ? `2d20k${adv === 'adv' ? 'h' : 'l'}1` : `1d${sides}`;
    if (mod) expr += mod > 0 ? `+${mod}` : `${mod}`;
    const label = sides === 20 && adv !== 'none' ? (adv === 'adv' ? 'd20 advantage' : 'd20 disadvantage') : `d${sides}`;
    emit('dice:roll', { expr, label }).catch(e => setStatus(e.message, 4000));
  }
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 6 }}>
        {DICE.map(d => (
          <button key={d} onClick={() => roll(d)} title={`Roll a d${d}`}
            style={{ padding: '8px 0', fontWeight: 700, fontSize: d === 20 ? 14 : 12,
              ...(d === 20 ? { borderColor: 'var(--accent)' } : {}) }}>
            d{d}
          </button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 80px', gap: 4, alignItems: 'center' }}>
        <button onClick={() => setAdv(adv === 'adv' ? 'none' : 'adv')}
          style={adv === 'adv' ? { borderColor: 'var(--ok)', background: 'rgba(88,194,103,0.2)' } : {}}>Advantage</button>
        <button onClick={() => setAdv(adv === 'dis' ? 'none' : 'dis')}
          style={adv === 'dis' ? { borderColor: 'var(--danger)', background: 'rgba(210,69,58,0.2)' } : {}}>Disadv.</button>
        <label style={{ margin: 0, textAlign: 'right', fontSize: 12 }}>Bonus</label>
        <input type="number" value={mod} onChange={e => setMod(parseInt(e.target.value || '0', 10))} />
      </div>
    </div>
  );
}

function ChatTab() {
  const chat = useStore(s => s.chat);
  const [text, setText] = useState('');
  const setStatus = useStore(s => s.setStatus);
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView?.({ block: 'end' }); }, [chat.length]);
  async function send(e) {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      await emit('chat:send', { text });
      setText('');
    } catch (err) {
      setStatus(err.message, 4000);
    }
  }
  return (
    <>
      <DicePanel />
      <div className="chat-msgs" style={{ marginBottom: 12 }}>
        {chat.map(m => (
          <div key={m.id} className={`chat-msg ${m.type} ${m.whisper ? 'whisper' : ''}`}>
            {m.from !== 'system' && <span className="from">{m.from}:</span>}
            <span>{m.text}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form onSubmit={send} className="dice-bar">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Say something… (or /r 1d20+5)"
        />
        <button className="primary">Send</button>
      </form>
    </>
  );
}
