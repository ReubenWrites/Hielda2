import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { getSocket, emit } from '../net/socket.js';
import { useStore } from '../state/store.js';
import MapCanvas from '../components/MapCanvas.jsx';
import Sidebar from '../components/Sidebar.jsx';
import SpellBar from '../components/SpellBar.jsx';
import ProposalBanner from '../components/ProposalBanner.jsx';

export default function Room() {
  const { roomId } = useParams();
  const [search] = useSearchParams();
  const nav = useNavigate();
  const [connected, setConnected] = useState(false);
  const [joinError, setJoinError] = useState(null);

  const role = useStore(s => s.role);
  const status = useStore(s => s.status);
  const setStatus = useStore(s => s.setStatus);
  const hydrate = useStore.getState().hydrate;

  useEffect(() => {
    const sock = getSocket();
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    sock.on('connect', onConnect);
    sock.on('disconnect', onDisconnect);
    if (sock.connected) setConnected(true);

    const name = sessionStorage.getItem('questhub:name') || 'Adventurer';
    const dmSecret = sessionStorage.getItem(`questhub:dm:${roomId}`);
    const asDm = !!dmSecret && search.get('dm') === '1';

    function join() {
      sock.emit('room:join', { roomId, name, asDm, dmSecret }, (res) => {
        if (res?.error) {
          setJoinError(res.error);
          return;
        }
        hydrate(res);
        if (asDm) useStore.setState({ dmSecret });
      });
    }
    if (sock.connected) join();
    else sock.once('connect', join);

    // ---- Room event wiring ----
    const s = useStore.getState();

    const onMapUpdated = (room) => s.setRoom(room);
    const onTokenCreated = (t) => s.upsertToken(t);
    const onTokenUpdated = (t) => s.upsertToken(t);
    const onTokenDeleted = ({ id }) => s.removeToken(id);
    const onTokenMoved = ({ id, x, y }) => {
      s.upsertToken({ id, x, y });
    };
    const onWallCreated = (w) => s.upsertWall(w);
    const onWallUpdated = (w) => s.upsertWall(w);
    const onWallDeleted = ({ id }) => s.removeWall(id);
    const onMoveProposed = (p) => s.addProposal(p);
    const onMoveRejected = ({ proposalId }) => {
      s.removeProposal(proposalId);
      setStatus('Move rejected');
    };
    const onMoveApproved = ({ proposalId, tokenId, path, interrupted }) => {
      s.removeProposal(proposalId);
      // Trigger animation on the scene (MapCanvas listens for this)
      window.dispatchEvent(new CustomEvent('questhub:animate-move', { detail: { tokenId, path } }));
      // Update the store position to the final cell so state stays consistent
      const end = path[path.length - 1];
      s.upsertToken({ id: tokenId, x: end.x, y: end.y });
      if (interrupted) setStatus('Move interrupted');
    };
    const onChat = (msg) => s.appendChat(msg);
    const onSpellFx = (payload) => {
      window.dispatchEvent(new CustomEvent('questhub:spell-fx', { detail: payload }));
    };

    sock.on('map:updated', onMapUpdated);
    sock.on('token:created', onTokenCreated);
    sock.on('token:updated', onTokenUpdated);
    sock.on('token:deleted', onTokenDeleted);
    sock.on('token:moved', onTokenMoved);
    sock.on('wall:created', onWallCreated);
    sock.on('wall:updated', onWallUpdated);
    sock.on('wall:deleted', onWallDeleted);
    sock.on('move:proposed', onMoveProposed);
    sock.on('move:rejected', onMoveRejected);
    sock.on('move:approved', onMoveApproved);
    sock.on('chat:message', onChat);
    sock.on('spell:effect', onSpellFx);

    return () => {
      sock.off('connect', onConnect);
      sock.off('disconnect', onDisconnect);
      sock.off('map:updated', onMapUpdated);
      sock.off('token:created', onTokenCreated);
      sock.off('token:updated', onTokenUpdated);
      sock.off('token:deleted', onTokenDeleted);
      sock.off('token:moved', onTokenMoved);
      sock.off('wall:created', onWallCreated);
      sock.off('wall:updated', onWallUpdated);
      sock.off('wall:deleted', onWallDeleted);
      sock.off('move:proposed', onMoveProposed);
      sock.off('move:rejected', onMoveRejected);
      sock.off('move:approved', onMoveApproved);
      sock.off('chat:message', onChat);
      sock.off('spell:effect', onSpellFx);
    };
  }, [roomId]);

  // Esc key returns to Select tool
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') {
        useStore.getState().setTool('select');
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleAction = async (action) => {
    try {
      switch (action.type) {
        case 'select-token':
          useStore.getState().setSelected(action.id);
          break;
        case 'add-token':
          await emit('token:create', { x: action.cell.x, y: action.cell.y, name: 'Token', color: randomColor() });
          useStore.getState().setTool('select');
          break;
        case 'dm-move-token':
          await emit('token:move', { id: action.id, x: action.x, y: action.y, animate: true });
          break;
        case 'propose-move':
          await emit('move:propose', { tokenId: action.tokenId, path: action.path });
          useStore.getState().setStatus('Move proposed — waiting for DM');
          break;
        case 'add-wall':
          await emit('wall:create', action.wall);
          break;
        case 'delete-wall':
          await emit('wall:delete', { id: action.id });
          break;
        case 'toggle-door':
          await emit('door:toggle', { id: action.id });
          break;
        case 'cast-spell':
          await emit('spell:cast', { kind: action.kind, from: action.from, to: action.to });
          useStore.getState().setSpell(null);
          break;
      }
    } catch (e) {
      useStore.getState().setStatus(e.message, 4000);
    }
  };

  function copyInvite() {
    const url = `${location.origin}/r/${roomId}`;
    navigator.clipboard?.writeText(url).then(() => setStatus('Invite link copied'));
  }

  if (joinError) {
    return (
      <div className="home">
        <div className="card">
          <h2 style={{ color: 'var(--danger)' }}>Could not join</h2>
          <p>{joinError}</p>
          <button onClick={() => nav('/')}>Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="room">
      <div className="stage">
        <MapCanvas onAction={handleAction} />
        <Hint />
        {role === 'dm' && <ProposalBanner />}
        <SpellBar />
        {status && (
          <div className="hint" style={{ left: '50%', transform: 'translateX(-50%)', top: 64, color: 'var(--text)' }}>
            {status}
          </div>
        )}
      </div>
      <Sidebar onCopyInvite={copyInvite} />
    </div>
  );
}

function Hint() {
  const tool = useStore(s => s.tool);
  const role = useStore(s => s.role);
  let msg = '';
  if (tool === 'add-token') msg = 'Click a cell to place a token';
  else if (tool === 'draw-wall') msg = 'Click two corners to draw a wall';
  else if (tool === 'draw-door') msg = 'Click two corners to draw a door';
  else if (tool === 'erase-wall') msg = 'Click a wall to remove it';
  else if (tool === 'toggle-door') msg = 'Click a door to open/close it';
  else if (tool === 'cast-spell') msg = 'Click target to cast';
  else if (role === 'player') msg = 'Drag your token to propose a move';
  else msg = 'Drag tokens to move · Shift+drag to pan · Scroll to zoom';
  return <div className="hint">{msg}</div>;
}

function randomColor() {
  const palette = ['#f25c54', '#f7b32b', '#5b9bd5', '#7fc97f', '#c47fb5', '#e9c46a', '#8b5cf6'];
  return palette[Math.floor(Math.random() * palette.length)];
}
