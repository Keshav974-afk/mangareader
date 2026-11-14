import http from 'node:http';
import https from 'node:https';
import tls from 'node:tls';

// Credentials belong in deployment settings, never in source control.
export function createResidentialFetcher(config, transport = { http, https, tls }) {
  const { host = 'gate-us.vaultproxies.com', port = 80, auth } = config;
  if (!auth) throw new Error('PROXY_AUTH is required for residential proxy access');
  const agent = new https.Agent({ keepAlive: true, maxSockets: 24 });
  agent.createConnection = (options, callback) => {
    const tunnel = transport.http.request({ host, port, method: 'CONNECT',
      path: `${options.host}:443`, headers: { Host: `${options.host}:443`,
        'Proxy-Authorization': `Basic ${Buffer.from(auth).toString('base64')}` } });
    let finished = false;
    const finish = (error, socket) => { if (!finished) { finished = true; callback(error, socket); } };
    tunnel.setTimeout(8000, () => tunnel.destroy(new Error('Residential proxy connection timed out')));
    tunnel.on('error', error => finish(error));
    tunnel.on('connect', (response, socket, head) => {
      tunnel.setTimeout(0);
      if (response.statusCode !== 200) { socket.destroy(); return finish(new Error(`Residential proxy CONNECT HTTP ${response.statusCode}`)); }
      if (head.length) socket.unshift(head);
      const secure = transport.tls.connect({ socket, servername: options.host, rejectUnauthorized: true });
      secure.setTimeout(8000, () => secure.destroy(new Error('Residential proxy TLS timed out')));
      secure.once('secureConnect', () => { secure.setTimeout(0); finish(null, secure); });
      secure.on('error', error => finish(error));
    });
    tunnel.end();
  };
  return (url, options = {}) => new Promise((resolve, reject) => {
    const request = transport.https.request(url, { agent, headers: options.headers, signal: options.signal }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('error', reject);
      response.on('aborted', () => reject(new Error('Residential proxy response interrupted')));
      response.on('end', () => {
        const headers = new Headers();
        for (const [key, value] of Object.entries(response.headers)) {
          if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
        }
        resolve(new Response([204, 205, 304].includes(response.statusCode) ? null : Buffer.concat(chunks), { status: response.statusCode, headers }));
      });
    });
    request.on('error', reject);
    request.end();
  });
}

export const residentialFetcher = process.env.PROXY_AUTH ? createResidentialFetcher({
  host: process.env.PROXY_HOST || 'gate-us.vaultproxies.com',
  port: Number(process.env.PROXY_PORT || 80), auth: process.env.PROXY_AUTH
}) : null;
