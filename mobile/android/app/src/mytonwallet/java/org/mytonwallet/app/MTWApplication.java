package com.yohi.wallet;

import com.capacitorjs.plugins.statusbar.StatusBarPluginDelegate;

public class MTWApplication extends MTWApplicationBase implements StatusBarPluginDelegate {

  @Override
  public void didUpdateStatusBar(String newStatusBar) {
    setCurrentStatusBar(newStatusBar);
  }
}
