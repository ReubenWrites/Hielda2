import { Graphics } from 'pixi.js';

// Lightweight spell/attack effect library. Each effect is a function that
// returns an object { container, tick(dt), done } where `tick` is called each
// frame with delta-time in ms, and `done` flips true when the animation has finished.

export const EFFECTS = {
  fireball: { label: 'Fireball', emoji: '🔥', color: 0xff5a1f },
  missile:  { label: 'Magic Missile', emoji: '✨', color: 0xaa66ff },
  slash:    { label: 'Slash', emoji: '⚔️', color: 0xffffff },
  heal:     { label: 'Heal', emoji: '✚', color: 0x66dd88 },
  lightning:{ label: 'Lightning', emoji: '⚡', color: 0xfff05a },
};

export function createEffect(kind, { from, to, color }) {
  const c = color ?? EFFECTS[kind]?.color ?? 0xffffff;
  switch (kind) {
    case 'fireball': return fireball(from, to, c);
    case 'missile':  return missile(from, to, c);
    case 'slash':    return slash(to, c);
    case 'heal':     return heal(to, c);
    case 'lightning':return lightning(from, to, c);
    default: return null;
  }
}

function fireball(_from, to, color) {
  const g = new Graphics();
  let age = 0;
  const dur = 700; // ms
  const maxR = 90;
  return {
    container: g,
    tick(dt) {
      age += dt;
      const t = Math.min(1, age / dur);
      const r = maxR * easeOut(t);
      g.clear();
      g.circle(to.x, to.y, r * 0.55).fill({ color: 0xffe7a3, alpha: (1 - t) * 0.9 });
      g.circle(to.x, to.y, r).fill({ color, alpha: (1 - t) * 0.6 });
      g.circle(to.x, to.y, r).stroke({ width: 3, color, alpha: 1 - t });
      this.done = age >= dur;
    },
    done: false,
  };
}

function missile(from, to, color) {
  const g = new Graphics();
  let age = 0;
  const dur = 600;
  const dx = to.x - from.x, dy = to.y - from.y;
  // Three streaks with slight perpendicular offsets
  const perp = { x: -dy, y: dx };
  const plen = Math.hypot(perp.x, perp.y) || 1;
  perp.x /= plen; perp.y /= plen;
  const lanes = [-12, 0, 12];
  return {
    container: g,
    tick(dt) {
      age += dt;
      const t = Math.min(1, age / dur);
      g.clear();
      for (const off of lanes) {
        const ox = perp.x * off, oy = perp.y * off;
        const headX = from.x + dx * t + ox;
        const headY = from.y + dy * t + oy;
        const tailX = from.x + dx * Math.max(0, t - 0.2) + ox;
        const tailY = from.y + dy * Math.max(0, t - 0.2) + oy;
        g.moveTo(tailX, tailY).lineTo(headX, headY).stroke({ width: 4, color, alpha: 1 });
        g.circle(headX, headY, 5).fill({ color: 0xffffff, alpha: 1 - t });
      }
      this.done = age >= dur;
    },
    done: false,
  };
}

function slash(to, color) {
  const g = new Graphics();
  let age = 0;
  const dur = 350;
  return {
    container: g,
    tick(dt) {
      age += dt;
      const t = Math.min(1, age / dur);
      g.clear();
      const r = 30 + t * 12;
      const startAng = -Math.PI / 4;
      const endAng = startAng + Math.PI * 1.1 * t;
      g.moveTo(to.x + Math.cos(startAng) * r, to.y + Math.sin(startAng) * r);
      for (let i = 1; i <= 24; i++) {
        const a = startAng + (endAng - startAng) * (i / 24);
        g.lineTo(to.x + Math.cos(a) * r, to.y + Math.sin(a) * r);
      }
      g.stroke({ width: 4, color, alpha: 1 - t * 0.7 });
      this.done = age >= dur;
    },
    done: false,
  };
}

function heal(to, color) {
  const g = new Graphics();
  let age = 0;
  const dur = 900;
  const sparkles = Array.from({ length: 14 }, () => ({
    a: Math.random() * Math.PI * 2,
    r: 8 + Math.random() * 18,
    phase: Math.random() * 0.4,
  }));
  return {
    container: g,
    tick(dt) {
      age += dt;
      const t = Math.min(1, age / dur);
      g.clear();
      for (const s of sparkles) {
        const lt = Math.max(0, Math.min(1, t - s.phase));
        const yOff = -40 * lt;
        const x = to.x + Math.cos(s.a) * s.r;
        const y = to.y + Math.sin(s.a) * s.r * 0.5 + yOff;
        g.circle(x, y, 4 - 3 * lt).fill({ color, alpha: 1 - lt });
      }
      this.done = age >= dur;
    },
    done: false,
  };
}

function lightning(from, to, color) {
  const g = new Graphics();
  let age = 0;
  const dur = 450;
  const segs = makeBoltSegments(from, to, 6);
  return {
    container: g,
    tick(dt) {
      age += dt;
      const t = Math.min(1, age / dur);
      g.clear();
      g.moveTo(segs[0].x, segs[0].y);
      for (let i = 1; i < segs.length; i++) g.lineTo(segs[i].x, segs[i].y);
      g.stroke({ width: 5 * (1 - t), color: 0xffffff, alpha: 1 - t });
      g.moveTo(segs[0].x, segs[0].y);
      for (let i = 1; i < segs.length; i++) g.lineTo(segs[i].x, segs[i].y);
      g.stroke({ width: 2 * (1 - t * 0.5), color, alpha: 1 - t * 0.8 });
      this.done = age >= dur;
    },
    done: false,
  };
}

function makeBoltSegments(from, to, n) {
  const segs = [{ x: from.x, y: from.y }];
  const dx = to.x - from.x, dy = to.y - from.y;
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const jitter = 20;
    segs.push({
      x: from.x + dx * t + (Math.random() - 0.5) * jitter,
      y: from.y + dy * t + (Math.random() - 0.5) * jitter,
    });
  }
  segs.push({ x: to.x, y: to.y });
  return segs;
}

function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
