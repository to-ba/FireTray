/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

var EXPORTED_SYMBOLS = [ "firetray" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/ctypes.jsm");
// FIXME: can't subscribeLibsForClosing([appind3])
// https://bugs.launchpad.net/ubuntu/+source/firefox/+bug/1393256
Cu.import("resource://firetray/ctypes/linux/appindicator.jsm");
Cu.import("resource://firetray/ctypes/linux/gobject.jsm");
Cu.import("resource://firetray/ctypes/linux/gtk.jsm");
Cu.import("resource://firetray/commons.js");
firetray.Handler.subscribeLibsForClosing([gobject, gtk]);

let log = firetray.Logging.getLogger("firetray.AppIndicator");

if ("undefined" == typeof(firetray.StatusIcon))
  log.error("This module MUST be imported from/after FiretrayStatusIcon !");


firetray.AppIndicator = {
  initialized: false,
  callbacks: {},
  indicator: null,

  init: function() {
    this.indicator = appind3.app_indicator_new(
      FIRETRAY_APPINDICATOR_ID,
      firetray.StatusIcon.defaultAppIconName,
      appind3.APP_INDICATOR_CATEGORY_COMMUNICATIONS
    );
    appind3.app_indicator_set_status(this.indicator,
                                     appind3.APP_INDICATOR_STATUS_ACTIVE);
    appind3.app_indicator_set_menu(this.indicator,
                                   firetray.PopupMenu.menu); // mandatory
    log.debug("indicator="+this.indicator);

    this.addCallbacks();

    for (let item in firetray.PopupMenu.menuItem) {
      firetray.PopupMenu.showItem(firetray.PopupMenu.menuItem[item]);
    }

    this.attachMiddleClickCallback();
    firetray.Handler.setIconTooltipDefault();

    this.initialized = true;
    return true;
  },

  shutdown: function() {
    log.debug("Disabling AppIndicator");
    gobject.g_object_unref(this.indicator);
    this.initialized = false;
  },

  addCallbacks: function() {
    this.callbacks.connChanged = appind3.ConnectionChangedCb_t(
      firetray.AppIndicator.onConnectionChanged); // void return, no sentinel
    gobject.g_signal_connect(this.indicator, "connection-changed",
                             firetray.AppIndicator.callbacks.connChanged, null);

    this.callbacks.onScroll = appind3.OnScrollCb_t(
      firetray.AppIndicator.onScroll); // void return, no sentinel
    gobject.g_signal_connect(this.indicator, "scroll-event",
                             firetray.AppIndicator.callbacks.onScroll, null);
  },

  attachMiddleClickCallback: function() {
    let pref = firetray.Utils.prefService.getIntPref("middle_click");
    if (pref === FIRETRAY_MIDDLE_CLICK_ACTIVATE_LAST) {
      item = firetray.PopupMenu.menuItem.activateLast;
      firetray.PopupMenu.showItem(firetray.PopupMenu.menuItem.activateLast);
    } else if (pref === FIRETRAY_MIDDLE_CLICK_SHOW_HIDE) {
      item = firetray.PopupMenu.menuItem.showHide;
      firetray.PopupMenu.hideItem(firetray.PopupMenu.menuItem.activateLast);
    } else {
      log.error("Unknown pref value for 'middle_click': "+pref);
      return false;
    }
    let menuItemShowHideWidget = ctypes.cast(item, gtk.GtkWidget.ptr);
    appind3.app_indicator_set_secondary_activate_target(
      this.indicator, menuItemShowHideWidget);
    return true;
  },

  onConnectionChanged: function(indicator, connected, data) {
    log.debug("AppIndicator connection-changed: "+connected);
  },

  // https://bugs.kde.org/show_bug.cgi?id=340978 broken under KDE4
  onScroll: function(indicator, delta, direction, data) { // AppIndicator*, gint, GdkScrollDirection, gpointer
    log.debug("onScroll: "+direction);
    firetray.StatusIcon.onScroll(direction);
  },

};  // AppIndicator

firetray.StatusIcon.initImpl =
  firetray.AppIndicator.init.bind(firetray.AppIndicator);

firetray.StatusIcon.shutdownImpl =
  firetray.AppIndicator.shutdown.bind(firetray.AppIndicator);


firetray.Handler.setIconImageDefault = function() {
  log.debug("setIconImageDefault");
  appind3.app_indicator_set_icon(firetray.AppIndicator.indicator,
                                 firetray.StatusIcon.defaultAppIconName);
};

firetray.Handler.setIconImageNewMail = function() {
  log.debug("setIconImageNewMail");
  appind3.app_indicator_set_icon(firetray.AppIndicator.indicator,
                                 firetray.StatusIcon.defaultNewMailIconName);
};

firetray.Handler.setIconImageCustom = function(prefname) {
  let prefCustomIconPath = firetray.Utils.prefService.getCharPref(prefname);
  // Undocumented: ok to pass a *path* instead of an icon name! Otherwise we
  // should be changing the default icons (which is maybe a better
  // implementation anyway)...
  appind3.app_indicator_set_icon(firetray.AppIndicator.indicator, prefCustomIconPath);
};

// No tooltips in AppIndicator
// https://bugs.launchpad.net/indicator-application/+bug/527458
firetray.Handler.setIconTooltip = function(toolTipStr) {
  log.debug("setIconTooltip");
  if (!firetray.AppIndicator.indicator)
    return false;
  firetray.PopupMenu.setItemLabel(firetray.PopupMenu.menuItem.tip,
                                  toolTipStr);
  return true;
};

// AppIndicator doesn't support pixbuf https://bugs.launchpad.net/bugs/812067
firetray.Handler.setIconText = function(text, color) { };

firetray.Handler.setIconVisibility = function(visible) {
  if (!firetray.AppIndicator.indicator)
    return false;

  let status = visible ?
        appind3.APP_INDICATOR_STATUS_ACTIVE :
        appind3.APP_INDICATOR_STATUS_PASSIVE;
  appind3.app_indicator_set_status(firetray.AppIndicator.indicator, status);
  return true;
};
