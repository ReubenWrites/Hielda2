import { useState, useRef, useEffect } from 'react';
import { useStore } from '../state/store.js';
import { uploadImage, emit } from '../net/socket.js';

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

      <div>
        <div className="tabs">
          {role === 'dm' && <button className={tab === 'dm' ? 'active' : ''} onClick={() => setTab('dm')}>DM</button>}
          <button className={tab === 'characters' ? 'active' : ''} onClick={() => setTab('characters')}>Tokens</button>
          <button className={tab === 'chat' ? 'active' : ''} onClick={() => setTab('chat')}>Chat</button>
        </div>
        <div className="body">
          {tab === 'dm' && role === 'dm' && <DmTab tool={tool} setTool={setTool} />}
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

function DmTab({ tool, setTool }) {
  const room = useStore(s => s.room);
  const fileRef = useRef(null);
  const setStatus = useStore(s => s.setStatus);

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { url } = await uploadImage(file);
      await emit('map:config', { mapImageUrl: url });
      setStatus('Map uploaded');
    } catch (err) {
      setStatus(`Upload failed: ${err.message}`, 5000);
    } finally {
      e.target.value = '';
    }
  }

  async function setGrid(updates) {
    await emit('map:config', updates);
  }

  return (
    <>
      <div className="tool-section">
        <h3>Map</h3>
        <button onClick={() => fileRef.current?.click()} style={{ width: '100%', marginBottom: 8 }}>
          Upload map image
        </button>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} style={{ display: 'none' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <NumberField label="Cell px" value={room?.grid_size ?? 64} onChange={v => setGrid({ gridSize: v })} min={16} max={256} />
          <div />
          <NumberField label="Cells wide" value={room?.grid_w ?? 30} onChange={v => setGrid({ gridW: v })} min={4} max={120} />
          <NumberField label="Cells tall" value={room?.grid_h ?? 20} onChange={v => setGrid({ gridH: v })} min={4} max={120} />
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
        </div>
        {tool !== 'select' && (
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
            Press Esc or pick Select to return to normal mode.
          </div>
        )}
      </div>
    </>
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
              {' · '}
              sight {t.sightRadius} cells
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
