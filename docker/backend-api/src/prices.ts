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

type TonApiChartResponse = {
  points?: unknown;
};

const PERIOD_SECONDS: Record<string, number> = {
  '1D': 24 * 60 * 60,
  '7D': 7 * 24 * 60 * 60,
  '1M': 30 * 24 * 60 * 60,
  '3M': 90 * 24 * 60 * 60,
  '1Y': 365 * 24 * 60 * 60,
  ALL: 10 * 365 * 24 * 60 * 60,
};

function normalizeTonApiChartToken(assetId: string) {
  const token = assetId.replace(/^ton:/i, '');
  return token.toUpperCase() === 'TON' ? 'ton' : token;
}

function parsePercent(value: string | undefined) {
  if (!value) return 0;
  const parsed = Number(value.replace('%', '').replace('−', '-'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function tonApiSlug(token: string) {
  // The client asset catalog uses the first ten lowercase address characters.
  const addressPart = token.replace(/[^a-z\d]/gi, '').slice(0, 10).toLowerCase();
  return token === 'TON' ? 'toncoin' : `ton-${addressPart}`;
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

export function normalizeChartResponse(body: unknown): number[][] | undefined {
  const points = (body as TonApiChartResponse | undefined)?.points;
  if (!Array.isArray(points)) return undefined;

  return points
    .filter((point): point is [number, number] => (
      Array.isArray(point)
      && point.length >= 2
      && typeof point[0] === 'number'
      && Number.isFinite(point[0])
      && typeof point[1] === 'number'
      && Number.isFinite(point[1])
    ))
    .map(([timestamp, price]): [number, number] => [timestamp, price])
    .sort((a, b) => a[0] - b[0]);
}

export class PriceService {
  constructor(
    private readonly cache: Cache,
    private readonly url: string,
    private readonly chartUrl: string,
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

  async getChart(assetId: string, period: string, base: string): Promise<number[][] | undefined> {
    const periodSeconds = PERIOD_SECONDS[period];
    if (!this.chartUrl || !periodSeconds) return undefined;

    const endDate = Math.floor(Date.now() / 1000);
    const target = new URL(this.chartUrl);
    target.searchParams.set('token', normalizeTonApiChartToken(assetId));
    target.searchParams.set('currency', base.toLowerCase());
    target.searchParams.set('start_date', String(Math.max(0, endDate - periodSeconds)));
    target.searchParams.set('end_date', String(endDate));
    target.searchParams.set('points_count', '289');

    try {
      const response = await fetch(target, {
        headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {},
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return undefined;
      return normalizeChartResponse(await response.json());
    } catch {
      return undefined;
    }
  }
}
