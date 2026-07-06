import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createRoom } from '../net/socket.js';

export default function Home() {
  const nav = useNavigate();
  const [mode, setMode] = useState('create'); // create | join
  const [name, setName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleCreate(e) {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      const { id, dmSecret } = await createRoom(roomName || 'Untitled Quest');
      // Persist DM secret so the room owner can rejoin as DM on refresh
      sessionStorage.setItem(`questhub:dm:${id}`, dmSecret);
      sessionStorage.setItem(`questhub:name`, name || 'DM');
      nav(`/r/${id}?dm=1`);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  function handleJoin(e) {
    e.preventDefault();
    setErr(null);
    const clean = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(clean)) {
      setErr('Room codes are 6 characters (A-Z, 2-9)');
      return;
    }
    sessionStorage.setItem('questhub:name', name || 'Player');
    nav(`/r/${clean}`);
  }

  return (
    <div className="home">
      <div className="card">
        <h1>QuestHub</h1>
        <p className="tag">Pen-and-paper magic, over the internet.</p>

        <div className="tabs" style={{ padding: 0, marginBottom: 12 }}>
          <button className={mode === 'create' ? 'active' : ''} onClick={() => setMode('create')}>Create</button>
          <button className={mode === 'join' ? 'active' : ''} onClick={() => setMode('join')}>Join</button>
        </div>

        {mode === 'create' ? (
          <form onSubmit={handleCreate}>
            <div className="field">
              <label>Your name (DM)</label>
              <input value={name} onChange={e => setName(e.target.value)} maxLength={32} placeholder="Dungeon Master" />
            </div>
            <div className="field">
              <label>Quest name</label>
              <input value={roomName} onChange={e => setRoomName(e.target.value)} maxLength={60} placeholder="The Lost Mines" />
            </div>
            <div className="actions">
              <button className="primary" type="submit" disabled={busy}>{busy ? 'Creating…' : 'Start quest'}</button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleJoin}>
            <div className="field">
              <label>Your name</label>
              <input value={name} onChange={e => setName(e.target.value)} maxLength={32} placeholder="Adventurer" />
            </div>
            <div className="field">
              <label>Room code</label>
              <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} maxLength={6}
                placeholder="ABC123" style={{ letterSpacing: 4, fontFamily: 'monospace', fontSize: 18 }} />
            </div>
            <div className="actions">
              <button className="primary" type="submit">Join quest</button>
            </div>
          </form>
        )}
        {err && <div className="err">{err}</div>}
      </div>
    </div>
  );
}
