// Scenario 4: one-click player setup creates a sheet; a real-size gridded map
// goes through Library → ＋ Scene → auto-detect → play with fog.
const { chromium } = require('playwright');
const { io } = require('socket.io-client');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const PORT = process.env.PORT || 4330;
const BASE = `http://localhost:${PORT}`;
const OUT = process.env.PLAY_OUT || path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok }); console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`); };
const ack = (s, ev, p) => new Promise(res => s.emit(ev, p, res));

async function makeBigMap(file) {
  // 2400x3300 parchment with a 75px grid offset (20,20), like a scanned battle map.
  const W = 2400, H = 3300, P = 75, O = 20;
  const buf = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 3;
    const tex = ((x * 7 + y * 13) % 17) - 8; // faint texture
    let r = 214 + tex, g = 196 + tex, b = 160 + tex;
    if (((x - O) % P === 0 && x >= O) || ((y - O) % P === 0 && y >= O)) { r = 110; g = 95; b = 70; }
    buf[i] = r; buf[i + 1] = g; buf[i + 2] = b;
  }
  await sharp(buf, { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality: 85 }).toFile(file);
}

(async () => {
  const mapFile = path.join(OUT, 'bigmap.jpg');
  if (!fs.existsSync(mapFile)) await makeBigMap(mapFile);
  const browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });

  const dmCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const dm = await dmCtx.newPage();
  dm.on('pageerror', e => console.log(`[dm pageerror] ${e.message}`));
  dm.on('dialog', d => d.accept('Seren'));
  await dm.goto(BASE, { waitUntil: 'domcontentloaded' });
  await dm.fill('input[placeholder="Dungeon Master"]', 'Reuben');
  await dm.fill('input[placeholder="The Lost Mines"]', 'Big Map');
  await dm.click('button:has-text("Start quest")');
  await dm.waitForURL(/\/r\//, { timeout: 10000 });
  await dm.waitForTimeout(1500);
  const roomId = dm.url().split('/r/')[1].split('?')[0];
  const dmSecret = await dm.evaluate((id) => sessionStorage.getItem(`questhub:dm:${id}`), roomId);

  // ---- Library upload of the big map, then ＋ Scene from it
  await dm.click('.tabs button:has-text("Library")');
  const t0 = Date.now();
  await dm.locator('input[type="file"][multiple]').first().setInputFiles(mapFile); // Maps section is first
  await dm.waitForFunction(() => document.body.innerText.includes('Uploaded 1 map'), null, { timeout: 60000 });
  const uploadMs = Date.now() - t0;
  check('Big map uploads through the Library', true, `${uploadMs} ms`);
  await dm.click('button:has-text("＋ Scene")');
  await dm.waitForFunction(() => /Grid detected|No grid detected/.test(document.body.innerText), null, { timeout: 60000 });
  const detectMsg = await dm.locator('.hint').last().textContent();
  check('Auto-detect found the printed grid (75px)', /Grid detected: 7[4-6]px/.test(detectMsg), detectMsg);
  await dm.click('.tabs button:has-text("DM")');
  const sqPx = await dm.locator('.field:has(label:has-text("Square px")) input').inputValue();
  const wide = await dm.locator('.field:has(label:has-text("Squares wide")) input').inputValue();
  check('Scene got the detected grid (≈32 squares wide)', Math.abs(parseInt(sqPx, 10) - 75) <= 1 && Math.abs(parseInt(wide, 10) - 32) <= 1, `${sqPx}px × ${wide} wide`);

  // ---- One-click player setup from the DM tab creates a PC sheet + token
  await dm.click('button:has-text("Add player token")'); // prompt answers "Seren"
  await dm.waitForTimeout(500);
  const dst = await dm.locator('.stage').boundingBox();
  await dm.mouse.click(dst.x + dst.width / 2, dst.y + dst.height / 2);
  await dm.waitForTimeout(800);
  await dm.click('.tabs button:has-text("Cast")');
  const cast = await dm.locator('.tool-section:has-text("Player characters")').textContent().catch(() => '');
  check('⭐ Add player token also created Seren\'s PC sheet in the Cast', /Seren/.test(cast), cast.slice(0, 60));
  await dm.click('.tabs button:has-text("Tokens")');
  await dm.click('.token-row:has-text("Seren")');
  const hasSheet = await dm.locator('label:has-text("Sheet notes")').count();
  check('Seren\'s token is linked to that sheet (notes editable from the token)', hasSheet > 0);

  // ---- Seren plays on the big map: fog renders over a native-size image
  const sCtx = await browser.newContext({ viewport: { width: 1200, height: 700 } });
  const seren = await sCtx.newPage();
  const errs = [];
  seren.on('pageerror', e => errs.push(e.message));
  await seren.goto(BASE, { waitUntil: 'domcontentloaded' });
  await seren.click('.tabs button:has-text("Join")');
  await seren.fill('input[placeholder="Adventurer"]', 'Seren');
  await seren.fill('input[placeholder="ABC123"]', roomId);
  const t1 = Date.now();
  await seren.click('button:has-text("Join quest")');
  await seren.waitForSelector('.stage canvas', { timeout: 20000 });
  await seren.waitForTimeout(2500);
  const joinMs = Date.now() - t1;
  const head = await seren.locator('.side .head').textContent();
  check('Seren lands on the big-map scene', /bigmap/.test(head), `${head} (${joinMs} ms to canvas)`);
  await seren.screenshot({ path: `${OUT}/s4-1-seren-bigmap.png` });
  // Drag a move: interaction must stay responsive on the big map
  const sst = await seren.locator('.stage').boundingBox();
  const cx = sst.x + sst.width / 2, cy = sst.y + sst.height / 2;
  const t2 = Date.now();
  await seren.mouse.move(cx, cy); await seren.mouse.down();
  await seren.mouse.move(cx + 3 * 75, cy, { steps: 8 });
  await seren.mouse.up();
  await seren.waitForTimeout(400);
  const dragMs = Date.now() - t2;
  const status = await seren.locator('.hint').last().textContent();
  check('Dragging on the big map proposes a move promptly', /waiting for DM/.test(status) && dragMs < 3000, `${dragMs} ms`);
  await dm.click('.proposal-banner button:has-text("Approve")').catch(() => {});
  await seren.waitForTimeout(1200);
  await seren.screenshot({ path: `${OUT}/s4-2-seren-bigmap-moved.png` });
  check('No page errors on the big map', errs.length === 0, errs.join(' | '));

  console.log(`\n${results.filter(r => r.ok).length}/${results.length} checks passed`);
  await browser.close();
  process.exit(results.every(r => r.ok) ? 0 : 1);
})();
