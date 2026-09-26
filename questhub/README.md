# QuestHub — a small D&D virtual tabletop

A custom VTT for playing D&D remotely with your family: shared map with a
grid, tokens, automatic fog of war from character vision, DM-approved player
movement, dice rolling, spell animations, and read-only D&D Beyond character
sync.

> **Note:** this folder was developed on a branch of the Hielda2 repo purely
> for persistence. It is a standalone project — copy it into its own repo
> (see "Moving to its own repo" below).

## Quick start (local)

```bash
npm install
npm run dev     # client on http://localhost:5173, server on :4000
```

Open http://localhost:5173, create a quest (you become the DM), then open the
invite link in a second tab/browser to join as a player.

## How to play

- **DM**: create the room. The DM tab in the sidebar has map upload, grid
  settings, and tools for tokens, walls and doors. A floating toolbar on the
  left edge of the map switches cursor modes; **Esc** returns to Select and
  **Delete** removes the selected token. Drag the strip between map and
  sidebar to resize the sidebar.
- **Players**: join with the 6-character room code. You can only see what
  your character can see (sight radius, blocked by walls and closed doors).
- **Players panel** (top of DM tab): everyone connected, plus every token
  owner even when offline. **⭐ Token** creates that player's token in one
  click; **👁 View** shows the map exactly as they see it (fog, hidden tokens,
  only their HP) with a "Back to DM view" banner — no player needs to be
  online to preview.
- **Maps & grids**: maps display at native resolution. When you set a map,
  the app detects its printed square grid automatically (works on clean
  battle maps); for faint or missing grids use **📐 Align Grid** and click
  two opposite corners of one printed square. Calibration is remembered on
  the Library asset. **Grid style** per map: *Squares* (battle maps, fog on)
  or *Free* (overland/hex maps: no overlay, smooth movement, no fog).
  Scale presets 5 ft / 10 ft / ¼ mile drive distance labels, which read in
  feet or miles as appropriate.
- **Movement**: players drag their token to *propose* a move (shown as a
  dotted ghost path with distance). The DM gets an Approve / Reject /
  Stop-halfway banner. Approved moves animate cell by cell.
- **Dice**: type `/r 1d20+5` in chat. Advantage: `/r 2d20kh1+3`.
- **Bestiary**: DM tab → search a monster → click it → click the map repeatedly
  to place auto-numbered tokens (Wolf, Wolf 2…) with SRD HP/AC/darkvision and
  the monster's emoji on the token face. Tokens without art show a monogram.
- **Player tokens**: DM tab → "Add player token" → type the player's join name;
  the token is owned by them with vision configured.
- **HP**: bars over tokens (DM sees all; players see their own). Quick −5/−1/+1/+5
  buttons in the token editor.
- **Initiative**: DM tab → "Roll initiative"; order shows for everyone in the
  Tokens tab, the active creature gets a ring on the map, DM clicks Next turn.
- **Asset library**: Library tab → bulk-upload maps, token art and
  **handouts**. Big images are compressed in the browser before upload.
  One click sets a map or stamps token art onto the board; **📣** flashes an
  image full-screen on every player's view (click to close for everyone).
- **Save/Load quest**: DM tab → Save downloads a `.questhub.json` with the map,
  walls, tokens, library (images embedded) and grid calibration; Load restores
  it. Use one file per prepared scene ("Death House", "Castle Ravenloft") —
  this also survives free-tier restarts.
- **Character sheets**: players get a Sheet tab — HP with short/long rests,
  AC/initiative/speed tiles, tap-to-roll abilities, saves and skills
  (proficiency ● / expertise ◉ toggles), temporary ability bonuses that ripple
  through every derived number, weapons with the active one selected, spell
  slot pips, spells, inventory and money, conditions. Players edit only their
  own sheet and never see DM notes. `shared/rules.js` derives all numbers.
- **D&D Beyond**: Cast card → enter the character ID (from the DDB URL; the
  character must be Public). Imports ability scores, HP, speed, senses,
  proficiencies, armour, equipped weapons, slots, spells, inventory, money and
  XP. One-way: DDB stays the rules calculator (level-ups, magic items) —
  hit Refresh after changes and QuestHub keeps live HP, slot use and loot.
  Linked sheets auto-refresh every 5 minutes.
- **Attacks**: tapping a target rolls d20 + the active weapon's to-hit vs AC,
  rolls damage on a hit (crits double dice) and applies it automatically,
  temp HP first. Bestiary monsters have their own attacks for the DM's ⚔️ tool.
- **Combat**: initiative (d20 + bonus) on a bar across everyone's map; players
  act only on their turn — movement up to speed, attacks per action, one
  action (attack or spell); Space / N advances; ⏸ Hold (H) freezes players
  and stops walkers mid-route; DM can click a square on a drawn route to
  stop a player exactly there.
- **Awards & session end**: Cast tab → 🎁 Award XP/gold/items to sheets;
  DM tab → 📜 End session shows everyone a checklist of what changed since
  the last D&D Beyond sync so the DDB sheets get updated together.
- **Spells**: pick an effect from the bar at the bottom (fireball, magic
  missile, slash, heal, lightning), then click a target on the map.
- **D&D Beyond**: select a token → "Link to D&D Beyond character ID". The
  character must be set to public on D&D Beyond. This uses the unofficial
  character-service endpoint (read-only) and may break if DDB change it.

## Deploying to Render

1. Push this project (as its own repo) to GitHub.
2. On https://render.com: New → Web Service → connect the repo.
3. Render reads `render.yaml` automatically (free plan, Node 22).
4. Free-tier caveats: the service sleeps after ~15 min idle (first load takes
   ~30s to wake) and storage is ephemeral — uploaded maps and rooms reset on
   restart **and on every deploy** (each push to the branch redeploys). Save
   quest files after uploading so a restore is one click, or move to a paid
   plan with a persistent disk (see render.yaml).

## Moving to its own repo

```bash
git clone https://github.com/reubenwrites/hielda2 -b claude/dnd-vtt-tool-SMIRv hielda2-vtt
cp -r hielda2-vtt/questhub/. my-questhub/
cd my-questhub
git init && git add -A && git commit -m "QuestHub VTT"
git remote add origin git@github.com:reubenwrites/questhub.git
git push -u origin main
```

## Architecture

```
shared/   pure logic: dice parser/roller, raycast vision (unit tested)
server/   Express + Socket.io + better-sqlite3 + multer uploads
client/   Vite + React + PixiJS 8 + zustand
```

- Rooms/tokens/walls persist in SQLite; chat and move proposals are
  in-memory per room.
- Fog of war is computed client-side from the player's own tokens
  (`shared/vision.js`): every cell within sight radius gets a raycast from
  the token; walls and closed doors block, open doors don't.
- The DM secret is returned once at room creation and kept in
  sessionStorage; all DM socket events are verified server-side.

## Tests

```bash
npm test                 # unit suites: shared (rules, dice, vision…), server, client
node e2e/run-all.cjs     # browser playthroughs (see e2e/README.md)
```

## Known limitations (v1)

- Client-side vision means a technically savvy player could inspect network
  traffic to see hidden tokens. Fine for family games.
- No initiative tracker or character-sheet editing yet.
- D&D Beyond sync is unofficial and read-only; manual JSON paste is wired in
  the server (`ddb:link` accepts `manualData`) but has no UI yet.
