import type { Cache, PriceSnapshot } from './types.js';

const CACHE_KEY = 'yohi:prices:v1';
const FRESH_SECONDS = 300;
const RETAIN_SECONDS = 7 * 24 * 60 * 60;
const EMPTY_RATES = { USD: '1', EUR: '0', RUB: '0', CNY: '0', BTC: '0', TON: '0' };

type TonApiRate = {
  prices?: Record<string, number>;
  diff_24h?: Record<string, string>;
};

type TonApiResponse = {
  rates?: Record<string, TonApiRate>;
};

function parsePercent(value: string | undefined) {
  if (!value) return 0;
  const parsed = Number(value.replace('%', '').replace('−', '-'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function tonApiSlug(token: string) {
  // The client asset catalog uses the first ten lowercase address characters.
  return token === 'TON' ? 'toncoin' : `ton-${token.toLowerCase().slice(0, 10)}`;
}

export function normalizePriceResponse(body: unknown): PriceSnapshot | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const value = body as Record<string, unknown>;

  const responseRates = value.rates;
  const tonApiRates = responseRates && typeof responseRates === 'object'
    && typeof (responseRates as Record<string, unknown>).TON === 'object';

  // Preserve the existing provider contract for custom PRICE_URL endpoints.
  if (value.prices && value.rates && !tonApiRates) {
    const snapshot = value as Partial<PriceSnapshot>;
    return {
      updatedAt: Date.now(),
      prices: snapshot.prices ?? {},
      rates: { ...EMPTY_RATES, ...snapshot.rates },
    };
  }

  const rates = (value as TonApiResponse).rates;
  const ton = rates?.TON;
  if (!rates || !ton?.prices) return undefined;

  const usdPrice = ton.prices.USD;
  if (!usdPrice || !Number.isFinite(usdPrice)) return undefined;

  const normalizedRates: Record<string, string> = { ...EMPTY_RATES };
  for (const currency of Object.keys(normalizedRates)) {
    const price = ton.prices[currency];
    if (typeof price === 'number' && Number.isFinite(price)) {
      normalizedRates[currency] = String(price / usdPrice);
    }
  }

  const prices: PriceSnapshot['prices'] = {};
  for (const [token, rate] of Object.entries(rates)) {
    const priceUsd = rate.prices?.USD;
    if (typeof priceUsd !== 'number' || !Number.isFinite(priceUsd)) continue;
    prices[tonApiSlug(token)] = {
      priceUsd,
      percentChange24h: parsePercent(rate.diff_24h?.USD),
    };
  }

  return { updatedAt: Date.now(), prices, rates: normalizedRates };
}

export class PriceService {
  constructor(
    private readonly cache: Cache,
    private readonly url: string,
    private readonly apiKey: string,
  ) {}

  async get(): Promise<PriceSnapshot | undefined> {
    let cached: PriceSnapshot | undefined;
    try {
      const raw = await this.cache.get(CACHE_KEY);
      cached = raw ? JSON.parse(raw) as PriceSnapshot : undefined;
      if (cached && Date.now() - cached.updatedAt < FRESH_SECONDS * 1000) return cached;
    } catch {
      // A cache outage must not block chain operations.
    }

    if (this.url) {
      try {
        const response = await fetch(this.url, {
          headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {},
          signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) throw new Error(`Price upstream returned ${response.status}`);
        const snapshot = normalizePriceResponse(await response.json());
        if (!snapshot) throw new Error('Unsupported price response format');
        await this.cache.set(CACHE_KEY, JSON.stringify(snapshot), RETAIN_SECONDS).catch(() => undefined);
        return snapshot;
      } catch {
        return cached;
      }
    }
    return cached;
  }

  static emptyRates() {
    return { ...EMPTY_RATES };
  }
}
