import { atsuRequest } from '../../lib/atsu.js';
export function onRequest({ request }) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' } });
  if (request.method !== 'GET') return new Response(null, { status: 405 });
  return atsuRequest(new URL(request.url));
}
