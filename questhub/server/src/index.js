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
  createRoom, getRoom, getSceneState, verifyDm, listScenes, listCharacters,
  replaceRoomContents,
} from './rooms.js';
import { upload, uploadUrl, uploadPath } from './uploads.js';
import { attachSockets, resyncRoom } from './sockets.js';

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

  app.get('/api/health', (_req, res) => res.json({ ok: true, version: '0.3.0' }));

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
  // Everything a campaign needs (every scene's map, the library and the cast,
  // images embedded as data URLs) so free-tier hosting with ephemeral disks
  // can restore a prepared campaign in one click.

  app.get('/api/rooms/:id/export', (req, res) => {
    const { id } = req.params;
    if (!verifyDm(id, req.query.secret)) return res.status(403).json({ error: 'Invalid DM secret' });
    const room = getRoom(id);
    let budget = EXPORT_BUDGET_BYTES;
    let skipped = 0;
    const embed = (url) => {
      const dataUrl = fileToDataUrl(url);
      if (!dataUrl) return null;
      if (dataUrl.length > budget) { skipped++; return null; }
      budget -= dataUrl.length;
      return dataUrl;
    };
    // Library assets embed once; scenes reference their map by asset index
    // when it came from the library, or embed it directly otherwise.
    const scenesList = listScenes(id);
    const assetsState = getSceneState(id, scenesList[0].id).assets;
    const assets = assetsState.map(({ id: _i, roomId: _r, url, ...a }) => ({ ...a, dataUrl: embed(url), url }))
      .filter(a => a.dataUrl);
    const scenes = scenesList.map(s => {
      const st = getSceneState(id, s.id);
      const viaAsset = assets.findIndex(a => a.url === st.room.map_image_url);
      return {
        name: s.name,
        grid_size: st.room.grid_size, grid_w: st.room.grid_w, grid_h: st.room.grid_h,
        offset_x: st.room.offset_x, offset_y: st.room.offset_y,
        feet_per_cell: st.room.feet_per_cell, grid_type: st.room.grid_type,
        mapAssetIndex: viaAsset >= 0 ? viaAsset : null,
        mapImageDataUrl: viaAsset >= 0 ? null : embed(st.room.map_image_url),
        walls: st.walls.map(({ id: _i, roomId: _r, sceneId: _s, ...w }) => w),
        tokens: st.tokens.map(({ roomId: _r, sceneId: _s, ...t }) => t),
      };
    });
    const out = {
      version: 2,
      kind: 'questhub-quest',
      name: room.name,
      dmSceneIndex: Math.max(0, scenesList.findIndex(s => s.id === room.dm_scene_id)),
      scenes,
      characters: listCharacters(id).map(({ roomId: _r, ...c }) => c),
      assets: assets.map(({ url: _u, ...a }) => a),
      skippedAssets: skipped,
    };
    res.setHeader('Content-Disposition',
      `attachment; filename="${(room.name || 'quest').replace(/[^\w -]/g, '')}.questhub.json"`);
    res.json(out);
  });

  app.post('/api/rooms/:id/import', (req, res) => {
    const { id } = req.params;
    const { secret, data } = req.body || {};
    if (!verifyDm(id, secret)) return res.status(403).json({ error: 'Invalid DM secret' });
    if (!data || data.kind !== 'questhub-quest' || ![1, 2].includes(data.version)) {
      return res.status(400).json({ error: 'Not a QuestHub quest file' });
    }
    try {
      // v1 files held a single map; wrap it as one scene.
      const quest = data.version === 1 ? {
        scenes: [{
          name: 'Scene 1', ...(data.grid || {}), mapImageDataUrl: data.mapImageDataUrl,
          walls: data.walls || [], tokens: data.tokens || [],
        }],
        characters: [],
        assets: data.assets || [],
      } : data;

      const assets = (quest.assets || []).map(a => ({
        kind: a.kind, name: a.name, grid: a.grid || null, url: dataUrlToFile(a.dataUrl),
      })).filter(a => a.url);
      const scenes = (quest.scenes || []).map(s => ({
        name: s.name,
        grid_size: s.grid_size ?? 64, grid_w: s.grid_w ?? 30, grid_h: s.grid_h ?? 20,
        offset_x: s.offset_x ?? 0, offset_y: s.offset_y ?? 0,
        feet_per_cell: s.feet_per_cell ?? 5, grid_type: s.grid_type === 'free' ? 'free' : 'square',
        map_image_url: (s.mapAssetIndex != null && assets[s.mapAssetIndex])
          ? assets[s.mapAssetIndex].url
          : dataUrlToFile(s.mapImageDataUrl),
        walls: s.walls || [],
        tokens: (s.tokens || []).map(t => ({
          ...t,
          // Art from a previous server life is dead unless embedded.
          imageUrl: t.imageUrl?.startsWith('data:') ? t.imageUrl : null,
        })),
      }));
      const characters = (quest.characters || []).map(c => ({
        ...c, imageUrl: c.imageUrl?.startsWith('data:') ? c.imageUrl : null,
      }));
      replaceRoomContents(id, { scenes, characters, assets });
      // Honour the saved "which scene was the DM on".
      const list = listScenes(id);
      const dmIdx = Math.min(list.length - 1, Math.max(0, quest.dmSceneIndex ?? 0));
      getDb().prepare('UPDATE rooms SET dm_scene_id = ? WHERE id = ?').run(list[dmIdx].id, id);
      resyncRoom(io, id);
      res.json({ ok: true, scenes: list.length });
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
