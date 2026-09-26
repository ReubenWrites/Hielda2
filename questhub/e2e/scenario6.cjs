// Scenario 6: DM interrupts — hold freezes the player, clicking a point on a
// drawn route moves the player exactly that far, Space advances the turn.
const { chromium } = require('playwright');
const { io } = require('socket.io-client');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 4330;
const BASE = `http://localhost:${PORT}`;
const OUT = process.env.PLAY_OUT || path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok }); console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`); };
const ack = (s, ev, p) => new Promise(res => s.emit(ev, p, res));
const once = (s, ev) => new Promise(res => s.once(ev, res));

(async () => {
  const browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  const { id: roomId, dmSecret } = await (await fetch(`${BASE}/api/rooms`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Interrupts' }) })).json();
  const gm = io(BASE, { transports: ['websocket'] });
  await new Promise(r => gm.on('connect', r));
  await ack(gm, 'room:join', { roomId, name: 'GM', asDm: true, dmSecret });
  const serenTok = (await ack(gm, 'token:create', { name: 'Seren', owner: 'Seren', x: 15, y: 10, color: '#f0c040', hp: 12, maxHp: 12 })).token;
  const wolf = (await ack(gm, 'token:create', { name: 'Wolf', emoji: '🐺', x: 20, y: 14, hp: 11, maxHp: 11 })).token;

  // DM browser joins as DM (secret in sessionStorage the way the app does it)
  const dmCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const dm = await dmCtx.newPage();
  dm.on('pageerror', e => console.log(`[dm pageerror] ${e.message}`));
  await dm.goto(BASE, { waitUntil: 'domcontentloaded' });
  await dm.evaluate(({ roomId, dmSecret }) => { sessionStorage.setItem(`questhub:dm:${roomId}`, dmSecret); sessionStorage.setItem('questhub:name', 'Reuben'); }, { roomId, dmSecret });
  await dm.goto(`${BASE}/r/${roomId}?dm=1`, { waitUntil: 'domcontentloaded' });
  await dm.waitForTimeout(1800);

  const sCtx = await browser.newContext({ viewport: { width: 1200, height: 700 } });
  const seren = await sCtx.newPage();
  seren.on('pageerror', e => console.log(`[seren pageerror] ${e.message}`));
  await seren.goto(BASE, { waitUntil: 'domcontentloaded' });
  await seren.click('.tabs button:has-text("Join")');
  await seren.fill('input[placeholder="Adventurer"]', 'Seren');
  await seren.fill('input[placeholder="ABC123"]', roomId);
  await seren.click('button:has-text("Join quest")');
  await seren.waitForTimeout(1800);

  // ---- Hold (H) freezes Seren
  await dm.keyboard.press('h');
  await seren.waitForTimeout(500);
  check('H puts the "Hold on…" overlay on Seren\'s screen', (await seren.locator('text=Hold on…').count()) > 0);
  check('DM button flips to Resume', (await dm.locator('button:has-text("Resume (H)")').count()) > 0);
  await seren.screenshot({ path: `${OUT}/s6-1-seren-hold.png` });
  await dm.keyboard.press('h');
  await seren.waitForTimeout(400);
  check('H again lifts the hold', (await seren.locator('text=Hold on…').count()) === 0);

  // ---- Seren draws a 4-square route; the DM clicks its 2nd square to stop him there
  const sst = await seren.locator('.stage').boundingBox();
  const scx = sst.x + sst.width / 2, scy = sst.y + sst.height / 2;
  await seren.mouse.move(scx, scy); await seren.mouse.down();
  await seren.mouse.move(scx + 4 * 64, scy, { steps: 10 }); await seren.mouse.up();
  await seren.waitForTimeout(500);
  await dm.waitForTimeout(300);
  check('DM sees the proposal banner (20 ft)', /20 ft/.test(await dm.locator('.proposal-banner').textContent().catch(() => '')));
  await dm.screenshot({ path: `${OUT}/s6-2-dm-ghost-route.png` });
  // DM's camera is centred on Seren (15,10); route squares are (16..19,10); click (17,10) = +2 squares
  const dst = await dm.locator('.stage').boundingBox();
  await dm.mouse.click(dst.x + dst.width / 2 + 2 * 64, dst.y + dst.height / 2);
  await seren.waitForTimeout(900);
  const probe = io(BASE, { transports: ['websocket'] });
  await new Promise(r => probe.on('connect', r));
  let st = (await ack(probe, 'room:join', { roomId, name: 'Probe' })).state;
  let sNow = st.tokens.find(t => t.id === serenTok.id);
  check('Clicking the 2nd square of the route stops Seren exactly there (17,10)', sNow.x === 17 && sNow.y === 10, `at ${sNow.x},${sNow.y}`);
  check('DM got a toast about the partial move', /Moved them 2 squares/.test(await dm.locator('.hint').last().textContent()));

  // ---- Hold mid-walk: approve a long route, press H while he walks → frozen mid-route
  await seren.mouse.move(scx + 2 * 64, scy); await seren.mouse.down();
  await seren.mouse.move(scx + 2 * 64, scy + 5 * 64, { steps: 10 }); await seren.mouse.up(); // 5 squares down
  await seren.waitForTimeout(400);
  await dm.click('.proposal-banner button:has-text("Approve")');
  await dm.waitForTimeout(500); // ~2 squares into a 5-square walk (220 ms/square)
  await dm.keyboard.press('h');
  await dm.waitForTimeout(600);
  st = (await ack(probe, 'room:join', { roomId, name: 'Probe2' })).state;
  sNow = st.tokens.find(t => t.id === serenTok.id);
  check('Hold during the walk freezes Seren partway (y between 11 and 14)', sNow.x === 17 && sNow.y >= 11 && sNow.y <= 14, `at ${sNow.x},${sNow.y}`);
  await dm.keyboard.press('h');

  // ---- Space advances the turn during combat
  let init = (await ack(gm, 'init:roll', { tokenIds: [serenTok.id, wolf.id] })).initiative;
  const first = init.order[0].name;
  await dm.waitForTimeout(400);
  await dm.keyboard.press('Space');
  await dm.waitForTimeout(400);
  init = (await ack(gm, 'room:join', { roomId, name: 'GM', asDm: true, dmSecret })).initiative;
  check('Space moves to the next creature', init.turn === 1 && init.order[1].name !== first, `now ${init.order[init.turn].name}'s turn`);
  await dm.screenshot({ path: `${OUT}/s6-3-dm-combat-bar.png` });

  probe.close(); gm.close();
  console.log(`\n${results.filter(r => r.ok).length}/${results.length} checks passed`);
  await browser.close();
  process.exit(results.every(r => r.ok) ? 0 : 1);
})();
