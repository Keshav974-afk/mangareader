import { atsuRequest } from './atsu.js';
import { createCloudflareProxyFetcher } from './cloudflare-proxy.js';
const transportHeaders = { 'X-Voidflix-Transport': 'cloudflare-tcp-v1', 'Cache-Control': 'no-store' };
export async function handleCloudflareRequest({ request, env }, connect) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...transportHeaders, 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' } });
  if (request.method !== 'GET') return new Response(null, { status: 405, headers: transportHeaders });
  const url = new URL(request.url);
  if (url.pathname === '/api/health') {
    const port = Number(env?.PROXY_PORT || 80);
    return Response.json({ runtime: 'cloudflare-pages', transport: 'residential-tcp',
      credentialPresent: Boolean(env?.PROXY_AUTH), proxyPortValid: Number.isInteger(port) && port > 0 && port <= 65535,
      note: 'Configuration check only; does not test proxy connectivity.' }, { headers: transportHeaders });
  }
  const response = await atsuRequest(url, createCloudflareProxyFetcher(env, connect));
  response.headers.set('X-Voidflix-Transport', 'cloudflare-tcp-v1');
  return response;
}
