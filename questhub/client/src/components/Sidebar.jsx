import { useState, useRef, useEffect } from 'react';
import { useStore } from '../state/store.js';
import { uploadImage, emit } from '../net/socket.js';
import { BESTIARY } from '@questhub/shared/bestiary';

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
  useEffect(() => {
    if (role === 'dm') setTab('dm');
  }, [role]);

  return (
    <div className="side">
      <div className="head">
        <div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Quest</div>
          <div style={{ fontWeight: 600 }}>{room?.name}</div>
        </div>
        <button onClick={onCopyInvite} title="Copy invite link" style={{ padding: '4px 8px' }}>
          <span className="code">{room?.id}</span>
        </button>
      </div>

      <div style={{ overflow: 'hidden', display: 'grid', gridTemplateRows: 'auto 1fr' }}>
        <div className="tabs">
          {role === 'dm' && <button className={tab === 'dm' ? 'active' : ''} onClick={() => setTab('dm')}>DM</button>}
          {role === 'dm' && <button className={tab === 'library' ? 'active' : ''} onClick={() => setTab('library')}>Library</button>}
          <button className={tab === 'characters' ? 'active' : ''} onClick={() => setTab('characters')}>Tokens</button>
          <button className={tab === 'chat' ? 'active' : ''} onClick={() => setTab('chat')}>Chat</button>
        </div>
        <div className="body">
          {tab === 'dm' && role === 'dm' && <DmTab tool={tool} setTool={setTool} />}
          {tab === 'library' && role === 'dm' && <LibraryTab />}
          {tab === 'characters' && (
            <>
              <InitiativePanel />
              <TokenListTab
                tokens={tokens}
                selectedId={selectedTokenId}
                setSelected={setSelected}
                role={role}
              />
            </>
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
      const { url } = await uploadImage(file);
      await emit('map:config', { mapImageUrl: url });
      setStatus('Map uploaded — detecting grid…');
      await autoDetectGrid(url, setStatus);
    } catch (err) {
      setStatus(`Upload failed: ${err.message}`, 5000);
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
    setSpawnTemplate({
      name: name.trim(),
      owner: name.trim(),
      color: '#f0c040',
      sightRadius: 6,
      hp: 10, maxHp: 10,
      single: true,
    });
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
      setStatus('Quest saved to your Downloads');
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
      setStatus('Quest loaded');
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
      <div className="tool-section">
        <h3>Quest file</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <button onClick={saveQuest}>💾 Save quest</button>
          <button onClick={() => loadRef.current?.click()}>📂 Load quest</button>
        </div>
        <input ref={loadRef} type="file" accept=".json,application/json" onChange={loadQuest} style={{ display: 'none' }} />
      </div>

      <div className="tool-section">
        <h3>Map</h3>
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
            🎲 Roll initiative (everyone)
          </button>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <button className="primary" onClick={() => emit('init:next')}>Next turn ▶</button>
            <button onClick={() => emit('init:end')}>End combat</button>
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
        {spawnTemplate && (
          <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 6 }}>
            Click the map to place {spawnTemplate.name} — keep clicking for more, Esc to stop.
          </div>
        )}
      </div>
    </>
  );
}

