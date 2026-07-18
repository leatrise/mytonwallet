import type { ApiBalanceBySlug, ApiTokenWithPrice } from '../types';

import { PRICELESS_TOKEN_HASHES, TINY_TRANSFER_MAX_COST } from '../../config';
import { toBig } from '../../util/decimals';

export function hasQualifyingWalletBalance(
  balancesBySlug: ApiBalanceBySlug,
  tokensBySlug: Record<string, ApiTokenWithPrice>,
  shouldShowLowValueTokens: boolean,
) {
  return Object.entries(balancesBySlug).some(([slug, balance]) => {
    if (balance <= 0n) return false;
    if (shouldShowLowValueTokens) return true;

    const token = tokensBySlug[slug];
    if (!token) return false;
    if (token.codeHash && PRICELESS_TOKEN_HASHES.has(token.codeHash)) return true;

    return toBig(balance, token.decimals)
      .mul(token.priceUsd ?? 0)
      .gte(TINY_TRANSFER_MAX_COST);
  });
}

export function hasReachedWalletDiscoveryGap(
  scannedThroughIndex: number,
  lastQualifyingIndex: number,
  gapLimit: number,
) {
  return scannedThroughIndex - lastQualifyingIndex >= gapLimit;
}
