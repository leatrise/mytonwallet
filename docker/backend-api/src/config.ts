import type { Network, Provider, Upstreams } from './types.js';

const networks: Network[] = ['mainnet', 'testnet'];
const providers: Provider[] = ['toncenter', 'tonapi'];

function env(name: string, fallback = '') {
  return process.env[name]?.trim() || fallback;
}

export function loadUpstreams(): Upstreams {
  const result = {} as Upstreams;
  for (const provider of providers) {
    result[provider] = {} as Record<Network, Upstreams[Provider][Network]>;
    for (const network of networks) {
      const prefix = `${provider}_${network}`.toUpperCase();
      result[provider][network] = {
        primary: env(`${prefix}_URL`),
        secondary: env(`${prefix}_SECONDARY_URL`) || undefined,
        apiKey: env(`${prefix}_API_KEY`) || undefined,
        secondaryApiKey: env(`${prefix}_SECONDARY_API_KEY`) || undefined,
      };
    }
  }
  return result;
}

export const runtimeConfig = {
  host: env('HOST', '0.0.0.0'),
  port: Number(env('PORT', '3000')),
  valkeyUrl: env('VALKEY_URL', 'redis://valkey:6379/0'),
  allowedOrigins: env('ALLOWED_ORIGINS', 'https://yohi.io,capacitor://localhost,http://localhost')
    .split(',').map((x) => x.trim()).filter(Boolean),
  priceUrl: env('PRICE_URL'),
  priceChartUrl: env('PRICE_CHART_URL', 'https://tonapi.io/v2/rates/chart'),
  priceApiKey: env('PRICE_API_KEY'),
  requestTimeoutMs: Number(env('UPSTREAM_TIMEOUT_MS', '8000')),
};
