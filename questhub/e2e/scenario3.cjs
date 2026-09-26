// Scenario 3: DM view-as with fog memory, save → load into a fresh room,
// and an overland scene mixed with a battle scene (memory survives the trip).
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
const sharp = require('sharp');

async function newDm(browser, questName) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log(`[dm pageerror] ${e.message}`));
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.fill('input[placeholder="Dungeon Master"]', 'Reuben');
  await page.fill('input[placeholder="The Lost Mines"]', questName);
  await page.click('button:has-text("Start quest")');
  await page.waitForURL(/\/r\//, { timeout: 10000 });
  await page.waitForTimeout(1500);
  const roomId = page.url().split('/r/')[1].split('?')[0];
  const dmSecret = await page.evaluate((id) => sessionStorage.getItem(`questhub:dm:${id}`), roomId);
  return { page, roomId, dmSecret };
}
async function joinAs(browser, name, roomId) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 700 } });
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
async function probeState(roomId, name = 'Probe') {
  const s = io(BASE, { transports: ['websocket'] });
  await new Promise(r => s.on('connect', r));
  const j = await ack(s, 'room:join', { roomId, name });
  s.close();
  return j;
}
// Sample average luminance at a stage-relative point.
async function lumAt(page, sx, sy) {
  const st = await page.locator('.stage').boundingBox();
  const shot = await page.screenshot({ clip: { x: st.x + sx - 2, y: st.y + sy - 2, width: 5, height: 5 } });
  const { data, info } = await sharp(shot).raw().toBuffer({ resolveWithObject: true });
  let sum = 0, n = 0;
  for (let i = 0; i < data.length; i += info.channels) { sum += (data[i] + data[i + 1] + data[i + 2]) / 3; n++; }
  return sum / n;
}

