import React, { type ElementRef, memo } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type { StakingStateStatus } from '../../../../util/staking';

import buildClassName from '../../../../util/buildClassName';
import { vibrate } from '../../../../util/haptics';
import { STAKING_TAB_TEXT_VARIANTS } from './helpers/stakingLabels';

import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import Button from '../../../ui/Button';

import styles from './PortraitActions.module.scss';

interface OwnProps {
  isTestnet?: boolean;
  isLedger?: boolean;
  stakingStatus: StakingStateStatus;
  isSwapDisabled?: boolean;
  isStakingDisabled?: boolean;
  isOnRampDisabled?: boolean;
  isOffRampDisabled?: boolean;
  containerRef: ElementRef<HTMLDivElement>;
  onEarnClick: NoneToVoidFunction;
}

function PortraitActions({
  stakingStatus,
  isStakingDisabled,
  isSwapDisabled,
  onEarnClick,
}: OwnProps) {
  const {
    startTransfer, startSwap, openReceiveModal,
  } = getActions();

  const lang = useLang();

  const addBuyButtonName = lang('Add');
  const sendButtonName = lang('Send');

  const handleStartSwap = useLastCallback(() => {
    void vibrate();

    startSwap();
  });

  const handleStartTransfer = useLastCallback(() => {
    void vibrate();

    startTransfer();
  });

  const handleAddBuyClick = useLastCallback(() => {
    void vibrate();

    openReceiveModal();
  });

  const handleEarnClick = useLastCallback(() => {
    void vibrate();

    onEarnClick();
  });

  return (
    <div className={styles.container}>
      <div className={styles.buttons}>
        <Button
          isSimple
          className={styles.button}
          onClick={handleAddBuyClick}
        >
          <i className={buildClassName(styles.buttonIcon, 'icon-action-add')} aria-hidden />
          {addBuyButtonName}
        </Button>
        <Button
          isSimple
          className={styles.button}
          onClick={handleStartTransfer}
        >
          <i className={buildClassName(styles.buttonIcon, 'icon-action-send')} aria-hidden />
          {sendButtonName}
        </Button>
        {!isSwapDisabled && (
          <Button
            isSimple
            className={styles.button}
            onClick={handleStartSwap}
          >
            <i className={buildClassName(styles.buttonIcon, 'icon-action-swap')} aria-hidden />
            {lang('Swap')}
          </Button>
        )}
        {!isStakingDisabled && (
          <Button
            isSimple
            className={buildClassName(styles.button, stakingStatus !== 'inactive' && styles.button_purple)}
            onClick={handleEarnClick}
          >
            <i className={buildClassName(styles.buttonIcon, 'icon-action-earn')} aria-hidden />
            {lang(STAKING_TAB_TEXT_VARIANTS[stakingStatus])}
          </Button>
        )}
      </div>
    </div>
  );
}

export default memo(PortraitActions);
