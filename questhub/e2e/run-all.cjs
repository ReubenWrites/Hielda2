// Run every e2e scenario in sequence and summarise. Needs the built app
// served on PORT (default 4330) — see e2e/README.md.
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const scenarios = fs.readdirSync(__dirname)
  .filter(f => /^(playthrough|scenario\d+)\.cjs$/.test(f))
  .sort((a, b) => (a.startsWith('playthrough') ? -1 : a.localeCompare(b, undefined, { numeric: true })));

const summary = [];
for (const file of scenarios) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(__dirname, file)], { encoding: 'utf8', env: process.env });
  const out = (r.stdout || '') + (r.stderr || '');
  const passed = (out.match(/(\d+)\/(\d+) checks passed/) || [])[0] || 'no summary';
  const failed = out.split('\n').filter(l => l.startsWith('❌'));
  summary.push({ file, ok: r.status === 0, passed, failed, ms: Date.now() - t0 });
  console.log(`${r.status === 0 ? '✅' : '❌'} ${file.padEnd(18)} ${passed.padEnd(22)} ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  for (const f of failed) console.log(`     ${f}`);
  if (r.status !== 0 && failed.length === 0) console.log(out.split('\n').slice(-12).join('\n'));
}
const bad = summary.filter(s => !s.ok);
console.log(`\n${summary.length - bad.length}/${summary.length} scenarios passed`);
process.exit(bad.length ? 1 : 0);
