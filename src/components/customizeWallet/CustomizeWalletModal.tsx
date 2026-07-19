import React, { memo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiBaseCurrency, ApiCurrencyRates } from '../../api/types';
import type { Account, CardBackground, Theme, UserToken } from '../../global/types';

import {
  selectAccount,
  selectAccountSettings,
  selectCurrentAccountId,
  selectCurrentAccountTokens,
} from '../../global/selectors';
import buildClassName from '../../util/buildClassName';

import useLang from '../../hooks/useLang';
import useScrolledState from '../../hooks/useScrolledState';

import AccentColorSelector from '../common/AccentColorSelector';
import Modal from '../ui/Modal';
import ModalHeader from '../ui/ModalHeader';
import WalletCardPreview from './WalletCardPreview';

import modalStyles from '../ui/Modal.module.scss';
import styles from './CustomizeWalletModal.module.scss';

const CARD_BACKGROUNDS: Array<{ id: CardBackground; label: string }> = [
  { id: 'default', label: 'Yohi' },
  { id: 'orange', label: 'Amber' },
  { id: 'green', label: 'Green' },
  { id: 'sea', label: 'Ocean' },
  { id: 'purple', label: 'Purple' },
  { id: 'pink', label: 'Pink' },
  { id: 'red', label: 'Red' },
];

interface OwnProps {
  isOpen?: boolean;
}

interface StateProps {
  account?: Account;
  cardBackground: CardBackground;
  accentColorIndex?: number;
  tokens?: UserToken[];
  baseCurrency?: ApiBaseCurrency;
  currencyRates?: ApiCurrencyRates;
  theme: Theme;
  returnTo?: 'settings' | 'accountSelector';
}

function CustomizeWalletModal({
  isOpen,
  account,
  cardBackground,
  accentColorIndex,
  tokens,
  baseCurrency,
  currencyRates,
  theme,
  returnTo,
}: OwnProps & StateProps) {
  const { closeCustomizeWalletModal, setCardBackground } = getActions();
  const lang = useLang();
  const { handleScroll, isScrolled } = useScrolledState();

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeCustomizeWalletModal}
      dialogClassName={styles.modalDialog}
      hasCloseButton
    >
      <ModalHeader
        className={styles.modalHeader}
        title={lang('Background')}
        withNotch={isScrolled}
        onBackButtonClick={returnTo ? closeCustomizeWalletModal : undefined}
        onClose={returnTo ? undefined : closeCustomizeWalletModal}
      />

      <div
        className={buildClassName(modalStyles.transition, 'custom-scroll', styles.content)}
        onScroll={handleScroll}
      >
        <div className={styles.walletCardPreviews}>
          <WalletCardPreview
            account={account}
            tokens={tokens}
            baseCurrency={baseCurrency}
            currencyRates={currencyRates}
            cardBackground={cardBackground}
            variant="middle"
          />
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionHeader}>{lang('Background')}</h3>
          <div className={styles.backgroundGrid}>
            {CARD_BACKGROUNDS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                className={buildClassName(
                  styles.backgroundOption,
                  id !== 'default' && id,
                  cardBackground === id && styles.backgroundOptionActive,
                )}
                aria-label={label}
                aria-pressed={cardBackground === id}
                onClick={() => setCardBackground({ background: id })}
              >
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionHeader}>{lang('Palette')}</h3>
          <AccentColorSelector accentColorIndex={accentColorIndex} theme={theme} />
        </div>
      </div>
    </Modal>
  );
}

export default memo(withGlobal<OwnProps>((global): StateProps => {
  const accountId = selectCurrentAccountId(global);
  const accountSettings = accountId ? selectAccountSettings(global, accountId) : undefined;

  return {
    account: accountId ? selectAccount(global, accountId) : undefined,
    cardBackground: accountSettings?.cardBackground ?? 'default',
    accentColorIndex: accountSettings?.accentColorIndex,
    tokens: accountId ? selectCurrentAccountTokens(global) : undefined,
    baseCurrency: global.settings.baseCurrency,
    currencyRates: global.currencyRates,
    theme: global.settings.theme,
    returnTo: global.customizeWalletReturnTo,
  };
})(CustomizeWalletModal));
