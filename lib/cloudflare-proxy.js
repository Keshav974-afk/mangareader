const encoder = new TextEncoder();
const decoder = new TextDecoder();
const MAX_RESPONSE = 32 * 1024 * 1024;
const failure = (message, code) => Object.assign(new Error(message), { code });

function join(chunks, size) {
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

// HTTP/1.1 framing is necessary because a raw TCP tunnel does not use fetch().
export async function decodeHttpResponse(bytes) {
  let offset = 0;
  let status, headers;
  do {
    let end = -1;
    for (let i = offset; i < bytes.length - 3; i++) {
      if (bytes[i] === 13 && bytes[i + 1] === 10 && bytes[i + 2] === 13 && bytes[i + 3] === 10) { end = i; break; }
    }
    if (end < 0) throw failure('Incomplete upstream headers', 'PROXY_PROTOCOL');
    const block = decoder.decode(bytes.subarray(offset, end));
    offset = end + 4;
    const lines = block.split('\r\n');
    const match = /^HTTP\/1\.[01] (\d{3})/.exec(lines.shift());
    if (!match) throw failure('Invalid upstream HTTP response', 'PROXY_PROTOCOL');
    status = Number(match[1]);
    headers = new Headers();
    for (const line of lines) {
      const colon = line.indexOf(':');
      if (colon < 1) throw failure('Invalid upstream header', 'PROXY_PROTOCOL');
      headers.append(line.slice(0, colon), line.slice(colon + 1).trim());
    }
  } while (status >= 100 && status < 200 && status !== 101);
  let body = bytes.subarray(offset);
  if (headers.get('transfer-encoding')?.toLowerCase() === 'chunked') {
    const chunks = []; let size = 0; let cursor = 0;
    while (true) {
      const lineEnd = body.indexOf(13, cursor);
      if (lineEnd < 0 || body[lineEnd + 1] !== 10) throw failure('Incomplete chunk', 'PROXY_PROTOCOL');
      const line = decoder.decode(body.subarray(cursor, lineEnd)).split(';')[0];
      if (!/^[0-9a-f]+$/i.test(line)) throw failure('Invalid chunk size', 'PROXY_PROTOCOL');
      const length = parseInt(line, 16); cursor = lineEnd + 2;
      if (length === 0) break;
      if (cursor + length + 2 > body.length || body[cursor + length] !== 13 || body[cursor + length + 1] !== 10) throw failure('Truncated chunk', 'PROXY_PROTOCOL');
      chunks.push(body.subarray(cursor, cursor + length)); size += length; cursor += length + 2;
    }
    body = join(chunks, size); headers.delete('transfer-encoding');
  } else if (headers.has('content-length') && Number(headers.get('content-length')) !== body.length && ![204, 304].includes(status)) {
    throw failure('Truncated response', 'PROXY_PROTOCOL');
  }
  const encoding = headers.get('content-encoding');
  if (encoding && encoding !== 'identity') {
    if (!['gzip', 'deflate'].includes(encoding)) throw failure('Unsupported content encoding', 'PROXY_PROTOCOL');
    body = new Uint8Array(await new Response(new Blob([body]).stream().pipeThrough(new DecompressionStream(encoding))).arrayBuffer());
    headers.delete('content-encoding');
  }
  headers.delete('content-length'); headers.delete('connection');
  return new Response([204, 205, 304].includes(status) ? null : body, { status, headers });
}

export function createCloudflareProxyFetcher(env, connect) {
  return async (target, options = {}) => {
    if (!env?.PROXY_AUTH) throw failure('Set PROXY_AUTH in Cloudflare Pages secrets', 'PROXY_CONFIG');
    const url = new URL(target);
    if (url.protocol !== 'https:' || !['atsu.moe', 'www.atsu.moe', 'cdn.atsu.moe'].includes(url.hostname) || url.port) throw failure('Invalid proxy target', 'PROXY_CONFIG');
    const host = env.PROXY_HOST || 'gate-us.vaultproxies.com';
    const port = Number(env.PROXY_PORT || 80);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw failure('Invalid proxy port', 'PROXY_CONFIG');
    let socket;
    const close = () => { if (socket) void socket.close().catch(() => {}); };
    const abort = () => close();
    options.signal?.throwIfAborted();
    try {
      socket = connect({ hostname: host, port }, { secureTransport: 'starttls' });
      options.signal?.addEventListener('abort', abort, { once: true });
      await socket.opened;
      const writer = socket.writable.getWriter();
      await writer.write(encoder.encode(`CONNECT ${url.hostname}:443 HTTP/1.1\r\nHost: ${url.hostname}:443\r\nProxy-Authorization: Basic ${btoa(env.PROXY_AUTH)}\r\n\r\n`));
      writer.releaseLock();
      const reader = socket.readable.getReader();
      let reply = '';
      try {
        while (!reply.endsWith('\r\n\r\n')) {
          const { value, done } = await reader.read();
          if (done || reply.length > 16384) throw failure('Proxy handshake failed', 'PROXY_PROTOCOL');
          reply += decoder.decode(value);
        }
      } finally { reader.releaseLock(); }
      const status = /^HTTP\/1\.[01] (\d{3})/.exec(reply)?.[1];
      if (status !== '200') throw failure('Proxy CONNECT rejected', status === '407' ? 'PROXY_AUTH' : 'PROXY_CONNECT');
      socket = socket.startTls({ expectedServerHostname: url.hostname });
      await socket.opened;
      const secureWriter = socket.writable.getWriter();
      const accept = url.hostname === 'cdn.atsu.moe' ? 'image/avif,image/webp,image/*,*/*' : 'application/json';
      await secureWriter.write(encoder.encode(`GET ${url.pathname}${url.search} HTTP/1.1\r\nHost: ${url.hostname}\r\nAccept: ${accept}\r\nAccept-Encoding: identity\r\nReferer: https://atsu.moe/\r\nConnection: close\r\n\r\n`));
      secureWriter.releaseLock();
      const secureReader = socket.readable.getReader();
      const chunks = []; let size = 0;
      try {
        while (true) {
          const { value, done } = await secureReader.read();
          if (done) break;
          size += value.length;
          if (size > MAX_RESPONSE) throw failure('Upstream response exceeds 32 MiB', 'PROXY_PROTOCOL');
          chunks.push(value);
        }
      } finally { secureReader.releaseLock(); }
      options.signal?.throwIfAborted();
      return await decodeHttpResponse(join(chunks, size));
    } finally {
      options.signal?.removeEventListener('abort', abort);
      close();
    }
  };
}
