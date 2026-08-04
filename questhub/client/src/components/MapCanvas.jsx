import { useEffect, useRef } from 'react';
import { Scene } from '../game/Scene.js';
import { useStore } from '../state/store.js';
import { computeFog } from '../game/fog.js';

export default function MapCanvas({ onAction }) {
  const hostRef = useRef(null);
  const sceneRef = useRef(null);

  const role = useStore(s => s.role);
  const you = useStore(s => s.you);
  const room = useStore(s => s.room);
  const tokens = useStore(s => s.tokens);
  const walls = useStore(s => s.walls);
  const proposals = useStore(s => s.proposals);
  const tool = useStore(s => s.tool);
  const spell = useStore(s => s.spell);
  const selectedTokenId = useStore(s => s.selectedTokenId);
  const initiative = useStore(s => s.initiative);
  const viewAs = useStore(s => s.viewAs);

  // Init scene once
  useEffect(() => {
    let cancelled = false;
    const scene = new Scene(hostRef.current);
    scene.init().then(() => {
      if (cancelled) return scene.destroy();
      sceneRef.current = scene;
      scene.onAction = (a) => onAction?.(a, scene);
      scene.setRole(useStore.getState().role, useStore.getState().you);
      if (useStore.getState().room) {
        scene.setRoom(useStore.getState().room);
        scene.setWalls(useStore.getState().walls);
        scene.setTokens(useStore.getState().tokens);
        applyFog(scene);
      }
    });

    function onAnim(e) {
      sceneRef.current?.animateTokenAlong(e.detail.tokenId, e.detail.path);
    }
    function onFx(e) {
      sceneRef.current?.playEffect(e.detail);
    }
    window.addEventListener('questhub:animate-move', onAnim);
    window.addEventListener('questhub:spell-fx', onFx);

    return () => {
      cancelled = true;
      window.removeEventListener('questhub:animate-move', onAnim);
      window.removeEventListener('questhub:spell-fx', onFx);
      sceneRef.current?.destroy();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (sceneRef.current) sceneRef.current.onAction = (a) => onAction?.(a, sceneRef.current);
  }, [onAction]);
  useEffect(() => { sceneRef.current?.setRole(role, you); applyFog(sceneRef.current); }, [role, you]);
  useEffect(() => {
    if (!sceneRef.current || !room) return;
    sceneRef.current.setRoom(room);
    sceneRef.current.setTokens(useStore.getState().tokens);
    applyFog(sceneRef.current);
  }, [room]);
  useEffect(() => {
    if (!sceneRef.current) return;
    sceneRef.current.setWalls(walls);
    applyFog(sceneRef.current);
  }, [walls]);
  useEffect(() => {
    if (!sceneRef.current) return;
    sceneRef.current.setTokens(tokens);
    applyFog(sceneRef.current);
  }, [tokens]);
  useEffect(() => { sceneRef.current?.setProposalGhosts(proposals); }, [proposals]);
  useEffect(() => {
    const current = initiative ? initiative.order[initiative.turn]?.tokenId : null;
    sceneRef.current?.setInitiativeToken(current ?? null);
  }, [initiative]);
  useEffect(() => {
    if (!sceneRef.current) return;
    sceneRef.current.setViewAs(viewAs);
    sceneRef.current.setTokens(useStore.getState().tokens);
    applyFog(sceneRef.current);
  }, [viewAs]);
  useEffect(() => { sceneRef.current?.setTool(tool, { spell }); }, [tool, spell]);
  useEffect(() => { sceneRef.current?.setSelected(selectedTokenId); }, [selectedTokenId]);

  return <div ref={hostRef} style={{ width: '100%', height: '100%' }} />;
}

function applyFog(scene) {
  if (!scene) return;
  const s = useStore.getState();
  // DM previewing a player's view computes fog exactly as that player would.
  const role = s.viewAs ? 'player' : s.role;
  const you = s.viewAs ? { name: s.viewAs } : s.you;
  const set = computeFog({ role, you, tokens: s.tokens, walls: s.walls, room: s.room });
  scene.setFog(set);
}
