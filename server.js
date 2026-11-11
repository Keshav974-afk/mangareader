// Zero-dependency Node.js server and API proxy for Atsu Reader
import http from 'node:http';
import https from 'node:https';
import tls from 'node:tls';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3300;
const ATSU_API_BASE = 'https://atsu.moe';
const ATSU_CDN_BASE = 'https://cdn.atsu.moe';
const R2_PUBLIC_BASE = 'https://pub-2916bfced0d845f088ad2b3e71104031.r2.dev';

// Dedicated Residential Proxy Configuration
const PROXY_CONFIG = {
  host: process.env.PROXY_HOST || 'gate-us.vaultproxies.com',
  port: parseInt(process.env.PROXY_PORT || '80', 10),
  auth: process.env.PROXY_AUTH || '4c6169f09d00279c:62f360c1eb4c9da0'
};

// Cloudflare R2 S3 Upload Configuration
const R2_CONFIG = {
  accountId: process.env.R2_ACCOUNT_ID || '226feb5957e769bc4cb99556d587d909',
  bucket: process.env.R2_BUCKET || 'manga',
  accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || ''
};

// Smart Tiered Cache Policies:
// 1. FOREVER: Published chapter content (Chapter 321 pages/text NEVER change once published)
// 2. TEMPORARY: Series info (1 hour) & Chapter lists (2 hours, so new chapters appear as released)
// 3. NO_R2: Home feeds, search results (RAM only, 10 min TTL)
function getCachePolicy(pathname, query) {
  const clean = pathname.replace(/^\/api\//, '').replace(/^\//, '');

  // A. FOREVER CACHE (Immutable chapter content)
  if (clean === 'read/chapter') {
    const p = new URLSearchParams(query);
    const m = p.get('mangaId');
    const c = p.get('chapterId');
    if (m && c) {
      return { type: 'FOREVER', key: `read/chapter/${m}_${c}.json`, maxAge: 31536000, ttlMs: Infinity };
    }
  }

  if (clean === 'read/novelChapter') {
    const p = new URLSearchParams(query);
    const m = p.get('mangaId');
    const c = p.get('chapterId');
    if (m && c) {
      return { type: 'FOREVER', key: `read/novelChapter/${m}_${c}.json`, maxAge: 31536000, ttlMs: Infinity };
    }
  }

  // B. TEMPORARY CACHE (Series metadata & chapters list)
  if (clean === 'manga/allChapters') {
    const mangaId = new URLSearchParams(query).get('mangaId');
    if (mangaId) {
      // 2 hours TTL so newly released chapters show up
      return { type: 'TEMPORARY', key: `manga/allChapters/${mangaId}.json`, maxAge: 7200, ttlMs: 2 * 60 * 60 * 1000 };
    }
  }

  if (clean === 'manga/page') {
    const id = new URLSearchParams(query).get('id');
    if (id) {
      // 1 hour TTL
      return { type: 'TEMPORARY', key: `manga/page/${id}.json`, maxAge: 3600, ttlMs: 60 * 60 * 1000 };
    }
  }

  // C. NO R2 (Home feeds, search - ephemeral)
  return { type: 'NO_R2', key: null, maxAge: 600, ttlMs: 10 * 60 * 1000 };
}

// Upload buffer/string to Cloudflare R2 bucket using AWS Signature V4
function uploadToR2(key, body, contentType = 'application/json') {
  if (!R2_CONFIG.accessKeyId || !R2_CONFIG.secretAccessKey) return;

  try {
    const host = `${R2_CONFIG.accountId}.r2.cloudflarestorage.com`;
    const endpoint = `/${R2_CONFIG.bucket}/${key}`;
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const region = 'auto';
    const service = 's3';

    const payloadHash = crypto.createHash('sha256').update(body).digest('hex');
    const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';

    const canonicalRequest = `PUT\n${endpoint}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${crypto.createHash('sha256').update(canonicalRequest).digest('hex')}`;

    function hmac(k, v) { return crypto.createHmac('sha256', k).update(v).digest(); }
    const kDate = hmac(`AWS4${R2_CONFIG.secretAccessKey}`, dateStamp);
    const kRegion = hmac(kDate, region);
    const kService = hmac(kRegion, service);
    const kSigning = hmac(kService, 'aws4_request');
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

    const authHeader = `${algorithm} Credential=${R2_CONFIG.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const r2Req = https.request({
      host,
      path: endpoint,
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        'Host': host,
        'x-amz-date': amzDate,
        'x-amz-content-sha256': payloadHash,
        'Authorization': authHeader,
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log(`[R2] Successfully stored forever: ${key}`);
      } else {
        console.warn(`[R2] Upload status ${res.statusCode} for ${key}`);
      }
    });

    r2Req.on('error', err => console.warn(`[R2] Upload error:`, err.message));
    r2Req.write(body);
    r2Req.end();
  } catch (err) {
    console.warn(`[R2] SigV4 error:`, err.message);
  }
}

// Create custom HTTPS agent that tunnels via the residential proxy
const proxyAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 100,
  timeout: 30000
});

proxyAgent.createConnection = function (options, callback) {
  const req = http.request({
    host: PROXY_CONFIG.host,
    port: PROXY_CONFIG.port,
    method: 'CONNECT',
    path: `${options.host}:${options.port || 443}`,
    headers: {
      'Proxy-Authorization': 'Basic ' + Buffer.from(PROXY_CONFIG.auth).toString('base64'),
      'Host': `${options.host}:${options.port || 443}`
    }
  });

  req.on('connect', (res, socket) => {
    if (res.statusCode !== 200) {
      socket.destroy();
      callback(new Error(`Proxy CONNECT failed with status: ${res.statusCode}`));
      return;
    }
    const tlsSocket = tls.connect({
      host: options.host,
      socket: socket,
      servername: options.servername || options.host
    }, () => callback(null, tlsSocket));
    tlsSocket.on('error', err => callback(err));
  });

  req.on('error', err => callback(err));
  req.end();
};

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

// In-memory cache for queries (TTL 10 minutes)
const apiCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;
const SCRAPFLY_KEY = process.env.SCRAPFLY_KEY || 'scp-live-96e7f740c2b84816bbf8475dff519328';

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
  if (apiCache.size > 1000) {
    const firstKey = apiCache.keys().next().value;
    apiCache.delete(firstKey);
  }
  apiCache.set(key, { time: Date.now(), data });
}

function fetchViaScrapfly(targetUrl, cb) {
  const scrapflyUrl = `https://api.scrapfly.io/scrape?key=${SCRAPFLY_KEY}&url=${encodeURIComponent(targetUrl)}&unblocker=true`;
  https.get(scrapflyUrl, (sfRes) => {
    let raw = '';
    sfRes.on('data', c => raw += c);
    sfRes.on('end', () => {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.result && parsed.result.content) {
          cb(null, parsed.result.status_code || 200, parsed.result.content, parsed.result.content_type || 'application/json');
          return;
        }
        cb(new Error(parsed.message || 'Scrapfly empty response'));
      } catch (e) {
        cb(e);
      }
    });
  }).on('error', err => cb(err));
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
    res.end(JSON.stringify({ status: 'ok', proxy: 'voidflix-manga-proxy', version: '2.0-scrapfly', time: new Date().toISOString() }));
    return;
  }

  const query = parsedUrl.search || '';
  const fullUrl = `${ATSU_API_BASE}${targetPath}${query}`;
  const cacheKey = req.method + ':' + fullUrl;
  const policy = getCachePolicy(targetPath, query);

  function executeProxy() {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
      'Referer': ATSU_API_BASE + '/',
      'Accept': 'application/json'
    };

    const proxyReq = https.request(fullUrl, {
      method: req.method,
      headers,
      agent: proxyAgent
    }, (proxyRes) => {
      let chunks = [];
      proxyRes.on('data', chunk => chunks.push(chunk));
      proxyRes.on('end', () => {
        const responseBuffer = Buffer.concat(chunks);
        const isBlock = proxyRes.statusCode === 403 || proxyRes.statusCode === 401 || (responseBuffer.length > 0 && responseBuffer.slice(0, 100).toString().includes('<!DOCTYPE html>'));

        if (isBlock && req.method === 'GET') {
          console.log(`[Proxy] Upstream blocked (status ${proxyRes.statusCode}) for ${targetPath}. Retrying via Scrapfly Unblocker...`);
          fetchViaScrapfly(fullUrl, (err, sfStatus, sfContent, sfContentType) => {
            if (err) {
              console.error('[Proxy] Scrapfly fallback failed:', err.message);
              res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
              res.end(JSON.stringify({ error: 'Proxy request failed: ' + err.message }));
              return;
            }
            res.writeHead(sfStatus, {
              'Content-Type': sfContentType,
              'Access-Control-Allow-Origin': '*',
              'X-Proxy-Provider': 'scrapfly'
            });
            res.end(sfContent);
            if (sfStatus === 200) {
              setCache(cacheKey, sfContent);
              if (policy.key) uploadToR2(policy.key, sfContent, sfContentType);
            }
          });
          return;
        }

        // Normal direct response (status 200, etc.)
        const contentType = proxyRes.headers['content-type'] || 'application/json';
        res.writeHead(proxyRes.statusCode || 500, {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
          'X-Proxy-Provider': 'vaultproxies'
        });
        res.end(responseBuffer);
        if (proxyRes.statusCode === 200 && req.method === 'GET' && responseBuffer.length > 0) {
          const str = responseBuffer.toString('utf-8');
          setCache(cacheKey, str);
          if (policy.key) uploadToR2(policy.key, str, contentType);
        }
      });
    });

    proxyReq.on('error', (err) => {
      // On network error, try Scrapfly as fallback
      if (req.method === 'GET') {
        console.log(`[Proxy] Network error via vaultproxies for ${targetPath}, trying Scrapfly...`);
        fetchViaScrapfly(fullUrl, (sfErr, sfStatus, sfContent, sfContentType) => {
          if (!sfErr && sfContent) {
            res.writeHead(sfStatus, {
              'Content-Type': sfContentType,
              'Access-Control-Allow-Origin': '*',
              'X-Proxy-Provider': 'scrapfly'
            });
            res.end(sfContent);
            if (sfStatus === 200) {
              setCache(cacheKey, sfContent);
              if (policy.key) uploadToR2(policy.key, sfContent, sfContentType);
            }
            return;
          }
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Proxy request failed: ' + err.message }));
        });
        return;
      }
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Proxy request failed: ' + err.message }));
    });

    req.pipe(proxyReq);
  }

  // 1. In-memory RAM Cache check
  if (req.method === 'GET') {
    const cached = getCached(cacheKey);
    if (cached) {
      const age = Date.now() - cached.time;
      if (policy.type === 'FOREVER' || age < policy.ttlMs) {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'X-Cache': `RAM-${policy.type}-HIT`,
          'Access-Control-Allow-Origin': '*'
        });
        res.end(cached.data);
        return;
      }
    }

    // 2. Cloudflare R2 Persistent Storage check
    if (policy.key) {
      https.get(`${R2_PUBLIC_BASE}/${policy.key}`, (r2Res) => {
        if (r2Res.statusCode === 200) {
          const lastMod = r2Res.headers['last-modified'];
          const age = lastMod ? Date.now() - new Date(lastMod).getTime() : 0;
          if (policy.type === 'FOREVER' || age < policy.ttlMs) {
            let r2Data = '';
            r2Res.on('data', c => r2Data += c);
            r2Res.on('end', () => {
              setCache(cacheKey, r2Data);
              res.writeHead(200, {
                'Content-Type': 'application/json',
                'X-Cache': `R2-${policy.type}-HIT`,
                'Access-Control-Allow-Origin': '*'
              });
              res.end(r2Data);
            });
            return;
          }
        }
        executeProxy();
      }).on('error', () => executeProxy());
      return;
    }
  }

  executeProxy();
}

