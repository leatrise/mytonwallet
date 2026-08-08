import type { Cache, PriceSnapshot } from './types.js';

const CACHE_KEY = 'yohi:prices:v1';
const FRESH_SECONDS = 300;
const RETAIN_SECONDS = 7 * 24 * 60 * 60;
const EMPTY_RATES = { USD: '1', EUR: '0', RUB: '0', CNY: '0', BTC: '0', TON: '0' };

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
        const body = await response.json() as Partial<PriceSnapshot>;
        const snapshot: PriceSnapshot = {
          updatedAt: Date.now(),
          prices: body.prices ?? {},
          rates: { ...EMPTY_RATES, ...body.rates },
        };
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
