import React, { memo } from '../../../../../lib/teact/teact';
import { getActions } from '../../../../../global';

import useLang from '../../../../../hooks/useLang';
import useLastCallback from '../../../../../hooks/useLastCallback';

import Button from '../../../../ui/Button';

import styles from './Buttons.module.scss';

function SettingsButton() {
  const { switchToSettings } = getActions();
  const lang = useLang();

  const handleClick = useLastCallback(() => {
    switchToSettings();
  });

  return (
    <Button
      className={styles.button}
      isText
      isSimple
      kind="transparent"
      ariaLabel={lang('Settings')}
      onClick={handleClick}
    >
      <i className="icon-settings" aria-hidden />
    </Button>
  );
}

export default memo(SettingsButton);
