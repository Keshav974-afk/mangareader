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

// Dedicated US Residential Proxy Configuration (gate-us.vaultproxies.com:80)
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

// Fast zero-dependency deterministic hash for query strings
function getQueryHash(search) {
  if (!search) return 'default';
  let hash = 5381;
  for (let i = 0; i < search.length; i++) {
    hash = ((hash << 5) + hash) + search.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// Smart Tiered Cache Policies:
// 1. FOREVER: Published chapter content (Chapter 321 pages/text NEVER change once published)
// 2. TEMPORARY: 
//    - Series metadata: 1 hour TTL
//    - Chapter lists: 2 hours TTL (so newly released chapters appear automatically)
//    - Homepage trending/popular: 30 mins TTL
//    - Homepage hot updates: 15 mins TTL
//    - Homepage recently updated: 10 mins TTL
//    - Search results: 30 mins TTL
function getCachePolicy(pathname, query) {
  const queryStr = query ? (query.startsWith('?') ? query : `?${query}`) : '';
  const clean = pathname.replace(/^\/api\//, '').replace(/^\//, '');

  // A. FOREVER CACHE (Immutable chapter content)
  if (clean === 'read/chapter') {
    const p = new URLSearchParams(queryStr);
    const m = p.get('mangaId');
    const c = p.get('chapterId');
    if (m && c) {
      return { type: 'FOREVER', key: `read/chapter/${m}_${c}.json`, maxAge: 31536000, ttlMs: Infinity };
    }
  }

  if (clean === 'read/novelChapter') {
    const p = new URLSearchParams(queryStr);
    const m = p.get('mangaId');
    const c = p.get('chapterId');
    if (m && c) {
      return { type: 'FOREVER', key: `read/novelChapter/${m}_${c}.json`, maxAge: 31536000, ttlMs: Infinity };
    }
  }

  // B. TEMPORARY CACHE: Chapters list & Series metadata
  if (clean === 'manga/allChapters') {
    const mangaId = new URLSearchParams(queryStr).get('mangaId');
    if (mangaId) {
      return { type: 'TEMPORARY', key: `manga/allChapters/${mangaId}.json`, maxAge: 7200, ttlMs: 2 * 60 * 60 * 1000 };
    }
  }

  if (clean === 'manga/page') {
    const id = new URLSearchParams(queryStr).get('id');
    if (id) {
      return { type: 'TEMPORARY', key: `manga/page/${id}.json`, maxAge: 3600, ttlMs: 60 * 60 * 1000 };
    }
  }

  // C. TEMPORARY CACHE: Homepage Trending, Popular & Updates
  if (clean === 'home2/popular') {
    const p = new URLSearchParams(queryStr);
    const tf = p.get('timeframe') || 'daily';
    const off = p.get('offset') || '0';
    const lim = p.get('limit') || '24';
    const med = (p.get('mediums') || 'all').replace(/[^a-zA-Z0-9]/g, '_');
    return {
      type: 'TEMPORARY',
      key: `home2/popular/${tf}_${off}_${lim}_${med}.json`,
      maxAge: 1800,
      ttlMs: 30 * 60 * 1000
    };
  }

  if (clean === 'home2/hotUpdates') {
    const p = new URLSearchParams(queryStr);
    const off = p.get('offset') || '0';
    const lim = p.get('limit') || '24';
    return {
      type: 'TEMPORARY',
      key: `home2/hotUpdates/${off}_${lim}.json`,
      maxAge: 900,
      ttlMs: 15 * 60 * 1000
    };
  }

  if (clean === 'home2/recentlyUpdated') {
    const p = new URLSearchParams(queryStr);
    const off = p.get('offset') || '0';
    const lim = p.get('limit') || '24';
    return {
      type: 'TEMPORARY',
      key: `home2/recentlyUpdated/${off}_${lim}.json`,
      maxAge: 600,
      ttlMs: 10 * 60 * 1000
    };
  }

  if (clean.startsWith('home2/') || clean.startsWith('home/')) {
    const sub = clean.replace(/^home2?\//, '').replace(/[^a-zA-Z0-9_-]/g, '_');
    const hash = getQueryHash(queryStr);
    return {
      type: 'TEMPORARY',
      key: `home2/${sub}_${hash}.json`,
      maxAge: 1200,
      ttlMs: 20 * 60 * 1000
    };
  }

  // D. TEMPORARY CACHE: Search
  if (clean === 'search/manga' || clean.startsWith('search/')) {
    const p = new URLSearchParams(queryStr);
    const q = (p.get('q') || '').toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 32);
    const page = p.get('page') || '1';
    const med = (p.get('filter_by') || '').includes('Novel') ? 'novel' : ((p.get('filter_by') || '').includes('Comic') ? 'comic' : 'all');
    return {
      type: 'TEMPORARY',
      key: `search/${q || 'empty'}_${med}_p${page}.json`,
      maxAge: 1800,
      ttlMs: 30 * 60 * 1000
    };
  }

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
      return callback(new Error(`Residential Proxy CONNECT failed with status: ${res.statusCode}`));
    }
    const secureSocket = tls.connect({
      host: options.host,
      socket: socket,
      servername: options.servername || options.host
    }, () => {
      callback(null, secureSocket);
    });
    secureSocket.on('error', err => callback(err));
  });

  req.on('error', err => callback(err));
  req.end();
};

// In-memory cache for API responses (fast L1 RAM cache)
const apiCache = new Map();
const CACHE_TTL_MS = 60 * 1000;

function getCached(key) {
  const item = apiCache.get(key);
  if (!item) return null;
  if (Date.now() - item.time > CACHE_TTL_MS) {
    apiCache.delete(key);
    return null;
  }
  return item;
}

