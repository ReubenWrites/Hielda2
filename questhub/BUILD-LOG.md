# QuestHub — build log and current state

A record of what was built in the September 2026 build sessions, where
things stand, how to verify them, and what is known to be unfinished.
Everything below is on branch `claude/dnd-vtt-tool-SMIRv` (folder
`questhub/`) and deployed to Render from that branch.

## What QuestHub is

A virtual tabletop for running D&D (built for Curse of Strahd) remotely with a
family group: a DM and one or more players (Seren). Node/Express + Socket.io +
SQLite server; React + PixiJS client; shared rules/dice/vision modules.

## Features, in the order they were built

### Core table
- Rooms with a 6-character invite code; DM secret kept in the DM's browser.
- Maps: upload or pick from a Library; maps render at native resolution;
  the grid is calibrated to the map's printed squares — automatic detection
  (`server/src/gridDetect.js`, autocorrelation with harmonic reduction,
  verified on real Curse of Strahd-style maps) or the **📐 Align Grid** tool
  (click two corners of one square). Calibration is remembered on the
  Library asset. Grid style per map: *Squares* (fog on) or *Free* (overland /
  hex maps: no overlay, smooth movement, no fog). Feet-per-square presets
  (5 ft / 10 ft / ¼ mile); distances read in feet or miles.
- Tokens: colour + emoji face or uploaded art; monogram when neither; sizes
  Medium→Gargantuan; HP bars (DM sees all, players only their own);
  downed creatures go grey with a skull.
- Walls and doors; players open doors beside their character; doors gate
  vision.
- Fog of war computed from each player's own tokens (raycast against walls,
  closed doors block). **Explored memory**: areas a player has seen stay
  dimly visible with no creatures shown; stored server-side per player per
  scene; included in quest files; reset per scene.
- Movement: players *draw* a route (distance label, remaining budget during
  combat, red when over); the DM approves, rejects, stops halfway, or clicks
  any square on the route to stop them exactly there. Approved moves animate.
- ⏸ **Hold (H)**: freezes players (overlay, all actions refused), stops any
  walking token where it is for everyone; ▶ Resume.
- Ping: DM tool or double-click; pulses for everyone on that scene and pans
  players to it.
- Handouts: flash any Library image full-screen for every player.
- Dice: `/r 2d20kh1+3` in chat, plus a kid-friendly d4–d100 button panel with
  advantage/disadvantage and bonus.
- Spell/attack effects: fireball, magic missile, slash, heal, lightning,
  entrance shockwave, ping, floating damage numbers.
- Chat with roll formatting; join/leave lines de-duplicated per person.

### Scenes and cast
- **Scenes**: a quest holds many maps. The DM switches freely; each player
  automatically sees the scene their character is on; tokens can be sent
  between scenes; Library maps spawn scenes (with saved calibration).
- **Cast**: PCs/NPCs/monsters with persistent sheets and DM-only notes
  (accent, motives, secrets) that follow them onto every map; place with one
  click; "save as character" promotes any token. Players never receive notes.
- Players panel: online/offline players, one-click **⭐ Token** (creates the
  PC sheet + token), **👁 View** to see exactly what a player sees (fog,
  memory, hidden tokens), works with nobody else online.
- Bestiary: ~26 SRD creatures with HP/AC/speed/attacks/reach/initiative
  bonus/size; auto-numbered placement; dramatic entrance + "X appears!".

### Combat
- Initiative: d20 + bonus, **combat bar** across every map (order with
  faces, current creature, round, remaining movement/attacks); Space / N
  advances (players end only their own turn); add/remove combatants mid-fight;
  downed or deleted creatures leave the order.
- Turn economy (players only; DM unrestricted): act on your turn, move up to
  speed, attacks per action, spell uses the action, doors free.
- Tap-to-attack (players): tap a target within reach → d20 + to-hit vs AC,
  crits, damage rolled and applied (temp HP first), announced.
- DM ⚔️ Attack tool: select a monster, tap a hero; monsters use bestiary
  attacks.

### Character sheets and D&D Beyond
- `shared/rules.js`: derives modifiers, skills (proficiency ● / expertise ◉),
  saves, initiative, AC (armour base, DEX cap, shield, bonuses), attack
  to-hit/damage from sheet *sources*, so temporary ability bonuses and new
  proficiencies ripple through; level-ups raise everything proficient.
- Player **Sheet** tab: HP with short/long rests, derived tiles,
  tap-to-roll abilities/saves/skills, temp ± per ability, weapons (active one
  used by tap-to-attack), spell-slot pips, spells, inventory + money,
  conditions. Players edit only their own sheet.
- **D&D Beyond import** (`server/src/dndbeyond.js`, unofficial
  character-service endpoint; character must be Public): ability scores with
  racial and equipped/attuned item bonuses, HP, speed, senses, proficiencies,
  saves, armour, equipped weapons as rule sources, slots, spells, inventory,
  money, XP. One-way. Re-sync after a level-up keeps live HP, slot usage and
  table loot. Auto-refresh every 5 minutes while the DM is in. **Paste-JSON
  fallback** when the server cannot reach D&D Beyond. Accepts an ID or the
  character URL.
- 🎁 Award XP/gold/items to sheets; 📜 End session shows everyone a checklist
  of what changed since the last DDB sync (HP, slots, items, money, XP,
  conditions) so DDB sheets get updated together.

### Persistence and hosting
- Quest files (v2): every scene (map embedded), walls, tokens, explored
  memory, cast with sheets, Library with calibration, DM position; v1 files
  still import. This is the free-tier survival strategy: Render's free plan
  wipes uploads on every restart **and every deploy**.
- `render.yaml` at the repo root deploys `questhub/` from this branch.

## Verification

- Unit: `npm test` — shared 47 (rules, dice, vision, geometry, measure,
  bestiary, grid calibration), server 44 (mechanics, permissions, fog memory,
  scenes, sheets, DDB import fixture, quest files), client 16.
- Browser: `node e2e/run-all.cjs` — eight scripted playthroughs in headless
  Chromium with a DM and one or two players in separate windows (~100
  checks, screenshots in `e2e/out/`). See `e2e/README.md`.
- Last full run: all green. (The final regression re-run on 26 Sep was
  interrupted before completing; no code changed after the previous green run.)

## Known gaps and caveats

- **Live D&D Beyond fetch untested from the build sandbox** (its network
  policy blocks dndbeyond.com). Test from the Render deploy with
  `https://www.dndbeyond.com/characters/43513513`; the paste-JSON path is the
  guaranteed fallback. DDB has no write API, so nothing is pushed back.
- The DDB importer computes AC from equipped armour/shield/bonuses and covers
  common weapon properties; unusual class features (e.g. Unarmoured Defense,
  Sharpshooter) are not modelled — adjust on the sheet.
- Free/overland mode ignores hex geometry (no hex snapping).
- Client-side vision means a determined player could read hidden tokens from
  network traffic; fine for a family game.
- Free-tier Render sleeps after ~15 min idle and wipes uploads on restart or
  deploy — save quest files after prep, or move to a paid plan with a disk
  mounted at `/var/data` (the app already uses it if present).
- Every push to the branch redeploys the live site; avoid pushing during a
  session.

## Handy commands

```bash
npm install && npm run dev        # local dev: client :5173, server :4000
npm test                          # all unit suites
npm run build && PORT=4330 npm start &
node e2e/run-all.cjs              # browser playthroughs (needs playwright + Chromium)
```
