import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import type { Cache, Upstreams } from './types.js';

import { buildApp } from './app.js';
import { normalizeChartResponse, normalizePriceResponse, PriceService } from './prices.js';

class MemoryCache implements Cache {
  values = new Map<string, string>();
  // Cache misses use null to match the Redis API and the Cache contract.
  // eslint-disable-next-line no-null/no-null
  get(key: string) { return Promise.resolve(this.values.get(key) ?? null); }
  set(key: string, value: string) {
    this.values.set(key, value);
    return Promise.resolve();
  }

  ping() { return Promise.resolve(true); }
  close() { return Promise.resolve(); }
}

const cache = new MemoryCache();
const upstreams: Upstreams = {
  toncenter: {
    mainnet: { primary: 'http://127.0.0.1:1' },
    testnet: { primary: 'http://127.0.0.1:1' },
  },
  tonapi: {
    mainnet: { primary: 'http://127.0.0.1:1' },
    testnet: { primary: 'http://127.0.0.1:1' },
  },
};
const dataDir = fileURLToPath(new URL('../data', import.meta.url));
let app: Awaited<ReturnType<typeof buildApp>>;

before(async () => {
  app = await buildApp({
    cache,
    prices: new PriceService(cache, '', '', ''),
    upstreams,
    allowedOrigins: ['https://yohi.io'],
    timeoutMs: 50,
    dataDir,
  });
});
after(async () => app.close());

