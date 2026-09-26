// Scenario 2: two players on one map, move approval, spells, handouts, tablet.
const { chromium } = require('playwright');
const { io } = require('socket.io-client');
const fs = require('fs');

const PORT = process.env.PORT || 4330;
const BASE = `http://localhost:${PORT}`;
const OUT = process.env.PLAY_OUT || require('path').join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok }); console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`); };
const ack = (s, ev, p) => new Promise(res => s.emit(ev, p, res));
const once = (s, ev) => new Promise(res => s.once(ev, res));
const TINY_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

async function joinAs(browser, name, roomId, viewport = { width: 1200, height: 700 }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log(`[${name} pageerror] ${e.message}`));
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.click('.tabs button:has-text("Join")');
  await page.fill('input[placeholder="Adventurer"]', name);
  await page.fill('input[placeholder="ABC123"]', roomId);
  await page.click('button:has-text("Join quest")');
  await page.waitForTimeout(1800);
  return page;
}
const tokenNames = async (page) => {
  await page.click('.tabs button:has-text("Tokens")');
  await page.waitForTimeout(200);
  return page.locator('.token-row .name').allTextContents();
};

(async () => {
  const browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });

  // DM in a real browser
  const dmCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const dm = await dmCtx.newPage();
  dm.on('pageerror', e => console.log(`[dm pageerror] ${e.message}`));
  await dm.goto(BASE, { waitUntil: 'domcontentloaded' });
  await dm.fill('input[placeholder="Dungeon Master"]', 'Reuben');
  await dm.fill('input[placeholder="The Lost Mines"]', 'Split Party');
  await dm.click('button:has-text("Start quest")');
  await dm.waitForURL(/\/r\//, { timeout: 10000 });
  await dm.waitForTimeout(1500);
  const roomId = dm.url().split('/r/')[1].split('?')[0];
  const dmSecret = await dm.evaluate((id) => sessionStorage.getItem(`questhub:dm:${id}`), roomId);

  // Geometry: wall x=8 with a door (8,5)-(8,6). Seren left, Mira + wolf right.
  const gm = io(BASE, { transports: ['websocket'] });
  await new Promise(r => gm.on('connect', r));
  await ack(gm, 'room:join', { roomId, name: 'GM-helper', asDm: true, dmSecret });
  await ack(gm, 'wall:create', { x1: 8, y1: 0, x2: 8, y2: 5 });
  const door = (await ack(gm, 'wall:create', { x1: 8, y1: 5, x2: 8, y2: 6, isDoor: true })).wall;
  await ack(gm, 'wall:create', { x1: 8, y1: 6, x2: 8, y2: 20 });
  const serenTok = (await ack(gm, 'token:create', { name: 'Seren', owner: 'Seren', x: 3, y: 5, color: '#f0c040', hp: 12, maxHp: 12 })).token;
  await ack(gm, 'token:create', { name: 'Mira', owner: 'Mira', x: 12, y: 5, color: '#c47fb5', hp: 10, maxHp: 10 });
  const wolf = (await ack(gm, 'token:create', { name: 'Wolf', emoji: '🐺', x: 12, y: 8, hp: 11, maxHp: 11 })).token;

  const seren = await joinAs(browser, 'Seren', roomId);
  const mira = await joinAs(browser, 'Mira', roomId);

  // --- Split party: each sees only their side
  const s1 = await tokenNames(seren), m1 = await tokenNames(mira);
  check('Seren sees neither Mira nor the wolf through the wall', !s1.includes('Mira') && !s1.includes('Wolf'), JSON.stringify(s1));
  check('Mira sees the wolf beside her but not Seren', m1.includes('Wolf') && !m1.includes('Seren'), JSON.stringify(m1));
  await seren.screenshot({ path: `${OUT}/s2-1-seren-split.png` });
  await mira.screenshot({ path: `${OUT}/s2-2-mira-split.png` });

  // --- Seren proposes a 4-square move to the door by dragging; DM approves
  const st = await seren.locator('.stage').boundingBox();
  const cx = st.x + st.width / 2, cy = st.y + st.height / 2;
  await seren.mouse.move(cx, cy);
  await seren.mouse.down();
  await seren.mouse.move(cx + 4 * 64, cy, { steps: 12 });
  await seren.screenshot({ path: `${OUT}/s2-3-seren-dragging.png` });
  await seren.mouse.up();
  await seren.waitForTimeout(600);
  const serenStatus = await seren.locator('.hint').last().textContent();
  check('Seren gets "waiting for DM" feedback after proposing', /waiting for DM/i.test(serenStatus), serenStatus);
  const banner = await dm.locator('.proposal-banner').textContent();
  check('DM sees the proposal banner with distance', /Seren wants to move Seren 20 ft/.test(banner), banner);
  await dm.click('.proposal-banner button:has-text("Approve")');
  await seren.waitForTimeout(1600); // 4 cells × 220ms animation
  const probe = io(BASE, { transports: ['websocket'] });
  await new Promise(r => probe.on('connect', r));
  const pj = await ack(probe, 'room:join', { roomId, name: 'Probe' });
  const serenNow = pj.state.tokens.find(t => t.name === 'Seren');
  check('Approved move landed Seren beside the door (7,5)', serenNow.x === 7 && serenNow.y === 5, `at ${serenNow.x},${serenNow.y}`);

  // --- Seren opens the door → both players now see each other.
  // His camera was centred on his token's CENTRE (3.5,5.5) and hasn't needed
  // to follow (token still on screen), so the door line x=8 is +4.5 squares.
  await seren.mouse.click(cx + 4.5 * 64, cy);
  await seren.waitForTimeout(900);
  const doorStatus = await seren.locator('.hint').last().textContent();
  const s2 = await tokenNames(seren), m2 = await tokenNames(mira);
  check('Through the open door Seren sees Mira', s2.includes('Mira'), `${JSON.stringify(s2)} status="${doorStatus}"`);
  check('…and Mira sees Seren', m2.includes('Seren'), JSON.stringify(m2));
  await seren.screenshot({ path: `${OUT}/s2-4-seren-door-open.png` });

  // --- Seren casts fireball through the doorway from the spell bar; Mira's client gets the effect
  const fxOnProbe = once(probe, 'spell:effect');
  await seren.click('.spell-btn[title^="Fireball"]');
  await seren.mouse.click(cx + 5.5 * 64, cy); // target (9,5), just inside the far room
  await seren.waitForTimeout(150);
  await seren.screenshot({ path: `${OUT}/s2-5-seren-fireball.png` });
  const fx = await Promise.race([fxOnProbe, new Promise(r => setTimeout(() => r(null), 2000))]);
  check('Fireball effect reaches everyone on the map', fx && fx.kind === 'fireball' && fx.by === 'Seren', fx ? `${fx.kind} by ${fx.by}` : 'no effect received');

  // --- Handout from Seren's POV
  const form = new FormData();
  form.append('image', new Blob([TINY_PNG], { type: 'image/png' }), 'gates.png');
  const up = await (await fetch(`${BASE}/api/upload`, { method: 'POST', body: form })).json();
  await ack(gm, 'handout:show', { url: up.url, title: 'The Gates of Barovia' });
  await seren.waitForTimeout(500);
  const overlay = await seren.locator('text=The Gates of Barovia').count();
  check('Handout splashes on Seren\'s screen with its title', overlay > 0);
  await seren.screenshot({ path: `${OUT}/s2-6-seren-handout.png` });
  await seren.click('text=Click to dismiss');
  await seren.waitForTimeout(300);
  check('Seren can dismiss the handout', (await seren.locator('text=The Gates of Barovia').count()) === 0);

  // --- Tablet portrait layout for a player: the map must keep most of the
  // width and Seren's character must stay on screen after the resize.
  await seren.setViewportSize({ width: 768, height: 1024 });
  await seren.waitForTimeout(800);
  await seren.screenshot({ path: `${OUT}/s2-7-seren-tablet.png` });
  const stageT = await seren.locator('.stage').boundingBox();
  const sideT = await seren.locator('.side').boundingBox();
  check('Tablet portrait: map still gets most of the width', stageT.width >= 380 && sideT.width <= 330, `stage ${Math.round(stageT.width)}px side ${Math.round(sideT.width)}px`);
  const overflow = await seren.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check('Tablet portrait: no horizontal page overflow', !overflow);
  {
    // Seren's token (gold #f0c040) must be somewhere in the stage after the resize.
    const sharp = require('sharp');
    const shot = await seren.screenshot({ clip: { x: stageT.x, y: stageT.y, width: stageT.width, height: stageT.height } });
    const { data, info } = await sharp(shot).raw().toBuffer({ resolveWithObject: true });
    let gold = 0;
    for (let i = 0; i < data.length; i += info.channels) {
      if (data[i] > 200 && data[i + 1] > 160 && data[i + 1] < 210 && data[i + 2] < 110) gold++;
    }
    check('Tablet portrait: Seren\'s character is still on screen', gold > 200, `${gold} gold pixels`);
  }

  gm.close(); probe.close();
  console.log(`\n${results.filter(r => r.ok).length}/${results.length} checks passed`);
  await browser.close();
  process.exit(results.every(r => r.ok) ? 0 : 1);
})();
