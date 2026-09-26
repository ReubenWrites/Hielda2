import { describe, test, expect } from 'vitest';
import { computeDerived, mod, proficiencyForLevel, SKILLS } from './rules.js';

// Seren-like level 5 rogue: DEX 16, proficient in Stealth (expertise) and
// Perception, DEX saves, studded leather (12 + DEX), rapier (finesse, +1).
const seren = {
  level: 5,
  abilities: { STR: 10, DEX: 16, CON: 14, INT: 12, WIS: 13, CHA: 8 },
  skillProfs: ['Stealth', 'Perception', 'Acrobatics'],
  expertise: ['Stealth'],
  saveProfs: ['DEX', 'INT'],
  armour: { base: 12, maxDex: null, shield: 0, bonus: 0 },
  attacks: [
    { id: 'rapier', name: 'Rapier +1', dice: '1d8', ability: 'finesse', magic: 1 },
    { id: 'bow', name: 'Shortbow', dice: '1d6', ability: 'DEX', ranged: true },
    { id: 'club', name: 'Improvised club', dice: '1d4', ability: 'STR', proficient: false },
  ],
};

describe('rules: derived numbers', () => {
  test('modifiers and proficiency by level', () => {
    expect(mod(16)).toBe(3); expect(mod(8)).toBe(-1); expect(mod(10)).toBe(0);
    expect(proficiencyForLevel(1)).toBe(2); expect(proficiencyForLevel(5)).toBe(3); expect(proficiencyForLevel(9)).toBe(4);
  });

  test('skills: proficiency and expertise apply; unproficient is plain modifier', () => {
    const d = computeDerived(seren);
    expect(d.proficiency).toBe(3);
    expect(d.skills.Stealth.bonus).toBe(3 + 6);        // DEX 3 + expertise 2×3
    expect(d.skills.Perception.bonus).toBe(1 + 3);     // WIS 1 + prof
    expect(d.skills['Animal Handling'].bonus).toBe(1); // WIS only
    expect(d.skills.Athletics.bonus).toBe(0);
    expect(Object.keys(d.skills)).toHaveLength(Object.keys(SKILLS).length);
  });

  test('learning Animal Handling changes that roll and nothing else', () => {
    const before = computeDerived(seren);
    const after = computeDerived({ ...seren, skillProfs: [...seren.skillProfs, 'Animal Handling'] });
    expect(after.skills['Animal Handling'].bonus).toBe(before.skills['Animal Handling'].bonus + 3);
    expect(after.skills.Stealth.bonus).toBe(before.skills.Stealth.bonus);
    expect(after.ac).toBe(before.ac);
  });

  test('saves, initiative, passive perception, AC, attacks', () => {
    const d = computeDerived(seren);
    expect(d.saves.DEX.bonus).toBe(6);   // 3 + prof
    expect(d.saves.STR.bonus).toBe(0);
    expect(d.initiative).toBe(3);
    expect(d.passivePerception).toBe(14);
    expect(d.ac).toBe(15);               // 12 + 3
    const rapier = d.attacks.find(a => a.id === 'rapier');
    expect(rapier.useAbility).toBe('DEX');
    expect(rapier.toHit).toBe(3 + 3 + 1);
    expect(rapier.damage).toBe('1d8+4');
    const bow = d.attacks.find(a => a.id === 'bow');
    expect(bow.toHit).toBe(6);
    expect(bow.damage).toBe('1d6+3');
    const club = d.attacks.find(a => a.id === 'club');
    expect(club.toHit).toBe(0);          // not proficient, STR 0
    expect(club.damage).toBe('1d4');
  });

  test('a temporary +2 DEX ripples into AC, initiative, DEX skills, saves and finesse/ranged attacks', () => {
    const before = computeDerived(seren);
    const boosted = computeDerived({ ...seren, tempBonuses: { DEX: 2 } });
    expect(boosted.abilities.DEX).toBe(18);
    expect(boosted.mods.DEX).toBe(4);
    expect(boosted.ac).toBe(before.ac + 1);
    expect(boosted.initiative).toBe(before.initiative + 1);
    expect(boosted.skills.Stealth.bonus).toBe(before.skills.Stealth.bonus + 1);
    expect(boosted.skills.Acrobatics.bonus).toBe(before.skills.Acrobatics.bonus + 1);
    expect(boosted.saves.DEX.bonus).toBe(before.saves.DEX.bonus + 1);
    expect(boosted.attacks.find(a => a.id === 'rapier').toHit).toBe(before.attacks.find(a => a.id === 'rapier').toHit + 1);
    expect(boosted.attacks.find(a => a.id === 'bow').damage).toBe('1d6+4');
    // ...and does not touch STR-based numbers
    expect(boosted.skills.Athletics.bonus).toBe(before.skills.Athletics.bonus);
    expect(boosted.attacks.find(a => a.id === 'club').toHit).toBe(before.attacks.find(a => a.id === 'club').toHit);
  });

  test('medium armour caps DEX at +2; shield and misc bonuses add; override wins', () => {
    const d = computeDerived({ ...seren, armour: { base: 14, maxDex: 2, shield: 2, bonus: 1 } });
    expect(d.ac).toBe(14 + 2 + 2 + 1);
    expect(computeDerived({ ...seren, acOverride: 20 }).ac).toBe(20);
  });

  test('level-up raises proficiency and everything proficient', () => {
    const l4 = computeDerived({ ...seren, level: 4 });
    const l5 = computeDerived({ ...seren, level: 5 });
    expect(l5.proficiency).toBe(l4.proficiency + 1);
    expect(l5.skills.Perception.bonus).toBe(l4.skills.Perception.bonus + 1);
    expect(l5.skills.Stealth.bonus).toBe(l4.skills.Stealth.bonus + 2); // expertise doubles
    expect(l5.attacks[0].toHit).toBe(l4.attacks[0].toHit + 1);
    expect(l5.attacks.find(a => a.id === 'club').toHit).toBe(l4.attacks.find(a => a.id === 'club').toHit);
  });

  test('empty sheet is safe: all numbers defined', () => {
    const d = computeDerived({});
    expect(d.ac).toBe(10);
    expect(d.initiative).toBe(0);
    expect(d.skills.Perception.bonus).toBe(0);
    expect(d.attacks).toEqual([]);
  });
});
