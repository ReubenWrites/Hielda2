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

export async function uploadImage(file, onProgress) {
  const prepared = await prepareImage(file);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');
    xhr.timeout = 90000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let j = {};
      try { j = JSON.parse(xhr.responseText); } catch {}
      if (xhr.status >= 200 && xhr.status < 300) resolve(j);
      else reject(new Error(j.error || `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error(
      'Upload failed — the server may be waking up or redeploying. Wait a minute and try again.'));
    xhr.ontimeout = () => reject(new Error('Upload timed out — try again (large maps are auto-compressed now)'));
    const form = new FormData();
    form.append('image', prepared);
    xhr.send(form);
  });
}

// Downscale/compress big images in the browser before uploading: a 20MB
// scanned map becomes a few MB of JPEG with no visible difference at VTT zoom.
// Small files and formats that may carry transparency pass through untouched.
async function prepareImage(file) {
  const COMPRESS_OVER_BYTES = 3 * 1024 * 1024;
  const MAX_DIMENSION = 4096;
  if (file.size < COMPRESS_OVER_BYTES) return file;
  if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.87));
    bmp.close?.();
    if (blob && blob.size < file.size) {
      return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
    }
    return file;
  } catch {
    return file; // compression is best-effort; upload the original on any failure
  }
}
