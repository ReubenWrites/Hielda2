import { describe, test, expect } from 'vitest';
import { normaliseDdb, ddbToStats } from '../src/dndbeyond.js';
import { computeDerived } from '@questhub/shared/rules';

// A D&D Beyond character-service style payload for a level 5 wood-elf rogue:
// base DEX 15 +2 racial, studded leather + no shield, Rapier +1 (finesse),
// Longbow, expertise in Stealth, proficient Perception & Acrobatics,
// DEX/INT saves, Bless-less but with 4 level-1 and 2 level-2 slots.
const fixture = {
  id: 12345678,
  name: 'Seren',
  race: { fullName: 'Wood Elf', baseName: 'Elf' },
  classes: [{ level: 5, definition: { name: 'Rogue' } }],
  baseHitPoints: 33,          // 5d8 rolled average before CON
  removedHitPoints: 6,
  temporaryHitPoints: 3,
  currentXp: 6500,
  currencies: { gp: 12, sp: 5, cp: 30 },
  stats: [{ id: 1, value: 10 }, { id: 2, value: 15 }, { id: 3, value: 14 }, { id: 4, value: 12 }, { id: 5, value: 13 }, { id: 6, value: 8 }],
  bonusStats: [{ value: null }, { value: null }, { value: null }, { value: null }, { value: null }, { value: null }],
  overrideStats: [{ value: null }, { value: null }, { value: null }, { value: null }, { value: null }, { value: null }],
  weightSpeeds: { normal: { walk: 35 } },
  modifiers: {
    race: [
      { type: 'bonus', subType: 'dexterity-score', value: 2 },
      { type: 'bonus', subType: 'wisdom-score', value: 1 },
      { type: 'set-base', subType: 'darkvision', value: 60 },
      { type: 'proficiency', subType: 'perception' },
    ],
    class: [
      { type: 'proficiency', subType: 'stealth' },
      { type: 'expertise', subType: 'stealth' },
      { type: 'proficiency', subType: 'acrobatics' },
      { type: 'proficiency', subType: 'dexterity-saving-throws' },
      { type: 'proficiency', subType: 'intelligence-saving-throws' },
    ],
    background: [], feat: [], condition: [],
    item: [
      // Cloak of Protection: +1 AC, but only when equipped & attuned
      { type: 'bonus', subType: 'armor-class', value: 1, componentId: 9001 },
    ],
  },
  inventory: [
    { id: 7001, equipped: true, quantity: 1, definition: { name: 'Studded Leather', filterType: 'Armor', armorTypeId: 1, armorClass: 12 } },
    { id: 7002, equipped: true, quantity: 1, definition: { name: 'Rapier +1', filterType: 'Weapon', magic: true, rarity: 'Uncommon',
      damage: { diceString: '1d8' }, damageType: 'Piercing', attackType: 1, properties: [{ name: 'Finesse' }],
      grantedModifiers: [{ type: 'bonus', subType: 'magic', value: 1 }] } },
    { id: 7003, equipped: true, quantity: 1, definition: { name: 'Longbow', filterType: 'Weapon', damage: { diceString: '1d8' }, damageType: 'Piercing', attackType: 2, range: 150, properties: [{ name: 'Ammunition' }, { name: 'Heavy' }] } },
    { id: 7004, equipped: false, quantity: 1, definition: { name: 'Greataxe', filterType: 'Weapon', damage: { diceString: '1d12' }, attackType: 1 } },
    { id: 7005, equipped: false, quantity: 3, definition: { name: 'Potion of Healing', filterType: 'Potion', rarity: 'Common' } },
    { id: 9001, equipped: true, isAttuned: true, quantity: 1, definition: { name: 'Cloak of Protection', filterType: 'Wondrous item', magic: true, rarity: 'Uncommon', canAttune: true } },
  ],
  spellSlots: [{ level: 1, used: 1, available: 4 }, { level: 2, used: 0, available: 2 }, { level: 3, used: 0, available: 0 }],
  classSpells: [{ spells: [
    { prepared: true, definition: { name: 'Find Familiar', level: 1 } },
    { prepared: true, definition: { name: 'Mage Hand', level: 0 } },
  ] }],
};

