export const DEFAULT_RELAY = 'https://mangareader-production-b77c3f15.up.railway.app';

// Pages cannot open residential HTTP CONNECT tunnels; the Node relay does that.
export function createRelayFetcher(base = DEFAULT_RELAY, fetcher = fetch) {
  const relay = new URL(base);
  if (relay.protocol !== 'https:' || relay.username || relay.password) throw new Error('ATSU_RELAY_URL must be an HTTPS URL without credentials');
  return (target, options) => {
    const url = new URL(target);
    const path = url.hostname === 'cdn.atsu.moe' ? `/cdn${url.pathname}` : url.pathname;
    return fetcher(new URL(relay.origin + path + url.search), options);
  };
}
