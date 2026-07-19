import React, { memo } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { ApiNft } from '../../api/types';
import type { Theme } from '../../global/types';

import { IS_CORE_WALLET } from '../../config';
import { ACCENT_COLORS } from '../../util/accentColor/constants';
import buildClassName from '../../util/buildClassName';
import { DEFAULT_CARD_ADDRESS } from '../customizeWallet/constants';

import useAppTheme from '../../hooks/useAppTheme';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import styles from './AccentColorSelector.module.scss';

interface OwnProps {
  accentColorIndex?: number;
  nftAddresses?: string[];
  nftsByAddress?: Record<string, ApiNft>;
  theme: Theme;
  isNftBuyingDisabled?: boolean;
}

function AccentColorSelector({
  accentColorIndex,
  theme,
}: OwnProps) {
  const { setAccentColor } = getActions();

  const lang = useLang();

  const appTheme = useAppTheme(theme);

  const handleAccentColorClick = useLastCallback((colorIndex?: number) => {
    setAccentColor({ accentColorIndex: colorIndex });
  });

  function renderColorButton(color?: string, index?: number) {
    const isSelected = accentColorIndex === index;

    return (
      <button
        key={color || DEFAULT_CARD_ADDRESS}
        type="button"
        disabled={isSelected}
        style={color ? `--current-accent-color: ${color}` : undefined}
        className={buildClassName(styles.colorButton, isSelected && styles.colorButtonCurrent)}
        aria-label={lang('Change Palette')}
        onClick={() => handleAccentColorClick(index)}
      />
    );
  }

  if (IS_CORE_WALLET) {
    return undefined;
  }

  return (
    <>
      <div className={styles.colorList}>
        {renderColorButton()}
        {ACCENT_COLORS[appTheme].map((color, index) => renderColorButton(color, index))}
      </div>
    </>
  );
}

export default memo(AccentColorSelector);
