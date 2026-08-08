import { Redis } from 'ioredis';

import type { Cache } from './types.js';

export class ValkeyCache implements Cache {
  readonly #redis: Redis;

  constructor(url: string) {
    this.#redis = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    this.#redis.on('error', () => undefined);
  }

  async get(key: string) {
    await this.#connect();
    return this.#redis.get(key);
  }

  async set(key: string, value: string, ttlSeconds: number) {
    await this.#connect();
    await this.#redis.set(key, value, 'EX', ttlSeconds);
  }

  async ping() {
    try {
      await this.#connect();
      return await this.#redis.ping() === 'PONG';
    } catch {
      return false;
    }
  }

  close() {
    if (this.#redis.status !== 'end') this.#redis.disconnect();
    return Promise.resolve();
  }

  async #connect() {
    if (this.#redis.status === 'wait') await this.#redis.connect();
  }
}
