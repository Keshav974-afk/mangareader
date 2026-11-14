// Vercel Serverless Function Proxy for Voidflix Manga (runs on AWS Lambda - not blocked by Cloudflare)
import https from 'node:https';
import { URL } from 'node:url';

const ATSU_API_BASE = 'https://atsu.moe';
const ATSU_CDN_BASE = 'https://cdn.atsu.moe';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = reqUrl.pathname;

  // Healthcheck
  if (pathname === '/api/health' || pathname === '/api/health/') {
    return res.status(200).json({ status: 'ok', runtime: 'vercel-lambda' });
  }

  // Determine target URL
  let targetUrl;
  let isCdn = false;

  if (pathname.startsWith('/cdn/')) {
    isCdn = true;
    const cleanPath = pathname.replace(/^\/cdn/, '');
    targetUrl = `${ATSU_CDN_BASE}${cleanPath}${reqUrl.search || ''}`;
  } else {
    targetUrl = `${ATSU_API_BASE}${pathname}${reqUrl.search || ''}`;
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
    'Referer': ATSU_API_BASE,
    'Accept': isCdn
      ? 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      : 'application/json, text/plain, */*'
  };

  return new Promise((resolve) => {
    const proxyReq = https.request(targetUrl, {
      method: req.method,
      headers
    }, (proxyRes) => {
      // Follow redirect if 301/302
      if ((proxyRes.statusCode === 301 || proxyRes.statusCode === 302) && proxyRes.headers.location) {
        const redirect = proxyRes.headers.location;
        const newTarget = redirect.startsWith('http') ? redirect : `${isCdn ? ATSU_CDN_BASE : ATSU_API_BASE}${redirect}`;
        https.get(newTarget, { headers }, (redRes) => {
          res.writeHead(redRes.statusCode || 200, {
            'Content-Type': redRes.headers['content-type'] || (isCdn ? 'image/jpeg' : 'application/json'),
            'Access-Control-Allow-Origin': '*'
          });
          redRes.pipe(res);
          redRes.on('end', resolve);
        }).on('error', () => {
          res.status(502).json({ error: 'Redirect failed' });
          resolve();
        });
        return;
      }

      res.writeHead(proxyRes.statusCode || 200, {
        'Content-Type': proxyRes.headers['content-type'] || (isCdn ? 'image/jpeg' : 'application/json'),
        'Cache-Control': isCdn ? 'public, max-age=604800, immutable' : 'public, max-age=120',
        'Access-Control-Allow-Origin': '*'
      });

      proxyRes.pipe(res);
      proxyRes.on('end', resolve);
    });

    proxyReq.on('error', (err) => {
      res.status(502).json({ error: 'Proxy request failed: ' + err.message });
      resolve();
    });

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      req.pipe(proxyReq);
    } else {
      proxyReq.end();
    }
  });
}
