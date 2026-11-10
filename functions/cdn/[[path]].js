// Cloudflare Pages Function: Proxy for Atsu CDN images with anti-hotlinking bypass
export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  // Extract path after /cdn
  const cdnPath = url.pathname.replace(/^\/cdn/, '');
  const targetUrl = new URL(`https://cdn.atsu.moe${cdnPath}${url.search}`);

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  const modifiedHeaders = new Headers();
  modifiedHeaders.set(
    'User-Agent',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
  );
  modifiedHeaders.set('Referer', 'https://atsu.moe');
  modifiedHeaders.set('Accept', 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8');

  try {
    const res = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers: modifiedHeaders,
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
    return new Response(null, { status: 404 });
  }
}
