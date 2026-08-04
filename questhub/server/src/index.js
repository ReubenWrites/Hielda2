import express from 'express';
import cors from 'cors';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { nanoid } from 'nanoid';
import { Server as SocketServer } from 'socket.io';
import { config } from './config.js';
import { getDb } from './db.js';
import {
  createRoom, getRoom, getRoomState, verifyDm,
  updateRoomMap, replaceRoomContents,
} from './rooms.js';
import { upload, uploadUrl, uploadPath } from './uploads.js';
import { attachSockets } from './sockets.js';

const MIME_BY_EXT = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
};
const EXT_BY_MIME = Object.fromEntries(Object.entries(MIME_BY_EXT).map(([e, m]) => [m, e]));
// Keep quest export files under Express's JSON body limit with headroom.
const EXPORT_BUDGET_BYTES = 24 * 1024 * 1024;

export function createApp() {
  // Touch the DB so migrations run before anything else.
  getDb();

  const app = express();
  app.use(cors({ origin: config.origin === '*' ? true : config.origin, credentials: true }));
  // Large limit: quest import files embed map images as data URLs.
  app.use(express.json({ limit: '30mb' }));

  const server = http.createServer(app);
  const io = new SocketServer(server, {
    cors: { origin: config.origin === '*' ? true : config.origin, credentials: true },
  });
  attachSockets(io);

  app.get('/api/health', (_req, res) => res.json({ ok: true, version: '0.2.0' }));

  app.post('/api/rooms', (req, res) => {
    const { name } = req.body || {};
    const { id, dmSecret } = createRoom({ name });
    res.json({ id, dmSecret });
  });

  app.get('/api/rooms/:id', (req, res) => {
    const room = getRoom(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    const { dm_secret, ...publicRoom } = room;
    res.json({ room: publicRoom });
  });

  app.post('/api/upload', (req, res) => {
    upload.single('image')(req, res, (err) => {
      if (err) {
        const msg = err.code === 'LIMIT_FILE_SIZE'
          ? 'Image too large (max 40MB) — export a smaller version'
          : err.message;
        return res.status(400).json({ error: msg });
      }
      if (!req.file) return res.status(400).json({ error: 'No file received' });
      res.json({ url: uploadUrl(req.file.filename), filename: req.file.filename });
    });
  });

  // ---- Quest save/load ----
  // Everything a session needs (map image and assets embedded as data URLs)
  // so free-tier hosting with ephemeral disks can restore a prepared scene.

  app.get('/api/rooms/:id/export', (req, res) => {
    const { id } = req.params;
    if (!verifyDm(id, req.query.secret)) return res.status(403).json({ error: 'Invalid DM secret' });
    const state = getRoomState(id);
    let budget = EXPORT_BUDGET_BYTES;
    let skipped = 0;
    const embed = (url) => {
      const dataUrl = fileToDataUrl(url);
      if (!dataUrl) return null;
      if (dataUrl.length > budget) { skipped++; return null; }
      budget -= dataUrl.length;
      return dataUrl;
    };
    const out = {
      version: 1,
      kind: 'questhub-quest',
      name: state.room.name,
      grid: {
        grid_size: state.room.grid_size,
        grid_w: state.room.grid_w,
        grid_h: state.room.grid_h,
        offset_x: state.room.offset_x,
        offset_y: state.room.offset_y,
        feet_per_cell: state.room.feet_per_cell,
        grid_type: state.room.grid_type,
      },
      mapImageDataUrl: embed(state.room.map_image_url),
      walls: state.walls.map(({ id: _i, roomId: _r, ...w }) => w),
      tokens: state.tokens.map(({ id: _i, roomId: _r, ...t }) => t),
      assets: state.assets.map(({ id: _i, roomId: _r, url, ...a }) => ({
        ...a,
        dataUrl: embed(url),
      })).filter(a => a.dataUrl),
      skippedAssets: skipped,
    };
    res.setHeader('Content-Disposition',
      `attachment; filename="${(state.room.name || 'quest').replace(/[^\w -]/g, '')}.questhub.json"`);
    res.json(out);
  });

  app.post('/api/rooms/:id/import', (req, res) => {
    const { id } = req.params;
    const { secret, data } = req.body || {};
    if (!verifyDm(id, secret)) return res.status(403).json({ error: 'Invalid DM secret' });
    if (!data || data.kind !== 'questhub-quest' || data.version !== 1) {
      return res.status(400).json({ error: 'Not a QuestHub quest file' });
    }
    try {
      const mapUrl = dataUrlToFile(data.mapImageDataUrl);
      updateRoomMap(id, {
        map_image_url: mapUrl,
        grid_size: data.grid?.grid_size ?? 64,
        grid_w: data.grid?.grid_w ?? 30,
        grid_h: data.grid?.grid_h ?? 20,
        offset_x: data.grid?.offset_x ?? 0,
        offset_y: data.grid?.offset_y ?? 0,
        feet_per_cell: data.grid?.feet_per_cell ?? 5,
        grid_type: data.grid?.grid_type === 'free' ? 'free' : 'square',
      });
      const assets = (data.assets || []).map(a => ({
        kind: a.kind, name: a.name, url: dataUrlToFile(a.dataUrl),
      })).filter(a => a.url);
      replaceRoomContents(id, {
        walls: data.walls || [],
        tokens: (data.tokens || []).map(t => ({
          ...t,
          // Uploaded token art from a previous server life is embedded per-asset,
          // not per-token; drop dead /uploads references.
          imageUrl: t.imageUrl?.startsWith('data:') ? t.imageUrl : null,
        })),
        assets,
      });
      const state = getRoomState(id);
      io.to(id).emit('room:resync', state);
      res.json({ ok: true });
    } catch (e) {
      res.status(400).json({ error: `Import failed: ${e.message}` });
    }
  });

  app.use('/uploads', express.static(config.uploadsDir, { fallthrough: false, maxAge: '7d' }));

  if (fs.existsSync(config.clientDist)) {
    app.use(express.static(config.clientDist));
    app.get(/^(?!\/api|\/uploads|\/socket\.io).*/, (_req, res) => {
      res.sendFile(path.join(config.clientDist, 'index.html'));
    });
  }

  return { app, server, io };
}

function fileToDataUrl(url) {
  if (!url || !url.startsWith('/uploads/')) return url?.startsWith('data:') ? url : null;
  try {
    const name = url.slice('/uploads/'.length);
    const p = uploadPath(name);
    const ext = path.extname(p).toLowerCase();
    const mime = MIME_BY_EXT[ext] || 'application/octet-stream';
    const buf = fs.readFileSync(p);
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

function dataUrlToFile(dataUrl) {
  if (!dataUrl || !dataUrl.startsWith('data:')) return null;
  const m = /^data:([^;,]+);base64,(.+)$/s.exec(dataUrl);
  if (!m) return null;
  const ext = EXT_BY_MIME[m[1]] || '.png';
  const name = `${nanoid(16)}${ext}`;
  fs.writeFileSync(uploadPath(name), Buffer.from(m[2], 'base64'));
  return uploadUrl(name);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { server } = createApp();
  server.listen(config.port, () => {
    console.log(`[questhub] listening on http://localhost:${config.port}`);
  });
}
