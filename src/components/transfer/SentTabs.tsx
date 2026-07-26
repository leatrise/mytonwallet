import React, { memo } from '../../lib/teact/teact';

import type { TabWithProperties } from '../ui/TabList';

import buildClassName from '../../util/buildClassName';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import TabList from '../ui/TabList';

import styles from './SentTabs.module.scss';

const enum TabContent {
  Send,
}

function SentTabs() {
  const lang = useLang();

  const handleSwitchTab = useLastCallback(() => undefined);
  const tabs: TabWithProperties<TabContent>[] = [{
    id: TabContent.Send,
    title: lang('Send'),
    className: styles.tab,
  }];

  return (
    <div className={styles.root}>
      <TabList
        tabs={tabs}
        activeTab={TabContent.Send}
        onSwitchTab={handleSwitchTab}
        className={buildClassName(styles.tabs, 'content-tabslist')}
        overlayClassName={styles.tabsOverlay}
      />
    </div>
  );
}

export default memo(SentTabs);
