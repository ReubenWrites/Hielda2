import { useStore } from '../state/store.js';
import { emit } from '../net/socket.js';
import { formatFeet, measureMoveFeet } from '@questhub/shared/measure';

export default function ProposalBanner() {
  const role = useStore(s => s.role);
  const proposals = useStore(s => s.proposals);
  const tokens = useStore(s => s.tokens);
  const setStatus = useStore(s => s.setStatus);
  const feetPerCell = useStore(s => s.room?.feet_per_cell || 5);
  const gridType = useStore(s => s.room?.grid_type || 'square');

  if (role !== 'dm' || proposals.length === 0) return null;
  // Only proposals for tokens on the map the DM is looking at.
  const here = proposals.filter(p => tokens.some(t => t.id === p.tokenId));
  if (here.length === 0) return null;

  return (
    <>
      {here.map(p => {
        const token = tokens.find(t => t.id === p.tokenId);
        const cells = p.path.length;
        const dist = token
          ? measureMoveFeet({ from: { x: token.x, y: token.y }, path: p.path, feetPerCell, gridType })
          : cells * feetPerCell;
        return (
          <div key={p.id} className="proposal-banner" style={{ top: 12 + here.indexOf(p) * 60 }}>
            <span className="text">
              <strong>{p.proposedBy}</strong> wants to move <strong>{token?.name ?? '?'}</strong> {formatFeet(dist)}
            </span>
            <button className="primary" onClick={() => emit('move:approve', { proposalId: p.id }).catch(e => setStatus(e.message))}>
              Approve
            </button>
            <button onClick={() => emit('move:reject', { proposalId: p.id })}>Reject</button>
            {cells > 1 && (
              <button
                title="Approve up to halfway (e.g., to trigger a trap or an ambush)"
                onClick={() => emit('move:approve', { proposalId: p.id, stopAtIndex: Math.floor(cells / 2) - 1 })}
              >
                Stop halfway
              </button>
            )}
          </div>
        );
      })}
    </>
  );
}
