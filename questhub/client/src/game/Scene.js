import { Application, Container, Graphics, Sprite, Assets, Text } from 'pixi.js';
import { buildGrid, worldToCell, cellToWorld, lineCells } from './grid.js';
import { TokenView } from './tokens.js';
import { drawWalls } from './walls.js';
import { drawFog, tokenVisibleToViewer } from './fog.js';
import { createEffect } from './spells.js';

const CELL_ANIM_MS = 220;

export class Scene {
  constructor(host) {
    this.host = host;
    this.app = new Application();
    this.tokenViews = new Map(); // tokenId -> TokenView
    this.animations = new Map(); // tokenId -> { path, idx, progress }
    this.fx = []; // active effects
    this.room = null;
    this.role = 'player';
    this.you = null;
    this.tokens = [];
    this.walls = [];
    this.visibleSet = null;
    this.tool = 'select';
    this.spell = null;
    this.selectedId = null;
    this.draftWall = null;  // { x1, y1, isDoor } while drawing
    this.dragging = null;   // { tokenId, startCell, path } while dragging a token
    this.onAction = () => {};
    this.camera = { x: 0, y: 0, scale: 1 };
    this.pointer = { x: 0, y: 0, world: { x: 0, y: 0 }, cell: { x: 0, y: 0 } };
    this.panning = null; // { fromX, fromY, camX, camY }
    this.cursorText = null;
    this.initTokenId = null; // token whose turn it is in initiative
    this.viewAsYou = null;   // DM previewing a player's view: { name }
    this.mapNatural = null;  // { w, h } of the loaded map image
    this.draftAlign = null;  // first corner clicked with the align-grid tool
  }

  // Identity used for VISIBILITY (fog, hidden tokens). The DM can temporarily
  // borrow a player's identity via "view as" without losing DM controls.
  get visYou() {
    return this.viewAsYou ?? this.you;
  }

  get feetPerCell() {
    return this.room?.feet_per_cell || 5;
  }

  async init() {
    await this.app.init({
      background: 0x0a0a10,
      antialias: true,
      resizeTo: this.host,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
    });
    this.host.appendChild(this.app.canvas);

    this.world = new Container();
    this.world.sortableChildren = true;
    this.app.stage.addChild(this.world);

    this.mapLayer = new Container(); this.mapLayer.zIndex = 0;
    this.gridLayer = new Container(); this.gridLayer.zIndex = 1;
    this.ghostLayer = new Container(); this.ghostLayer.zIndex = 3;
    this.tokenLayer = new Container(); this.tokenLayer.zIndex = 4;
    this.wallLayer = new Graphics(); this.wallLayer.zIndex = 5;
    this.fogLayer = new Graphics(); this.fogLayer.zIndex = 6;
    this.cursorLayer = new Graphics(); this.cursorLayer.zIndex = 9;
    this.fxLayer = new Container(); this.fxLayer.zIndex = 10;
    this.world.addChild(
      this.mapLayer, this.gridLayer, this.ghostLayer, this.tokenLayer,
      this.wallLayer, this.fogLayer, this.cursorLayer, this.fxLayer,
    );

    this.attachInput();

    this.app.ticker.add((ticker) => this.tick(ticker.deltaMS));
  }

