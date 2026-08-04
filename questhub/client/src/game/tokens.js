import { Container, Graphics, Text, Assets, Sprite } from 'pixi.js';
import { cellToWorld } from './grid.js';

export class TokenView {
  constructor(token, room) {
    this.token = token;
    this.room = room;
    this.container = new Container();
    this.container.eventMode = 'static';
    this.container.cursor = 'pointer';
    this.body = new Graphics();
    this.label = new Text({
      text: token.name,
      style: { fontFamily: 'Inter', fontSize: 12, fill: 0xffffff, stroke: { color: 0x000000, width: 3 } },
    });
    this.label.anchor.set(0.5, 0);
    this.container.addChild(this.body);
    this.container.addChild(this.label);
    this.sprite = null;
    this.draw();
    this.position();
    if (token.imageUrl) this.loadImage(token.imageUrl);
  }

  async loadImage(url) {
    try {
      const tex = await Assets.load(url);
      if (this.sprite) this.container.removeChild(this.sprite);
      this.sprite = new Sprite(tex);
      const s = this.room.grid_size * 0.86;
      this.sprite.width = s; this.sprite.height = s;
      this.sprite.anchor.set(0.5);
      this.container.addChildAt(this.sprite, 0);
      this.position();
    } catch (e) {
      // Fallback to colored circle
    }
  }

  draw({ selected = false, ghost = false, showHp = false } = {}) {
    const g = this.body;
    g.clear();
    const r = this.room.grid_size * 0.4;
    const color = parseInt((this.token.color || '#5b9bd5').replace('#', ''), 16);
    if (!this.sprite) {
      g.circle(0, 0, r).fill({ color, alpha: ghost ? 0.45 : 1 });
    }
    g.circle(0, 0, r).stroke({
      width: selected ? 3 : 2,
      color: selected ? 0xf0a500 : (ghost ? 0xaaaaaa : 0xffffff),
      alpha: ghost ? 0.6 : 1,
    });
    // HP bar above the token (DM always; players only on their own tokens)
    if (showHp && this.token.maxHp > 0 && this.token.hp != null) {
      const w = this.room.grid_size * 0.8;
      const h = 5;
      const y = -this.room.grid_size * 0.55;
      const frac = Math.max(0, Math.min(1, this.token.hp / this.token.maxHp));
      g.rect(-w / 2, y, w, h).fill({ color: 0x511414, alpha: 0.9 });
      if (frac > 0) {
        g.rect(-w / 2, y, w * frac, h)
          .fill({ color: frac > 0.5 ? 0x58c267 : (frac > 0.25 ? 0xf0a500 : 0xd2453a), alpha: 1 });
      }
      g.rect(-w / 2, y, w, h).stroke({ width: 1, color: 0x000000, alpha: 0.7 });
    }
    this.container.alpha = ghost ? 0.55 : 1;
  }

  position(cellOverride) {
    const c = cellOverride ?? { x: this.token.x, y: this.token.y };
    const w = cellToWorld(c.x + 0.5, c.y + 0.5, this.room);
    this.container.x = w.x;
    this.container.y = w.y;
    this.label.x = 0;
    this.label.y = this.room.grid_size * 0.42;
  }

  update(nextToken, room) {
    this.token = nextToken;
    this.room = room;
    if (nextToken.imageUrl && (!this.sprite || this.sprite?.texture?.label !== nextToken.imageUrl)) {
      this.loadImage(nextToken.imageUrl);
    }
    this.label.text = nextToken.name;
    this.draw();
    this.position();
  }

  destroy() {
    this.container.destroy({ children: true });
  }
}
