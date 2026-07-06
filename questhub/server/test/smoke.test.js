import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { io as ioClient } from 'socket.io-client';
import { createApp } from '../src/index.js';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

let server, baseUrl;

beforeAll(async () => {
  // Isolated data dir per run
  process.env.QUESTHUB_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'questhub-test-'));
  const app = createApp();
  server = app.server;
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  baseUrl = `http://localhost:${port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

async function call(method, p, body) {
  const res = await fetch(`${baseUrl}${p}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${p} -> ${res.status}`);
  return res.json();
}

function connect() {
  return ioClient(baseUrl, { transports: ['websocket'], forceNew: true });
}

function once(socket, event) {
  return new Promise((resolve) => socket.once(event, resolve));
}

function emitAck(socket, event, payload) {
  return new Promise((resolve) => socket.emit(event, payload, resolve));
}

describe('REST API', () => {
  test('health check', async () => {
    const r = await call('GET', '/api/health');
    expect(r.ok).toBe(true);
  });

  test('create + fetch room', async () => {
    const created = await call('POST', '/api/rooms', { name: 'Goblin Cave' });
    expect(created.id).toMatch(/^[A-Z0-9]{6}$/);
    expect(typeof created.dmSecret).toBe('string');
    const fetched = await call('GET', `/api/rooms/${created.id}`);
    expect(fetched.room.name).toBe('Goblin Cave');
    expect(fetched.room.dm_secret).toBeUndefined();
  });
});

describe('socket flow', () => {
  test('DM joins, creates token, player sees it', async () => {
    const { id: roomId, dmSecret } = await call('POST', '/api/rooms', { name: 'Test Room' });

    const dm = connect();
    await once(dm, 'connect');
    const dmJoin = await emitAck(dm, 'room:join', {
      roomId, name: 'GM', asDm: true, dmSecret,
    });
    expect(dmJoin.ok).toBe(true);
    expect(dmJoin.role).toBe('dm');

    const player = connect();
    await once(player, 'connect');
    const playerJoin = await emitAck(player, 'room:join', {
      roomId, name: 'Aragorn',
    });
    expect(playerJoin.ok).toBe(true);
    expect(playerJoin.role).toBe('player');

    const tokenCreatedOnPlayer = once(player, 'token:created');
    const dmCreate = await emitAck(dm, 'token:create', {
      name: 'Goblin', x: 5, y: 5, color: '#f00',
    });
    expect(dmCreate.ok).toBe(true);

    const received = await tokenCreatedOnPlayer;
    expect(received.name).toBe('Goblin');
    expect(received.x).toBe(5);

    dm.close();
    player.close();
  });

  test('player cannot create tokens', async () => {
    const { id: roomId } = await call('POST', '/api/rooms', { name: 'No-DM Test' });
    const player = connect();
    await once(player, 'connect');
    await emitAck(player, 'room:join', { roomId, name: 'Bilbo' });
    const result = await emitAck(player, 'token:create', { name: 'Cheater' });
    expect(result.error).toMatch(/DM only/i);
    player.close();
  });

  test('move proposal: player proposes, DM approves', async () => {
    const { id: roomId, dmSecret } = await call('POST', '/api/rooms', { name: 'Move Test' });

    const dm = connect();
    await once(dm, 'connect');
    await emitAck(dm, 'room:join', { roomId, name: 'GM', asDm: true, dmSecret });

    const player = connect();
    await once(player, 'connect');
    const pj = await emitAck(player, 'room:join', { roomId, name: 'Frodo' });
    const playerSocketId = pj.you.id;

    // DM creates a token owned by the player
    const tCreate = await emitAck(dm, 'token:create', {
      name: 'Frodo', owner: playerSocketId, x: 0, y: 0,
    });
    const tokenId = tCreate.token.id;

    // Player proposes move
    const proposedOnDm = once(dm, 'move:proposed');
    const proposeRes = await emitAck(player, 'move:propose', {
      tokenId, path: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }],
    });
    expect(proposeRes.ok).toBe(true);
    const proposal = await proposedOnDm;
    expect(proposal.path.length).toBe(3);

    // DM approves with interrupt at index 1
    const approvedOnPlayer = once(player, 'move:approved');
    const approveRes = await emitAck(dm, 'move:approve', {
      proposalId: proposal.id, stopAtIndex: 1,
    });
    expect(approveRes.ok).toBe(true);
    const approved = await approvedOnPlayer;
    expect(approved.path.length).toBe(2); // truncated
    expect(approved.interrupted).toBe(true);

    dm.close();
    player.close();
  });

  test('chat /r rolls dice', async () => {
    const { id: roomId, dmSecret } = await call('POST', '/api/rooms', { name: 'Dice Test' });

    const dm = connect();
    await once(dm, 'connect');
    await emitAck(dm, 'room:join', { roomId, name: 'GM', asDm: true, dmSecret });

    const player = connect();
    await once(player, 'connect');
    await emitAck(player, 'room:join', { roomId, name: 'P' });

    const seen = once(player, 'chat:message');
    await emitAck(dm, 'chat:send', { text: '/r 1d20+3' });
    const msg = await seen;
    expect(msg.type).toBe('roll');
    expect(msg.roll.total).toBeGreaterThanOrEqual(4);
    expect(msg.roll.total).toBeLessThanOrEqual(23);

    dm.close();
    player.close();
  });
});
