// Cloudflare Pages Function: Proxy for Atsu.moe API
export async function onRequest(context) {
  const { request, params } = context;
  const url = new URL(request.url);

  // Reconstruct path to https://atsu.moe/api/...
  const targetUrl = new URL(`https://atsu.moe${url.pathname}${url.search}`);

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  const modifiedHeaders = new Headers(request.headers);
  modifiedHeaders.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  modifiedHeaders.set('Referer', 'https://atsu.moe');
  modifiedHeaders.set('Accept', 'application/json');

  try {
    const res = await fetch(targetUrl.toString(), {
      method: request.method,
      headers: modifiedHeaders,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
    });

    const responseHeaders = new Headers(res.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', '*');

    // Cache home and search endpoints for 2 minutes on Cloudflare edge
    if (url.pathname.includes('/home2/') || url.pathname.includes('/search/manga')) {
      responseHeaders.set('Cache-Control', 'public, max-age=120, s-maxage=120');
    }

    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: responseHeaders,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Proxy request failed: ' + err.message }), {
      status: 502,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}