  attachInput() {
    const canvas = this.app.canvas;
    canvas.style.touchAction = 'none';
    canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    canvas.addEventListener('pointermove', (e) => this.onPointerMove(e));
    canvas.addEventListener('pointerup', (e) => this.onPointerUp(e));
    canvas.addEventListener('pointercancel', (e) => this.onPointerUp(e));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  screenToWorld(x, y) {
    const rect = this.app.canvas.getBoundingClientRect();
    const sx = (x - rect.left);
    const sy = (y - rect.top);
    return {
      x: (sx - this.camera.x) / this.camera.scale,
      y: (sy - this.camera.y) / this.camera.scale,
    };
  }

  applyCamera() {
    this.world.x = this.camera.x;
    this.world.y = this.camera.y;
    this.world.scale.set(this.camera.scale);
  }

  centerOn(cellX, cellY) {
    if (!this.room) return;
    const w = cellToWorld(cellX, cellY, this.room);
    const cw = this.host.clientWidth, ch = this.host.clientHeight;
    this.camera.x = cw / 2 - w.x * this.camera.scale;
    this.camera.y = ch / 2 - w.y * this.camera.scale;
    this.applyCamera();
  }

  onWheel(e) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const prev = this.camera.scale;
    const next = Math.min(3, Math.max(0.2, prev * factor));
    const rect = this.app.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    // Keep cursor point fixed in world space
    const wx = (sx - this.camera.x) / prev;
    const wy = (sy - this.camera.y) / prev;
    this.camera.scale = next;
    this.camera.x = sx - wx * next;
    this.camera.y = sy - wy * next;
    this.applyCamera();
  }

  isPanGesture(e) {
    return e.button === 1 || (e.button === 0 && e.shiftKey) || (e.button === 2);
  }

  onPointerDown(e) {
    this.app.canvas.setPointerCapture(e.pointerId);
    if (this.isPanGesture(e)) {
      this.panning = { fromX: e.clientX, fromY: e.clientY, camX: this.camera.x, camY: this.camera.y };
      return;
    }
    const world = this.screenToWorld(e.clientX, e.clientY);
    if (!this.room) return;
    const cell = worldToCell(world.x, world.y, this.room);
    const cellSnap = { x: Math.floor(cell.x), y: Math.floor(cell.y) };

    if (this.tool === 'add-token' && this.role === 'dm') {
      this.onAction({ type: 'add-token', cell: cellSnap });
      return;
    }
    if (this.tool === 'align-grid' && this.role === 'dm') {
      if (!this.draftAlign) {
        this.draftAlign = { x: world.x, y: world.y };
      } else {
        this.onAction({
          type: 'align-grid',
          p1: this.draftAlign,
          p2: { x: world.x, y: world.y },
          mapW: this.mapNatural?.w,
          mapH: this.mapNatural?.h,
        });
        this.draftAlign = null;
      }
      return;
    }
    if ((this.tool === 'draw-wall' || this.tool === 'draw-door') && this.role === 'dm') {
      // Snap to nearest cell corner
      const corner = { x: Math.round(cell.x), y: Math.round(cell.y) };
      if (!this.draftWall) {
        this.draftWall = { x1: corner.x, y1: corner.y, isDoor: this.tool === 'draw-door' };
      } else {
        this.onAction({
          type: 'add-wall',
          wall: { ...this.draftWall, x2: corner.x, y2: corner.y },
        });
        this.draftWall = null;
      }
      return;
    }
    if (this.tool === 'erase-wall' && this.role === 'dm') {
      const hit = this.pickWall(world);
      if (hit) this.onAction({ type: 'delete-wall', id: hit.id });
      return;
    }
    if (this.tool === 'toggle-door' && this.role === 'dm') {
      const hit = this.pickWall(world, { doorsOnly: true });
      if (hit) this.onAction({ type: 'toggle-door', id: hit.id });
      return;
    }
    if (this.tool === 'cast-spell' && this.spell) {
      const selected = this.tokens.find(t => t.id === this.selectedId);
      const fromCell = selected ? { x: selected.x + 0.5, y: selected.y + 0.5 } : cell;
      const from = cellToWorld(fromCell.x, fromCell.y, this.room);
      const to = cellToWorld(cell.x, cell.y, this.room);
      this.onAction({ type: 'cast-spell', kind: this.spell.kind, from, to });
      return;
    }

    // Default: select / drag tokens
    const hit = this.pickToken(world);
    if (hit) {
      this.selectedId = hit.id;
      this.onAction({ type: 'select-token', id: hit.id });
      if (this.canMoveToken(hit)) {
        // Start drag
        this.dragging = {
          tokenId: hit.id,
          startCell: { x: Math.floor(hit.x), y: Math.floor(hit.y) },
          path: [{ x: Math.floor(hit.x), y: Math.floor(hit.y) }],
        };
      }
    } else {
      this.selectedId = null;
      this.onAction({ type: 'select-token', id: null });
    }
  }

