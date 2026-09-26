// D&D Beyond unofficial character sync.
//
// D&D Beyond does not publish an official API. Public characters (the
// character's privacy setting must allow public viewing) can be fetched from:
//
//   https://character-service.dndbeyond.com/character/v5/character/{id}
//
// We only read this — never write. The endpoint returns a large JSON blob;
// we normalise the bits the VTT cares about into a stable shape. D&D Beyond
// remains the rules calculator (levelling, class features, magic-item
// bonuses); QuestHub imports the resulting numbers and tracks live state.
//
// If D&D Beyond changes the endpoint, the user can paste a JSON dump manually
// instead (handled by the same normaliser).

const DDB_URL = 'https://character-service.dndbeyond.com/character/v5/character';
const ABILITIES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
const ABILITY_SUBTYPES = ['strength-score', 'dexterity-score', 'constitution-score', 'intelligence-score', 'wisdom-score', 'charisma-score'];

export async function fetchDdbCharacter(characterId) {
  if (!/^\d+$/.test(String(characterId))) {
    throw new Error('characterId must be numeric');
  }
  const res = await fetch(`${DDB_URL}/${characterId}`, {
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`D&D Beyond fetch failed: ${res.status}`);
  }
  const body = await res.json();
  // Endpoint wraps the character data; tolerate both shapes.
  const data = body?.data ?? body;
  if (!data || typeof data !== 'object') throw new Error('Unexpected D&D Beyond response');
  return normaliseDdb(data);
}

const mod = (score) => Math.floor((score - 10) / 2);
const profForLevel = (level) => Math.max(2, Math.ceil(level / 4) + 1);

function allModifiers(d) {
  const m = d.modifiers || {};
  return [].concat(m.race ?? [], m.class ?? [], m.background ?? [], m.feat ?? [], m.condition ?? [],
    // Only equipped/attuned items grant their bonuses.
    (m.item ?? []).filter(x => {
      const inv = (d.inventory || []).find(i => i.id === x.componentId || i.definition?.id === x.componentId);
      return !inv || (inv.equipped && (inv.isAttuned || !inv.definition?.canAttune));
    }));
}

