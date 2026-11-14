// Direct first-party requests only. No residential proxy, scraper, or mirror.
const cache = new Map();
const pending = new Map();
const MAX_BYTES = 32 * 1024 * 1024;
let cacheBytes = 0;
export async function atsuRequest(url, fetcher = fetch) {
  const cdn = url.pathname.startsWith('/cdn/');
  const target = new URL((cdn ? 'https://cdn.atsu.moe' : 'https://atsu.moe') + (cdn ? url.pathname.slice(4) : url.pathname));
  target.search = url.search;
  const key = target.href;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return new Response(cached.body.slice(), { headers: cached.headers });
  if (!pending.has(key)) {
    pending.set(key, (async () => {
      const upstream = await fetcher(target, {
        headers: { Accept: cdn ? 'image/avif,image/webp,image/*,*/*' : 'application/json', Referer: 'https://atsu.moe/' },
        signal: AbortSignal.timeout(12000), redirect: 'error'
      });
      if (!upstream.ok) {
        await upstream.body?.cancel();
        return { status: upstream.status, body: JSON.stringify({ error: upstream.status === 403
          ? 'Atsu denied this request. Direct access from this server is unavailable.'
          : `Atsu returned HTTP ${upstream.status}.` }), headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } };
      }
      const body = new Uint8Array(await upstream.arrayBuffer());
      const ttl = cdn ? 86400 : url.pathname.includes('/read/') ? 86400 : 300;
      const headers = { 'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream',
        'Cache-Control': `public, max-age=${ttl}`, 'Access-Control-Allow-Origin': '*' };
      if (body.byteLength <= MAX_BYTES) {
        if (cache.has(key)) { cacheBytes -= cache.get(key).body.byteLength; cache.delete(key); }
        while (cache.size && (cacheBytes + body.byteLength > MAX_BYTES || cache.size >= 500)) {
          const oldest = cache.keys().next().value; cacheBytes -= cache.get(oldest).body.byteLength; cache.delete(oldest);
        }
        cache.set(key, { body, headers, expires: Date.now() + ttl * 1000 }); cacheBytes += body.byteLength;
      }
      return { body, headers, status: 200 };
    })().catch(() => ({ status: 502, body: JSON.stringify({ error: 'Cannot reach Atsu. Check network access or try again later.' }),
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })));
  }
  const job = pending.get(key);
  try { const result = await job; return new Response(result.body instanceof Uint8Array ? result.body.slice() : result.body, result); }
  finally { if (pending.get(key) === job) pending.delete(key); }
}
