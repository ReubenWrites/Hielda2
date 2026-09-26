import { useState } from 'react';
import { useStore } from '../state/store.js';
import { emit } from '../net/socket.js';
import { computeDerived, ABILITIES, SKILLS, fmtBonus } from '@questhub/shared/rules';

const CONDITIONS = ['Blinded', 'Charmed', 'Deafened', 'Frightened', 'Grappled', 'Invisible', 'Paralysed', 'Poisoned', 'Prone', 'Restrained', 'Stunned', 'Unconscious'];
const ABILITY_NAMES = { STR: 'Strength', DEX: 'Dexterity', CON: 'Constitution', INT: 'Intelligence', WIS: 'Wisdom', CHA: 'Charisma' };

// The live character sheet: everything a player needs during play, with
// every number derived by the rules engine so temporary bonuses and new
// proficiencies ripple through automatically.
export default function SheetPanel({ character, dm = false }) {
  const setStatus = useStore(s => s.setStatus);
  const sheet = character.sheet || {};
  const d = computeDerived(sheet);
  const patch = (p) => emit('sheet:update', { characterId: character.id, patch: p }).catch(e => setStatus(e.message, 4000));
  const roll = (label, bonus) => emit('dice:roll', { expr: `1d20${bonus ? (bonus > 0 ? '+' : '') + bonus : ''}`, label }).catch(e => setStatus(e.message, 4000));

  const hp = character.hp ?? 0, maxHp = character.maxHp ?? 0, temp = sheet.tempHp || 0;
  const hpFrac = maxHp ? hp / maxHp : 1;
  const hpColor = hpFrac > 0.5 ? 'var(--ok)' : hpFrac > 0.25 ? 'var(--accent)' : 'var(--danger)';

  return (
    <div className="sheet">
      {/* ---- Header & HP ---- */}
      <div className="sheet-head">
        <div>
          <div className="sheet-name">{character.emoji ? character.emoji + ' ' : ''}{character.name}</div>
          <div className="sheet-sub">
            {[sheet.race, (sheet.classes || []).map(c => `${c.name} ${c.level}`).join(' / '), sheet.level ? `Level ${sheet.level}` : null].filter(Boolean).join(' · ')}
          </div>
        </div>
      </div>
      <div className="sheet-hp">
        <div className="hp-num" style={{ color: hpColor }}>{hp}<span className="hp-max">/{maxHp || '?'}</span>{temp > 0 && <span className="hp-temp"> +{temp} temp</span>}</div>
        <div className="hp-bar"><div style={{ width: `${Math.max(0, Math.min(100, hpFrac * 100))}%`, background: hpColor }} /></div>
        <div className="hp-btns">
          {[-5, -1, +1, +5].map(n => (
            <button key={n} onClick={() => patch({ hp: Math.max(0, Math.min(maxHp || 999, hp + n)) })}>{n > 0 ? `+${n}` : n}</button>
          ))}
          <button title="Temporary hit points" onClick={() => { const v = window.prompt('Temporary HP:', temp); if (v !== null) patch({ tempHp: Math.max(0, parseInt(v, 10) || 0) }); }}>temp</button>
        </div>
        <div className="hp-btns">
          <button onClick={() => emit('rest', { characterId: character.id, kind: 'short' })}>☕ Short rest</button>
          <button onClick={() => window.confirm('Long rest: full HP, all spell slots back, conditions cleared?') && emit('rest', { characterId: character.id, kind: 'long' })}>🌙 Long rest</button>
        </div>
      </div>

      {/* ---- Core numbers ---- */}
      <div className="sheet-tiles">
        <Tile label="AC" value={d.ac} />
        <Tile label="Initiative" value={fmtBonus(d.initiative)} onClick={() => roll('Initiative', d.initiative)} />
        <Tile label="Speed" value={`${character.speed ?? 30} ft`} />
        <Tile label="Prof." value={fmtBonus(d.proficiency)} />
        <Tile label="Passive Perc." value={d.passivePerception} />
      </div>

      {/* ---- Abilities ---- */}
      <Section title="Abilities — tap to roll a check">
        <div className="sheet-abilities">
          {ABILITIES.map(a => {
            const tb = sheet.tempBonuses?.[a] || 0;
            return (
              <div key={a} className="ability" onClick={() => roll(`${ABILITY_NAMES[a]} check`, d.mods[a])} title={`Roll a ${ABILITY_NAMES[a]} check`}>
                <div className="ab-name">{a}</div>
                <div className="ab-mod">{fmtBonus(d.mods[a])}</div>
                <div className="ab-score">{d.abilities[a]}{tb ? <span className="ab-temp"> ({fmtBonus(tb)})</span> : ''}</div>
                <div className="ab-temp-btns" onClick={e => e.stopPropagation()}>
                  <button title="Temporary −1 (potion, spell, curse…)" onClick={() => patch({ tempBonuses: { ...(sheet.tempBonuses || {}), [a]: tb - 1 } })}>−</button>
                  <button title="Temporary +1" onClick={() => patch({ tempBonuses: { ...(sheet.tempBonuses || {}), [a]: tb + 1 } })}>+</button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="sheet-hint">Temporary bonuses change AC, initiative, saves, skills and attacks that use that ability.</div>
      </Section>

      {/* ---- Saves ---- */}
      <Section title="Saving throws" defaultOpen={false}>
        {ABILITIES.map(a => (
          <Row key={a}
            prof={d.saves[a].prof ? 1 : 0}
            onProf={() => patch({ saveProfs: toggle(sheet.saveProfs || [], a) })}
            label={`${ABILITY_NAMES[a]} save`} bonus={d.saves[a].bonus}
            onRoll={() => roll(`${ABILITY_NAMES[a]} save`, d.saves[a].bonus)} />
        ))}
      </Section>

      {/* ---- Skills ---- */}
      <Section title="Skills — ● proficient, ◉ expertise" defaultOpen={false}>
        {Object.keys(SKILLS).map(name => (
          <Row key={name}
            prof={d.skills[name].prof}
            onProf={() => {
              // cycle: none → proficient → expertise → none
              const p = d.skills[name].prof;
              if (p === 0) patch({ skillProfs: [...(sheet.skillProfs || []), name] });
              else if (p === 1) patch({ expertise: [...(sheet.expertise || []), name] });
              else patch({ skillProfs: (sheet.skillProfs || []).filter(x => x !== name), expertise: (sheet.expertise || []).filter(x => x !== name) });
            }}
            label={`${name} (${SKILLS[name]})`} bonus={d.skills[name].bonus}
            onRoll={() => roll(name, d.skills[name].bonus)} />
        ))}
      </Section>

      {/* ---- Attacks ---- */}
      <Section title="Attacks — pick the one you're using">
        {d.attacks.length === 0 && <div className="sheet-hint">No weapons yet. Add one below or link D&D Beyond.</div>}
        {d.attacks.map(a => {
          const active = (sheet.activeAttack || d.attacks[0]?.id) === a.id;
          return (
            <div key={a.id} className={`attack ${active ? 'active' : ''}`} onClick={() => patch({ activeAttack: a.id })}>
              <span className="atk-radio">{active ? '◉' : '○'}</span>
              <span className="atk-name">{a.name}</span>
              <span className="atk-num" title="to hit">{fmtBonus(a.toHit)}</span>
              <span className="atk-num" title="damage">{a.damage}{a.damageType ? ` ${a.damageType}` : ''}</span>
              <span className="atk-reach">{a.reach || 5} ft</span>
              {(dm || true) && <button className="tiny" title="Remove" onClick={e => { e.stopPropagation(); patch({ attacks: (sheet.attacks || []).filter(x => x.id !== a.id) }); }}>✕</button>}
            </div>
          );
        })}
        <AddAttack onAdd={(atk) => patch({ attacks: [...(sheet.attacks || []), atk] })} />
      </Section>

      {/* ---- Spell slots & spells ---- */}
      {(Object.keys(sheet.slots || {}).length > 0 || (sheet.spells || []).length > 0) && (
        <Section title="Spells">
          {Object.entries(sheet.slots || {}).sort(([a], [b]) => String(a).localeCompare(String(b), undefined, { numeric: true })).map(([lvl, sl]) => (
            <div key={lvl} className="slots-row">
              <span className="slots-lvl">{sl.pact ? 'Pact' : `Level ${lvl}`}</span>
              <span className="slots-pips">
                {Array.from({ length: sl.max }, (_, i) => (
                  <button key={i} className={`pip ${i < (sl.used || 0) ? 'used' : ''}`}
                    title={i < (sl.used || 0) ? 'Used — click to restore' : 'Click to spend'}
                    onClick={() => patch({ slots: { ...sheet.slots, [lvl]: { ...sl, used: i < (sl.used || 0) ? i : i + 1 } } })} />
                ))}
              </span>
              <span className="slots-count">{sl.max - (sl.used || 0)}/{sl.max}</span>
            </div>
          ))}
          <div className="spell-list">
            {(sheet.spells || []).map(sp => (
              <span key={sp.name} className={`spell ${sp.prepared === false ? 'unprepared' : ''}`} title={sp.level ? `Level ${sp.level}` : 'Cantrip'}>
                {sp.level ? `${sp.level}· ` : '∘ '}{sp.name}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* ---- Inventory ---- */}
      <Section title="Inventory" defaultOpen={false}>
        <div className="money">
          {['gp', 'sp', 'cp'].map(k => (
            <label key={k}>{k.toUpperCase()} <input type="number" value={sheet.money?.[k] ?? 0}
              onChange={e => patch({ money: { ...(sheet.money || {}), [k]: parseInt(e.target.value, 10) || 0 } })} /></label>
          ))}
        </div>
        {(sheet.inventory || []).map(it => (
          <div key={it.id} className="item">
            <span className="item-name">{it.equipped ? '🛡 ' : ''}{it.magic ? '✨ ' : ''}{it.name}{it.notes ? <span className="item-notes"> · {it.notes}</span> : ''}</span>
            <span className="item-qty">
              <button className="tiny" onClick={() => patch({ inventory: it.qty <= 1 ? sheet.inventory.filter(x => x.id !== it.id) : sheet.inventory.map(x => x.id === it.id ? { ...x, qty: x.qty - 1 } : x) })}>−</button>
              {it.qty}
              <button className="tiny" onClick={() => patch({ inventory: sheet.inventory.map(x => x.id === it.id ? { ...x, qty: (x.qty || 1) + 1 } : x) })}>+</button>
            </span>
          </div>
        ))}
        <AddItem onAdd={(item) => patch({ inventory: [...(sheet.inventory || []), item] })} />
      </Section>

      {/* ---- Conditions ---- */}
      <Section title="Conditions" defaultOpen={(sheet.conditions || []).length > 0}>
        <div className="conditions">
          {CONDITIONS.map(c => {
            const on = (sheet.conditions || []).includes(c);
            return <button key={c} className={`cond ${on ? 'on' : ''}`} onClick={() => patch({ conditions: toggle(sheet.conditions || [], c) })}>{c}</button>;
          })}
        </div>
      </Section>
    </div>
  );
}

const toggle = (arr, v) => arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v];

function Tile({ label, value, onClick }) {
  return (
    <div className={`tile ${onClick ? 'clickable' : ''}`} onClick={onClick} title={onClick ? 'Tap to roll' : undefined}>
      <div className="tile-val">{value}</div>
      <div className="tile-lab">{label}</div>
    </div>
  );
}

function Section({ title, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="sheet-section">
      <h3 onClick={() => setOpen(o => !o)}>{open ? '▾' : '▸'} {title}</h3>
      {open && children}
    </div>
  );
}

function Row({ prof, onProf, label, bonus, onRoll }) {
  return (
    <div className="sheet-row">
      <button className="prof" title="Toggle proficiency" onClick={onProf}>{prof === 2 ? '◉' : prof === 1 ? '●' : '○'}</button>
      <span className="row-label">{label}</span>
      <button className="row-roll" onClick={onRoll} title="Roll">{fmtBonus(bonus)} 🎲</button>
    </div>
  );
}

function AddAttack({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: '', dice: '1d6', ability: 'STR', magic: 0, ranged: false, reach: 5 });
  if (!open) return <button className="tiny-wide" onClick={() => setOpen(true)}>＋ Add weapon / attack</button>;
  return (
    <div className="add-form">
      <input placeholder="Name (Longsword)" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
      <input placeholder="Dice (1d8)" value={f.dice} onChange={e => setF({ ...f, dice: e.target.value })} />
      <select value={f.ability} onChange={e => setF({ ...f, ability: e.target.value })}>
        <option value="STR">STR</option><option value="DEX">DEX</option><option value="finesse">Finesse</option>
        <option value="INT">INT (spell)</option><option value="WIS">WIS (spell)</option><option value="CHA">CHA (spell)</option><option value="none">No ability</option>
      </select>
      <input type="number" placeholder="Magic +" value={f.magic} onChange={e => setF({ ...f, magic: parseInt(e.target.value, 10) || 0 })} title="Magic bonus (+1 sword)" />
      <input type="number" placeholder="Reach ft" value={f.reach} onChange={e => setF({ ...f, reach: parseInt(e.target.value, 10) || 5 })} title="Reach / range in feet" />
      <button className="primary" disabled={!f.name.trim()} onClick={() => { onAdd({ ...f, id: `atk-${Date.now()}`, name: f.name.trim(), proficient: true, ranged: f.reach > 10 }); setOpen(false); setF({ name: '', dice: '1d6', ability: 'STR', magic: 0, ranged: false, reach: 5 }); }}>Add</button>
      <button onClick={() => setOpen(false)}>Cancel</button>
    </div>
  );
}

function AddItem({ onAdd }) {
  const [name, setName] = useState('');
  return (
    <div className="add-form">
      <input placeholder="Add item (Healing potion)" value={name} onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && name.trim()) { onAdd({ id: `it-${Date.now()}`, name: name.trim(), qty: 1 }); setName(''); } }} />
      <button disabled={!name.trim()} onClick={() => { onAdd({ id: `it-${Date.now()}`, name: name.trim(), qty: 1 }); setName(''); }}>Add</button>
    </div>
  );
}
