import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRelayFetcher } from '../lib/relay.js';
import { createResidentialFetcher } from '../lib/residential.js';

test('relay preserves API query and maps CDN paths', async () => {
  const calls = [];
  const fetcher = createRelayFetcher('https://relay.example', async (url, options) => {
    calls.push([url.href, options]); return new Response('ok');
  });
  const signal = AbortSignal.timeout(1000);
  await fetcher('https://atsu.moe/api/home2/popular?limit=1', { signal });
  await fetcher('https://cdn.atsu.moe/static/posters/a.jpg?size=small', { signal });
  assert.equal(calls[0][0], 'https://relay.example/api/home2/popular?limit=1');
  assert.equal(calls[1][0], 'https://relay.example/cdn/static/posters/a.jpg?size=small');
  assert.equal(calls[0][1].signal, signal);
});

test('proxy configuration requires credentials and HTTPS relay', () => {
  assert.throws(() => createResidentialFetcher({}), /PROXY_AUTH/);
  assert.throws(() => createRelayFetcher('http://relay.example'), /HTTPS/);
  assert.throws(() => createRelayFetcher('https://user:pass@relay.example'), /credentials/);
});

test('residential fetcher authenticates CONNECT and verifies upstream TLS', async () => {
  let connectOptions;
  const transport = {
    http: { request(options) {
      connectOptions = options;
      const req = new EventEmitter(); req.setTimeout = () => {}; req.end = () => {
        queueMicrotask(() => req.emit('connect', { statusCode: 200 }, { unshift() {} }, Buffer.alloc(0)));
      }; return req;
    } },
    tls: { connect(options) {
      assert.equal(options.rejectUnauthorized, true);
      assert.equal(options.servername, 'atsu.moe');
      const socket = new EventEmitter(); socket.setTimeout = () => {};
      queueMicrotask(() => socket.emit('secureConnect')); return socket;
    } },
    https: { request(url, options, callback) {
      assert.equal(url, 'https://atsu.moe/api/test');
      const req = new EventEmitter();
      req.end = () => options.agent.createConnection({ host: 'atsu.moe' }, (error) => {
        assert.ifError(error);
        const res = new EventEmitter(); res.statusCode = 200; res.headers = { 'content-type': 'application/json' };
        callback(res); res.emit('data', Buffer.from('{"items":[]}')); res.emit('end');
      }); return req;
    } }
  };
  const fetcher = createResidentialFetcher({ host: 'proxy.example', port: 80, auth: 'test:credential' }, transport);
  const response = await fetcher('https://atsu.moe/api/test');
  assert.deepEqual(await response.json(), { items: [] });
  assert.equal(connectOptions.method, 'CONNECT');
  assert.equal(connectOptions.path, 'atsu.moe:443');
  assert.equal(connectOptions.headers['Proxy-Authorization'], 'Basic ' + Buffer.from('test:credential').toString('base64'));
});
