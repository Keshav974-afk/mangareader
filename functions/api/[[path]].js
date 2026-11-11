// Cloudflare Pages Function: Proxy & R2 Persistent Cache for Atsu.moe API
const R2_PUBLIC_BASE = 'https://pub-2916bfced0d845f088ad2b3e71104031.r2.dev';

function getR2Key(pathname, search) {
  const clean = pathname.replace(/^\/api\//, '').replace(/^\//, '');
  if (clean === 'manga/page') {
    const id = new URLSearchParams(search).get('id');
    return id ? `manga/page/${id}.json` : null;
  }
  if (clean === 'manga/allChapters') {
    const mangaId = new URLSearchParams(search).get('mangaId');
    return mangaId ? `manga/allChapters/${mangaId}.json` : null;
  }
  if (clean === 'read/chapter') {
    const p = new URLSearchParams(search);
    const m = p.get('mangaId');
    const c = p.get('chapterId');
    return (m && c) ? `read/chapter/${m}_${c}.json` : null;
  }
  return null;
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

  const r2Key = getR2Key(url.pathname, url.search);

  // 1. Check R2 Cache first (Native Binding or Public R2 URL)
  if (r2Key && request.method === 'GET') {
    // Check native Cloudflare Pages R2 binding (if bound in dashboard)
    if (context.env?.R2_CACHE) {
      try {
        const obj = await context.env.R2_CACHE.get(r2Key);
        if (obj) {
          return new Response(obj.body, {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'X-Cache': 'R2-BINDING-HIT',
              ...corsHeaders
            }
          });
        }
      } catch (e) {}
    }

    // Check public R2 URL
    try {
      const pubRes = await fetch(`${R2_PUBLIC_BASE}/${r2Key}`);
      if (pubRes.ok) {
        const bodyText = await pubRes.text();
        return new Response(bodyText, {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Cache': 'R2-PUBLIC-HIT',
            ...corsHeaders
          }
        });
      }
    } catch (e) {}
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
          // Store in R2 bucket forever
          if (r2Key && context.env?.R2_CACHE) {
            context.waitUntil(
              context.env.R2_CACHE.put(r2Key, content, {
                httpMetadata: { contentType: 'application/json' }
              })
            );
          }

          return new Response(content, {
            status: sfData.result.status_code || 200,
            headers: {
              'Content-Type': sfData.result.content_type || 'application/json',
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': 'public, max-age=86400',
              'X-Proxy-Provider': 'scrapfly'
            }
          });
        }
      }
    }

    // Direct response handling
    const responseBody = await res.text();
    if (res.ok && r2Key && context.env?.R2_CACHE && request.method === 'GET') {
      context.waitUntil(
        context.env.R2_CACHE.put(r2Key, responseBody, {
          httpMetadata: { contentType: 'application/json' }
        })
      );
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
