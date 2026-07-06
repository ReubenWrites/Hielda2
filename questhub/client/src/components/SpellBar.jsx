import { useStore } from '../state/store.js';
import { EFFECTS } from '../game/spells.js';

export default function SpellBar() {
  const spell = useStore(s => s.spell);
  const setSpell = useStore(s => s.setSpell);
  const tokens = useStore(s => s.tokens);
  const selectedTokenId = useStore(s => s.selectedTokenId);
  const selectedToken = tokens.find(t => t.id === selectedTokenId);

  return (
    <div className="spell-bar">
      {Object.entries(EFFECTS).map(([kind, e]) => (
        <button
          key={kind}
          className={`spell-btn ${spell?.kind === kind ? 'active' : ''}`}
          title={`${e.label}${selectedToken ? ` (from ${selectedToken.name})` : ''}`}
          onClick={() => setSpell(spell?.kind === kind ? null : { kind, color: e.color })}
        >
          {e.emoji}
        </button>
      ))}
    </div>
  );
}
