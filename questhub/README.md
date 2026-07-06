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
  settings, and tools for tokens, walls and doors.
- **Players**: join with the 6-character room code. You can only see what
  your character can see (sight radius, blocked by walls and closed doors).
- **Movement**: players drag their token to *propose* a move (shown as a
  dotted ghost path with distance in feet). The DM gets an Approve / Reject /
  Stop-halfway banner. Approved moves animate cell by cell.
- **Dice**: type `/r 1d20+5` in chat. Advantage: `/r 2d20kh1+3`.
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
   restart. Open the app 5 minutes before a session and re-upload the map, or
   move to a paid plan with a persistent disk (see render.yaml).

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
npm test    # runs shared (23), server (6) and client (14) suites
```

## Known limitations (v1)

- Client-side vision means a technically savvy player could inspect network
  traffic to see hidden tokens. Fine for family games.
- No initiative tracker or character-sheet editing yet.
- D&D Beyond sync is unofficial and read-only; manual JSON paste is wired in
  the server (`ddb:link` accepts `manualData`) but has no UI yet.
