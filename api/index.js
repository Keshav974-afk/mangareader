import { atsuRequest } from '../lib/atsu.js';
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!['GET', 'HEAD'].includes(req.method)) return res.status(405).end();
  const response = await atsuRequest(new URL(req.url, 'http://localhost'));
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(req.method === 'HEAD' ? undefined : Buffer.from(await response.arrayBuffer()));
}
