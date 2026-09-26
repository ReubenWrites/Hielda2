// Scenario 8: the player's character sheet — derived numbers, rolls, slots,
// inventory, sheet-driven attacks, and the end-of-session checklist.
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
  const { id: roomId, dmSecret } = await (await fetch(`${BASE}/api/rooms`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Sheet' }) })).json();
  const gm = io(BASE, { transports: ['websocket'] });
  await new Promise(r => gm.on('connect', r));
  await ack(gm, 'room:join', { roomId, name: 'GM', asDm: true, dmSecret });
  // Seren's sheet as a D&D Beyond import would leave it (manual data = same shape)
  const ch = (await ack(gm, 'char:create', { name: 'Seren', kind: 'pc', owner: 'Seren', hp: 12, maxHp: 12, emoji: '🧝', notes: 'SECRET' })).character;
  await ack(gm, 'char:ddb-link', { characterId: ch.id, ddbId: '42', manualData: {
    name: 'Seren', level: 3, classes: [{ name: 'Rogue', level: 3 }], race: 'Wood Elf', proficiency: 2,
    hp: { current: 12, max: 12, temp: 0 }, ac: 15, speed: 35, senses: { darkvision: 60 },
    abilities: { STR: 10, DEX: 16, CON: 14, INT: 12, WIS: 13, CHA: 8 }, initBonus: 3,
    skillProfs: ['Stealth', 'Perception'], expertise: ['Stealth'], saveProfs: ['DEX', 'INT'],
    armour: { base: 12, maxDex: null, shield: 0, bonus: 0 },
    attacks: [{ id: 'rap', name: 'Rapier', dice: '1d8', ability: 'finesse', proficient: true, reach: 5 }],
    slots: { 1: { max: 2, used: 0 } }, spells: [{ name: 'Mage Hand', level: 0, prepared: true }],
    inventory: [{ id: 'i1', name: 'Torch', qty: 2 }], money: { gp: 5, sp: 0, cp: 0 }, xp: 900,
  } });
  await ack(gm, 'char:place', { characterId: ch.id, x: 5, y: 5 });
  const wolf = (await ack(gm, 'token:create', { name: 'Wolf', emoji: '🐺', x: 6, y: 5, ac: 5, hp: 30, maxHp: 30 })).token;

  const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  const seren = await ctx.newPage();
  seren.on('pageerror', e => console.log(`[seren pageerror] ${e.message}`));
  await seren.goto(BASE, { waitUntil: 'domcontentloaded' });
  await seren.click('.tabs button:has-text("Join")');
  await seren.fill('input[placeholder="Adventurer"]', 'Seren');
  await seren.fill('input[placeholder="ABC123"]', roomId);
  await seren.click('button:has-text("Join quest")');
  await seren.waitForTimeout(1800);

  // ---- Sheet tab opens by default for a player with a character
  check('Seren lands on his Sheet tab', (await seren.locator('.tabs button.active').textContent()) === 'Sheet');
  const sheet = () => seren.locator('.sheet').textContent();
  let txt = await sheet();
  check('Sheet shows race/class/level and HP 12/12', /Wood Elf · Rogue 3 · Level 3/.test(txt) && /12\/12/.test(txt), txt.slice(0, 80));
  const ac = async () => (await seren.locator('.tile:has(.tile-lab:has-text("AC")) .tile-val').textContent()).trim();
  check('AC tile derived from armour + DEX = 15', (await ac()) === '15', await ac());
  check('DM notes are not on the player sheet', !/SECRET/.test(txt));
  await seren.screenshot({ path: `${OUT}/s8-1-seren-sheet.png` });

  // ---- Tap an ability to roll a check → chat
  await seren.click('.ability:has-text("DEX")');
  await seren.waitForTimeout(400);
  await seren.click('.tabs button:has-text("Chat")');
  let chat = await seren.locator('.chat-msgs').textContent();
  check('Tapping DEX rolls "Dexterity check: 1d20+3"', /Dexterity check: 1d20\[\d+\]\+3 = \d+/.test(chat), chat.slice(-60));
  await seren.click('.tabs button:has-text("Sheet")');

  // ---- Temporary +1 DEX ripples into AC and the attack line
  await seren.locator('.ability:has-text("DEX") .ab-temp-btns button', { hasText: '+' }).click();
  await seren.waitForTimeout(500);
  check('Temp +1 DEX (DEX 17): modifier unchanged, so AC stays 15', (await ac()) === '15', await ac());
  txt = await sheet();
  check('Rapier line still +5 to hit (mod unchanged at 17), damage 1d8+3', /Rapier\+5/.test(txt.replace(/\s/g, '')) && /1d8\+3/.test(txt), '');
  await seren.locator('.ability:has-text("DEX") .ab-temp-btns button', { hasText: '+' }).click();
  await seren.waitForTimeout(500);
  txt = await sheet();
  check('A second +1 (DEX 18, mod +4): AC 16 and Rapier +6 / 1d8+4', (await ac()) === '16' && /Rapier\+6/.test(txt.replace(/\s/g, '')) && /1d8\+4/.test(txt), await ac());

  // ---- Spend a spell slot by clicking a pip
  await seren.locator('.pip').first().click();
  await seren.waitForTimeout(400);
  txt = await sheet();
  check('Spending a level-1 slot shows 1/2 left', /1\/2/.test(txt));

  // ---- Loot: add an item
  await seren.click('.sheet-section h3:has-text("Inventory")');
  await seren.fill('input[placeholder="Add item (Healing potion)"]', 'Silver dagger');
  await seren.keyboard.press('Enter');
  await seren.waitForTimeout(400);
  txt = await sheet();
  check('Added "Silver dagger" to inventory', /Silver dagger/.test(txt));

  // ---- Attack the wolf with the sheet weapon (AC 5 → hits on anything but a 1)
  const st = await seren.locator('.stage').boundingBox();
  await seren.mouse.click(st.x + st.width / 2 + 64, st.y + st.height / 2);
  await seren.waitForTimeout(600);
  await seren.click('.tabs button:has-text("Chat")');
  chat = await seren.locator('.chat-msgs').textContent();
  check('Attack uses the sheet: "Seren attacks Wolf with Rapier: d20 N+6 = …"', /Seren attacks Wolf with Rapier: d20 \d+\+6 = \d+/.test(chat), chat.slice(-90));
  const wolfNow = (await ack(gm, 'room:join', { roomId, name: 'GM', asDm: true, dmSecret })).state.tokens.find(t => t.id === wolf.id);
  check('Damage was applied to the wolf automatically', wolfNow.hp < 30 || /miss/.test(chat.slice(-60)), `wolf hp ${wolfNow.hp}`);
  await seren.click('.tabs button:has-text("Sheet")');

  // ---- End session: checklist for everyone
  await ack(gm, 'session:end', {});
  await seren.waitForTimeout(600);
  const overlay = await seren.locator('text=Session over').count();
  const items = await seren.locator('input[type="checkbox"]').count();
  const overlayText = await seren.locator('text=Session over').locator('..').textContent().catch(() => '');
  check('End-of-session checklist appears for Seren with what to update on D&D Beyond', overlay > 0 && items >= 2 && /Silver dagger/.test(overlayText) && /spell slots used: 0 → 1/.test(overlayText), overlayText.slice(0, 200));
  await seren.screenshot({ path: `${OUT}/s8-2-seren-session-end.png` });

  gm.close();
  console.log(`\n${results.filter(r => r.ok).length}/${results.length} checks passed`);
  await browser.close();
  process.exit(results.every(r => r.ok) ? 0 : 1);
})();