  onPointerMove(e) {
    const rect = this.app.canvas.getBoundingClientRect();
    this.pointer.x = e.clientX - rect.left;
    this.pointer.y = e.clientY - rect.top;

    if (this.panning) {
      this.camera.x = this.panning.camX + (e.clientX - this.panning.fromX);
      this.camera.y = this.panning.camY + (e.clientY - this.panning.fromY);
      this.applyCamera();
      return;
    }

    if (!this.room) return;
    const world = this.screenToWorld(e.clientX, e.clientY);
    this.pointer.world = world;
    this.pointer.cell = worldToCell(world.x, world.y, this.room);

    if (this.dragging) {
      const targetCell = { x: Math.floor(this.pointer.cell.x), y: Math.floor(this.pointer.cell.y) };
      const last = this.dragging.path[this.dragging.path.length - 1];
      if (last.x !== targetCell.x || last.y !== targetCell.y) {
        const segment = lineCells(last, targetCell);
        // skip first (it's `last`); cap total path
        for (let i = 1; i < segment.length && this.dragging.path.length < 40; i++) {
          this.dragging.path.push(segment[i]);
        }
      }
    }

    this.drawCursorOverlay();
  }

  onPointerUp(e) {
    if (this.panning) { this.panning = null; return; }
    if (this.dragging) {
      const d = this.dragging;
      this.dragging = null;
      const endCell = d.path[d.path.length - 1];
      if (endCell.x === d.startCell.x && endCell.y === d.startCell.y) {
        // Click without dragging — nothing to do
        this.drawCursorOverlay();
        return;
      }
      const token = this.tokens.find(t => t.id === d.tokenId);
      if (!token) return;
      if (this.role === 'dm') {
        this.onAction({ type: 'dm-move-token', id: d.tokenId, x: endCell.x, y: endCell.y });
      } else {
        // Player proposal: path excluding the starting cell
        const path = d.path.slice(1);
        if (path.length > 0) {
          this.onAction({ type: 'propose-move', tokenId: d.tokenId, path });
        }
      }
      this.drawCursorOverlay();
    }
  }

  canMoveToken(token) {
    if (this.role === 'dm') return true;
    return token.owner === this.you?.name || token.owner === this.you?.id;
  }

  pickToken(world) {
    if (!this.room) return null;
    const r = this.room.grid_size * 0.42;
    for (let i = this.tokens.length - 1; i >= 0; i--) {
      const t = this.tokens[i];
      if (!tokenVisibleToViewer(t, this.visibleSet, this.visYou)) continue;
      const c = cellToWorld(t.x + 0.5, t.y + 0.5, this.room);
      const dx = world.x - c.x, dy = world.y - c.y;
      if (dx * dx + dy * dy <= r * r) return t;
    }
    return null;
  }

  pickWall(world, { doorsOnly = false } = {}) {
    if (!this.room) return null;
    const thresh = 8 / this.camera.scale;
    let best = null, bestD = thresh;
    for (const w of this.walls) {
      if (doorsOnly && !w.isDoor) continue;
      const a = cellToWorld(w.x1, w.y1, this.room);
      const b = cellToWorld(w.x2, w.y2, this.room);
      const d = distToSegment(world, a, b);
      if (d < bestD) { bestD = d; best = w; }
    }
    return best;
  }

