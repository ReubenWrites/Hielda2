// 5e derivation rules: everything a roll needs, computed from the sheet.
//
// The sheet stores *sources* (ability scores, proficiencies, armour, weapons,
// temporary bonuses); this module derives *results* (modifiers, skill and
// save bonuses, initiative, AC, attack to-hit/damage). Changing a source —
// a temporary +2 DEX, a new proficiency, a magic weapon — changes every
// number that depends on it, the way a character sheet should.

export const ABILITIES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

export const SKILLS = {
  'Acrobatics': 'DEX', 'Animal Handling': 'WIS', 'Arcana': 'INT', 'Athletics': 'STR',
  'Deception': 'CHA', 'History': 'INT', 'Insight': 'WIS', 'Intimidation': 'CHA',
  'Investigation': 'INT', 'Medicine': 'WIS', 'Nature': 'INT', 'Perception': 'WIS',
  'Performance': 'CHA', 'Persuasion': 'CHA', 'Religion': 'INT', 'Sleight of Hand': 'DEX',
  'Stealth': 'DEX', 'Survival': 'WIS',
};

export const mod = (score) => Math.floor(((Number(score) || 10) - 10) / 2);
export const proficiencyForLevel = (level) => Math.max(2, Math.ceil((Number(level) || 1) / 4) + 1);
export const fmtBonus = (n) => (n >= 0 ? `+${n}` : `${n}`);

// Effective ability scores = base + temporary bonuses (potions, spells, DM rulings).
export function effectiveAbilities(sheet) {
  const out = {};
  for (const a of ABILITIES) {
    const base = Number(sheet?.abilities?.[a]);
    const temp = Number(sheet?.tempBonuses?.[a]) || 0;
    out[a] = (Number.isFinite(base) ? base : 10) + temp;
  }
  return out;
}

export function computeDerived(sheet = {}) {
  const abilities = effectiveAbilities(sheet);
  const mods = Object.fromEntries(ABILITIES.map(a => [a, mod(abilities[a])]));
  const prof = Number(sheet.proficiency) || proficiencyForLevel(sheet.level);
  const skillProfs = new Set(sheet.skillProfs || []);
  const expertise = new Set(sheet.expertise || []);
  const saveProfs = new Set(sheet.saveProfs || []);

  const skills = {};
  for (const [name, ab] of Object.entries(SKILLS)) {
    const level = expertise.has(name) ? 2 : (skillProfs.has(name) ? 1 : 0);
    const extra = Number(sheet.skillBonuses?.[name]) || 0;
    skills[name] = { ability: ab, prof: level, bonus: mods[ab] + level * prof + extra };
  }
  const saves = {};
  for (const a of ABILITIES) {
    const extra = Number(sheet.saveBonuses?.[a]) || 0;
    saves[a] = { prof: saveProfs.has(a), bonus: mods[a] + (saveProfs.has(a) ? prof : 0) + extra };
  }

  const initiative = mods.DEX + (Number(sheet.initExtra) || 0);
  const passivePerception = 10 + skills.Perception.bonus;

  // AC: armour base with its DEX cap (or 10 + DEX unarmoured), shield, misc.
  const arm = sheet.armour || {};
  let ac;
  if (arm.base != null) {
    const dex = arm.maxDex == null ? mods.DEX : Math.min(mods.DEX, arm.maxDex);
    ac = arm.base + dex;
  } else {
    ac = 10 + mods.DEX;
  }
  ac += (Number(arm.shield) || 0) + (Number(arm.bonus) || 0) + (Number(sheet.acExtra) || 0);
  if (sheet.acOverride != null) ac = Number(sheet.acOverride);

  // Attacks: to-hit and damage recomputed from the ability they use.
  const attacks = (sheet.attacks || []).map(a => {
    const useAbility = a.ability === 'finesse'
      ? (mods.DEX >= mods.STR ? 'DEX' : 'STR')
      : (a.ability || (a.ranged ? 'DEX' : 'STR'));
    const abMod = a.ability === 'none' ? 0 : (mods[useAbility] ?? 0);
    const magic = Number(a.magic) || 0;
    const toHit = a.toHitOverride != null
      ? Number(a.toHitOverride)
      : abMod + (a.proficient === false ? 0 : prof) + magic + (Number(a.toHitExtra) || 0);
    const dmgBonus = a.damageOverride != null ? null : abMod + magic + (Number(a.damageExtra) || 0);
    const dice = a.dice || (a.damage ? String(a.damage).replace(/([+-]\d+)$/, '') : '1d4');
    const damage = a.damageOverride != null
      ? String(a.damageOverride)
      : `${dice}${dmgBonus ? (dmgBonus > 0 ? '+' : '') + dmgBonus : ''}`;
    return { ...a, useAbility, toHit, damage, dice };
  });

  return { abilities, mods, proficiency: prof, skills, saves, initiative, passivePerception, ac, attacks };
}
