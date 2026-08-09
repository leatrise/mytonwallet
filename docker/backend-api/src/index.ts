import { fileURLToPath } from 'node:url';

import { loadUpstreams, runtimeConfig } from './config.js';
import { buildApp } from './app.js';
import { ValkeyCache } from './cache.js';
import { PriceService } from './prices.js';

const cache = new ValkeyCache(runtimeConfig.valkeyUrl);
const dataDir = fileURLToPath(new URL('../data', import.meta.url));
const app = await buildApp({
  cache,
  prices: new PriceService(
    cache,
    runtimeConfig.priceUrl,
    runtimeConfig.priceChartUrl,
    runtimeConfig.priceApiKey,
  ),
  upstreams: loadUpstreams(),
  allowedOrigins: runtimeConfig.allowedOrigins,
  timeoutMs: runtimeConfig.requestTimeoutMs,
  dataDir,
});

const shutdown = async () => {
  await app.close();
  await cache.close();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
await app.listen({ host: runtimeConfig.host, port: runtimeConfig.port });
