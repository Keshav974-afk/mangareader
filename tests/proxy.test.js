import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createResidentialFetcher } from '../lib/residential.js';

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
