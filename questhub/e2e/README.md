# End-to-end playthrough

Drives the built app in two headless Chrome windows — a DM and a player
called Seren — and checks the experience from both chairs: fog of war,
door opening, explored-area memory (pixel-sampled), monster entrances,
one-tap dice, HP damage, scene switching/following, and NPC sheets.

```bash
npm run build
PORT=4330 npm start &            # serves client/dist
npm i -D playwright               # once; needs a Chromium (CHROMIUM_PATH optional)
node e2e/playthrough.cjs           # screenshots land in e2e/out/
```