(async () => {
  const browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  const { page: dm, roomId, dmSecret } = await newDm(browser, 'Memory Test');

  const gm = io(BASE, { transports: ['websocket'] });
  await new Promise(r => gm.on('connect', r));
  await ack(gm, 'room:join', { roomId, name: 'GM-helper', asDm: true, dmSecret });
  await ack(gm, 'wall:create', { x1: 8, y1: 0, x2: 8, y2: 5 });
  const door = (await ack(gm, 'wall:create', { x1: 8, y1: 5, x2: 8, y2: 6, isDoor: true })).wall;
  await ack(gm, 'wall:create', { x1: 8, y1: 6, x2: 8, y2: 20 });
  const serenTok = (await ack(gm, 'token:create', { name: 'Seren', owner: 'Seren', x: 7, y: 5, color: '#f0c040', hp: 12, maxHp: 12 })).token;
  await ack(gm, 'token:create', { name: 'Wolf', emoji: '🐺', x: 9, y: 7, hp: 11, maxHp: 11 });
  await ack(gm, 'char:create', { name: 'Ireena', kind: 'npc', emoji: '👩', notes: 'Soft-spoken, brave; Strahd wants her.' });

  const seren = await joinAs(browser, 'Seren', roomId);
  // Seren opens the door (he's beside it), sees the wolf room; DM shuts it and moves him away.
  const sst = await seren.locator('.stage').boundingBox();
  await seren.mouse.click(sst.x + sst.width / 2 + 32, sst.y + sst.height / 2);
  await seren.waitForTimeout(700);
  await ack(gm, 'door:toggle', { id: door.id });
  await ack(gm, 'token:move', { id: serenTok.id, x: 3, y: 10 });
  await seren.waitForTimeout(900);

  // ---- DM "view as Seren" must reproduce his three fog levels
  await dm.click('.tabs button:has-text("Tokens")');
  await dm.dblclick('.token-row:has-text("Seren")'); // centre DM map on Seren (3,10)
  await dm.waitForTimeout(300);
  await dm.click('.tabs button:has-text("DM")');
  await dm.click('button:has-text("👁 View")');
  await dm.waitForTimeout(700);
  const dst = await dm.locator('.stage').boundingBox();
  const c = { x: dst.width / 2, y: dst.height / 2 };
  const px = (gx, gy) => ({ x: Math.round(c.x + (gx - 3) * 64), y: Math.round(c.y + (gy - 10) * 64) });
  const vis = await lumAt(dm, px(3, 9).x, px(3, 9).y);
  const mem = await lumAt(dm, px(7, 5).x, px(7, 5).y);
  const unseen = await lumAt(dm, px(9, 13).x, px(9, 13).y);
  check('DM view-as shows visible > remembered > unseen exactly like Seren', vis > mem + 4 && mem > unseen + 3 && unseen < 8, `visible=${vis.toFixed(1)} remembered=${mem.toFixed(1)} unseen=${unseen.toFixed(1)}`);
  const wolfSpot = px(9, 7);
  const wolfLum = await lumAt(dm, wolfSpot.x, wolfSpot.y);
  check('…and the wolf is hidden in the DM preview (its square is dark)', wolfLum < 20, `wolf square luminance=${wolfLum.toFixed(1)}`);
  await dm.screenshot({ path: `${OUT}/s3-1-dm-view-as-memory.png` });
  await dm.click('button:has-text("Back to DM view")');
  await dm.waitForTimeout(500);
  const wolfLumDm = await lumAt(dm, wolfSpot.x, wolfSpot.y);
  check('…but visible again in the real DM view', wolfLumDm > 60, `wolf square luminance=${wolfLumDm.toFixed(1)}`);
  const unseenDm = await lumAt(dm, px(9, 13).x, px(9, 13).y);
  check('Back to DM view lifts the fog', unseenDm > 12, `luminance=${unseenDm.toFixed(1)}`);

  // ---- Mixed scenes: add an overland scene, send Seren there, walk in miles, bring him back
  const over = (await ack(gm, 'scene:create', { name: 'Barovia overland' })).scene;
  await ack(gm, 'scene:switch', { sceneId: over.id }); // helper's own view (not the browser DM)
  await ack(gm, 'map:config', { gridType: 'free', feetPerCell: 1320 });
  const enter1 = once(gm, 'scene:enter');
  await ack(gm, 'token:teleport', { id: serenTok.id, sceneId: over.id, x: 5, y: 5 });
  await seren.waitForTimeout(1000);
  const head = await seren.locator('.side .head').textContent();
  check('Seren arrives on the overland scene', /Barovia overland/.test(head), head);
  const ost = await seren.locator('.stage').boundingBox();
  const ocx = ost.x + ost.width / 2, ocy = ost.y + ost.height / 2;
  await seren.mouse.move(ocx, ocy);
  await seren.mouse.down();
  await seren.mouse.move(ocx + 320, ocy + 180, { steps: 10 });
  await seren.waitForTimeout(150);
  await seren.screenshot({ path: `${OUT}/s3-2-seren-overland-drag.png` });
  await seren.mouse.up();
  await seren.waitForTimeout(500);
  const prop = (await probeState(roomId)).proposals?.find?.(p => p.tokenId === serenTok.id) || null;
  // Proposals are room-wide; read them off the DM's banner instead.
  await dm.waitForTimeout(300);
  // The browser DM is still on Scene 1, so no banner there — switch him to the overland.
  await dm.click('.tabs button:has-text("DM")');
  await dm.locator('.tool-section:has-text("Scenes") button:has-text("Go")').first().click();
  await dm.waitForTimeout(700);
  const banner = await dm.locator('.proposal-banner').textContent().catch(() => '');
  check('Overland proposal is measured in miles on the DM banner', /\d(\.\d)? mi/.test(banner), banner);
  await dm.click('.proposal-banner button:has-text("Approve")');
  await seren.waitForTimeout(800);
  const afterWalk = (await probeState(roomId)).state; // probe lands on DM's scene = overland
  const serenOver = afterWalk.tokens.find(t => t.name === 'Seren');
  check('Approved overland move lands on a fractional position', serenOver && (serenOver.x % 1 !== 0 || serenOver.y % 1 !== 0), serenOver ? `${serenOver.x.toFixed(2)},${serenOver.y.toFixed(2)}` : 'missing');
  await seren.click('.tabs button:has-text("Tokens")');
  const overList = await seren.locator('.token-row .name').allTextContents();
  check('No fog on the overland: Seren simply sees the scene', overList.includes('Seren'), JSON.stringify(overList));

  // Back to the battle map: his explored memory for Scene 1 must still be there.
  const scene1 = afterWalk.scenes.find(s => s.name === 'Scene 1');
  await ack(gm, 'token:teleport', { id: serenTok.id, sceneId: scene1.id, x: 3, y: 10 });
  await seren.waitForTimeout(900);
  const backJoin = await probeState(roomId, 'Seren'); // joins as Seren → lands on his scene with his explored set
  check('Scene 1 fog memory survived the overland trip', backJoin.state.room.scene_name === 'Scene 1' && (backJoin.explored.Seren || []).includes('7,5'), `scene=${backJoin.state.room.scene_name} remembered ${(backJoin.explored.Seren || []).length} cells`);

  // ---- Save quest from the DM browser, load it into a brand-new room
  await dm.click('.tabs button:has-text("DM")');
  const dl = dm.waitForEvent('download', { timeout: 10000 });
  await dm.click('button:has-text("Save quest")');
  const file = await dl;
  const savedPath = path.join(OUT, 'saved.questhub.json');
  await file.saveAs(savedPath);
  const saved = JSON.parse(fs.readFileSync(savedPath, 'utf8'));
  check('Saved file holds both scenes, the cast and the map settings', saved.scenes?.length === 2 && saved.characters?.length === 1 && saved.scenes.some(s => s.grid_type === 'free'), `scenes=${saved.scenes?.length} chars=${saved.characters?.length}`);

  const { page: dm2, roomId: room2 } = await newDm(browser, 'Fresh Room');
  await dm2.click('.tabs button:has-text("DM")');
  await dm2.locator('input[type="file"][accept*="json"]').setInputFiles(savedPath);
  await dm2.waitForTimeout(1500);
  const st2 = await probeState(room2);
  const names2 = st2.state.scenes.map(s => s.name);
  check('Loaded quest recreates the scenes', names2.includes('Scene 1') && names2.includes('Barovia overland'), JSON.stringify(names2));
  const dmJoin2 = await (async () => {
    const s = io(BASE, { transports: ['websocket' ] });
    await new Promise(r => s.on('connect', r));
    const secret2 = await dm2.evaluate((id) => sessionStorage.getItem(`questhub:dm:${id}`), room2);
    const j = await ack(s, 'room:join', { roomId: room2, name: 'GM2', asDm: true, dmSecret: secret2 });
    s.close();
    return j;
  })();
  check('Loaded quest restores the cast with notes', dmJoin2.characters.some(ch => ch.name === 'Ireena' && /Strahd wants her/.test(ch.notes)));
  const scene1b = dmJoin2.state.scenes.find(s => s.name === 'Scene 1');
  const s1state = await (async () => {
    const s = io(BASE, { transports: ['websocket'] });
    await new Promise(r => s.on('connect', r));
    const secret2 = await dm2.evaluate((id) => sessionStorage.getItem(`questhub:dm:${id}`), room2);
    await ack(s, 'room:join', { roomId: room2, name: 'GM3', asDm: true, dmSecret: secret2 });
    const e = once(s, 'scene:enter');
    await ack(s, 'scene:switch', { sceneId: scene1b.id });
    const r = await e; s.close(); return r.state;
  })();
  check('Loaded Scene 1 has its walls, door, Seren and the wolf', s1state.walls.length === 3 && s1state.walls.some(w => w.isDoor) && s1state.tokens.some(t => t.name === 'Seren' && t.owner === 'Seren') && s1state.tokens.some(t => t.name === 'Wolf'), `walls=${s1state.walls.length} tokens=${s1state.tokens.map(t => t.name)}`);
  await dm2.screenshot({ path: `${OUT}/s3-3-dm-loaded-quest.png` });

  gm.close();
  console.log(`\n${results.filter(r => r.ok).length}/${results.length} checks passed`);
  await browser.close();
  process.exit(results.every(r => r.ok) ? 0 : 1);
})();
