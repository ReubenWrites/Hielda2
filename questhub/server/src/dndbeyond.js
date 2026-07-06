// D&D Beyond unofficial character sync.
//
// D&D Beyond does not publish an official API. Public characters (the
// character's privacy setting must allow public viewing) can be fetched from:
//
//   https://character-service.dndbeyond.com/character/v5/character/{id}
//
// We only read this — never write. The endpoint returns a large JSON blob;
// we normalise the bits the VTT cares about into a stable shape.
//
// If D&D Beyond changes the endpoint, the user can paste a JSON dump manually
// instead (handled by the same normaliser).

const DDB_URL = 'https://character-service.dndbeyond.com/character/v5/character';

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
  };
  out.level = out.classes.reduce((s, c) => s + (c.level || 0), 0);

  if (typeof d.baseHitPoints === 'number') out.hp.max = d.baseHitPoints;
  if (typeof d.removedHitPoints === 'number' && out.hp.max != null) {
    out.hp.current = out.hp.max - d.removedHitPoints;
  } else if (typeof d.currentHitPoints === 'number') {
    out.hp.current = d.currentHitPoints;
  }
  if (typeof d.temporaryHitPoints === 'number') out.hp.temp = d.temporaryHitPoints;

  if (Array.isArray(d.stats)) {
    const names = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
    d.stats.forEach((s, i) => { if (names[i]) out.abilities[names[i]] = s.value; });
  }

  if (typeof d.weightSpeeds?.normal?.walk === 'number') out.speed = d.weightSpeeds.normal.walk;

  // Senses: look for darkvision modifiers
  const modifiers = []
    .concat(d.modifiers?.race ?? [])
    .concat(d.modifiers?.class ?? [])
    .concat(d.modifiers?.background ?? [])
    .concat(d.modifiers?.item ?? [])
    .concat(d.modifiers?.feat ?? []);
  for (const m of modifiers) {
    if (m.type !== 'set-base' && m.type !== 'set') continue;
    const sub = m.subType?.toLowerCase();
    if (sub === 'darkvision') out.senses.darkvision = Math.max(out.senses.darkvision, m.value ?? 60);
    if (sub === 'blindsight') out.senses.blindsight = Math.max(out.senses.blindsight, m.value ?? 0);
    if (sub === 'truesight') out.senses.truesight = Math.max(out.senses.truesight, m.value ?? 0);
    if (sub === 'tremorsense') out.senses.tremorsense = Math.max(out.senses.tremorsense, m.value ?? 0);
  }

  // AC is annoying to compute from raw DDB data (depends on armor + dex etc).
  // For v1 we just leave it null and let the DM type it in.
  return out;
}
