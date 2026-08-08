export type Network = 'mainnet' | 'testnet';
export type Provider = 'toncenter' | 'tonapi';

export interface Cache {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  ping(): Promise<boolean>;
  close(): Promise<void>;
}

export interface Upstream {
  primary: string;
  secondary?: string;
  apiKey?: string;
  secondaryApiKey?: string;
}

export type Upstreams = Record<Provider, Record<Network, Upstream>>;

export interface PriceSnapshot {
  updatedAt: number;
  prices: Record<string, { priceUsd: number; percentChange24h: number }>;
  rates: Record<string, string>;
}
