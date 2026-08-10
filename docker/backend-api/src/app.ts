import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import { Address } from '@ton/core';
import Fastify from 'fastify';
import { readFile, stat } from 'node:fs/promises';
import { join, normalize } from 'node:path';
import WebSocket from 'ws';

import type { Cache, Upstreams } from './types.js';

import { DomainService } from './domains.js';
import { PriceService } from './prices.js';
import { proxyRequest } from './proxy.js';

interface Dependencies {
  cache: Cache;
  prices: PriceService;
  upstreams: Upstreams;
  allowedOrigins: string[];
  timeoutMs: number;
  dataDir: string;
}

export async function buildApp(deps: Dependencies) {
  const domains = new DomainService(deps.cache, deps.upstreams.tonapi.mainnet, deps.timeoutMs);
  const app = Fastify({
    logger: { level: 'warn', redact: ['req.headers.authorization', 'req.headers.x-api-key'] },
    bodyLimit: 64 * 1024,
    requestTimeout: 15_000,
    trustProxy: true,
  });
  await app.register(cors, {
    // Fastify CORS uses null to indicate that no callback error occurred.
    // eslint-disable-next-line no-null/no-null
    origin: (origin, cb) => cb(null, !origin || deps.allowedOrigins.includes(origin)),
    methods: ['GET', 'POST', 'OPTIONS'],
  });
  await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });
  await app.register(websocket, { options: { maxPayload: 64 * 1024 } });

  const assetsFile = JSON.parse(await readFile(`${deps.dataDir}/assets.json`, 'utf8')) as { assets: Record<string, unknown>[] };
  const knownAddresses = JSON.parse(await readFile(`${deps.dataDir}/known-addresses.json`, 'utf8')) as object;

  app.get('/', () => ({ ok: true, service: 'yohi-api' }));
  app.get('/healthz', () => ({ ok: true }));
  app.get('/readyz', async (_request, reply) => {
    const valkey = await deps.cache.ping();
    const configuredUpstreams = Object.values(deps.upstreams).every((networks) => (
      Object.values(networks).every((upstream) => Boolean(upstream.primary))
    ));
    return reply.code(valkey && configuredUpstreams ? 200 : 503).send({ ok: valkey && configuredUpstreams, valkey, upstreams: configuredUpstreams });
  });

  app.get('/assets', async () => {
    const snapshot = await deps.prices.get();
    return assetsFile.assets.map((asset) => ({
      ...asset,
      priceUsd: snapshot?.prices[String(asset.slug)]?.priceUsd ?? 0,
      percentChange24h: snapshot?.prices[String(asset.slug)]?.percentChange24h ?? 0,
    }));
  });

  app.get<{ Params: { '*': string } }>('/static/*', async (request, reply) => {
    const relativePath = request.params['*'];
    const staticRoot = normalize(`${deps.dataDir}/static`);
    const filePath = normalize(join(staticRoot, relativePath));
    if (!filePath.startsWith(`${staticRoot}/`)) {
      return reply.code(400).send({ error: 'Invalid static asset path' });
    }

    try {
      const fileStat = await stat(filePath);
      if (!fileStat.isFile()) return reply.code(404).send({ error: 'Asset not found' });
      const extension = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
      const contentTypes: Record<string, string> = {
        '.avif': 'image/avif',
        '.gif': 'image/gif',
        '.ico': 'image/x-icon',
        '.jpeg': 'image/jpeg',
        '.jpg': 'image/jpeg',
        '.json': 'application/json; charset=utf-8',
        '.mp3': 'audio/mpeg',
        '.png': 'image/png',
        '.svg': 'image/svg+xml',
        '.webp': 'image/webp',
      };
      reply.header('Cache-Control', 'public, max-age=31536000, immutable');
      return reply.type(contentTypes[extension] ?? 'application/octet-stream').send(await readFile(filePath));
    } catch {
      return reply.code(404).send({ error: 'Asset not found' });
    }
  });

  app.post<{ Body: { assets?: unknown } }>('/assets', {
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const addresses = request.body?.assets;
    if (!Array.isArray(addresses) || addresses.length > 100 || addresses.some((x) => typeof x !== 'string' || x.length > 80)) {
      return reply.code(400).send({ error: 'assets must contain at most 100 contract addresses' });
    }
    const snapshot = await deps.prices.get();
    return assetsFile.assets.filter((asset) => addresses.includes(asset.tokenAddress)).map((asset) => ({
      slug: asset.slug,
      type: asset.type,
      priceUsd: snapshot?.prices[String(asset.slug)]?.priceUsd ?? 0,
      percentChange24h: snapshot?.prices[String(asset.slug)]?.percentChange24h ?? 0,
    }));
  });

  app.get('/currency-rates', async () => ({ rates: (await deps.prices.get())?.rates ?? PriceService.emptyRates() }));
  app.get<{ Params: { assetId: string }; Querystring: { period?: string; base?: string } }>(
    '/prices/chart/:assetId',
    async (request, reply) => {
      const { assetId } = request.params;
      const period = request.query.period ?? '';
      const base = request.query.base ?? '';
      if (!/^[A-Za-z0-9:_-]{1,80}$/.test(assetId)
        || !['1D', '7D', '1M', '3M', '1Y', 'ALL'].includes(period)
        || !/^[A-Za-z]{2,10}$/.test(base)) {
        return reply.code(400).send({ error: 'Invalid price chart parameters' });
      }

      const chart = await deps.prices.getChart(assetId, period, base);
      return chart
        ? reply.send(chart)
        : reply.code(503).send({ error: 'Price chart unavailable' });
    },
  );
  app.get('/known-addresses', () => knownAddresses);
  app.get('/utils/get-config', () => ({
    isLimited: false,
    isCopyStorageEnabled: false,
    supportAccountsCount: 10,
    now: Date.now(),
    country: 'US',
    isUpdateRequired: false,
    isWebSocketEnabled: true,
    isTonConnectAnalyticsEnabled: false,
    shouldAutoSwitchToAir: false,
  }));
  app.post('/account-config', () => ({}));

  app.get<{ Querystring: { address?: string } }>('/dns/getDomains', {
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const { address } = request.query;
    if (!address || address.length > 80) return reply.code(400).send({ error: 'Invalid TON address' });
    try {
      Address.parse(address);
    } catch {
      return reply.code(400).send({ error: 'Invalid TON address' });
    }

    try {
      return await domains.get(address);
    } catch {
      return reply.code(502).send({ error: 'TON DNS data unavailable' });
    }
  });

  app.get<{ Params: { network: 'mainnet' | 'testnet' } }>(
    '/toncenter/:network/api/streaming/v2/ws',
    { websocket: true },
    (client, request) => {
      const upstream = deps.upstreams.toncenter[request.params.network];
      if (!upstream?.primary) return client.close(1013, 'Upstream unavailable');
      const target = new URL('/api/streaming/v2/ws', upstream.primary);
      const query = new URL(request.raw.url ?? '', 'http://internal').searchParams;
      query.forEach((value, key) => target.searchParams.append(key, value));
      if (upstream.apiKey) target.searchParams.set('api_key', upstream.apiKey);
      target.protocol = target.protocol === 'http:' ? 'ws:' : 'wss:';

      const provider = new WebSocket(target, {
        handshakeTimeout: deps.timeoutMs,
        maxPayload: 2 * 1024 * 1024,
      });
      client.on('message', (data, binary) => {
        if (provider.readyState === WebSocket.OPEN) provider.send(data, { binary });
      });
      provider.on('message', (data, binary) => {
        if (client.readyState === WebSocket.OPEN) client.send(data, { binary });
      });
      provider.on('error', () => client.close(1011, 'Provider error'));
      provider.on('close', (code) => client.close(code));
      client.on('close', () => provider.close());
    },
  );

  app.all('/toncenter/*', (request, reply) => proxyRequest(request, reply, deps.upstreams, deps.timeoutMs));
  app.all('/tonapi/*', (request, reply) => proxyRequest(request, reply, deps.upstreams, deps.timeoutMs));
  app.setNotFoundHandler((_request, reply) => reply.code(404).send({ error: 'Not found' }));
  return app;
}
