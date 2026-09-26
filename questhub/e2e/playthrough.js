// Full two-player playthrough from Seren's chair (child POV) and the DM's.
// Setup geometry uses a DM socket for precision; every *experience* is
// exercised through the real UI in two headless Chrome windows.
const { chromium } = require('playwright');
const { io } = require('socket.io-client');

const PORT = 4330;
const BASE = `http://localhost:${PORT}`;
const OUT = process.env.PLAY_OUT || require('path').join(__dirname, 'out');
require('fs').mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const ack = (s, ev, p) => new Promise(res => s.emit(ev, p, res));

(async () => {
  const browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  const errors = [];
  const track = (page, tag) => {
    page.on('pageerror', e => errors.push(`[${tag}] ${e.message}`));
    page.on('console', m => { if (m.type() === 'error' && !/font|ERR_CONNECTION/.test(m.text())) errors.push(`[${tag} console] ${m.text()}`); });
  };

  // ---- DM creates the quest in a real browser
  const dmCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const dm = await dmCtx.newPage(); track(dm, 'dm');
  dm.on('dialog', d => d.accept(d.message().includes('Scene name') ? 'Village of Barovia' : 'ok'));
  await dm.goto(BASE, { waitUntil: 'domcontentloaded' });
  await dm.fill('input[placeholder="Dungeon Master"]', 'Reuben');
  await dm.fill('input[placeholder="The Lost Mines"]', 'Playtest');
  await dm.click('button:has-text("Start quest")');
  await dm.waitForURL(/\/r\//, { timeout: 10000 });
  await dm.waitForTimeout(1500);
  const roomId = dm.url().split('/r/')[1].split('?')[0];
  const dmSecret = await dm.evaluate((id) => sessionStorage.getItem(`questhub:dm:${id}`), roomId);

  // Precise geometry via a DM socket: a wall down x=8 with a door at y 5..6,
  // Seren beside the door on the left, a wolf lurking on the right.
  const gm = io(BASE, { transports: ['websocket'] });
  await new Promise(r => gm.on('connect', r));
  await ack(gm, 'room:join', { roomId, name: 'GM-helper', asDm: true, dmSecret });
  await ack(gm, 'wall:create', { x1: 8, y1: 0, x2: 8, y2: 5 });
  const door = (await ack(gm, 'wall:create', { x1: 8, y1: 5, x2: 8, y2: 6, isDoor: true })).wall;
  await ack(gm, 'wall:create', { x1: 8, y1: 6, x2: 8, y2: 20 });
  const serenTok = (await ack(gm, 'token:create', { name: 'Seren', owner: 'Seren', x: 7, y: 5, color: '#f0c040', hp: 12, maxHp: 12, sightRadius: 6 })).token;
  const wolf = (await ack(gm, 'token:create', { name: 'Wolf', emoji: '🐺', x: 12, y: 5, hp: 11, maxHp: 11, color: '#6b7b8c' })).token;

  // ---- Seren joins in his own browser
  const sCtx = await browser.newContext({ viewport: { width: 1200, height: 700 } });
  const seren = await sCtx.newPage(); track(seren, 'seren');
  await seren.goto(BASE, { waitUntil: 'domcontentloaded' });
  await seren.click('.tabs button:has-text("Join")');
  await seren.fill('input[placeholder="Adventurer"]', 'Seren');
  await seren.fill('input[placeholder="ABC123"]', roomId);
  await seren.click('button:has-text("Join quest")');
  await seren.waitForTimeout(2000);

  // Seren's sidebar must not list the wolf (it's behind a closed door)
  await seren.click('.tabs button:has-text("Tokens")');
  let names = await seren.locator('.token-row .name').allTextContents();
  check('Seren cannot see the wolf behind the door (token list)', !names.some(n => n.includes('Wolf')), JSON.stringify(names));
  await seren.screenshot({ path: `${OUT}/1-seren-door-closed.png` });

  // Seren opens the door by clicking it (he is beside it). His map centres on
  // his token at scale 1, so the door's midpoint is 0.5 cells right of him.
  const stage = await seren.locator('.stage').boundingBox();
  const cx = stage.x + stage.width / 2, cy = stage.y + stage.height / 2;
  await seren.mouse.click(cx + 0.5 * 64, cy);
  await seren.waitForTimeout(900);
  names = await seren.locator('.token-row .name').allTextContents();
  check('Seren opened the door himself and now sees the wolf', names.some(n => n.includes('Wolf')), JSON.stringify(names));
  await seren.screenshot({ path: `${OUT}/2-seren-door-open.png` });
  const chatAfterDoor = await (async () => { await seren.click('.tabs button:has-text("Chat")'); return seren.locator('.chat-msgs').textContent(); })();
  check('Door opening is announced in chat', /Seren opens a door/.test(chatAfterDoor));

  // Fog memory: the DM moves Seren to (3,10) — out of sight of his old spot
  // (7,5) but with it still on screen — and closes the door. The wolf room
  // should stay dimly remembered, wolf hidden.
  await ack(gm, 'door:toggle', { id: door.id }); // DM closes the door again
  await ack(gm, 'token:move', { id: serenTok.id, x: 3, y: 10 });
  await seren.waitForTimeout(900);
  await seren.click('.tabs button:has-text("Tokens")');
  names = await seren.locator('.token-row .name').allTextContents();
  check('After leaving, wolf is hidden again (memory shows room, not creatures)', !names.some(n => n.includes('Wolf')), JSON.stringify(names));
  await seren.screenshot({ path: `${OUT}/3-seren-remembered-room.png` });
  // Three fog levels, sampled from the canvas. Seren's camera is centred on
  // his token at scale 1 (64px squares): visible (3,9) just above him,
  // remembered (7,5) where he stood, never-seen (9,13) behind the wall.
  {
    const sharp = require('sharp');
    const st = await seren.locator('.stage').boundingBox();
    const ccx = st.x + st.width / 2, ccy = st.y + st.height / 2;
    const cellPx = (x, y) => ({ x: Math.round(ccx + (x - 3) * 64), y: Math.round(ccy + (y - 10) * 64) });
    const shot = await seren.screenshot();
    const { data, info } = await sharp(shot).raw().toBuffer({ resolveWithObject: true });
    const lum = ({ x, y }) => { const i = (y * info.width + x) * info.channels; return (data[i] + data[i + 1] + data[i + 2]) / 3; };
    const vis = lum(cellPx(3, 9)), mem = lum(cellPx(7, 5)), unseen = lum(cellPx(9, 13));
    check('Fog has three levels: visible > remembered > never seen',
      vis > mem + 4 && mem > unseen + 3 && unseen < 8, `visible=${vis.toFixed(1)} remembered=${mem.toFixed(1)} unseen=${unseen.toFixed(1)}`);
  }

  // Dramatic entrance: DM places a Zombie from the bestiary two squares from
  // Seren. The DM's camera is centred on the first token (Seren was at 7,5
  // when the DM's map opened), so (5,8) is (-2,+3) squares from centre.
  await dm.click('.tabs button:has-text("DM")');
  await dm.fill('input[placeholder="Search monsters…"]', 'zombie');
  await dm.click('button:has-text("🧟 Zombie")');
  const dstage = await dm.locator('.stage').boundingBox();
  await dm.mouse.click(dstage.x + dstage.width / 2 - 2 * 64, dstage.y + dstage.height / 2 + 3 * 64);
  await seren.waitForTimeout(300);
  await seren.screenshot({ path: `${OUT}/4-seren-zombie-appears.png` });
  await dm.keyboard.press('Escape');
  await seren.waitForTimeout(600);
  await seren.click('.tabs button:has-text("Chat")');
  const chatZ = await seren.locator('.chat-msgs').textContent();
  check('"Zombie appears!" announced to Seren', /Zombie appears/.test(chatZ));

  // Kid-friendly dice: Seren clicks d20 with Advantage.
  await seren.click('button:has-text("Advantage")');
  await seren.click('button:has-text("d20")');
  await seren.waitForTimeout(500);
  const chatD = await seren.locator('.chat-msgs').textContent();
  check('One-tap d20 with advantage rolls (2d20kh1)', /Seren:\s*d20 advantage: 2d20kh1/.test(chatD), chatD.slice(-80));

  // Damage: DM hits Seren for 5 → floating "-5" on Seren's map + HP bar update
  await dm.click('.tabs button:has-text("Tokens")');
  await dm.click('.token-row:has-text("Seren")');
  await dm.click('button:has-text("−5")');
  await seren.waitForTimeout(350);
  await seren.screenshot({ path: `${OUT}/5-seren-takes-damage.png` });
  await seren.click('.tabs button:has-text("Tokens")');
  const metaS = await seren.locator('.token-row:has-text("Seren") .meta').textContent();
  check('Seren sees his HP drop to 7/12', /7\/12/.test(metaS), metaS);

  // Scenes: DM makes a new scene (prompt answered "Village of Barovia"); Seren stays put.
  await dm.click('.tabs button:has-text("DM")');
  await dm.click('button:has-text("New blank scene")');
  await dm.waitForTimeout(800);
  const dmHead = await dm.locator('.side .head').textContent();
  check('DM is now on "Village of Barovia"', /Village of Barovia/.test(dmHead), dmHead);
  const serenHead = await seren.locator('.side .head').textContent();
  check('Seren stayed on Scene 1 while the DM moved on', /Scene 1/.test(serenHead), serenHead);
  // Players panel tells the DM where Seren is
  const players = await dm.locator('.tool-section:has-text("Players")').first().textContent();
  check('DM sees "Seren · in Scene 1"', /in Scene 1/.test(players), players);

  // Teleport Seren's token to the new scene from the DM's token editor
  // (must be done from the scene the token is on — switch back first).
  await dm.locator('.tool-section:has-text("Scenes") button:has-text("Go")').first().click();
  await dm.waitForTimeout(600);
  await dm.click('.tabs button:has-text("Tokens")');
  await dm.click('.token-row:has-text("Seren")');
  const sceneSelect = dm.locator('select:has(option:has-text("Village of Barovia"))').last();
  await sceneSelect.selectOption({ label: 'Village of Barovia' });
  await seren.waitForTimeout(900);
  const serenHead2 = await seren.locator('.side .head').textContent();
  check('Seren followed his character to "Village of Barovia"', /Village of Barovia/.test(serenHead2), serenHead2);
  await seren.screenshot({ path: `${OUT}/6-seren-new-scene.png` });

  // Cast: DM writes an NPC sheet with an accent note and places him.
  await dm.click('.tabs button:has-text("DM")');
  await dm.locator('.tool-section:has-text("Scenes") button:has-text("Go")').first().click(); // DM to Village
  await dm.waitForTimeout(600);
  const dmHead2 = await dm.locator('.side .head').textContent();
  check('DM hopped back to the Village with one click', /Village of Barovia/.test(dmHead2), dmHead2);
  await dm.click('.tabs button:has-text("Cast")');
  await dm.fill('input[placeholder="Ismark Kolyanovich"]', 'Ismark');
  await dm.fill('input[placeholder="🧔"]', '🧔');
  await dm.fill('textarea', 'Gruff Eastern-European accent. Wants Ireena escorted to safety.');
  await dm.click('button:has-text("Add to cast")');
  await dm.waitForTimeout(500);
  await dm.click('button:has-text("📍 Place")');
  const dstage2 = await dm.locator('.stage').boundingBox();
  await dm.mouse.click(dstage2.x + dstage2.width / 2 + 64, dstage2.y + dstage2.height / 2);
  await dm.waitForTimeout(600);
  await dm.click('.tabs button:has-text("Tokens")');
  await dm.click('.token-row:has-text("Ismark")');
  const sheet = await dm.locator('textarea').first().inputValue();
  check('Placed NPC token shows its sheet notes (accent) in the token editor', /Eastern-European accent/.test(sheet), sheet.slice(0, 40));
  await dm.screenshot({ path: `${OUT}/7-dm-npc-sheet.png` });
  // Seren, on the same scene now, sees Ismark but never the notes
  await seren.click('.tabs button:has-text("Tokens")');
  const serenTokens = await seren.locator('.token-row .name').allTextContents();
  check('Seren sees Ismark on the village map', serenTokens.some(n => n.includes('Ismark')), JSON.stringify(serenTokens));
  const serenHasNotes = await seren.locator('textarea').count();
  check('Seren has no notes fields (DM-only)', serenHasNotes === 0);

  gm.close();
  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  console.log(`\n${results.filter(r => r.ok).length}/${results.length} checks passed`);
  await browser.close();
  process.exit(results.every(r => r.ok) && errors.length === 0 ? 0 : 1);
})();
