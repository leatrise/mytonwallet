import { Address } from '@ton/core';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import type { Cache } from './types.js';

import { DomainService } from './domains.js';

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

const ACCOUNT_RAW = '0:632aab6158113a18472a6ff7a94d116b4359e24ba67567530733047e9a701846';
const NFT_RAW = '0:f1e336111a112caba4666b33cb311df529e3b1bcbde9fe7715f2e171346729de';
const LINKED_RAW = '0:83dfd552e63729b472fcbcc8c45ebcc6691702558b68ec7527e1ba403a0f31a8';
const COLLECTION_RAW = '0:b774d95eb20543f186c06b371ab88ad704f7e256130caf96189368a7d0cb6ccf';
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

void describe('TON DNS aggregation', () => {
  void it('returns the client contract and caches account results', async () => {
    const requestedUrls: string[] = [];
    globalThis.fetch = (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      requestedUrls.push(url);
      if (url.includes('/nfts?')) {
        return Promise.resolve(jsonResponse({
          nft_items: [{
            address: NFT_RAW,
            collection: { address: COLLECTION_RAW, name: 'TON DNS Domains' },
            metadata: { name: 'example.ton' },
            dns: 'example.ton',
          }],
        }));
      }
      if (url.includes('/methods/get_last_fill_up_time')) {
        return Promise.resolve(jsonResponse({
          success: true,
          exit_code: 0,
          stack: [{ type: 'num', num: '0x65920080' }],
          decoded: { last_fill_up_time: 1_704_067_200 },
        }));
      }
      if (url.includes('/v2/dns/example.ton/resolve')) {
        return Promise.resolve(jsonResponse({ wallet: { address: LINKED_RAW } }));
      }
      return Promise.resolve(jsonResponse({ error: 'unexpected request' }, 404));
    };

    const cache = new MemoryCache();
    const service = new DomainService(cache, { primary: 'https://tonapi.example' }, 500);
    const account = Address.parseRaw(ACCOUNT_RAW).toString({ bounceable: false });
    const expectedNftAddress = Address.parseRaw(NFT_RAW).toString({ bounceable: true });
    const expectedLinkedAddress = Address.parseRaw(LINKED_RAW).toString({ bounceable: true });

    const first = await service.get(account);
    assert.deepEqual(first[expectedNftAddress], {
      domain: 'example.ton',
      linkedAddress: expectedLinkedAddress,
      lastFillUpTime: '2024-01-01T00:00:00.000Z',
      nft: {
        address: NFT_RAW,
        collection: { address: COLLECTION_RAW, name: 'TON DNS Domains' },
        metadata: { name: 'example.ton' },
        dns: 'example.ton',
      },
    });
    assert.equal(requestedUrls.length, 3);

    assert.deepEqual(await service.get(account), first);
    assert.equal(requestedUrls.length, 3);
    assert.match(requestedUrls[0]!, /indirect_ownership=false/);
  });

  void it('keeps renewal metadata when no wallet DNS record exists', async () => {
    globalThis.fetch = (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/nfts?')) {
        return Promise.resolve(jsonResponse({
          nft_items: [{ address: NFT_RAW, dns: 'unlinked.ton', collection: { address: COLLECTION_RAW } }],
        }));
      }
      if (url.includes('/methods/')) {
        return Promise.resolve(jsonResponse({
          success: true, exit_code: 0, decoded: { last_fill_up_time: 1_704_067_200 },
        }));
      }
      return Promise.resolve(jsonResponse({ error: 'not resolved' }, 404));
    };

    const service = new DomainService(new MemoryCache(), { primary: 'https://tonapi.example' }, 500);
    const result = await service.get(ACCOUNT_RAW);
    const item = result[Address.parseRaw(NFT_RAW).toString({ bounceable: true })];
    assert.equal(item?.domain, 'unlinked.ton');
    assert.equal(item?.linkedAddress, undefined);
  });

  void it('rejects malformed account addresses before contacting TONAPI', async () => {
    let fetchCount = 0;
    globalThis.fetch = () => {
      fetchCount += 1;
      return Promise.resolve(jsonResponse({}));
    };
    const service = new DomainService(new MemoryCache(), { primary: 'https://tonapi.example' }, 500);
    await assert.rejects(() => service.get('not-an-address'));
    assert.equal(fetchCount, 0);
  });
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
