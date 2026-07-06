import { io } from 'socket.io-client';

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io({ transports: ['websocket'], autoConnect: true });
  }
  return socket;
}

export function emit(event, payload) {
  return new Promise((resolve, reject) => {
    getSocket().emit(event, payload, (res) => {
      if (!res) resolve({ ok: true });
      else if (res.error) reject(new Error(res.error));
      else resolve(res);
    });
  });
}

export async function createRoom(name) {
  const res = await fetch('/api/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error('Failed to create room');
  return res.json();
}

export async function uploadImage(file) {
  const form = new FormData();
  form.append('image', file);
  const res = await fetch('/api/upload', { method: 'POST', body: form });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || 'Upload failed');
  }
  return res.json();
}
