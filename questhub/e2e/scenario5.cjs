// Scenario 5: tap-to-attack from the player's chair.
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
  const { id: roomId, dmSecret } = await (await fetch(`${BASE}/api/rooms`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Attack' }) })).json();
  const gm = io(BASE, { transports: ['websocket'] });
  await new Promise(r => gm.on('connect', r));
  await ack(gm, 'room:join', { roomId, name: 'GM', asDm: true, dmSecret });
  await ack(gm, 'token:create', { name: 'Seren', owner: 'Seren', x: 5, y: 5, color: '#f0c040', hp: 12, maxHp: 12 });
  const wolf = (await ack(gm, 'token:create', { name: 'Wolf', emoji: '🐺', x: 6, y: 5, ac: 13, hp: 11, maxHp: 11 })).token;
  const far = (await ack(gm, 'token:create', { name: 'Zombie', emoji: '🧟', x: 9, y: 5, ac: 8, hp: 22, maxHp: 22 })).token;

  const ctx = await browser.newContext({ viewport: { width: 1200, height: 700 } });
  const seren = await ctx.newPage();
  seren.on('pageerror', e => console.log(`[seren pageerror] ${e.message}`));
  await seren.goto(BASE, { waitUntil: 'domcontentloaded' });
  await seren.click('.tabs button:has-text("Join")');
  await seren.fill('input[placeholder="Adventurer"]', 'Seren');
  await seren.fill('input[placeholder="ABC123"]', roomId);
  await seren.click('button:has-text("Join quest")');
  await seren.waitForTimeout(1800);
  const st = await seren.locator('.stage').boundingBox();
  const cx = st.x + st.width / 2, cy = st.y + st.height / 2; // Seren's centre

  // Tap the far zombie (4 squares away) → told to move closer, no roll
  await seren.mouse.click(cx + 4 * 64, cy);
  await seren.waitForTimeout(400);
  const s1 = await seren.locator('.hint').last().textContent();
  check('Tapping a monster out of reach says to move next to it', /next to it/i.test(s1), s1);

  // Tap the adjacent wolf → slash + d20 + hit/miss in chat
  const fx = once(gm, 'spell:effect');
  await seren.mouse.click(cx + 1 * 64, cy);
  await seren.waitForTimeout(120);
  await seren.screenshot({ path: `${OUT}/s5-1-seren-attack.png` });
  const effect = await Promise.race([fx, new Promise(r => setTimeout(() => r(null), 2000))]);
  check('Attack plays a slash on the wolf for everyone', effect && effect.kind === 'slash', effect ? effect.kind : 'none');
  await seren.waitForTimeout(400);
  const s2 = await seren.locator('.hint').last().textContent();
  check('Seren gets an instant HIT/miss toast', /Rolled \d+ — (HIT|miss)/.test(s2), s2);
  await seren.click('.tabs button:has-text("Chat")');
  const chat = await seren.locator('.chat-msgs').textContent();
  check('Chat shows "Seren attacks Wolf" with the d20 vs AC 13', /Seren attacks Wolf(?: with [^:]+)?: d20 \d+(?:[+-]\d+ = \d+)? — (HIT|miss)/.test(chat), chat.slice(-70));

  // ---- Combat: initiative bar + turn economy from Seren's chair
  const serenTok = (await ack(gm, 'room:join', { roomId, name: 'GM', asDm: true, dmSecret })).state.tokens.find(t => t.name === 'Seren');
  let init = (await ack(gm, 'init:roll', { tokenIds: [serenTok.id, wolf.id, far.id] })).initiative;
  await seren.waitForTimeout(500);
  check('Combat bar appears for Seren with all three combatants', (await seren.locator('.combat-chip').count()) === 3);
  // Step the DM through until it's Seren's turn
  for (let i = 0; i < 3 && init.order[init.turn].tokenId !== serenTok.id; i++) {
    const waiting = await seren.locator('.combat-status').textContent();
    if (i === 0) check("While it's a monster's turn Seren sees '⏳ …'s turn' and no End turn button", /⏳/.test(waiting) && !/End turn/.test(waiting), waiting);
    const denied = await new Promise(res => seren.evaluate(() => null).then(() => res(null)));
    await ack(gm, 'init:next', {});
    init = (await ack(gm, 'room:join', { roomId, name: 'GM', asDm: true, dmSecret })).initiative;
    await seren.waitForTimeout(300);
  }
  const yourTurn = await seren.locator('.combat-status').textContent();
  check("On his turn Seren's bar says 'Your turn!' with 30 ft and 1/1 attacks", /Your turn/.test(yourTurn) && /30 ft left/.test(yourTurn) && /1\/1/.test(yourTurn), yourTurn);
  await seren.screenshot({ path: `${OUT}/s5-2-seren-your-turn.png` });
  // Illegal move: 7 squares = 35 ft
  await seren.mouse.move(cx, cy); await seren.mouse.down();
  await seren.mouse.move(cx - 7 * 64, cy, { steps: 10 }); await seren.mouse.up();
  await seren.waitForTimeout(500);
  const tooFar = await seren.locator('.hint').last().textContent();
  check('A 35 ft drag is refused: "Only 30 ft of movement left"', /Only 30 ft of movement left/.test(tooFar), tooFar);
  // Legal move: 2 squares, DM approves → bar shows 20 ft left
  await seren.mouse.move(cx, cy); await seren.mouse.down();
  await seren.mouse.move(cx - 2 * 64, cy, { steps: 6 }); await seren.mouse.up();
  await seren.waitForTimeout(400);
  const props = (await ack(gm, 'room:join', { roomId, name: 'GM', asDm: true, dmSecret })).proposals;
  await ack(gm, 'move:approve', { proposalId: props[props.length - 1].id });
  await seren.waitForTimeout(800);
  const afterMove = await seren.locator('.combat-status').textContent();
  check('After a 10 ft approved move the bar shows 20 ft left', /20 ft left/.test(afterMove), afterMove);
  // End turn from the bar
  await seren.click('.combat-status button:has-text("End turn")');
  await seren.waitForTimeout(400);
  const ended = await seren.locator('.combat-status').textContent();
  check('End turn hands over to the next creature', /⏳/.test(ended), ended);

  console.log(`\n${results.filter(r => r.ok).length}/${results.length} checks passed`);
  gm.close();
  await browser.close();
  process.exit(results.every(r => r.ok) ? 0 : 1);
})();
