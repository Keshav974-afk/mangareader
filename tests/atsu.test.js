import { test } from 'node:test';
import assert from 'node:assert/strict';
import { atsuRequest } from '../lib/atsu.js';

test('direct API requests share concurrent work and cache successful responses', async () => {
  let calls = 0;
  const fetcher = async (url, options) => {
    calls++;
    assert.equal(url.origin, 'https://atsu.moe');
    assert.equal(url.search, '?limit=1');
    assert.ok(options.signal);
    await new Promise(resolve => setTimeout(resolve, 10));
    return Response.json({ items: [{ id: 'example' }] });
  };
  const url = new URL('http://localhost/api/test/catalog?limit=1');
  const responses = await Promise.all([atsuRequest(url, fetcher), atsuRequest(url, fetcher)]);
  assert.deepEqual(await responses[0].json(), await responses[1].json());
  assert.equal((await atsuRequest(url, fetcher)).status, 200);
  assert.equal(calls, 1);
});

test('denied responses stay 403, are not retried or cached', async () => {
  let calls = 0;
  const fetcher = async () => { calls++; return new Response('denied', { status: 403 }); };
  for (let i = 0; i < 2; i++) {
    const response = await atsuRequest(new URL('http://localhost/api/test/denied'), fetcher);
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.match((await response.json()).error, /Atsu denied/);
  }
  assert.equal(calls, 2);
});

test('network failures return actionable JSON', async () => {
  const response = await atsuRequest(new URL('http://localhost/api/test/failure'), async () => { throw new Error('DNS failure'); });
  assert.equal(response.status, 502);
  assert.match((await response.json()).error, /Cannot reach Atsu/);
});

test('CDN stays on Atsu even for a double slash path and preserves query', async () => {
  const response = await atsuRequest(new URL('http://localhost/cdn//example.com/image.jpg?size=small'), async url => {
    assert.equal(url.origin, 'https://cdn.atsu.moe');
    assert.equal(url.search, '?size=small');
    return new Response('image', { headers: { 'Content-Type': 'image/jpeg' } });
  });
  assert.equal(response.headers.get('content-type'), 'image/jpeg');
  assert.equal(await response.text(), 'image');
});
