import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { nanoid } from 'nanoid';
import { config } from './config.js';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, config.uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 8) || '';
    const safeExt = /^\.(png|jpe?g|webp|gif|svg)$/i.test(ext) ? ext : '';
    cb(null, `${nanoid(16)}${safeExt}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 40 * 1024 * 1024 }, // 40MB — client compresses first; this is a backstop
  fileFilter: (_req, file, cb) => {
    if (/^image\/(png|jpe?g|webp|gif|svg\+xml)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image uploads are allowed'));
  },
});

export function uploadUrl(filename) {
  return `/uploads/${filename}`;
}

export function uploadPath(filename) {
  return path.join(config.uploadsDir, filename);
}

export function deleteUpload(urlOrName) {
  if (!urlOrName) return;
  const name = urlOrName.startsWith('/uploads/') ? urlOrName.slice('/uploads/'.length) : urlOrName;
  const p = uploadPath(name);
  fs.rm(p, { force: true }, () => {});
}
