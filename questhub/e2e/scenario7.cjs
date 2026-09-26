// Scenario 7: one full combat round, DM and player chairs, end to end.
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

(async () => {
  const browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  const { id: roomId, dmSecret } = await (await fetch(`${BASE}/api/rooms`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Wolf Fight' }) })).json();
  const gm = io(BASE, { transports: ['websocket'] });
  await new Promise(r => gm.on('connect', r));
  await ack(gm, 'room:join', { roomId, name: 'GM', asDm: true, dmSecret });
  const serenTok = (await ack(gm, 'token:create', { name: 'Seren', owner: 'Seren', x: 10, y: 10, color: '#f0c040', hp: 12, maxHp: 12, ac: 14 })).token;
  const wolf = (await ack(gm, 'token:create', { name: 'Wolf', emoji: '🐺', x: 13, y: 10, hp: 11, maxHp: 11, ac: 13, speed: 40 })).token;
  const initState = async () => (await ack(gm, 'room:join', { roomId, name: 'GM', asDm: true, dmSecret })).initiative;
  const tokenState = async (id) => (await ack(gm, 'room:join', { roomId, name: 'GM', asDm: true, dmSecret })).state.tokens.find(t => t.id === id);

  const dmCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const dm = await dmCtx.newPage();
  dm.on('pageerror', e => console.log(`[dm pageerror] ${e.message}`));
  await dm.goto(BASE, { waitUntil: 'domcontentloaded' });
  await dm.evaluate(({ roomId, dmSecret }) => { sessionStorage.setItem(`questhub:dm:${roomId}`, dmSecret); sessionStorage.setItem('questhub:name', 'Reuben'); }, { roomId, dmSecret });
  await dm.goto(`${BASE}/r/${roomId}?dm=1`, { waitUntil: 'domcontentloaded' });
  await dm.waitForTimeout(1800);
  const dst = await dm.locator('.stage').boundingBox();
  const dcx = dst.x + dst.width / 2, dcy = dst.y + dst.height / 2; // centred on Seren (10,10)

  const sCtx = await browser.newContext({ viewport: { width: 1200, height: 700 } });
  const seren = await sCtx.newPage();
  seren.on('pageerror', e => console.log(`[seren pageerror] ${e.message}`));
  await seren.goto(BASE, { waitUntil: 'domcontentloaded' });
  await seren.click('.tabs button:has-text("Join")');
  await seren.fill('input[placeholder="Adventurer"]', 'Seren');
  await seren.fill('input[placeholder="ABC123"]', roomId);
  await seren.click('button:has-text("Join quest")');
  await seren.waitForTimeout(1800);
  const sst = await seren.locator('.stage').boundingBox();
  const scx = sst.x + sst.width / 2, scy = sst.y + sst.height / 2; // centred on Seren (10,10)

  // ---- DM rolls initiative from the DM tab
  await dm.click('.tabs button:has-text("DM")');
  await dm.click('button:has-text("Roll initiative")');
  await dm.waitForTimeout(600);
  let init = await initState();
  check('Initiative rolled with both combatants; combat bar visible to both', init?.order.length === 2 && (await seren.locator('.combat-bar').count()) === 1 && (await dm.locator('.combat-bar').count()) === 1);

  async function wolfTurn() {
    // DM: Attack tool → select wolf → tap Seren (wherever he is now)
    const s = await tokenState(serenTok.id);
    await dm.click('.stage-tool[title^="Attack"]');
    await dm.mouse.click(dcx + 3 * 64, dcy);               // wolf (13,10)
    await dm.mouse.click(dcx + (s.x - 10) * 64, dcy + (s.y - 10) * 64); // Seren
    await dm.waitForTimeout(500);
    const chat = await (async () => { await seren.click('.tabs button:has-text("Chat")'); return seren.locator('.chat-msgs').textContent(); })();
    check("Wolf's turn: DM attack tool → 'Wolf attacks Seren' with d20 vs AC 14 in Seren's chat", /Wolf attacks Seren: 1d20\[\d+\] = \d+ — (HIT|miss)/.test(chat), chat.slice(-60));
    await dm.keyboard.press('Escape');
    // DM applies 5 damage to Seren from the token editor
    await dm.click('.tabs button:has-text("Tokens")');
    if (await dm.locator('.token-row:has-text("Seren"):not(.selected)').count()) await dm.click('.token-row:has-text("Seren")');
    await dm.click('button:has-text("−5")');
    await seren.waitForTimeout(500);
    check('Seren takes 5 (HP 7/12 on his own bar)', /7\/12/.test(await seren.locator('.combat-bar, .side').first().textContent()) || (await tokenState(serenTok.id)).hp === 7);
    await dm.click('.tabs button:has-text("DM")');
    await dm.keyboard.press('Space');
    await dm.waitForTimeout(400);
  }

  async function serenTurn() {
    const bar = await seren.locator('.combat-status').textContent();
    check("Seren's turn: his bar says Your turn with 30 ft and 1/1 attacks", /Your turn/.test(bar) && /30 ft left/.test(bar) && /1\/1/.test(bar), bar);
    // Move 2 squares toward the wolf (to 12,10)
    await seren.mouse.move(scx, scy); await seren.mouse.down();
    await seren.mouse.move(scx + 2 * 64, scy, { steps: 8 }); await seren.mouse.up();
    await seren.waitForTimeout(400);
    await dm.click('.proposal-banner button:has-text("Approve")');
    await seren.waitForTimeout(900);
    const moved = await tokenState(serenTok.id);
    check('Approved 10 ft move puts Seren beside the wolf (12,10)', moved.x === 12 && moved.y === 10, `${moved.x},${moved.y}`);
    check('Bar now shows 20 ft left', /20 ft left/.test(await seren.locator('.combat-status').textContent()));
    // Tap the wolf (screen: +3 from Seren's original centre)
    await seren.mouse.click(scx + 3 * 64, scy);
    await seren.waitForTimeout(500);
    const bar2 = await seren.locator('.combat-status').textContent();
    check('After attacking, bar shows 0/1 attacks and action used', /0\/1/.test(bar2) && /action used/.test(bar2), bar2);
    await seren.mouse.click(scx + 3 * 64, scy);
    await seren.waitForTimeout(400);
    check('Second attack refused: "No attacks left this turn"', /No attacks left/.test(await seren.locator('.hint').last().textContent()));
    await seren.screenshot({ path: `${OUT}/s7-1-seren-attacked.png` });
    await seren.keyboard.press('Space'); // end his own turn
    await seren.waitForTimeout(400);
  }

  init = await initState();
  if (init.order[init.turn].tokenId === wolf.id) { await wolfTurn(); await serenTurn(); }
  else { await serenTurn(); await wolfTurn(); }

  // ---- DM drops the wolf to 0 HP: skull, chat, out of the order
  await dm.click('.tabs button:has-text("Tokens")');
  await dm.click('.token-row:has-text("Wolf")');
  const hpInput = dm.locator('.field:has(label:has-text("HP")) input').first();
  await hpInput.fill('0');
  await hpInput.dispatchEvent('change');
  await dm.waitForTimeout(700);
  await seren.click('.tabs button:has-text("Chat")');
  const chat2 = await seren.locator('.chat-msgs').textContent();
  check('"💀 Wolf is down!" announced', /Wolf is down/.test(chat2));
  init = await initState();
  check('Wolf leaves the initiative order', init === null || !init.order.some(e => e.tokenId === wolf.id), JSON.stringify(init?.order.map(e => e.name)));
  await seren.screenshot({ path: `${OUT}/s7-2-seren-wolf-down.png` });
  {
    // Skull rendered on the wolf's token in Seren's view: dark grey/white pixels replace the wolf's blue
    const sharp = require('sharp');
    const shot = await seren.screenshot({ clip: { x: sst.x + sst.width / 2 + 3 * 64 - 20, y: sst.y + sst.height / 2 - 20, width: 40, height: 40 } });
    const { data, info } = await sharp(shot).raw().toBuffer({ resolveWithObject: true });
    let blueish = 0, grey = 0;
    for (let i = 0; i < data.length; i += info.channels) {
      if (data[i + 2] > data[i] + 20) blueish++;
      if (Math.abs(data[i] - data[i + 1]) < 12 && Math.abs(data[i + 1] - data[i + 2]) < 12 && data[i] > 60) grey++;
    }
    check("Downed wolf is greyed out on Seren's map (grey, not blue)", blueish < 200 && grey > 100, `${blueish} blue / ${grey} grey pixels`);
  }
  // DM ends combat
  if (init) { await dm.click('.combat-status button:has-text("End combat")'); await dm.waitForTimeout(400); }
  check('Combat over: bar gone for Seren', (await seren.locator('.combat-bar').count()) === 0);

  gm.close();
  console.log(`\n${results.filter(r => r.ok).length}/${results.length} checks passed`);
  await browser.close();
  process.exit(results.every(r => r.ok) ? 0 : 1);
})();