describe('D&D Beyond import → sheet', () => {
  const n = normaliseDdb(fixture);

  test('identity, level, proficiency, XP, money', () => {
    expect(n.name).toBe('Seren');
    expect(n.race).toBe('Wood Elf');
    expect(n.classes).toEqual([{ name: 'Rogue', level: 5 }]);
    expect(n.level).toBe(5);
    expect(n.proficiency).toBe(3);
    expect(n.xp).toBe(6500);
    expect(n.money).toEqual({ gp: 12, sp: 5, cp: 30 });
  });

  test('ability scores include racial bonuses', () => {
    expect(n.abilities).toEqual({ STR: 10, DEX: 17, CON: 14, INT: 12, WIS: 14, CHA: 8 });
  });

  test('HP: base + CON per level; current = max − removed; temp kept', () => {
    expect(n.hp.max).toBe(33 + 2 * 5);
    expect(n.hp.current).toBe(43 - 6);
    expect(n.hp.temp).toBe(3);
  });

  test('speed and darkvision', () => {
    expect(n.speed).toBe(35);
    expect(n.senses.darkvision).toBe(60);
  });

  test('proficiencies, expertise, saves', () => {
    expect(n.skillProfs.sort()).toEqual(['Acrobatics', 'Perception', 'Stealth']);
    expect(n.expertise).toEqual(['Stealth']);
    expect(n.saveProfs.sort()).toEqual(['DEX', 'INT']);
  });

  test('armour from equipped items and attuned AC bonus', () => {
    expect(n.armour).toEqual({ base: 12, maxDex: null, shield: 0, bonus: 1 });
    expect(n.ac).toBe(12 + 3 + 1);
  });

  test('only equipped weapons become attacks, as rule sources', () => {
    expect(n.attacks.map(a => a.name)).toEqual(['Rapier +1', 'Longbow']);
    const rapier = n.attacks[0];
    expect(rapier).toMatchObject({ dice: '1d8', ability: 'finesse', magic: 1, proficient: true, reach: 5 });
    const bow = n.attacks[1];
    expect(bow).toMatchObject({ dice: '1d8', ability: 'DEX', ranged: true, reach: 150 });
  });

  test('slots, spells, inventory', () => {
    expect(n.slots).toEqual({ 1: { max: 4, used: 1 }, 2: { max: 2, used: 0 } });
    expect(n.spells).toEqual([{ name: 'Mage Hand', level: 0, prepared: true }, { name: 'Find Familiar', level: 1, prepared: true }]);
    expect(n.inventory.find(i => i.name === 'Potion of Healing')).toMatchObject({ qty: 3, equipped: false });
    expect(n.inventory.find(i => i.name === 'Rapier +1')).toMatchObject({ magic: true, notes: 'Uncommon' });
  });

  test('the derived sheet agrees with the rules engine end to end', () => {
    const stats = ddbToStats(n);
    expect(stats).toMatchObject({ name: 'Seren', maxHp: 43, hp: 37, ac: 16, speed: 35, sightRadius: 12, initBonus: 3, reach: 150 });
    const d = computeDerived(stats.sheet);
    expect(d.ac).toBe(16);
    expect(d.initiative).toBe(3);
    expect(d.skills.Stealth.bonus).toBe(3 + 6);
    expect(d.skills.Perception.bonus).toBe(2 + 3);
    expect(d.skills['Animal Handling'].bonus).toBe(2);
    expect(d.saves.DEX.bonus).toBe(6);
    expect(d.attacks[0]).toMatchObject({ name: 'Rapier +1', toHit: 3 + 3 + 1, damage: '1d8+4' });
    expect(d.attacks[1]).toMatchObject({ name: 'Longbow', toHit: 6, damage: '1d8+3' });
    // Snapshot for the end-of-session checklist
    expect(stats.sheet.ddbSnapshot.hp).toBe(37);
    expect(stats.sheet.ddbSnapshot.slots[1].used).toBe(1);
  });

  test('unequipped or un-attuned item bonuses are ignored', () => {
    const f2 = JSON.parse(JSON.stringify(fixture));
    f2.inventory.find(i => i.id === 9001).isAttuned = false;
    expect(normaliseDdb(f2).ac).toBe(15);
    f2.inventory.find(i => i.id === 7001).equipped = false;
    expect(normaliseDdb(f2).ac).toBe(10 + 3);
  });

  test('a level-up on D&D Beyond flows through: proficiency, HP, attack bonus', () => {
    const f3 = JSON.parse(JSON.stringify(fixture));
    f3.classes[0].level = 9; f3.baseHitPoints = 55;
    const n3 = normaliseDdb(f3);
    expect(n3.proficiency).toBe(4);
    expect(n3.hp.max).toBe(55 + 18);
    const d3 = computeDerived(ddbToStats(n3).sheet);
    expect(d3.attacks[0].toHit).toBe(3 + 4 + 1);
    expect(d3.skills.Stealth.bonus).toBe(3 + 8);
  });

  test('garbage in does not throw', () => {
    expect(() => normaliseDdb({})).not.toThrow();
    const d = computeDerived(ddbToStats(normaliseDdb({})).sheet);
    expect(d.ac).toBe(10);
  });
});
