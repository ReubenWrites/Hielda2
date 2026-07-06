// Dice expression parser & roller.
// Supports: NdM, NdM+K, NdM-K, multiple terms (1d20+1d4+3), advantage/disadvantage (2d20kh1 / 2d20kl1).
// Returns { total, terms: [{ kind, expr, rolls?, kept?, value }] }.

const TERM_RE = /([+-]?)\s*(?:(\d+)d(\d+)(?:k([hl])(\d+))?|(\d+))/gi;

export function parseDice(expr) {
  if (typeof expr !== 'string') throw new Error('dice expression must be a string');
  const cleaned = expr.replace(/\s+/g, '');
  if (!cleaned) throw new Error('empty dice expression');
  const terms = [];
  let m;
  let consumed = 0;
  TERM_RE.lastIndex = 0;
  while ((m = TERM_RE.exec(cleaned))) {
    if (m.index !== consumed) throw new Error(`unexpected token at position ${consumed} in "${expr}"`);
    consumed = m.index + m[0].length;
    const sign = m[1] === '-' ? -1 : 1;
    if (m[6]) {
      terms.push({ kind: 'const', sign, value: parseInt(m[6], 10) });
    } else {
      const n = parseInt(m[2], 10);
      const d = parseInt(m[3], 10);
      if (n <= 0 || n > 100) throw new Error(`die count out of range: ${n}`);
      if (d <= 1 || d > 1000) throw new Error(`die size out of range: ${d}`);
      const keepMode = m[4] ? m[4].toLowerCase() : null;
      const keepCount = m[5] ? parseInt(m[5], 10) : null;
      if (keepMode && (keepCount <= 0 || keepCount > n)) {
        throw new Error(`keep count must be 1..${n}`);
      }
      terms.push({ kind: 'dice', sign, n, d, keepMode, keepCount });
    }
  }
  if (consumed !== cleaned.length) throw new Error(`could not parse "${expr}"`);
  if (terms.length === 0) throw new Error(`no terms in "${expr}"`);
  return terms;
}

export function rollDice(expr, rng = Math.random) {
  const terms = parseDice(expr);
  const evaluated = [];
  let total = 0;
  for (const t of terms) {
    if (t.kind === 'const') {
      const v = t.sign * t.value;
      total += v;
      evaluated.push({ kind: 'const', expr: String(t.value), value: v });
      continue;
    }
    const rolls = [];
    for (let i = 0; i < t.n; i++) rolls.push(1 + Math.floor(rng() * t.d));
    let kept = rolls.slice();
    if (t.keepMode) {
      const sorted = rolls.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
      const picked = t.keepMode === 'h' ? sorted.slice(-t.keepCount) : sorted.slice(0, t.keepCount);
      kept = picked.map(([v]) => v);
    }
    const subtotal = kept.reduce((s, v) => s + v, 0) * t.sign;
    total += subtotal;
    evaluated.push({
      kind: 'dice',
      expr: `${t.n}d${t.d}${t.keepMode ? `k${t.keepMode}${t.keepCount}` : ''}`,
      sign: t.sign,
      rolls,
      kept,
      value: subtotal,
    });
  }
  return { expr, total, terms: evaluated };
}

export function formatRoll(result) {
  const parts = result.terms.map((t, i) => {
    const sign = t.sign === -1 ? '-' : (i === 0 ? '' : '+');
    if (t.kind === 'const') return `${sign}${t.expr}`;
    const rollsStr = t.kept.length !== t.rolls.length
      ? `[${t.rolls.map(r => t.kept.includes(r) ? r : `~~${r}~~`).join(',')}]`
      : `[${t.rolls.join(',')}]`;
    return `${sign}${t.expr}${rollsStr}`;
  });
  return `${parts.join('')} = ${result.total}`;
}
