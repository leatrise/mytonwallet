import type { ApiTokenWithPrice } from '../types';

import { PRICELESS_TOKEN_HASHES } from '../../config';
import { hasQualifyingWalletBalance, hasReachedWalletDiscoveryGap } from './walletDiscovery';

const TOKEN: ApiTokenWithPrice = {
  name: 'Token',
  symbol: 'TKN',
  slug: 'ton-token',
  decimals: 6,
  chain: 'ton',
  priceUsd: 0.01,
  percentChange24h: 0,
};

describe('hasQualifyingWalletBalance', () => {
  it('accepts any positive balance when low-value tokens are shown', () => {
    expect(hasQualifyingWalletBalance({ unknown: 1n }, {}, true)).toBe(true);
  });

  it('ignores unknown and low-value balances when low-value tokens are hidden', () => {
    expect(hasQualifyingWalletBalance({ unknown: 1n }, {}, false)).toBe(false);
    expect(hasQualifyingWalletBalance(
      { [TOKEN.slug]: 999_999n },
      { [TOKEN.slug]: TOKEN },
      false,
    )).toBe(false);
  });

  it('accepts balances at the configured value threshold', () => {
    expect(hasQualifyingWalletBalance(
      { [TOKEN.slug]: 1_000_000n },
      { [TOKEN.slug]: TOKEN },
      false,
    )).toBe(true);
  });

  it('accepts positive balances from the priceless-token allowlist', () => {
    const codeHash = PRICELESS_TOKEN_HASHES.values().next().value!;
    const pricelessToken = { ...TOKEN, codeHash, priceUsd: 0 };

    expect(hasQualifyingWalletBalance(
      { [TOKEN.slug]: 1n },
      { [TOKEN.slug]: pricelessToken },
      false,
    )).toBe(true);
  });
});

describe('hasReachedWalletDiscoveryGap', () => {
  it('stops after twenty empty indices from the start', () => {
    expect(hasReachedWalletDiscoveryGap(18, -1, 20)).toBe(false);
    expect(hasReachedWalletDiscoveryGap(19, -1, 20)).toBe(true);
  });

  it('restarts the gap after a qualifying index', () => {
    expect(hasReachedWalletDiscoveryGap(22, 3, 20)).toBe(false);
    expect(hasReachedWalletDiscoveryGap(23, 3, 20)).toBe(true);
  });
});
