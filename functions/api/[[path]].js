// Cloudflare Pages Function: Proxy & Smart Tiered R2 Persistent Cache for Atsu.moe API
const R2_PUBLIC_BASE = 'https://pub-2916bfced0d845f088ad2b3e71104031.r2.dev';

// Smart Tiered Cache Policies:
// 1. FOREVER: Published chapter pages & text (never changes once published, e.g. Ch 321)
// 2. TEMPORARY: Series info (1 hour) & Chapter lists (2 hours, so newly dropped chapters appear)
// 3. NO_R2: Home feeds, search results (RAM only, 10 min TTL)
function getCachePolicy(pathname, search) {
  const clean = pathname.replace(/^\/api\//, '').replace(/^\//, '');

  // A. FOREVER CACHE (Immutable chapter content)
  if (clean === 'read/chapter') {
    const p = new URLSearchParams(search);
    const m = p.get('mangaId');
    const c = p.get('chapterId');
    if (m && c) {
      return { type: 'FOREVER', key: `read/chapter/${m}_${c}.json`, maxAge: 31536000, ttlMs: Infinity };
    }
  }

  if (clean === 'read/novelChapter') {
    const p = new URLSearchParams(search);
    const m = p.get('mangaId');
    const c = p.get('chapterId');
    if (m && c) {
      return { type: 'FOREVER', key: `read/novelChapter/${m}_${c}.json`, maxAge: 31536000, ttlMs: Infinity };
    }
  }

  // B. TEMPORARY CACHE (Series metadata & chapters list)
  if (clean === 'manga/allChapters') {
    const mangaId = new URLSearchParams(search).get('mangaId');
    if (mangaId) {
      // 2 hours TTL so new chapters released by scanlators show up
      return { type: 'TEMPORARY', key: `manga/allChapters/${mangaId}.json`, maxAge: 7200, ttlMs: 2 * 60 * 60 * 1000 };
    }
  }

  if (clean === 'manga/page') {
    const id = new URLSearchParams(search).get('id');
    if (id) {
      // 1 hour TTL
      return { type: 'TEMPORARY', key: `manga/page/${id}.json`, maxAge: 3600, ttlMs: 60 * 60 * 1000 };
    }
  }

  // C. NO R2 (Home feeds, search - ephemeral)
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
    return new Response(JSON.stringify({ status: 'ok', service: 'voidflix-manga-proxy', r2Cache: true }), {
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
          const age = Date.now() - obj.uploaded.getTime();
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

  // Clean, realistic browser headers - DO NOT forward request.headers as it contains
  // host: mangareader-e3n.pages.dev and cf-* headers which trigger Cloudflare WAF block
  const headers = new Headers();
  headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36');
  headers.set('Accept', 'application/json, text/plain, */*');
  headers.set('Accept-Language', 'en-US,en;q=0.9');
  headers.set('Referer', 'https://atsu.moe/');
  headers.set('Origin', 'https://atsu.moe');
  headers.set('Sec-Ch-Ua', '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"');
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

    // Fallback to Scrapfly if Cloudflare WAF blocks worker IP
    if ((res.status === 403 || res.status === 401) && request.method === 'GET') {
      const SCRAPFLY_KEY = context.env?.SCRAPFLY_KEY || 'scp-live-96e7f740c2b84816bbf8475dff519328';
      const scrapflyUrl = `https://api.scrapfly.io/scrape?key=${SCRAPFLY_KEY}&url=${encodeURIComponent(targetUrl.toString())}&unblocker=true`;
      const sfRes = await fetch(scrapflyUrl);
      if (sfRes.ok) {
        const sfData = await sfRes.json();
        if (sfData.result && sfData.result.content) {
          const content = sfData.result.content;
          saveToR2(content);

          return new Response(content, {
            status: sfData.result.status_code || 200,
            headers: {
              'Content-Type': sfData.result.content_type || 'application/json',
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': policy.type === 'FOREVER' ? 'public, max-age=31536000, immutable' : 'public, max-age=3600',
              'X-Proxy-Provider': 'scrapfly'
            }
          });
        }
      }
    }

    // Direct response handling
    const responseBody = await res.text();
    if (res.ok && request.method === 'GET') {
      saveToR2(responseBody);
    }

    const responseHeaders = new Headers(res.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', '*');

    // Cache home and search endpoints for 2 minutes on Cloudflare edge
    if (url.pathname.includes('/home2/') || url.pathname.includes('/search/manga')) {
      responseHeaders.set('Cache-Control', 'public, max-age=120, s-maxage=120');
    }

    return new Response(responseBody, {
      status: res.status,
      statusText: res.statusText,
      headers: responseHeaders,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Proxy request failed: ' + err.message }), {
      status: 502,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  }
}