function setCache(key, data) {
  if (apiCache.size > 1000) {
    const firstKey = apiCache.keys().next().value;
    apiCache.delete(firstKey);
  }
  apiCache.set(key, { time: Date.now(), data });
}

// Proxy API requests to https://atsu.moe exclusively via residential proxy
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
    res.end(JSON.stringify({ status: 'ok', proxy: 'voidflix-manga-proxy', version: '3.0-residential-proxy', time: new Date().toISOString() }));
    return;
  }

  const query = parsedUrl.search || '';
  const fullUrl = `${ATSU_API_BASE}${targetPath}${query}`;
  const cacheKey = req.method + ':' + fullUrl;
  const policy = getCachePolicy(targetPath, query);

  function executeProxy(retryCount = 0) {
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
        const isBlock = proxyRes.statusCode === 403 || proxyRes.statusCode === 401;

        if (isBlock && retryCount < 2 && req.method === 'GET') {
          console.log(`[Proxy] Upstream status ${proxyRes.statusCode} for ${targetPath}. Retrying via residential proxy (attempt ${retryCount + 1})...`);
          setTimeout(() => executeProxy(retryCount + 1), 500);
          return;
        }

        const contentType = proxyRes.headers['content-type'] || 'application/json';
        res.writeHead(proxyRes.statusCode || 500, {
          'Content-Type': contentType,
          'Cache-Control': policy.type === 'FOREVER' ? 'public, max-age=31536000, immutable' : `public, max-age=${policy.maxAge}`,
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
      if (retryCount < 2 && req.method === 'GET') {
        console.log(`[Proxy] Network error via vaultproxies for ${targetPath}, retrying...`);
        setTimeout(() => executeProxy(retryCount + 1), 500);
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

// Proxy CDN image requests using the residential proxy with R2 permanent poster storage and Photon fallback
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
  const cleanKey = targetPath.replace(/^\//, '');
  const isPoster = cleanKey.includes('posters/') ||
                   cleanKey.includes('covers/') ||
                   cleanKey.includes('banners/') ||
                   cleanKey.includes('manga/');

  // 1. Check R2 Cache first for posters and covers
  if (isPoster) {
    https.get(`${R2_PUBLIC_BASE}/${cleanKey}`, (r2Res) => {
      if (r2Res.statusCode === 200) {
        res.writeHead(200, {
          'Content-Type': r2Res.headers['content-type'] || 'image/avif',
          'Cache-Control': 'public, max-age=31536000, immutable',
          'X-Cache': 'R2-POSTER-FOREVER-HIT',
          'Access-Control-Allow-Origin': '*'
        });
        r2Res.pipe(res);
        return;
      }
      fetchFromProxy();
    }).on('error', () => fetchFromProxy());
    return;
  }

  fetchFromProxy();

  function fetchFromProxy() {
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
        fetchFromPhoton();
        return;
      }

      let chunks = [];
      proxyRes.on('data', c => chunks.push(c));
      proxyRes.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const contentType = proxyRes.headers['content-type'] || 'image/avif';
        res.writeHead(200, {
          'Content-Type': contentType,
          'Cache-Control': isPoster ? 'public, max-age=31536000, immutable' : 'public, max-age=604800, immutable',
          'X-Cache': 'PROXY-FETCH',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(buffer);
        if (isPoster) uploadToR2(cleanKey, buffer, contentType);
      });
    });

    proxyReq.on('error', () => fetchFromPhoton());
    proxyReq.end();
  }

  function fetchFromPhoton() {
    const photonUrl = `https://i0.wp.com/cdn.atsu.moe${targetPath}${query}`;
    https.get(photonUrl, (photonRes) => {
      if (photonRes.statusCode === 200) {
        let chunks = [];
        photonRes.on('data', c => chunks.push(c));
        photonRes.on('end', () => {
          const buffer = Buffer.concat(chunks);
          const contentType = photonRes.headers['content-type'] || 'image/jpeg';
          res.writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': isPoster ? 'public, max-age=31536000, immutable' : 'public, max-age=604800, immutable',
            'X-Cache': 'PHOTON-EDGE',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(buffer);
          if (isPoster) uploadToR2(cleanKey, buffer, contentType);
        });
        return;
      }
      res.writeHead(302, { 'Location': photonUrl });
      res.end();
    }).on('error', () => {
      res.writeHead(302, { 'Location': photonUrl });
      res.end();
    });
  }
}

const STATIC_DIR = fs.existsSync(path.join(__dirname, 'dist')) ? path.join(__dirname, 'dist') : __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  if (pathname.startsWith('/api/')) {
    handleApiProxy(req, res, pathname, parsedUrl);
    return;
  }

  if (pathname.startsWith('/cdn/')) {
    const targetPath = pathname.replace(/^\/cdn/, '');
    handleCdnProxy(req, res, targetPath, parsedUrl);
    return;
  }

  // Static file serving for SPA
  let filePath = path.join(STATIC_DIR, pathname);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  if (!fs.existsSync(filePath)) {
    filePath = path.join(STATIC_DIR, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('500 Internal Server Error');
      return;
    }

    const headers = { 'Content-Type': contentType };
    if (ext === '.html') {
      headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    } else {
      headers['Cache-Control'] = 'public, max-age=31536000, immutable';
    }

    res.writeHead(200, headers);
    res.end(content);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Voidflix Proxy] Server running on port ${PORT}`);
  console.log(`[Voidflix Proxy] Dedicated Residential Proxy: ${PROXY_CONFIG.host}:${PROXY_CONFIG.port}`);
  console.log(`[Voidflix Proxy] Scrapfly completely disabled; 100% residential proxy & Cloudflare R2 cache`);
});
