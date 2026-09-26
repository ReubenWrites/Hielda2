// SRD 5.1 monster quick-stats for one-click token creation.
// Deliberately small: name, hp, ac, sight (in grid cells, 1 cell = 5 ft),
// a display colour and an emoji for the picker. DMs can edit anything after
// placing. Stats are from the freely-licensed SRD — rename tokens for
// campaign-specific villains.

export const BESTIARY = [
  // Townsfolk & humanoids
  { key: 'commoner',     name: 'Commoner',       emoji: '🧑', hp: 4,   ac: 10, sight: 6,  color: '#8d99ae', speed: 30, attacks: 1, size: 1, reach: 5, initBonus: 0 },
  { key: 'bandit',       name: 'Bandit',         emoji: '🗡️', hp: 11,  ac: 12, sight: 6,  color: '#b5651d', speed: 30, attacks: 1, size: 1, reach: 30, initBonus: 1 },
  { key: 'cultist',      name: 'Cultist',        emoji: '🕯️', hp: 9,   ac: 12, sight: 6,  color: '#6d3580', speed: 30, attacks: 1, size: 1, reach: 5, initBonus: 1 },
  { key: 'guard',        name: 'Guard',          emoji: '🛡️', hp: 11,  ac: 16, sight: 6,  color: '#4a6fa5', speed: 30, attacks: 1, size: 1, reach: 10, initBonus: 0 },
  { key: 'scout',        name: 'Scout',          emoji: '🏹', hp: 16,  ac: 13, sight: 6,  color: '#5a7d4a', speed: 30, attacks: 2, size: 1, reach: 150, initBonus: 2 },
  { key: 'priest',       name: 'Priest',         emoji: '📿', hp: 27,  ac: 13, sight: 6,  color: '#c9b458', speed: 25, attacks: 1, size: 1, reach: 5, initBonus: 0 },
  { key: 'mage',         name: 'Mage',           emoji: '🔮', hp: 40,  ac: 12, sight: 6,  color: '#7b5ce0', speed: 30, attacks: 1, size: 1, reach: 120, initBonus: 0 },
  { key: 'knight',       name: 'Knight',         emoji: '⚔️', hp: 52,  ac: 18, sight: 6,  color: '#9aa5b8', speed: 30, attacks: 2, size: 1, reach: 5, initBonus: 0 },
  { key: 'werewolf',     name: 'Werewolf',       emoji: '🌕', hp: 58,  ac: 12, sight: 6,  color: '#7a5c3e', speed: 30, attacks: 2, size: 1, reach: 5, initBonus: 1 },
  { key: 'nighthag',     name: 'Night Hag',      emoji: '🌒', hp: 112, ac: 17, sight: 24, color: '#4b2e5a', speed: 30, attacks: 1, size: 1, reach: 5, initBonus: 2 },

  // Beasts
  { key: 'rat',          name: 'Rat',            emoji: '🐀', hp: 1,   ac: 10, sight: 6,  color: '#7d7461', speed: 20, attacks: 1, size: 1, reach: 5, initBonus: 0 },
  { key: 'bat',          name: 'Bat',            emoji: '🦇', hp: 1,   ac: 12, sight: 12, color: '#544e61', speed: 30, attacks: 1, size: 1, reach: 5, initBonus: 2 },
  { key: 'wolf',         name: 'Wolf',           emoji: '🐺', hp: 11,  ac: 13, sight: 6,  color: '#6b7b8c', speed: 40, attacks: 1, size: 1, reach: 5, initBonus: 2 },
  { key: 'direwolf',     name: 'Dire Wolf',      emoji: '🐺', hp: 37,  ac: 14, sight: 6,  color: '#44525f', speed: 50, attacks: 1, size: 2, reach: 5, initBonus: 2 },
  { key: 'giantspider',  name: 'Giant Spider',   emoji: '🕷️', hp: 26,  ac: 14, sight: 12, color: '#3c3c3c', speed: 30, attacks: 1, size: 2, reach: 5, initBonus: 3 },
  { key: 'swarmrats',    name: 'Swarm of Rats',  emoji: '🐀', hp: 24,  ac: 10, sight: 6,  color: '#6e6250', speed: 30, attacks: 1, size: 1, reach: 5, initBonus: 0 },
  { key: 'swarmbats',    name: 'Swarm of Bats',  emoji: '🦇', hp: 22,  ac: 12, sight: 12, color: '#463f52', speed: 30, attacks: 1, size: 1, reach: 5, initBonus: 2 },

  // Undead & horrors
  { key: 'skeleton',     name: 'Skeleton',       emoji: '💀', hp: 13,  ac: 13, sight: 12, color: '#d8d3c5', speed: 30, attacks: 1, size: 1, reach: 30, initBonus: 2 },
  { key: 'zombie',       name: 'Zombie',         emoji: '🧟', hp: 22,  ac: 8,  sight: 12, color: '#5e7350', speed: 20, attacks: 1, size: 1, reach: 5, initBonus: -2 },
  { key: 'ghoul',        name: 'Ghoul',          emoji: '🩸', hp: 22,  ac: 12, sight: 12, color: '#8a9a5b', speed: 30, attacks: 1, size: 1, reach: 5, initBonus: 2 },
  { key: 'shadow',       name: 'Shadow',         emoji: '🌑', hp: 16,  ac: 12, sight: 12, color: '#2e2e38', speed: 40, attacks: 1, size: 1, reach: 5, initBonus: 2 },
  { key: 'specter',      name: 'Specter',        emoji: '👻', hp: 22,  ac: 12, sight: 12, color: '#88a2b8', speed: 50, attacks: 1, size: 1, reach: 5, initBonus: 2 },
  { key: 'ghost',        name: 'Ghost',          emoji: '👻', hp: 45,  ac: 11, sight: 12, color: '#b8cdd8', speed: 40, attacks: 1, size: 1, reach: 5, initBonus: 1 },
  { key: 'wight',        name: 'Wight',          emoji: '🗡️', hp: 45,  ac: 14, sight: 12, color: '#5c6b60', speed: 30, attacks: 2, size: 1, reach: 30, initBonus: 2 },
  { key: 'vampirespawn', name: 'Vampire Spawn',  emoji: '🧛', hp: 82,  ac: 15, sight: 12, color: '#7a2e3d', speed: 30, attacks: 2, size: 1, reach: 5, initBonus: 3 },
  { key: 'vampire',      name: 'Vampire',        emoji: '🧛', hp: 144, ac: 16, sight: 24, color: '#8b1a2b', speed: 30, attacks: 2, size: 1, reach: 5, initBonus: 4 },
];

export function findMonster(key) {
  return BESTIARY.find(m => m.key === key) || null;
}