// Proxy CDN image requests using the residential proxy with Photon fallback
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
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
    'Referer': 'https://atsu.moe/',
    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
  };

  const proxyReq = https.request(fullUrl, {
    method: 'GET',
    headers,
    agent: proxyAgent
  }, (proxyRes) => {
    // Follow redirect if 301/302
    if ((proxyRes.statusCode === 301 || proxyRes.statusCode === 302) && proxyRes.headers.location) {
      const loc = proxyRes.headers.location;
      const redirectPath = loc.startsWith('http') ? new URL(loc).pathname : loc;
      handleCdnProxy(req, res, redirectPath, parsedUrl);
      return;
    }

    if (proxyRes.statusCode !== 200) {
      // Fallback to WordPress Photon edge
      const photonUrl = `https://i0.wp.com/cdn.atsu.moe${targetPath}${query}`;
      res.writeHead(302, { 'Location': photonUrl });
      res.end();
      return;
    }

    res.writeHead(200, {
      'Content-Type': proxyRes.headers['content-type'] || 'image/jpeg',
      'Cache-Control': 'public, max-age=604800, immutable',
      'Access-Control-Allow-Origin': '*'
    });
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    const photonUrl = `https://i0.wp.com/cdn.atsu.moe${targetPath}${query}`;
    res.writeHead(302, { 'Location': photonUrl });
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
