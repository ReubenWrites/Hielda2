# End-to-end playthroughs

Drive the built app in headless Chrome — a DM and one or two players — and
check the experience from every chair: fog of war and memory, doors, monster
entrances, dice, HP, scenes, cast sheets, save/load, overland maps, tablet
layout, combat turns, attacks, interrupts.

```bash
npm run build
PORT=4330 npm start &            # serves client/dist
npm i -D playwright               # once; needs a Chromium (CHROMIUM_PATH optional)
node e2e/run-all.cjs              # every scenario; screenshots land in e2e/out/
node e2e/scenario7.cjs            # or one at a time
```
