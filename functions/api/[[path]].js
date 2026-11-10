// Cloudflare Pages Function: Proxy for Atsu.moe API
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
    return new Response(JSON.stringify({ status: 'ok', service: 'voidflix-manga-proxy' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
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
    const res = await fetch(targetUrl.toString(), {
      method: request.method,
      headers,
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
        ...corsHeaders,
      },
    });
  }
}