  drawCursorOverlay() {
    const g = this.cursorLayer;
    g.clear();
    if (!this.room) return;
    // Drag ghost path
    if (this.dragging) {
      const token = this.tokens.find(t => t.id === this.dragging.tokenId);
      if (!token) return;
      // Draw path as connected line through cell centers
      const path = this.dragging.path;
      for (let i = 0; i < path.length; i++) {
        const c = cellToWorld(path[i].x + 0.5, path[i].y + 0.5, this.room);
        if (i === 0) g.moveTo(c.x, c.y);
        else g.lineTo(c.x, c.y);
      }
      g.stroke({ width: 3, color: 0xf0a500, alpha: 0.85 });
      // Ghost circle at end
      const end = path[path.length - 1];
      const w = cellToWorld(end.x + 0.5, end.y + 0.5, this.room);
      g.circle(w.x, w.y, this.room.grid_size * 0.4)
        .stroke({ width: 2, color: 0xf0a500, alpha: 0.8 });
      // Cell count
      const cells = path.length - 1; // exclude start
      const ft = cells * this.feetPerCell;
      if (!this.cursorText) {
        this.cursorText = new Text({
          text: '', style: { fontSize: 14, fill: 0xf0a500, fontFamily: 'Inter', fontWeight: '600',
            stroke: { color: 0x000000, width: 3 } },
        });
        this.world.addChild(this.cursorText);
        this.cursorText.zIndex = 11;
      }
      this.cursorText.text = `${ft} ft`;
      this.cursorText.x = w.x + this.room.grid_size * 0.5;
      this.cursorText.y = w.y - this.room.grid_size * 0.5;
      this.cursorText.visible = true;
    } else if (this.cursorText) {
      this.cursorText.visible = false;
    }

    // Align-grid first corner marker + preview square
    if (this.tool === 'align-grid') {
      if (this.draftAlign) {
        g.circle(this.draftAlign.x, this.draftAlign.y, 5).fill({ color: 0xf0a500 });
        const dx = this.pointer.world.x - this.draftAlign.x;
        const dy = this.pointer.world.y - this.draftAlign.y;
        g.rect(this.draftAlign.x, this.draftAlign.y, dx, dy)
          .stroke({ width: 2, color: 0xf0a500, alpha: 0.9 });
      } else {
        g.circle(this.pointer.world.x, this.pointer.world.y, 5)
          .stroke({ width: 2, color: 0xf0a500, alpha: 0.8 });
      }
    }

    // Wall draft second-click preview
    if (this.draftWall && this.pointer.cell) {
      const a = cellToWorld(this.draftWall.x1, this.draftWall.y1, this.room);
      const b = cellToWorld(Math.round(this.pointer.cell.x), Math.round(this.pointer.cell.y), this.room);
      g.moveTo(a.x, a.y).lineTo(b.x, b.y);
      g.stroke({ width: 3, color: this.draftWall.isDoor ? 0xcc8833 : 0xeeeeee, alpha: 0.6 });
    }

    // Tool-specific hover indicator
    if (this.tool === 'add-token' && this.pointer.cell) {
      const c = cellToWorld(Math.floor(this.pointer.cell.x) + 0.5, Math.floor(this.pointer.cell.y) + 0.5, this.room);
      g.circle(c.x, c.y, this.room.grid_size * 0.4)
        .stroke({ width: 2, color: 0xf0a500, alpha: 0.6 });
    }

    // Selected token highlight
    if (this.selectedId) {
      const t = this.tokens.find(t => t.id === this.selectedId);
      if (t) {
        const c = cellToWorld(t.x + 0.5, t.y + 0.5, this.room);
        g.circle(c.x, c.y, this.room.grid_size * 0.5)
          .stroke({ width: 2, color: 0xf0a500, alpha: 0.5 });
      }
    }

    // Initiative: whose turn is it
    if (this.initTokenId) {
      const t = this.tokens.find(t => t.id === this.initTokenId);
      if (t && tokenVisibleToViewer(t, this.visibleSet, this.visYou)) {
        const c = cellToWorld(t.x + 0.5, t.y + 0.5, this.room);
        g.circle(c.x, c.y, this.room.grid_size * 0.56)
          .stroke({ width: 3, color: 0xffffff, alpha: 0.9 });
        g.circle(c.x, c.y, this.room.grid_size * 0.62)
          .stroke({ width: 2, color: 0xf0a500, alpha: 0.9 });
      }
    }
  }

