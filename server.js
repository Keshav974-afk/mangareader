// Zero-dependency Node.js server and API proxy for Atsu Reader
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3300;
const ATSU_API_BASE = 'https://atsu.moe';
const ATSU_CDN_BASE = 'https://cdn.atsu.moe';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// In-memory cache for home/popular queries (TTL 5 minutes)
const apiCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCached(key) {
  const item = apiCache.get(key);
  if (!item) return null;
  if (Date.now() - item.time > CACHE_TTL_MS) {
    apiCache.delete(key);
    return null;
  }
  return item.data;
}

function setCache(key, data) {
  if (apiCache.size > 200) {
    const firstKey = apiCache.keys().next().value;
    apiCache.delete(firstKey);
  }
  apiCache.set(key, { time: Date.now(), data });
}

// Proxy API requests to https://atsu.moe
function handleApiProxy(req, res, targetPath, parsedUrl) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Healthcheck
  if (targetPath === '/api/health' || targetPath === '/api/health/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', proxy: 'voidflix-manga-proxy', time: new Date().toISOString() }));
    return;
  }

  const query = parsedUrl.search || '';
  const fullUrl = `${ATSU_API_BASE}${targetPath}${query}`;
  const cacheKey = req.method + ':' + fullUrl;

  // Use cached response if available for GET home/popular requests
  if (req.method === 'GET' && (targetPath.includes('/home2/') || targetPath.includes('/search/manga'))) {
    const cached = getCached(cacheKey);
    if (cached) {
      res.writeHead(200, { 'Content-Type': 'application/json', 'X-Cache': 'HIT' });
      res.end(cached);
      return;
    }
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Referer': ATSU_API_BASE,
    'Accept': 'application/json'
  };

  const proxyReq = https.request(fullUrl, {
    method: req.method,
    headers
  }, (proxyRes) => {
    let responseData = '';
    const contentType = proxyRes.headers['content-type'] || 'application/json';

    res.writeHead(proxyRes.statusCode || 500, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*'
    });

    proxyRes.on('data', chunk => {
      responseData += chunk;
      res.write(chunk);
    });

    proxyRes.on('end', () => {
      res.end();
      if (proxyRes.statusCode === 200 && req.method === 'GET' && responseData.length > 0) {
        setCache(cacheKey, responseData);
      }
    });
  });

  proxyReq.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Proxy request failed: ' + err.message }));
  });

  req.pipe(proxyReq);
}

// Proxy CDN image requests to bypass Cloudflare anti-hotlinking
function handleCdnProxy(req, res, targetPath, parsedUrl) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const query = parsedUrl.search || '';
  const fullUrl = `${ATSU_CDN_BASE}${targetPath}${query}`;

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Referer': ATSU_API_BASE,
    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
  };

  const proxyReq = https.request(fullUrl, {
    method: 'GET',
    headers
  }, (proxyRes) => {
    // Follow redirect if 301/302
    if ((proxyRes.statusCode === 301 || proxyRes.statusCode === 302) && proxyRes.headers.location) {
      const loc = proxyRes.headers.location;
      const redirectPath = loc.startsWith('http') ? new URL(loc).pathname : loc;
      handleCdnProxy(req, res, redirectPath, parsedUrl);
      return;
    }

    res.writeHead(proxyRes.statusCode || 500, {
      'Content-Type': proxyRes.headers['content-type'] || 'image/jpeg',
      'Cache-Control': 'public, max-age=604800, immutable',
      'Access-Control-Allow-Origin': '*'
    });
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error('CDN proxy error for', fullUrl, err.message);
    res.writeHead(404);
    res.end();
  });

  proxyReq.end();
}

const STATIC_DIR = fs.existsSync(path.join(__dirname, 'dist')) ? path.join(__dirname, 'dist') : __dirname;

// Static file server
function serveStatic(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // SPA fallback: return index.html for unknown routes
        fs.readFile(path.join(STATIC_DIR, 'index.html'), (err2, indexContent) => {
          if (err2) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(indexContent);
          }
        });
      } else {
        res.writeHead(500);
        res.end('Server Error: ' + err.code);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // 1. API proxy route
  if (pathname.startsWith('/api/')) {
    handleApiProxy(req, res, pathname, parsedUrl);
    return;
  }

  // 2. CDN proxy route
  if (pathname.startsWith('/cdn/')) {
    handleCdnProxy(req, res, pathname.replace(/^\/cdn/, ''), parsedUrl);
    return;
  }

  // 3. Static files
  let safePath = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '\\') safePath = '/index.html';
  const filePath = path.join(STATIC_DIR, safePath);

  serveStatic(res, filePath);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`===============================================`);
  console.log(`  Voidflix Manga Server running on port ${PORT}`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`  API proxying -> ${ATSU_API_BASE}`);
  console.log(`  CDN proxying -> ${ATSU_CDN_BASE}`);
  console.log(`===============================================`);
});
