// Cloudflare Pages Function: Proxy & Smart Tiered R2 Persistent Cache for Atsu.moe API
const R2_PUBLIC_BASE = 'https://pub-2916bfced0d845f088ad2b3e71104031.r2.dev';
const RAILWAY_PROXY_BASE = 'https://mangareader-production-b77c3f15.up.railway.app';

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
// 1. FOREVER: Published chapter content (Chapter 321 pages/text NEVER change once released)
// 2. TEMPORARY: 
//    - Series metadata: 1 hour TTL
//    - Chapter lists: 2 hours TTL (so newly released chapters appear automatically)
//    - Homepage trending/popular: 30 mins TTL
//    - Homepage hot updates: 15 mins TTL
//    - Homepage recently updated: 10 mins TTL
//    - Search results: 30 mins TTL
function getCachePolicy(pathname, search) {
  const queryStr = search ? (search.startsWith('?') ? search : `?${search}`) : '';
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

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Healthcheck endpoint
  if (url.pathname === '/api/health' || url.pathname === '/api/health/') {
    return new Response(JSON.stringify({ status: 'ok', service: 'voidflix-manga-proxy', r2Cache: true, proxy: 'residential' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const policy = getCachePolicy(url.pathname, url.search);

  // 1. Check R2 Cache first according to policy (Native Binding or Public R2 URL)
  if (policy.key && request.method === 'GET') {
    // Check native Cloudflare Pages R2 binding (if bound in dashboard)
    if (context.env?.R2_CACHE) {
      try {
        const obj = await context.env.R2_CACHE.get(policy.key);
        if (obj) {
          const age = Date.now() - (obj.uploaded ? obj.uploaded.getTime() : 0);
          if (policy.type === 'FOREVER' || age < policy.ttlMs) {
            return new Response(obj.body, {
              status: 200,
              headers: {
                'Content-Type': 'application/json',
                'Cache-Control': policy.type === 'FOREVER' ? 'public, max-age=31536000, immutable' : `public, max-age=${Math.max(60, Math.floor((policy.ttlMs - age) / 1000))}`,
                'X-Cache': `R2-${policy.type}-HIT`,
                ...corsHeaders
              }
            });
          }
        }
      } catch (e) {}
    }

    // Check public R2 URL
    try {
      const pubRes = await fetch(`${R2_PUBLIC_BASE}/${policy.key}`);
      if (pubRes.ok) {
        const lastMod = pubRes.headers.get('last-modified');
        const age = lastMod ? Date.now() - new Date(lastMod).getTime() : 0;
        if (policy.type === 'FOREVER' || age < policy.ttlMs) {
          const bodyText = await pubRes.text();
          return new Response(bodyText, {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': policy.type === 'FOREVER' ? 'public, max-age=31536000, immutable' : `public, max-age=${Math.max(60, Math.floor((policy.ttlMs - age) / 1000))}`,
              'X-Cache': `R2-PUBLIC-${policy.type}-HIT`,
              ...corsHeaders
            }
          });
        }
      }
    } catch (e) {}
  }

  function saveToR2(content) {
    if (policy.key && context.env?.R2_CACHE && request.method === 'GET' && content) {
      context.waitUntil(
        context.env.R2_CACHE.put(policy.key, content, {
          httpMetadata: {
            contentType: 'application/json',
            cacheControl: policy.type === 'FOREVER' ? 'public, max-age=31536000, immutable' : `public, max-age=${policy.maxAge}`
          },
          customMetadata: {
            cachedAt: String(Date.now()),
            policy: policy.type
          }
        })
      );
    }
  }

  // Target URL on atsu.moe
  const targetUrl = new URL(`https://atsu.moe${url.pathname}${url.search}`);

  // Clean, realistic browser headers
  const headers = new Headers();
  headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36');
  headers.set('Accept', 'application/json, text/plain, */*');
  headers.set('Accept-Language', 'en-US,en;q=0.9');
  headers.set('Referer', 'https://atsu.moe/');
  headers.set('Origin', 'https://atsu.moe');
  headers.set('Sec-Ch-Ua', '"Chromium";v="133", "Google Chrome";v="133", "Not?A_Brand";v="99"');
  headers.set('Sec-Ch-Ua-Mobile', '?0');
  headers.set('Sec-Ch-Ua-Platform', '"Windows"');
  headers.set('Sec-Fetch-Dest', 'empty');
  headers.set('Sec-Fetch-Mode', 'cors');
  headers.set('Sec-Fetch-Site', 'same-origin');

  try {
    let res = await fetch(targetUrl.toString(), {
      method: request.method,
      headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
    });

    // If Cloudflare WAF blocks the Cloudflare Pages IP (403), fallback directly to the Railway residential proxy
    if ((res.status === 403 || res.status === 401) && request.method === 'GET') {
      const cleanPath = url.pathname.replace(/^\/api/, '');
      const proxyUrl = `${RAILWAY_PROXY_BASE}/api${cleanPath}${url.search}`;
      const proxyRes = await fetch(proxyUrl);
      if (proxyRes.ok) {
        const content = await proxyRes.text();
        saveToR2(content);
        return new Response(content, {
          status: proxyRes.status,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': policy.type === 'FOREVER' ? 'public, max-age=31536000, immutable' : `public, max-age=${policy.maxAge}`,
            'X-Proxy-Provider': 'vaultproxies-residential',
            ...corsHeaders
          }
        });
      }
    }

    if (res.ok && request.method === 'GET') {
      const bodyText = await res.text();
      saveToR2(bodyText);

      return new Response(bodyText, {
        status: res.status,
        headers: {
          'Content-Type': res.headers.get('content-type') || 'application/json',
          'Cache-Control': policy.type === 'FOREVER' ? 'public, max-age=31536000, immutable' : `public, max-age=${policy.maxAge}`,
          'X-Cache': 'ORIGIN-FETCH',
          ...corsHeaders
        }
      });
    }

    // Return upstream response as-is
    const responseHeaders = new Headers(res.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: responseHeaders,
    });
  } catch (err) {
    // If direct fetch errors out, attempt residential proxy via Railway
    try {
      const cleanPath = url.pathname.replace(/^\/api/, '');
      const proxyUrl = `${RAILWAY_PROXY_BASE}/api${cleanPath}${url.search}`;
      const proxyRes = await fetch(proxyUrl);
      if (proxyRes.ok) {
        const content = await proxyRes.text();
        saveToR2(content);
        return new Response(content, {
          status: proxyRes.status,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': policy.type === 'FOREVER' ? 'public, max-age=31536000, immutable' : `public, max-age=${policy.maxAge}`,
            'X-Proxy-Provider': 'vaultproxies-residential',
            ...corsHeaders
          }
        });
      }
    } catch (proxyErr) {}

    return new Response(
      JSON.stringify({ error: 'Proxy request failed', details: err.message }),
      { status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}
