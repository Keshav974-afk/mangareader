import { atsuRequest } from '../../lib/atsu.js';
import { connect } from 'cloudflare:sockets';
import { createCloudflareProxyFetcher } from '../../lib/cloudflare-proxy.js';
export function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' } });
  if (request.method !== 'GET') return new Response(null, { status: 405 });
  return atsuRequest(new URL(request.url), createCloudflareProxyFetcher(env, connect));
}
