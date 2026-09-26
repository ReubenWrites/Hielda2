import { useStore } from '../state/store.js';
import { emit } from '../net/socket.js';
import { formatFeet } from '@questhub/shared/measure';

// Combat bar: the initiative tracker everyone sees during a fight — turn
// order with faces, whose turn it is, the round, and the acting creature's
// remaining movement/attacks. Players end their own turn; the DM drives the rest.
export default function CombatBar() {
  const initiative = useStore(s => s.initiative);
  const role = useStore(s => s.role);
  const you = useStore(s => s.you);
  const tokens = useStore(s => s.tokens);
  const setStatus = useStore(s => s.setStatus);
  if (!initiative || !initiative.order.length) return null;

  const cur = initiative.order[initiative.turn];
  const curToken = tokens.find(t => t.id === cur.tokenId);
  const mine = role !== 'dm' && (cur.owner === you?.name || cur.owner === you?.id);
  const ts = initiative.turnState || { movedFt: 0, actionUsed: false, attacksUsed: 0 };
  const speed = curToken?.speed ?? 30;
  const attacks = curToken?.attacks ?? 1;
  const moveLeft = Math.max(0, speed - ts.movedFt);

  return (
    <div className="combat-bar">
      <div className="combat-order">
        {initiative.order.map((e, i) => {
          const alive = tokens.some(t => t.id === e.tokenId);
          const isCur = i === initiative.turn;
          return (
            <div key={e.tokenId}
              className={`combat-chip ${isCur ? 'current' : ''} ${alive ? '' : 'gone'}`}
              title={`${e.name} — initiative ${e.roll}${alive ? '' : ' (not on this map)'}`}
              style={{ background: e.color || '#5b9bd5' }}>
              <span className="face">{e.emoji || e.name.charAt(0).toUpperCase()}</span>
              <span className="who">{e.name}</span>
              {role === 'dm' && (
                <button className="chip-x" title="Remove from combat"
                  onClick={() => emit('init:remove', { tokenId: e.tokenId }).catch(err => setStatus(err.message, 4000))}>✕</button>
              )}
            </div>
          );
        })}
      </div>
      <div className="combat-status">
        <span className="round">Round {initiative.round || 1}</span>
        {mine ? (
          <>
            <span className="turn-you">🟢 Your turn!</span>
            <span className="budget">🏃 {formatFeet(moveLeft)} left</span>
            <span className="budget">⚔️ {Math.max(0, attacks - ts.attacksUsed)}/{attacks}</span>
            <span className="budget">{ts.actionUsed ? '✨ action used' : '✨ action ready'}</span>
            <button className="primary" onClick={() => emit('init:next').catch(err => setStatus(err.message, 4000))}
              title="Space">
              End turn ▶ <kbd>Space</kbd>
            </button>
          </>
        ) : (
          <span className="turn-other">⏳ {cur.name}'s turn</span>
        )}
        {role === 'dm' && (
          <>
            <span className="budget">🏃 {formatFeet(moveLeft)} · ⚔️ {Math.max(0, attacks - ts.attacksUsed)}/{attacks}</span>
            <button className="primary next-turn" onClick={() => emit('init:next').catch(err => setStatus(err.message, 4000))}
              title="Space or N">
              Next turn ▶ <kbd>Space</kbd>
            </button>
            <button onClick={() => emit('init:end').catch(err => setStatus(err.message, 4000))}>End combat</button>
          </>
        )}
      </div>
    </div>
  );
}
