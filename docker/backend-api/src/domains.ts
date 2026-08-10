import { Address } from '@ton/core';

import type { Cache, Upstream } from './types.js';

const CACHE_PREFIX = 'yohi:domains:v1:';
const CACHE_SECONDS = 30;
const PAGE_SIZE = 100;
const MAX_DOMAINS = 500;
const LOOKUP_CONCURRENCY = 8;
const TON_DNS_COLLECTION = Address.parse('EQC3dNlesgVD8YbAazcauIrXBPfiVhMMr5YYk2in0Mtsz0Bz').toRawString();

type TonApiNft = {
  address?: string;
  dns?: string;
  metadata?: { name?: unknown };
  collection?: { address?: string };
  [key: string]: unknown;
};

type TonApiNftPage = { nft_items?: TonApiNft[] };
type TonApiMethodResult = {
  success?: boolean;
  exit_code?: number;
  decoded?: { last_fill_up_time?: unknown };
  stack?: Array<{ type?: string; num?: string }>;
};
type TonApiDnsResult = { wallet?: { address?: string } };

export type DomainData = Record<string, {
  domain: string;
  linkedAddress?: string;
  lastFillUpTime: string;
  nft: TonApiNft;
}>;

function normalizeAddress(address: string, bounceable: boolean) {
  return Address.parse(address).toString({ urlSafe: true, bounceable });
}

function parseFillUpTime(result: TonApiMethodResult) {
  if (!result.success || result.exit_code !== 0) return undefined;
  const decoded = Number(result.decoded?.last_fill_up_time);
  if (Number.isSafeInteger(decoded) && decoded > 0) return decoded;

  const raw = result.stack?.find((item) => item.type === 'num')?.num;
  if (!raw) return undefined;
  const value = Number(BigInt(raw));
  return Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

export class DomainService {
  readonly #pending = new Map<string, Promise<DomainData>>();

  constructor(
    private readonly cache: Cache,
    private readonly upstream: Upstream,
    private readonly timeoutMs: number,
  ) {}

  async get(address: string): Promise<DomainData> {
    const account = Address.parse(address).toRawString();
    const cacheKey = `${CACHE_PREFIX}${account}`;
    try {
      const cached = await this.cache.get(cacheKey);
      if (cached) return JSON.parse(cached) as DomainData;
    } catch {
      // A cache outage must not block domain discovery.
    }

    const pending = this.#pending.get(account);
    if (pending) return pending;

    const request = this.#load(account).then(async (result) => {
      await this.cache.set(cacheKey, JSON.stringify(result), CACHE_SECONDS).catch(() => undefined);
      return result;
    }).finally(() => this.#pending.delete(account));
    this.#pending.set(account, request);
    return request;
  }

  async #load(account: string) {
    if (!this.upstream.primary) throw new Error('TONAPI mainnet upstream is not configured');

    const nfts: TonApiNft[] = [];
    for (let offset = 0; offset < MAX_DOMAINS; offset += PAGE_SIZE) {
      const page = await this.#request<TonApiNftPage>('/v2/accounts/'
        + `${encodeURIComponent(account)}/nfts?collection=${encodeURIComponent(TON_DNS_COLLECTION)}`
        + `&limit=${PAGE_SIZE}&offset=${offset}&indirect_ownership=false`);
      const items = Array.isArray(page.nft_items) ? page.nft_items : [];
      nfts.push(...items.slice(0, MAX_DOMAINS - nfts.length));
      if (items.length < PAGE_SIZE || nfts.length >= MAX_DOMAINS) break;
    }

    const entries = await mapConcurrent(nfts, LOOKUP_CONCURRENCY, (nft) => this.#loadDomain(nft));
    return Object.fromEntries(entries.filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)));
  }

  async #loadDomain(nft: TonApiNft) {
    if (!nft.address) return undefined;
    try {
      if (nft.collection?.address && Address.parse(nft.collection.address).toRawString() !== TON_DNS_COLLECTION) {
        return undefined;
      }
      const domain = nft.dns || (typeof nft.metadata?.name === 'string' ? nft.metadata.name : undefined);
      if (!domain?.toLowerCase().endsWith('.ton')) return undefined;

      const method = await this.#request<TonApiMethodResult>(
        `/v2/blockchain/accounts/${encodeURIComponent(nft.address)}/methods/get_last_fill_up_time`,
      );
      const lastFillUpTime = parseFillUpTime(method);
      if (!lastFillUpTime) return undefined;

      let linkedAddress: string | undefined;
      try {
        const resolved = await this.#request<TonApiDnsResult>(`/v2/dns/${encodeURIComponent(domain)}/resolve`);
        if (resolved.wallet?.address) linkedAddress = normalizeAddress(resolved.wallet.address, true);
      } catch {
        // A domain without a wallet record is valid and still needs renewal metadata.
      }

      const nftAddress = normalizeAddress(nft.address, true);
      return [nftAddress, {
        domain,
        ...(linkedAddress && { linkedAddress }),
        lastFillUpTime: new Date(lastFillUpTime * 1000).toISOString(),
        nft,
      }] as const;
    } catch {
      return undefined;
    }
  }

  async #request<T>(path: string): Promise<T> {
    const candidates = [
      [this.upstream.primary, this.upstream.apiKey],
      [this.upstream.secondary, this.upstream.secondaryApiKey],
    ].filter((candidate): candidate is [string, string | undefined] => Boolean(candidate[0]));

    let lastError: Error | undefined;
    for (const [baseUrl, apiKey] of candidates) {
      try {
        const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
          headers: {
            accept: 'application/json',
            ...(apiKey && { 'x-api-key': apiKey, Authorization: `Bearer ${apiKey}` }),
          },
          signal: AbortSignal.timeout(this.timeoutMs),
        });
        if (response.ok) return await response.json() as T;
        lastError = new Error(`TONAPI returned ${response.status}`);
        if (response.status < 500 && response.status !== 429) break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('TONAPI request failed');
      }
    }
    throw lastError ?? new Error('TONAPI request failed');
  }
}

async function mapConcurrent<T, R>(items: T[], concurrency: number, iteratee: (item: T) => Promise<R>) {
  const result = new Array<R>(items.length);
  let nextIndex = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      result[index] = await iteratee(items[index]!);
    }
  }));
  return result;
}