  setInitiativeToken(tokenId) {
    this.initTokenId = tokenId;
    this.drawCursorOverlay();
  }

  shouldShowHp(token) {
    if (this.viewAsYou) return token.owner === this.viewAsYou.name; // faithful player preview
    if (this.role === 'dm') return true;
    return token.owner === this.you?.name || token.owner === this.you?.id;
  }

  // ---- Sync from React/store ----

  setRoom(room) {
    this.room = room;
    this.rebuildMap();
    this.rebuildGrid();
    drawWalls(this.wallLayer, this.walls, this.room);
    if (room && this.tokens.length > 0) this.centerOn(this.tokens[0].x + 0.5, this.tokens[0].y + 0.5);
    else if (room) this.centerOn(room.grid_w / 2, room.grid_h / 2);
  }

  async rebuildMap() {
    this.mapLayer.removeChildren();
    this.mapNatural = null;
    if (!this.room) return;
    if (this.room.map_image_url) {
      try {
        const tex = await Assets.load(this.room.map_image_url);
        const sprite = new Sprite(tex);
        // Maps render at NATIVE resolution; the grid is calibrated to match
        // the map's own printed squares rather than stretching the image.
        sprite.x = 0;
        sprite.y = 0;
        this.mapNatural = { w: tex.width, h: tex.height };
        this.mapLayer.addChild(sprite);
        // Refresh fog so the out-of-grid area is covered for players.
        drawFog(this.fogLayer, this.visibleSet, this.room, this.fogExtent());
        return;
      } catch (e) {
        // fall through to checkerboard
      }
    }
    // Checkerboard placeholder (no map image, or image failed to load)
    const g = new Graphics();
    const { grid_size, grid_w, grid_h, offset_x = 0, offset_y = 0 } = this.room;
    for (let y = 0; y < grid_h; y++) for (let x = 0; x < grid_w; x++) {
      g.rect(offset_x + x * grid_size, offset_y + y * grid_size, grid_size, grid_size);
      g.fill({ color: (x + y) % 2 ? 0x1a1a26 : 0x161620 });
    }
    this.mapLayer.addChild(g);
  }

  fogExtent() {
    if (!this.room) return null;
    const gw = (this.room.offset_x || 0) + this.room.grid_w * this.room.grid_size;
    const gh = (this.room.offset_y || 0) + this.room.grid_h * this.room.grid_size;
    return {
      w: Math.max(gw, this.mapNatural?.w || 0),
      h: Math.max(gh, this.mapNatural?.h || 0),
    };
  }

  rebuildGrid() {
    this.gridLayer.removeChildren();
    if (!this.room) return;
    this.gridLayer.addChild(buildGrid(this.room));
  }

  setRole(role, you) {
    this.role = role;
    this.you = you;
  }

  setTokens(tokens) {
    this.tokens = tokens;
    if (!this.room) return;
    const ids = new Set(tokens.map(t => t.id));
    // Remove deleted
    for (const [id, view] of this.tokenViews) {
      if (!ids.has(id)) { view.destroy(); this.tokenViews.delete(id); }
    }
    // Add/update
    for (const t of tokens) {
      const visible = tokenVisibleToViewer(t, this.visibleSet, this.visYou);
      let v = this.tokenViews.get(t.id);
      if (!v) {
        v = new TokenView(t, this.room);
        this.tokenViews.set(t.id, v);
        this.tokenLayer.addChild(v.container);
      } else {
        v.update(t, this.room);
      }
      v.container.visible = visible;
      v.draw({ selected: this.selectedId === t.id, showHp: this.shouldShowHp(t) });
    }
    this.drawCursorOverlay();
  }

