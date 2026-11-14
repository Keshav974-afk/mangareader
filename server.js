import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { atsuRequest } from './lib/atsu.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS' }); return res.end(); }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD, OPTIONS' }); return res.end(); }
    if (url.pathname === '/api/health') { res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); return res.end(JSON.stringify({ status: 'ok', upstream: 'direct-atsu' })); }
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/cdn/')) {
      const response = await atsuRequest(url);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      return res.end(req.method === 'HEAD' ? undefined : Buffer.from(await response.arrayBuffer()));
    }
    let file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403); return res.end(); }
    try { if ((await fs.stat(file)).isDirectory()) file = path.join(file, 'index.html'); }
    catch { if (path.extname(file)) { res.writeHead(404); return res.end(); } file = path.join(root, 'index.html'); }
    const body = await fs.readFile(file);
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': file.includes(path.sep + 'assets' + path.sep) ? 'public, max-age=31536000, immutable' : 'no-cache' });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch { if (!res.headersSent) res.writeHead(500); res.end('Unable to serve request'); }
}).listen(process.env.PORT || 3300, '0.0.0.0', () => console.log('Voidflix server ready; direct Atsu access enabled'));
