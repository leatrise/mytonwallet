import React, { memo } from '../../../../lib/teact/teact';
import { withGlobal } from '../../../../global';

import { ContentTab } from '../../../../global/types';

import { NO_AGENT, NO_PORTFOLIO } from '../../../../config';
import { selectCurrentAccountId } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';

import Agent from '../../../agent/Agent';
import Portfolio from '../../../portfolio/Portfolio';
import Settings from '../../../settings/Settings';
import Transition from '../../../ui/Transition';
import LandscapeContent from '../Content/LandscapeContent';

import styles from './LandscapeLayout.module.scss';

interface OwnProps {
  onStakedTokenClick: NoneToVoidFunction;
}

interface StateProps {
  areSettingsOpen?: boolean;
  isAgentOpen?: boolean;
  isPortfolioOpen?: boolean;
}

function LandscapeLayout({
  onStakedTokenClick, areSettingsOpen, isAgentOpen, isPortfolioOpen,
}: OwnProps & StateProps) {
  function renderSlide(isActive: boolean, _isFrom: boolean, currentKey: ContentTab) {
    switch (currentKey) {
      case ContentTab.Agent:
        if (NO_AGENT) return <LandscapeContent onStakedTokenClick={onStakedTokenClick} />;
        return (
          <div className={styles.standaloneWrapper}>
            <Agent isActive={isActive} />
          </div>
        );
      case ContentTab.Explore:
        return <LandscapeContent onStakedTokenClick={onStakedTokenClick} />;
      case ContentTab.Settings:
        return (
          <div className={styles.settingsWrapper}>
            <Settings isActive={isActive} />
          </div>
        );
      case ContentTab.Portfolio:
        if (NO_PORTFOLIO) return <LandscapeContent onStakedTokenClick={onStakedTokenClick} />;
        return (
          <div className={buildClassName(styles.standaloneWrapper, styles.portfolioWrapper)}>
            <Portfolio isActive={isActive} />
          </div>
        );
      default:
        return <LandscapeContent onStakedTokenClick={onStakedTokenClick} />;
    }
  }

  function getActiveKey() {
    if (areSettingsOpen) return ContentTab.Settings;
    if (!NO_AGENT && isAgentOpen) return ContentTab.Agent;
    if (!NO_PORTFOLIO && isPortfolioOpen) return ContentTab.Portfolio;

    return ContentTab.Overview;
  }

  const activeKey = getActiveKey();

  return (
    <Transition
      name="semiFade"
      activeKey={activeKey}
      className={styles.transition}
      slideClassName={styles.slide}
    >
      {renderSlide}
    </Transition>
  );
}

export default memo(
  withGlobal<OwnProps>(
    (global): StateProps => {
      const {
        areSettingsOpen, isAgentOpen, isPortfolioOpen,
      } = global;

      return {
        areSettingsOpen, isAgentOpen, isPortfolioOpen,
      };
    },
    (global, _, stickToFirst) => stickToFirst(selectCurrentAccountId(global)),
  )(LandscapeLayout),
);