  setWalls(walls) {
    this.walls = walls;
    drawWalls(this.wallLayer, walls, this.room);
  }

  setFog(visibleSet) {
    this.visibleSet = visibleSet;
    drawFog(this.fogLayer, visibleSet, this.room, this.fogExtent());
    // Update token visibility
    for (const [id, v] of this.tokenViews) {
      const t = this.tokens.find(x => x.id === id);
      if (t) v.container.visible = tokenVisibleToViewer(t, visibleSet, this.visYou);
    }
  }

  setViewAs(name) {
    this.viewAsYou = name ? { name } : null;
  }

  setTool(tool, ctx = {}) {
    this.tool = tool;
    this.spell = ctx.spell || null;
    this.draftWall = null;
    this.draftAlign = null;
    this.drawCursorOverlay();
  }

  setSelected(id) {
    this.selectedId = id;
    // redraw token outlines
    for (const [tid, v] of this.tokenViews) {
      const t = this.tokens.find(x => x.id === tid);
      v.draw({ selected: tid === id, showHp: t ? this.shouldShowHp(t) : false });
    }
    this.drawCursorOverlay();
  }

  setProposalGhosts(proposals) {
    this.ghostLayer.removeChildren();
    if (!this.room) return;
    for (const p of proposals) {
      const token = this.tokens.find(t => t.id === p.tokenId);
      if (!token) continue;
      const g = new Graphics();
      // Start cell
      const start = cellToWorld(token.x + 0.5, token.y + 0.5, this.room);
      g.moveTo(start.x, start.y);
      for (const step of p.path) {
        const w = cellToWorld(step.x + 0.5, step.y + 0.5, this.room);
        g.lineTo(w.x, w.y);
      }
      g.stroke({ width: 3, color: 0x5b9bd5, alpha: 0.75 });
      const end = p.path[p.path.length - 1];
      const ec = cellToWorld(end.x + 0.5, end.y + 0.5, this.room);
      g.circle(ec.x, ec.y, this.room.grid_size * 0.4)
        .stroke({ width: 2, color: 0x5b9bd5, alpha: 0.85 });
      this.ghostLayer.addChild(g);
    }
  }

  animateTokenAlong(tokenId, path) {
    if (!path || path.length === 0) return;
    const token = this.tokens.find(t => t.id === tokenId);
    if (!token) return;
    this.animations.set(tokenId, {
      path: [{ x: token.x, y: token.y }, ...path],
      idx: 0,
      progress: 0,
    });
  }

  playEffect(payload) {
    const eff = createEffect(payload.kind, {
      from: payload.from,
      to: payload.to,
      color: payload.color,
    });
    if (!eff) return;
    this.fxLayer.addChild(eff.container);
    this.fx.push(eff);
  }

  tick(dt) {
    // Animate token moves
    for (const [id, anim] of this.animations) {
      const view = this.tokenViews.get(id);
      if (!view) { this.animations.delete(id); continue; }
      anim.progress += dt;
      while (anim.progress >= CELL_ANIM_MS && anim.idx < anim.path.length - 1) {
        anim.progress -= CELL_ANIM_MS;
        anim.idx++;
      }
      if (anim.idx >= anim.path.length - 1) {
        const last = anim.path[anim.path.length - 1];
        view.position({ x: last.x, y: last.y });
        this.animations.delete(id);
        continue;
      }
      const a = anim.path[anim.idx], b = anim.path[anim.idx + 1];
      const f = Math.min(1, anim.progress / CELL_ANIM_MS);
      view.position({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
    }
    // Run FX
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const eff = this.fx[i];
      eff.tick(dt);
      if (eff.done) {
        this.fxLayer.removeChild(eff.container);
        eff.container.destroy?.();
        this.fx.splice(i, 1);
      }
    }
  }

  destroy() {
    try { this.app.destroy(true, { children: true, texture: true }); } catch {}
  }
}

function distToSegment(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}