export function normaliseDdb(d) {
  const out = {
    source: 'dndbeyond',
    id: d.id ?? null,
    name: d.name ?? 'Unknown',
    race: d.race?.fullName ?? d.race?.baseName ?? null,
    classes: Array.isArray(d.classes)
      ? d.classes.map(c => ({
          name: c.definition?.name ?? c.class?.name ?? 'Class',
          level: c.level ?? 0,
        }))
      : [],
    level: 0,
    hp: { current: null, max: null, temp: null },
    ac: null,
    abilities: {},
    speed: null,
    senses: { darkvision: 0, blindsight: 0, truesight: 0, tremorsense: 0 },
    avatarUrl: d.avatarUrl ?? d.decorations?.avatarUrl ?? null,
    slots: {},
    inventory: [],
    spells: [],
    attacks: [],
    money: { gp: d.currencies?.gp ?? 0, sp: d.currencies?.sp ?? 0, cp: d.currencies?.cp ?? 0 },
    xp: d.currentXp ?? 0,
  };
  out.level = out.classes.reduce((s, c) => s + (c.level || 0), 0);
  out.proficiency = profForLevel(out.level || 1);

  const mods = allModifiers(d);

  // Ability scores: base + bonus/override + any "+N to score" modifiers (race, feats, equipped items).
  if (Array.isArray(d.stats)) {
    d.stats.forEach((s, i) => {
      if (!ABILITIES[i]) return;
      let score = s.value ?? 10;
      const bonus = d.bonusStats?.[i]?.value; if (typeof bonus === 'number') score += bonus;
      const override = d.overrideStats?.[i]?.value; if (typeof override === 'number') score = override;
      for (const m of mods) {
        if (m.type === 'bonus' && m.subType === ABILITY_SUBTYPES[i] && typeof m.value === 'number') score += m.value;
        if (m.type === 'set' && m.subType === ABILITY_SUBTYPES[i] && typeof m.value === 'number' && m.value > score) score = m.value;
      }
      out.abilities[ABILITIES[i]] = score;
    });
  }
  const conMod = mod(out.abilities.CON ?? 10);

  if (typeof d.baseHitPoints === 'number') {
    out.hp.max = d.baseHitPoints + conMod * (out.level || 1) + (d.bonusHitPoints || 0);
    if (typeof d.overrideHitPoints === 'number') out.hp.max = d.overrideHitPoints;
  }
  if (typeof d.removedHitPoints === 'number' && out.hp.max != null) {
    out.hp.current = out.hp.max - d.removedHitPoints;
  } else if (typeof d.currentHitPoints === 'number') {
    out.hp.current = d.currentHitPoints;
  }
  if (typeof d.temporaryHitPoints === 'number') out.hp.temp = d.temporaryHitPoints;

  if (typeof d.weightSpeeds?.normal?.walk === 'number') out.speed = d.weightSpeeds.normal.walk;

  // Senses: look for darkvision modifiers
  for (const m of mods) {
    if (m.type !== 'set-base' && m.type !== 'set') continue;
    const sub = m.subType?.toLowerCase();
    if (sub === 'darkvision') out.senses.darkvision = Math.max(out.senses.darkvision, m.value ?? 60);
    if (sub === 'blindsight') out.senses.blindsight = Math.max(out.senses.blindsight, m.value ?? 0);
    if (sub === 'truesight') out.senses.truesight = Math.max(out.senses.truesight, m.value ?? 0);
    if (sub === 'tremorsense') out.senses.tremorsense = Math.max(out.senses.tremorsense, m.value ?? 0);
  }

  // Derived numbers the VTT can use directly.
  const dexMod = mod(out.abilities.DEX ?? 10);
  out.dexMod = dexMod;
  out.initBonus = dexMod;
  // Armour class: DDB doesn't hand over a computed AC. Base 10 + DEX, plus
  // equipped armour/shield from the inventory, plus flat AC bonuses.
  let ac = 10 + dexMod;
  let armourBase = null, maxDex = null, shield = 0;
  for (const it of d.inventory || []) {
    const def = it.definition || {};
    if (!it.equipped) continue;
    if (def.filterType === 'Armor' || def.armorTypeId) {
      if (/shield/i.test(def.name || '') || def.armorTypeId === 4) shield += def.armorClass || 2;
      else if (typeof def.armorClass === 'number') {
        armourBase = def.armorClass;
        if (def.armorTypeId === 2) maxDex = 2;   // medium armour
        if (def.armorTypeId === 3) maxDex = 0;   // heavy armour
      }
    }
  }
  if (armourBase != null) ac = armourBase + (maxDex == null ? dexMod : Math.min(dexMod, maxDex));
  ac += shield;
  for (const m of mods) {
    if (m.type === 'bonus' && m.subType === 'armor-class' && typeof m.value === 'number') ac += m.value;
  }
  out.ac = ac;

  // Proficiencies (skills, expertise, saving throws) and flat bonuses.
  out.skillProfs = []; out.expertise = []; out.saveProfs = []; out.initExtra = 0;
  const SKILL_BY_SUBTYPE = {
    'acrobatics': 'Acrobatics', 'animal-handling': 'Animal Handling', 'arcana': 'Arcana', 'athletics': 'Athletics',
    'deception': 'Deception', 'history': 'History', 'insight': 'Insight', 'intimidation': 'Intimidation',
    'investigation': 'Investigation', 'medicine': 'Medicine', 'nature': 'Nature', 'perception': 'Perception',
    'performance': 'Performance', 'persuasion': 'Persuasion', 'religion': 'Religion', 'sleight-of-hand': 'Sleight of Hand',
    'stealth': 'Stealth', 'survival': 'Survival',
  };
  const SAVE_BY_SUBTYPE = {
    'strength-saving-throws': 'STR', 'dexterity-saving-throws': 'DEX', 'constitution-saving-throws': 'CON',
    'intelligence-saving-throws': 'INT', 'wisdom-saving-throws': 'WIS', 'charisma-saving-throws': 'CHA',
  };
  for (const m of mods) {
    const sub = (m.subType || '').toLowerCase();
    if (m.type === 'proficiency' && SKILL_BY_SUBTYPE[sub] && !out.skillProfs.includes(SKILL_BY_SUBTYPE[sub])) out.skillProfs.push(SKILL_BY_SUBTYPE[sub]);
    if (m.type === 'expertise' && SKILL_BY_SUBTYPE[sub] && !out.expertise.includes(SKILL_BY_SUBTYPE[sub])) out.expertise.push(SKILL_BY_SUBTYPE[sub]);
    if (m.type === 'proficiency' && SAVE_BY_SUBTYPE[sub] && !out.saveProfs.includes(SAVE_BY_SUBTYPE[sub])) out.saveProfs.push(SAVE_BY_SUBTYPE[sub]);
    if (m.type === 'bonus' && sub === 'initiative' && typeof m.value === 'number') out.initExtra += m.value;
  }
  out.armour = { base: armourBase, maxDex, shield, bonus: 0 };
  for (const m of mods) {
    if (m.type === 'bonus' && m.subType === 'armor-class' && typeof m.value === 'number') out.armour.bonus += m.value;
  }

  // Spell slots
  for (const s of d.spellSlots || []) {
    if (s.level && s.available > 0) out.slots[s.level] = { max: s.available, used: s.used || 0 };
  }
  for (const s of d.pactMagic || []) {
    if (s.level && s.available > 0) out.slots[`pact${s.level}`] = { max: s.available, used: s.used || 0, pact: true };
  }

  // Inventory
  out.inventory = (d.inventory || []).map(it => ({
    id: String(it.id ?? it.definition?.id ?? Math.random()),
    name: it.definition?.name || 'Item',
    qty: it.quantity ?? 1,
    equipped: !!it.equipped,
    magic: !!it.definition?.magic,
    notes: it.definition?.rarity && it.definition.rarity !== 'Common' ? it.definition.rarity : '',
  }));

  // Spells (class + racial + item spells), with prepared flag where DDB has it
  const spellGroups = [].concat(
    ...(d.classSpells || []).map(g => g.spells || []),
    ...(Object.values(d.spells || {}).flat ? Object.values(d.spells || {}).flat() : []),
  );
  const seen = new Set();
  for (const sp of spellGroups) {
    const name = sp.definition?.name; if (!name || seen.has(name)) continue;
    seen.add(name);
    out.spells.push({ name, level: sp.definition?.level ?? 0, prepared: sp.prepared !== false });
  }
  out.spells.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));

  // Attacks from equipped weapons, expressed as *sources* (the rules engine
  // derives to-hit and damage so ability changes flow through).
  for (const it of d.inventory || []) {
    const def = it.definition || {};
    if (!it.equipped || def.filterType !== 'Weapon' || !def.damage?.diceString) continue;
    const props = (def.properties || []).map(p => (p.name || '').toLowerCase());
    const ranged = def.attackType === 2 || /ranged/i.test(def.categoryName || '') || props.includes('ammunition');
    let magic = 0;
    for (const m of def.grantedModifiers || []) if (m.type === 'bonus' && m.subType === 'magic' && typeof m.value === 'number') magic = Math.max(magic, m.value);
    out.attacks.push({
      id: String(it.id ?? def.id),
      name: def.name,
      dice: def.damage.diceString,
      ability: props.includes('finesse') ? 'finesse' : (ranged ? 'DEX' : 'STR'),
      ranged: !!ranged,
      magic,
      proficient: true,
      damageType: def.damageType || '',
      reach: ranged ? (def.range || 30) : (props.includes('reach') ? 10 : 5),
    });
  }

  return out;
}