void describe('business API contracts', () => {
  void it('normalizes TONAPI rates into the backend price snapshot', () => {
    const snapshot = normalizePriceResponse({
      rates: {
        TON: {
          prices: { USD: 2, EUR: 1.8, CNY: 14, BTC: 0.00004, TON: 1 },
          diff_24h: { USD: '+2.5%' },
        },
        'EQToken-Address': {
          prices: { USD: 0.5 },
          diff_24h: { USD: '−1.2%' },
        },
      },
    });
    assert.deepEqual(snapshot?.rates, {
      USD: '1', EUR: '0.9', RUB: '0', CNY: '7', BTC: '0.00002', TON: '0.5',
    });
    assert.deepEqual(snapshot?.prices, {
      toncoin: { priceUsd: 2, percentChange24h: 2.5 },
      'ton-eqtokenadd': { priceUsd: 0.5, percentChange24h: -1.2 },
    });
  });

  void it('returns assets in the client shape', async () => {
    const response = await app.inject({ method: 'GET', url: '/assets' });
    const assets = response.json();
    assert.equal(response.statusCode, 200);
    assert.ok(assets.length >= 3);
    assert.equal(typeof assets[0].slug, 'string');
    assert.equal(typeof assets[0].priceUsd, 'number');
    assert.equal(typeof assets[0].percentChange24h, 'number');

    const swapAssets = await app.inject({ method: 'GET', url: '/swap/assets' });
    assert.equal(swapAssets.statusCode, 200);
    assert.deepEqual(swapAssets.json(), assets);
  });

  void it('returns the DApp catalog in the client shape', async () => {
    const response = await app.inject({ method: 'GET', url: '/v2/dapp/catalog?isLandscape=false&langCode=en' });
    const catalog = response.json();
    assert.equal(response.statusCode, 200);
    assert.ok(catalog.categories.length > 0);
    assert.ok(catalog.sites.length > 0);
    assert.equal(typeof catalog.sites[0].url, 'string');
    assert.equal(typeof catalog.sites[0].canBeRestricted, 'boolean');
  });

  void it('localizes the DApp catalog in Japanese and Korean with an English fallback', async () => {
    const japanese = (await app.inject({
      method: 'GET', url: '/v2/dapp/catalog?isLandscape=false&langCode=ja',
    })).json();
    const korean = (await app.inject({
      method: 'GET', url: '/v2/dapp/catalog?isLandscape=false&langCode=ko',
    })).json();
    const fallback = (await app.inject({
      method: 'GET', url: '/v2/dapp/catalog?isLandscape=false&langCode=fr',
    })).json();

    assert.equal(japanese.featuredTitle, 'トレンド');
    assert.equal(japanese.categories[0].name, 'ゲーム');
    assert.equal(korean.featuredTitle, '인기 급상승');
    assert.equal(korean.categories[0].name, '게임');
    assert.equal(fallback.featuredTitle, 'Trending');
    assert.equal('localizations' in japanese, false);
  });

  void it('validates DApp catalog parameters', async () => {
    assert.equal((await app.inject({ method: 'GET', url: '/v2/dapp/catalog?isLandscape=maybe&langCode=en' })).statusCode, 400);
    assert.equal((await app.inject({ method: 'GET', url: '/v2/dapp/catalog?isLandscape=false&langCode=中文' })).statusCode, 400);
  });

  void it('keeps static assets inside the data directory', async () => {
    assert.equal((await app.inject({ method: 'GET', url: '/static/not-found.png' })).statusCode, 404);
    const traversalStatus = (await app.inject({ method: 'GET', url: '/static/%2e%2e/assets.json' })).statusCode;
    assert.ok([400, 404].includes(traversalStatus));
  });

  void it('limits batch metadata requests', async () => {
    const response = await app.inject({ method: 'POST', url: '/assets', payload: { assets: Array(101).fill('x') } });
    assert.equal(response.statusCode, 400);
  });

  void it('returns all required currencies', async () => {
    const response = await app.inject({ method: 'GET', url: '/currency-rates' });
    assert.deepEqual(Object.keys(response.json().rates), ['USD', 'EUR', 'RUB', 'CNY', 'BTC', 'TON']);
  });

  void it('normalizes price chart points into chronological order', () => {
    assert.deepEqual(normalizeChartResponse({ points: [[3, 1.3], [1, 1.1], ['bad', 2], [2, 1.2]] }), [
      [1, 1.1], [2, 1.2], [3, 1.3],
    ]);
  });

  void it('fetches price charts from the configured upstream', async () => {
    const originalFetch = globalThis.fetch;
    let requestedUrl = '';
    globalThis.fetch = (input) => {
      requestedUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      return Promise.resolve(new Response(JSON.stringify({ points: [[2, 1.2], [1, 1.1]] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }));
    };
    try {
      const service = new PriceService(cache, '', 'https://prices.example/v2/rates/chart', 'secret');
      assert.deepEqual(await service.getChart('ton:TON', '1D', 'USD'), [[1, 1.1], [2, 1.2]]);
      const target = new URL(requestedUrl);
      assert.equal(target.searchParams.get('token'), 'ton');
      assert.equal(target.searchParams.get('currency'), 'usd');
      assert.equal(target.searchParams.get('points_count'), '289');

      await service.getChart('ton:EQTokenAddress', '1D', 'USD');
      assert.equal(new URL(requestedUrl).searchParams.get('token'), 'EQTokenAddress');

      await service.getChart('EQTokenAddress', '1D', 'USD');
      assert.equal(new URL(requestedUrl).searchParams.get('token'), 'EQTokenAddress');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  void it('validates price chart requests before contacting the upstream', async () => {
    assert.equal((await app.inject({ method: 'GET', url: '/prices/chart/TON?period=bad&base=USD' })).statusCode, 400);
    assert.equal((await app.inject({ method: 'GET', url: '/prices/chart/TON?period=1D&base=USD' })).statusCode, 503);
  });

  void it('returns known-address and launch config contracts', async () => {
    const known = await app.inject({ method: 'GET', url: '/known-addresses' });
    assert.ok(known.json().knownAddresses.mainnet);
    const config = await app.inject({ method: 'GET', url: '/utils/get-config' });
    assert.equal(typeof config.json().now, 'number');
    assert.equal(config.json().country, 'US');
  });

  void it('returns an empty referrer when attribution is not configured', async () => {
    assert.deepEqual((await app.inject({ method: 'GET', url: '/referrer/get' })).json(), {});
  });

  void it('rejects private content-proxy targets', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/proxy/download-json?url=http%3A%2F%2F127.0.0.1%2Fmetadata.json',
    });
    assert.equal(response.statusCode, 400);
  });

  void it('serves validated JSON and Lottie proxy responses', async () => {
    const proxyApp = await buildApp({
      cache,
      prices: new PriceService(cache, '', '', ''),
      upstreams,
      allowedOrigins: [],
      timeoutMs: 50,
      dataDir,
      contentProxy: {
        fetchJson: (url) => Promise.resolve({ source: url }),
        fetchLottie: () => Promise.resolve({
          body: Buffer.from('{"v":"5.5.0"}'),
          contentType: 'application/json',
        }),
      },
    });
    try {
      const json = await proxyApp.inject({
        method: 'GET',
        url: '/proxy/download-json?url=https%3A%2F%2Fexample.com%2Fmanifest.json',
      });
      assert.equal(json.statusCode, 200);
      assert.deepEqual(json.json(), { source: 'https://example.com/manifest.json' });
      assert.equal(json.headers['cache-control'], 'public, max-age=300');

      const lottie = await proxyApp.inject({
        method: 'GET',
        url: '/proxy/download-lottie?url=https%3A%2F%2Fexample.com%2Fanimation.json',
      });
      assert.equal(lottie.statusCode, 200);
      assert.equal(lottie.headers['content-type'], 'application/json');
      assert.equal(lottie.body, '{"v":"5.5.0"}');
    } finally {
      await proxyApp.close();
    }
  });

  void it('discards legacy account config payloads', async () => {
    const response = await app.inject({ method: 'POST', url: '/account-config', payload: { address: 'not-logged' } });
    assert.deepEqual(response.json(), {});
  });

  void it('validates TON DNS addresses and reports upstream outages', async () => {
    assert.equal((await app.inject({ method: 'GET', url: '/dns/getDomains' })).statusCode, 400);
    assert.equal((await app.inject({ method: 'GET', url: '/dns/getDomains?address=invalid' })).statusCode, 400);
    const address = 'UQBjKqthWBE6GEcqb_epTRFrQ1niS6Z1Z1MHMwR-mnAYRoYr';
    assert.equal((await app.inject({ method: 'GET', url: `/dns/getDomains?address=${address}` })).statusCode, 502);
  });

  void it('reports liveness and readiness separately', async () => {
    assert.deepEqual((await app.inject({ method: 'GET', url: '/' })).json(), { ok: true, service: 'yohi-api' });
    assert.equal((await app.inject({ method: 'GET', url: '/healthz' })).statusCode, 200);
    assert.equal((await app.inject({ method: 'GET', url: '/readyz' })).statusCode, 200);
  });
});

void describe('proxy boundary', () => {
  void it('rejects unknown methods and paths', async () => {
    assert.equal((await app.inject({ method: 'DELETE', url: '/toncenter/mainnet/api/v2/jsonRPC' })).statusCode, 404);
    assert.equal((await app.inject({ method: 'GET', url: '/tonapi/mainnet/v2/evil' })).statusCode, 404);
    assert.equal((await app.inject({ method: 'GET', url: '/toncenter/mainnet/admin' })).statusCode, 404);
  });

  void it('allows every Toncenter v3 path used by the Air SDK', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () => Promise.resolve(new Response('{}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    try {
      assert.equal((await app.inject({
        method: 'GET', url: '/toncenter/mainnet/api/v3/walletStates?address=test',
      })).statusCode, 200);
      assert.equal((await app.inject({
        method: 'GET', url: '/toncenter/mainnet/api/v3/pendingTraces?ext_msg_hash=test',
      })).statusCode, 200);
      assert.equal((await app.inject({
        method: 'GET', url: '/toncenter/mainnet/api/v3/jetton/wallets?owner_address=test',
      })).statusCode, 200);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  void it('fails over reads but never duplicates a broadcast', async () => {
    let secondaryHits = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.startsWith('https://secondary.example')) {
        secondaryHits += 1;
        return Promise.resolve(new Response('{"fallback":true}', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }));
      }
      return Promise.resolve(new Response('{"primary":false}', {
        status: 503,
        headers: { 'content-type': 'application/json' },
      }));
    };
    const proxyApp = await buildApp({
      cache,
      prices: new PriceService(cache, '', '', ''),
      upstreams: {
        ...upstreams,
        toncenter: {
          ...upstreams.toncenter,
          mainnet: { primary: 'https://primary.example', secondary: 'https://secondary.example' },
        },
      },
      allowedOrigins: [],
      timeoutMs: 500,
      dataDir,
    });
    try {
      const read = await proxyApp.inject({ method: 'GET', url: '/toncenter/mainnet/api/v3/actions' });
      assert.equal(read.statusCode, 200);
      assert.deepEqual(read.json(), { fallback: true });
      const broadcast = await proxyApp.inject({
        method: 'POST',
        url: '/toncenter/mainnet/api/v2/jsonRPC',
        payload: { jsonrpc: '2.0', id: 1, method: 'sendBoc', params: { boc: 'signed' } },
      });
      assert.equal(broadcast.statusCode, 503);
      assert.equal(secondaryHits, 1);
    } finally {
      globalThis.fetch = originalFetch;
      await proxyApp.close();
    }
  });

  void it('enforces CORS allowlisting', async () => {
    const denied = await app.inject({ method: 'OPTIONS', url: '/assets', headers: { origin: 'https://evil.example', 'access-control-request-method': 'GET' } });
    assert.equal(denied.headers['access-control-allow-origin'], undefined);
    const allowed = await app.inject({ method: 'OPTIONS', url: '/assets', headers: { origin: 'https://yohi.io', 'access-control-request-method': 'GET' } });
    assert.equal(allowed.headers['access-control-allow-origin'], 'https://yohi.io');
  });
});
