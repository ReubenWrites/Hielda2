import express from 'express';
import cors from 'cors';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { Server as SocketServer } from 'socket.io';
import { config } from './config.js';
import { getDb } from './db.js';
import { createRoom, getRoom } from './rooms.js';
import { upload, uploadUrl } from './uploads.js';
import { attachSockets } from './sockets.js';

export function createApp() {
  // Touch the DB so migrations run before anything else.
  getDb();

  const app = express();
  app.use(cors({ origin: config.origin === '*' ? true : config.origin, credentials: true }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true, version: '0.1.0' }));

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

  app.post('/api/upload', upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    res.json({ url: uploadUrl(req.file.filename), filename: req.file.filename });
  });

  app.use('/uploads', express.static(config.uploadsDir, { fallthrough: false, maxAge: '7d' }));

  if (fs.existsSync(config.clientDist)) {
    app.use(express.static(config.clientDist));
    app.get(/^(?!\/api|\/uploads|\/socket\.io).*/, (_req, res) => {
      res.sendFile(path.join(config.clientDist, 'index.html'));
    });
  }

  const server = http.createServer(app);
  const io = new SocketServer(server, {
    cors: { origin: config.origin === '*' ? true : config.origin, credentials: true },
  });
  attachSockets(io);

  return { app, server, io };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { server } = createApp();
  server.listen(config.port, () => {
    console.log(`[questhub] listening on http://localhost:${config.port}`);
  });
}
