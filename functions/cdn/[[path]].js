// Cloudflare Pages Function: Proxy for Atsu CDN images with anti-hotlinking bypass
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
  const cdnPath = url.pathname.replace(/^\/cdn/, '');
  const targetUrl = new URL(`https://cdn.atsu.moe${cdnPath}${url.search}`);

  const headers = new Headers();
  headers.set(
    'User-Agent',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
  );
  headers.set('Accept', 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8');
  headers.set('Accept-Language', 'en-US,en;q=0.9');
  headers.set('Referer', 'https://atsu.moe/');
  headers.set('Sec-Ch-Ua', '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"');
  headers.set('Sec-Ch-Ua-Mobile', '?0');
  headers.set('Sec-Ch-Ua-Platform', '"Windows"');
  headers.set('Sec-Fetch-Dest', 'image');
  headers.set('Sec-Fetch-Mode', 'no-cors');
  headers.set('Sec-Fetch-Site', 'same-origin');

  try {
    const res = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers,
    });

    const responseHeaders = new Headers(res.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Cache-Control', 'public, max-age=604800, immutable');

    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: responseHeaders,
    });
  } catch (err) {
    return new Response(null, { status: 404, headers: corsHeaders });
  }
}
