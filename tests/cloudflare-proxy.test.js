import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCloudflareProxyFetcher, decodeHttpResponse } from '../lib/cloudflare-proxy.js';
const encode = text => new TextEncoder().encode(text);
function socket(reply, writes) {
  return { opened: Promise.resolve(), close: async () => {},
    readable: new ReadableStream({ start(controller) { for (const part of reply) controller.enqueue(encode(part)); controller.close(); } }),
    writable: new WritableStream({ write(bytes) { writes.push(new TextDecoder().decode(bytes)); } }) };
}

test('Cloudflare connects to proxy, upgrades TLS for Atsu, and returns JSON', async () => {
  const tunnelWrites = [], upstreamWrites = [];
  let tlsOptions;
  const secure = socket(['HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 12\r\n\r\n{"items":[]}'], upstreamWrites);
  const tunnel = socket(['HTTP/1.1 200 Connection ', 'established\r\n\r\n'], tunnelWrites);
  tunnel.startTls = options => { tlsOptions = options; return secure; };
  const fetcher = createCloudflareProxyFetcher({ PROXY_AUTH: 'test:credential' }, (address, options) => {
    assert.equal(address.hostname, 'gate-us.vaultproxies.com');
    assert.equal(address.port, 80);
    assert.equal(options.secureTransport, 'starttls'); return tunnel;
  });
  const response = await fetcher('https://atsu.moe/api/home2/popular?limit=1');
  assert.deepEqual(await response.json(), { items: [] });
  assert.deepEqual(tlsOptions, { expectedServerHostname: 'atsu.moe' });
  assert.match(tunnelWrites[0], /CONNECT atsu.moe:443/);
  assert.match(tunnelWrites[0], /Proxy-Authorization: Basic/);
  assert.match(upstreamWrites[0], /GET \/api\/home2\/popular\?limit=1/);
  assert.doesNotMatch(upstreamWrites[0], /Proxy-Authorization|credential/);
});

test('Cloudflare rejects missing credentials and proxy authentication failures', async () => {
  await assert.rejects(createCloudflareProxyFetcher({}, () => {})('https://atsu.moe/api/test'), { code: 'PROXY_CONFIG' });
  const fetcher = createCloudflareProxyFetcher({ PROXY_AUTH: 'wrong:value' }, () => socket(['HTTP/1.1 407 Proxy Authentication Required\r\n\r\n'], []));
  await assert.rejects(fetcher('https://atsu.moe/api/test'), { code: 'PROXY_AUTH' });
});

test('decodes chunked response with extensions and preserves binary bytes', async () => {
  const response = await decodeHttpResponse(encode('HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\nContent-Type: application/json\r\n\r\n5;ext=yes\r\nhello\r\n6\r\n world\r\n0\r\n\r\n'));
  assert.equal(await response.text(), 'hello world');
  assert.equal(response.headers.has('transfer-encoding'), false);
  await assert.rejects(decodeHttpResponse(encode('HTTP/1.1 200 OK\r\nContent-Length: 9\r\n\r\nx')), { code: 'PROXY_PROTOCOL' });
});

test('binary image bytes survive HTTP framing', async () => {
  const header = encode('HTTP/1.1 200 OK\r\nContent-Type: image/avif\r\nContent-Length: 4\r\n\r\n');
  const bytes = new Uint8Array(header.length + 4); bytes.set(header); bytes.set([0, 255, 128, 13], header.length);
  const response = await decodeHttpResponse(bytes);
  assert.equal(response.headers.get('content-type'), 'image/avif');
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [0, 255, 128, 13]);
});
