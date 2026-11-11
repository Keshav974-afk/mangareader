// Cloudflare Pages Function: Proxy & R2 Permanent Cache for Atsu CDN Posters & Images
const R2_PUBLIC_BASE = 'https://pub-2916bfced0d845f088ad2b3e71104031.r2.dev';
const RAILWAY_PROXY_BASE = 'https://mangareader-production-b77c3f15.up.railway.app';

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Extract path after /cdn
  const cdnPath = url.pathname.replace(/^\/cdn\/?/, '');
  const cleanKey = cdnPath.replace(/^\//, '');

  // Is this a poster, cover, banner, or series artwork?
  const isPoster = cleanKey.includes('posters/') ||
                   cleanKey.includes('covers/') ||
                   cleanKey.includes('banners/') ||
                   cleanKey.includes('manga/');

  // 1. Check Cloudflare R2 Cache first (Native Binding or Public R2 URL)
  if (context.env?.R2_CACHE) {
    try {
      const obj = await context.env.R2_CACHE.get(cleanKey);
      if (obj) {
        return new Response(obj.body, {
          status: 200,
          headers: {
            'Content-Type': obj.httpMetadata?.contentType || 'image/avif',
            'Cache-Control': isPoster ? 'public, max-age=31536000, immutable' : 'public, max-age=604800, immutable',
            'X-Cache': isPoster ? 'R2-POSTER-FOREVER-HIT' : 'R2-BINDING-HIT',
            ...corsHeaders
          }
        });
      }
    } catch (e) {}
  }

  // Check public R2 bucket URL
  try {
    const pubRes = await fetch(`${R2_PUBLIC_BASE}/${cleanKey}`);
    if (pubRes.ok) {
      return new Response(pubRes.body, {
        status: 200,
        headers: {
          'Content-Type': pubRes.headers.get('content-type') || 'image/avif',
          'Cache-Control': isPoster ? 'public, max-age=31536000, immutable' : 'public, max-age=604800, immutable',
          'X-Cache': isPoster ? 'R2-POSTER-FOREVER-HIT' : 'R2-PUBLIC-HIT',
          ...corsHeaders
        }
      });
    }
  } catch (e) {}

  // 2. Fetch from upstream with residential proxy fallback (no Scrapfly)
  let imageBuffer = null;
  let contentType = 'image/avif';
  let fetchSource = 'ORIGIN';

  // Try direct fetch from cdn.atsu.moe with spoofed browser headers
  try {
    const targetUrl = new URL(`https://cdn.atsu.moe/${cleanKey}${url.search}`);
    const headers = new Headers();
    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36');
    headers.set('Accept', 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8');
    headers.set('Referer', 'https://atsu.moe/');
    headers.set('Sec-Fetch-Dest', 'image');
    headers.set('Sec-Fetch-Mode', 'no-cors');
    headers.set('Sec-Fetch-Site', 'same-origin');

    const res = await fetch(targetUrl.toString(), { method: 'GET', headers });
    if (res.ok) {
      imageBuffer = await res.arrayBuffer();
      contentType = res.headers.get('content-type') || 'image/avif';
    }
  } catch (err) {}

  // 3. If direct fetch failed or was blocked (403), fetch via Railway residential proxy
  if (!imageBuffer) {
    try {
      const proxyUrl = `${RAILWAY_PROXY_BASE}/cdn/${cleanKey}${url.search}`;
      const proxyRes = await fetch(proxyUrl);
      if (proxyRes.ok) {
        imageBuffer = await proxyRes.arrayBuffer();
        contentType = proxyRes.headers.get('content-type') || 'image/avif';
        fetchSource = 'RESIDENTIAL-PROXY';
      }
    } catch (e) {}
  }

  // 4. Fallback to WordPress Photon Edge if still missing
  if (!imageBuffer) {
    try {
      const photonUrl = `https://i0.wp.com/cdn.atsu.moe/${cleanKey}${url.search}`;
      const photonRes = await fetch(photonUrl);
      if (photonRes.ok) {
        imageBuffer = await photonRes.arrayBuffer();
        contentType = photonRes.headers.get('content-type') || 'image/jpeg';
        fetchSource = 'PHOTON-EDGE';
      }
    } catch (e) {}
  }

  if (!imageBuffer) {
    return new Response(null, { status: 404, headers: corsHeaders });
  }

  // 5. Store in Cloudflare R2 bucket permanently!
  // Posters and covers are saved forever in R2
  if (isPoster && context.env?.R2_CACHE) {
    context.waitUntil(
      context.env.R2_CACHE.put(cleanKey, imageBuffer, {
        httpMetadata: {
          contentType,
          cacheControl: 'public, max-age=31536000, immutable'
        }
      })
    );
  }

  return new Response(imageBuffer, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': isPoster ? 'public, max-age=31536000, immutable' : 'public, max-age=604800, immutable',
      'X-Cache': `${fetchSource}-SAVED-TO-R2`,
      ...corsHeaders
    }
  });
}
