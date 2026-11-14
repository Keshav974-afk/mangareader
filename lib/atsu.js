// Shared Atsu transport, caching, and error handling. Fetcher selects direct or proxy access.
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
      const signal = AbortSignal.timeout(12000);
      let destination = target;
      let upstream;
      for (let redirects = 0; ; redirects++) {
        upstream = await fetcher(destination, {
          headers: { Accept: cdn ? 'image/avif,image/webp,image/*,*/*' : 'application/json', Referer: 'https://atsu.moe/' },
          signal, redirect: 'manual'
        });
        if (![301, 302, 303, 307, 308].includes(upstream.status)) break;
        const location = upstream.headers.get('location');
        await upstream.body?.cancel();
        const next = location ? new URL(location, destination) : null;
        if (redirects >= 3 || !next || next.protocol !== 'https:' || !['atsu.moe', 'cdn.atsu.moe', 'www.atsu.moe'].includes(next.hostname) || next.username || next.password || next.port) {
          throw Object.assign(new Error('Unsupported Atsu redirect'), { code: 'UPSTREAM_REDIRECT' });
        }
        destination = next;
      }
      if (!upstream.ok) {
        await upstream.body?.cancel();
        return { status: upstream.status, body: JSON.stringify({ error: upstream.status === 403
          ? 'Atsu denied this request. Check the proxy relay configuration.'
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
    })().catch(error => {
      const cause = error.cause?.code || error.code || error.name || 'UNKNOWN';
      const code = String(cause).startsWith('PROXY_') ? cause : ['EAI_AGAIN', 'ENOTFOUND'].includes(cause) ? 'UPSTREAM_DNS'
        : error.name === 'TimeoutError' || cause === 'UND_ERR_CONNECT_TIMEOUT' ? 'UPSTREAM_TIMEOUT'
        : cause === 'UPSTREAM_REDIRECT' ? cause : 'UPSTREAM_CONNECTION';
      console.error('[Atsu]', target.hostname, code, cause);
      const errorMessage = code === 'PROXY_AUTH_MISSING' ? 'PROXY_AUTH is missing from this deployment. Set the secret in the matching Production or Preview environment and redeploy.'
        : code === 'PROXY_PORT_INVALID' ? 'PROXY_PORT must contain only a port number, such as 80.'
        : code === 'PROXY_CONFIG' ? 'Configure PROXY_AUTH, PROXY_HOST and PROXY_PORT in Cloudflare Pages settings.'
        : code === 'PROXY_AUTH' ? 'The proxy rejected its credentials. Update PROXY_AUTH in deployment settings.'
        : code === 'PROXY_CONNECT' ? 'The proxy refused a connection to Atsu.'
        : code === 'PROXY_PROTOCOL' ? 'The proxy returned an incomplete or unsupported response.'
        : code === 'UPSTREAM_DNS' ? 'The server cannot resolve Atsu. Check outbound DNS access.'
        : code === 'UPSTREAM_TIMEOUT' ? 'Atsu did not respond in time. Try again later.'
        : code === 'UPSTREAM_REDIRECT' ? 'Atsu returned an unsupported redirect.'
        : 'Cannot reach Atsu from this server. Check deployment logs and outbound access.';
      return { status: 502, body: JSON.stringify({ error: errorMessage, code }),
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } };
    }));
  }
  const job = pending.get(key);
  try { const result = await job; return new Response(result.body instanceof Uint8Array ? result.body.slice() : result.body, result); }
  finally { if (pending.get(key) === job) pending.delete(key); }
}