// Map a normalised sheet onto the fields a token / cast character understands.
export function ddbToStats(data) {
  const stats = {};
  if (data.name) stats.name = data.name;
  if (data.hp?.max != null) { stats.maxHp = data.hp.max; stats.hp = data.hp.current ?? data.hp.max; }
  if (data.ac != null) stats.ac = data.ac;
  if (data.speed != null) stats.speed = data.speed;
  if (data.senses?.darkvision > 0) stats.sightRadius = Math.max(6, Math.round(data.senses.darkvision / 5));
  if (typeof data.initBonus === 'number') stats.initBonus = data.initBonus;
  if (data.avatarUrl) stats.imageUrl = data.avatarUrl;
  if (data.attacks?.length) {
    stats.reach = Math.max(5, ...data.attacks.map(a => a.reach || 5));
  }
  stats.sheet = {
    level: data.level, classes: data.classes, race: data.race, proficiency: data.proficiency,
    abilities: data.abilities, tempHp: data.hp?.temp ?? 0,
    skillProfs: data.skillProfs || [], expertise: data.expertise || [], saveProfs: data.saveProfs || [],
    initExtra: data.initExtra || 0, armour: data.armour || {},
    slots: data.slots, inventory: data.inventory, spells: data.spells, attacks: data.attacks,
    money: data.money, xp: data.xp,
    // Snapshot for the end-of-session "what changed" checklist.
    ddbSnapshot: {
      hp: data.hp?.current ?? data.hp?.max ?? null,
      slots: data.slots,
      inventory: data.inventory.map(i => ({ name: i.name, qty: i.qty })),
      money: data.money,
      xp: data.xp,
    },
  };
  return stats;
}
