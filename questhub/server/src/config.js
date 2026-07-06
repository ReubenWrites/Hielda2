import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// On Render, mount the disk at /var/data. Locally, use ./data.
const DATA_DIR = process.env.QUESTHUB_DATA_DIR
  || (fs.existsSync('/var/data') ? '/var/data' : path.join(__dirname, '..', 'data'));

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, 'uploads'), { recursive: true });

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  dataDir: DATA_DIR,
  uploadsDir: path.join(DATA_DIR, 'uploads'),
  dbPath: path.join(DATA_DIR, 'questhub.db'),
  clientDist: path.resolve(__dirname, '..', '..', 'client', 'dist'),
  origin: process.env.CLIENT_ORIGIN || '*',
};
