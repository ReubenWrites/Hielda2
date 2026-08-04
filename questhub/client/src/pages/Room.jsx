import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { getSocket, emit } from '../net/socket.js';
import { useStore } from '../state/store.js';
import MapCanvas from '../components/MapCanvas.jsx';
import Sidebar from '../components/Sidebar.jsx';
import SpellBar from '../components/SpellBar.jsx';
import ProposalBanner from '../components/ProposalBanner.jsx';
import StageToolbar from '../components/StageToolbar.jsx';
import { computeGridFromSquare } from '@questhub/shared/gridcalib';

export default function Room() {
  const { roomId } = useParams();
  const [search] = useSearchParams();
  const nav = useNavigate();
  const [connected, setConnected] = useState(false);
  const [joinError, setJoinError] = useState(null);
  const [sideWidth, setSideWidth] = useState(() => {
    const saved = parseInt(localStorage.getItem('questhub:sideWidth') || '', 10);
    return Number.isFinite(saved) ? Math.min(720, Math.max(240, saved)) : 320;
  });

  function startResize(e) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = sideWidth;
    function onMove(ev) {
      const w = Math.min(720, Math.max(240, startW + (startX - ev.clientX)));
      setSideWidth(w);
    }
    function onUp(ev) {
      const w = Math.min(720, Math.max(240, startW + (startX - ev.clientX)));
      localStorage.setItem('questhub:sideWidth', String(w));
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

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
    const onAssetCreated = (a) => s.upsertAsset(a);
    const onAssetDeleted = ({ id }) => s.removeAsset(id);
    const onInitUpdated = (init) => s.setInitiative(init);
    const onResync = (state) => s.resync(state);
    const onPresence = (list) => s.setPresence(list);
    const onAssetUpdated = (a) => s.upsertAsset(a);
    const onHandoutShow = (h) => s.setHandout(h);
    const onHandoutHide = () => s.setHandout(null);

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
    sock.on('asset:created', onAssetCreated);
    sock.on('asset:deleted', onAssetDeleted);
    sock.on('init:updated', onInitUpdated);
    sock.on('room:resync', onResync);
    sock.on('presence:updated', onPresence);
    sock.on('asset:updated', onAssetUpdated);
    sock.on('handout:show', onHandoutShow);
    sock.on('handout:hide', onHandoutHide);

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
      sock.off('asset:created', onAssetCreated);
      sock.off('asset:deleted', onAssetDeleted);
      sock.off('init:updated', onInitUpdated);
      sock.off('room:resync', onResync);
      sock.off('presence:updated', onPresence);
      sock.off('asset:updated', onAssetUpdated);
      sock.off('handout:show', onHandoutShow);
      sock.off('handout:hide', onHandoutHide);
    };
  }, [roomId]);

  // Keyboard shortcuts: Esc returns to Select, Delete removes the selected token (DM)
  useEffect(() => {
    function onKey(e) {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName) || e.target?.isContentEditable;
      if (e.key === 'Escape') {
        useStore.getState().setTool('select');
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && !typing) {
        const s = useStore.getState();
        if (s.role !== 'dm' || !s.selectedTokenId) return;
        e.preventDefault();
        const token = s.tokens.find(t => t.id === s.selectedTokenId);
        emit('token:delete', { id: s.selectedTokenId })
          .then(() => s.setStatus(`Deleted ${token?.name ?? 'token'}`))
          .catch(err => s.setStatus(err.message, 4000));
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
        case 'add-token': {
          const tpl = useStore.getState().spawnTemplate;
          if (tpl) {
            await emit('token:create', {
              x: action.cell.x, y: action.cell.y,
              name: numberedName(tpl.name, useStore.getState().tokens),
              color: tpl.color,
              owner: tpl.owner || 'dm',
              imageUrl: tpl.imageUrl || null,
              sightRadius: tpl.sightRadius ?? 6,
              hp: tpl.hp ?? null, maxHp: tpl.maxHp ?? null, ac: tpl.ac ?? null,
              emoji: tpl.emoji ?? null,
            });
            // Single-shot templates (player tokens) disarm; bestiary stays armed
            if (tpl.single) useStore.getState().setSpawnTemplate(null);
          } else {
            await emit('token:create', { x: action.cell.x, y: action.cell.y, name: 'Token', color: randomColor() });
            useStore.getState().setTool('select');
          }
          break;
        }
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
        case 'align-grid': {
          const g = computeGridFromSquare(action.p1, action.p2, action.mapW, action.mapH);
          if (!g) {
            useStore.getState().setStatus('Too small — click two opposite corners of ONE map square', 5000);
            break;
          }
          await emit('map:config', {
            gridSize: g.gridSize, gridW: g.gridW, gridH: g.gridH,
            offsetX: g.offsetX, offsetY: g.offsetY,
          });
          useStore.getState().setStatus(`Grid aligned: ${g.gridSize}px squares (${g.gridW}×${g.gridH})`);
          useStore.getState().setTool('select');
          break;
        }
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
    <div className="room" style={{ gridTemplateColumns: `1fr 6px ${sideWidth}px` }}>
      <div className="stage">
        <MapCanvas onAction={handleAction} />
        <Hint />
        {role === 'dm' && <ProposalBanner />}
        {role === 'dm' && <StageToolbar />}
        {role === 'dm' && <ViewAsBanner />}
        <HandoutOverlay />
        <SpellBar />
        {status && (
          <div className="hint" style={{ left: '50%', transform: 'translateX(-50%)', top: 64, color: 'var(--text)' }}>
            {status}
          </div>
        )}
      </div>
      <div className="side-resizer" onPointerDown={startResize} title="Drag to resize the sidebar" />
      <Sidebar onCopyInvite={copyInvite} />
    </div>
  );
}

function HandoutOverlay() {
  const handout = useStore(s => s.handout);
  const role = useStore(s => s.role);
  const setHandout = useStore(s => s.setHandout);
  if (!handout) return null;
  function close() {
    if (role === 'dm') {
      emit('handout:hide').catch(() => {});
    }
    setHandout(null); // players dismiss locally; DM hides it for everyone
  }
  return (
    <div onClick={close} style={{
      position: 'absolute', inset: 0, zIndex: 30,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 12,
      cursor: 'pointer',
    }}>
      <img src={handout.url} alt={handout.title || 'Handout'}
        style={{ maxWidth: '88%', maxHeight: '80%', borderRadius: 8,
          boxShadow: '0 12px 60px rgba(0,0,0,0.9)' }} />
      {handout.title && (
        <div style={{ fontFamily: 'Cinzel, serif', fontSize: 20, color: 'var(--accent)' }}>
          {handout.title}
        </div>
      )}
      <div style={{ fontSize: 12, color: 'var(--muted)' }}>
        {role === 'dm' ? 'Click anywhere to close it for everyone' : 'Click to dismiss'}
      </div>
    </div>
  );
}

function ViewAsBanner() {
  const viewAs = useStore(s => s.viewAs);
  const setViewAs = useStore(s => s.setViewAs);
  if (!viewAs) return null;
  return (
    <div style={{
      position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(91,155,213,0.95)', color: '#0a0a14', borderRadius: 20,
      padding: '8px 16px', display: 'flex', gap: 10, alignItems: 'center',
      fontWeight: 600, zIndex: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
    }}>
      👁 Viewing as {viewAs}
      <button onClick={() => setViewAs(null)}
        style={{ padding: '2px 10px', fontSize: 12, background: '#0a0a14', color: 'white', border: 'none' }}>
        Back to DM view
      </button>
    </div>
  );
}

function Hint() {
  const tool = useStore(s => s.tool);
  const role = useStore(s => s.role);
  let msg = '';
  if (tool === 'align-grid') msg = 'Click one corner of a map square, then the OPPOSITE corner of the SAME square';
  else if (tool === 'add-token') msg = 'Click a cell to place a token';
  else if (tool === 'draw-wall') msg = 'Click two corners to draw a wall';
  else if (tool === 'draw-door') msg = 'Click two corners to draw a door';
  else if (tool === 'erase-wall') msg = 'Click a wall to remove it';
  else if (tool === 'toggle-door') msg = 'Click a door to open/close it';
  else if (tool === 'cast-spell') msg = 'Click target to cast';
  else if (role === 'player') msg = 'Drag your token to propose a move';
  else msg = 'Drag tokens to move · Shift+drag to pan · Scroll to zoom';
  return <div className="hint">{msg}</div>;
}

// Wolf, Wolf 2, Wolf 3… for repeated placements of the same creature.
function numberedName(base, tokens) {
  const re = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( \\d+)?$`);
  const count = tokens.filter(t => re.test(t.name)).length;
  return count === 0 ? base : `${base} ${count + 1}`;
}

function randomColor() {
  const palette = ['#f25c54', '#f7b32b', '#5b9bd5', '#7fc97f', '#c47fb5', '#e9c46a', '#8b5cf6'];
  return palette[Math.floor(Math.random() * palette.length)];
}