function PlayersSection() {
  const presence = useStore(s => s.presence);
  const tokens = useStore(s => s.tokens);
  const viewAs = useStore(s => s.viewAs);
  const setViewAs = useStore(s => s.setViewAs);
  const setSpawnTemplate = useStore(s => s.setSpawnTemplate);

  const players = presence.filter(p => p.role === 'player');
  // De-dupe by name (same player in two tabs)
  const seen = new Set();
  const unique = players.filter(p => !seen.has(p.name) && seen.add(p.name));

  return (
    <div className="tool-section">
      <h3>Players online</h3>
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
            <span style={{ flex: 1, fontSize: 13 }}>
              🟢 <strong>{p.name}</strong>
              {!hasToken && <span style={{ color: 'var(--accent)', fontSize: 11 }}> · no token yet!</span>}
            </span>
            <button style={{ fontSize: 11, padding: '3px 8px' }}
              title={`Create a token owned by ${p.name} — then click the map to place it`}
              onClick={() => setSpawnTemplate({
                name: p.name, owner: p.name, color: '#f0c040',
                sightRadius: 6, hp: 10, maxHp: 10, single: true,
              })}>
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

function LibraryTab() {
  const assets = useStore(s => s.assets);
  const setStatus = useStore(s => s.setStatus);
  const setSpawnTemplate = useStore(s => s.setSpawnTemplate);
  const spawnTemplate = useStore(s => s.spawnTemplate);
  const mapRef = useRef(null);
  const tokRef = useRef(null);
  const [busy, setBusy] = useState(false);

  async function handleFiles(e, kind) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setBusy(true);
    let done = 0;
    try {
      for (const file of files) {
        const { url } = await uploadImage(file);
        await emit('asset:create', { kind, name: file.name.replace(/\.[^.]+$/, ''), url });
        done++;
      }
      setStatus(`Uploaded ${done} ${kind}${done === 1 ? '' : 's'}`);
    } catch (err) {
      setStatus(`Upload failed after ${done}: ${err.message}`, 6000);
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  }

  const maps = assets.filter(a => a.kind === 'map');
  const tokenArt = assets.filter(a => a.kind === 'token');

  return (
    <>
      <div className="tool-section">
        <h3>Maps</h3>
        <button disabled={busy} onClick={() => mapRef.current?.click()} style={{ width: '100%', marginBottom: 6 }}>
          {busy ? 'Uploading…' : '⬆ Upload maps (multi-select ok)'}
        </button>
        <input ref={mapRef} type="file" accept="image/*" multiple onChange={e => handleFiles(e, 'map')} style={{ display: 'none' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {maps.map(a => (
            <AssetCard key={a.id} asset={a}
              actionLabel={a.grid ? 'Use as map ✓' : 'Use as map'}
              onUse={async () => {
                try {
                  await emit('map:config', { mapImageUrl: a.url });
                  if (a.grid) {
                    // Reapply the calibration saved with this map
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
        {maps.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 12 }}>Upload your battle maps once, then switch scenes with one click.</div>}
      </div>

      <div className="tool-section">
        <h3>Token art</h3>
        <button disabled={busy} onClick={() => tokRef.current?.click()} style={{ width: '100%', marginBottom: 6 }}>
          {busy ? 'Uploading…' : '⬆ Upload token images'}
        </button>
        <input ref={tokRef} type="file" accept="image/*" multiple onChange={e => handleFiles(e, 'token')} style={{ display: 'none' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {tokenArt.map(a => (
            <AssetCard key={a.id} asset={a}
              actionLabel={spawnTemplate?.assetId === a.id ? 'Placing… (Esc stops)' : 'Place on map'}
              active={spawnTemplate?.assetId === a.id}
              onUse={() => spawnTemplate?.assetId === a.id
                ? setSpawnTemplate(null)
                : setSpawnTemplate({ assetId: a.id, name: a.name, imageUrl: a.url, color: '#8d99ae', sightRadius: 6 })} />
          ))}
        </div>
        {tokenArt.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 12 }}>Upload character/monster art, then stamp them onto the board.</div>}
      </div>
    </>
  );
}

function AssetCard({ asset, actionLabel, onUse, active }) {
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
          <button onClick={onUse} style={{ fontSize: 10, padding: '2px 6px', flex: 1 }}>{actionLabel}</button>
          <button title="Delete"
            onClick={() => window.confirm(`Delete "${asset.name}" from library?`) &&
              emit('asset:delete', { id: asset.id }).catch(e => setStatus(e.message, 4000))}
            style={{ fontSize: 10, padding: '2px 6px' }}>✕</button>
        </div>
      </div>
    </div>
  );
}

function InitiativePanel() {
  const initiative = useStore(s => s.initiative);
  const tokens = useStore(s => s.tokens);
  if (!initiative) return null;
  return (
    <div className="tool-section" style={{ padding: 8, background: 'var(--panel-2)', borderRadius: 8 }}>
      <h3>⚔️ Initiative</h3>
      {initiative.order.map((e, i) => {
        const alive = tokens.some(t => t.id === e.tokenId);
        return (
          <div key={e.tokenId} style={{
            display: 'flex', justifyContent: 'space-between', padding: '3px 6px',
            borderRadius: 4, fontSize: 13,
            background: i === initiative.turn ? 'rgba(240,165,0,0.25)' : 'transparent',
            opacity: alive ? 1 : 0.4,
            textDecoration: alive ? 'none' : 'line-through',
          }}>
            <span>{i === initiative.turn ? '▶ ' : ''}{e.name}</span>
            <span style={{ color: 'var(--muted)' }}>{e.roll}</span>
          </div>
        );
      })}
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
  const filtered = role === 'dm' ? tokens : tokens.filter(t => t.visibleToPlayers || t.owner === you?.name);
  if (filtered.length === 0) return <div style={{ color: 'var(--muted)' }}>No tokens yet.</div>;
  return (
    <div className="token-list">
      {filtered.map(t => (
        <div key={t.id}
          className={`token-row ${selectedId === t.id ? 'selected' : ''}`}
          onClick={() => setSelected(t.id === selectedId ? null : t.id)}
        >
          <div className="swatch" style={{ background: t.color || '#5b9bd5' }} />
          <div>
            <div className="name">{t.name}</div>
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
  const [ddbId, setDdbId] = useState('');
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

  return (
    <div style={{ marginTop: 12, padding: 10, background: 'var(--panel-2)', borderRadius: 8 }}>
      <h3 style={{ fontSize: 12, color: 'var(--muted)' }}>Edit token</h3>
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
          <label>Sight (cells)</label>
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
        </label>
      </div>
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

function ChatTab() {
  const chat = useStore(s => s.chat);
  const [text, setText] = useState('');
  const setStatus = useStore(s => s.setStatus);
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
      <div className="chat-msgs" style={{ marginBottom: 12 }}>
        {chat.map(m => (
          <div key={m.id} className={`chat-msg ${m.type} ${m.whisper ? 'whisper' : ''}`}>
            {m.from !== 'system' && <span className="from">{m.from}:</span>}
            <span>{m.text}</span>
          </div>
        ))}
      </div>
      <form onSubmit={send} className="dice-bar">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Type a message or /r 1d20+5"
        />
        <button className="primary">Send</button>
      </form>
    </>
  );
}
