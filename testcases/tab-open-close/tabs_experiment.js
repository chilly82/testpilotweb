// A Securable Module to be loaded with Cuddlefish.
// This is the remote code for the Tabs Experiment, to be hosted from the server.
// (Think about where to put the remote experiments in the Hg repo!!)

const MY_EXPERIMENT_ID = 1;

// These constants are defined in experiment_data_store... duplicated here.
// How to use them without duplicating them?
const TYPE_INT_32 = 0;
const TYPE_DOUBLE = 1;

const TabsExperimentConstants = {
  // constants for event_code
  OPEN_EVENT: 1,
  CLOSE_EVENT: 2,
  DRAG_EVENT: 3,
  DROP_EVENT: 4,
  SWITCH_EVENT: 5,
  LOAD_EVENT: 6,
  STARTUP_EVENT: 7,
  SHUTDOWN_EVENT: 8,
  OPEN_WINDOW_EVENT: 9,
  CLOSE_WINDOW_EVENT: 10,

  // constants for ui_method
  UI_CLICK: 1,
  UI_KEYBOARD: 2,
  UI_MENU: 3,
  UI_LINK: 4,
  UI_URLENTRY: 5,
  UI_SEARCH: 6,
  UI_BOOKMARK: 7,
  UI_HISTORY: 8
};

// TODO: Firefox blurs/focuses, i.e. user switches application?
// Tabs that are 'permanenly open'

const TABS_EXPERIMENT_FILE = "testpilot_tabs_experiment_results.sqlite";
/* In this schema, each row represents a single UI event. */

const TABS_TABLE_NAME = "testpilot_tabs_experiment";

/* Schema is generated from columns; the property names are also used to access
 * the properties of the uiEvent objects passed to storeEvent, and to create
 * the column headers of the CSV file generated by barfAllData.
 * event.timeStamp is milliseconds since epoch */
var TABS_EXPERIMENT_COLUMNS =  [{property: "event_code", type: TYPE_INT_32},
                                {property: "tab_position", type: TYPE_INT_32},
                                {property: "tab_window", type: TYPE_INT_32},
                                {property: "ui_method", type: TYPE_INT_32},
                                {property: "tab_site_hash", type: TYPE_INT_32},
                                {property: "num_tabs", type: TYPE_INT_32},
                                {property: "timestamp", type: TYPE_DOUBLE}];

exports.experimentInfo = {
  startDate: null, // Null start date means we can start immediately.
  duration: "",
  testName: "Tab Open/Close Study",
  testId: MY_EXPERIMENT_ID,
  testInfoUrl: "",  // TODO
  optInRequired: false,
  basicPanel: true,
  versionNumber: 2 // for minor changes in format within the same experiment
};

exports.dataStoreInfo = {
  fileName: TABS_EXPERIMENT_FILE,
  tableName: TABS_TABLE_NAME,
  columns: TABS_EXPERIMENT_COLUMNS
};


var ObserverHelper = {
  /* Utility singleton that helps dealing with multiple instances of
   * TabsExperimentObserver.  Not exported. */
  _nextWindowId: 1,
  _nextTabGroupId: 0,
  /* TODO make hash persistent across sessions and windows...
   * may need to have an experiment_data_store for it. */
  _tempHostHash: {},
  _installedObservers: [],
  getTabGroupIdFromUrl: function(url) {
    var ioService = Cc["@mozilla.org/network/io-service;1"]
                      .getService(Ci.nsIIOService);
    // TODO this next line can sometimes throw a data:no exception.
    let host = ioService.newURI(url, null, null).host;

    if (this._tempHostHash[host] == undefined) {
      this._tempHostHash[host] = this._nextTabGroupId;
      this._nextTabGroupId ++;
    }
    return this._tempHostHash[host];
  },

  getNextWindowId: function() {
    let id = this._nextWindowId;
    this._nextWindowId ++;
    return id;
  },

  onObserverInstalled: function(instance) {
    this._installedObservers.push(instance);
  },

  cleanup: function() {
    // Uninstall all installed observers
    for (let i = 0; i < this._installedObservers.length; i++) {
      this._installedObservers[i].uninstall();
    }
  }
};

/* Ensure that when this module is unloaded, all observers get uninstalled
 * too. */
require("unload").when(
  function myDestructor() {
    ObserverHelper.cleanup();
  });


// The tabs experiment observer!
exports.Observer = function TabsExperimentObserver(window, store) {
  this._init(window, store);
};
exports.Observer.prototype = {
  _init: function TabsExperimentObserver__init(window, store) {
    this._lastEventWasClick = null;
    this._window = window;
    this._dataStore = store;
    this._windowId = ObserverHelper.getNextWindowId();
    this._registeredListeners = [];
    this.install();
    ObserverHelper.onObserverInstalled(this);
  },

  _listen: function TPS__listener(container, eventName, method, catchCap) {
    // Keep a record of this so that we can automatically unregister during
    // uninstall:
    let self = this;
    let handler = function(event) {
      method.call(self, event);
    };
    container.addEventListener(eventName, handler, catchCap);

    this._registeredListeners.push(
      {container: container, eventName: eventName, handler: handler,
       catchCap: catchCap});
  },

  install: function TabsExperimentObserver_install() {
    let browser = this._window.getBrowser();
    let container = browser.tabContainer;
    console.info("Installing tabsExperimentObserver on a window!\n");
    // Can we catch the click event during the capturing phase??
    // last argument of addEventListener is true to catch during capture, false to catch during bubbling.

    this._listen(container, "TabOpen", this.onTabOpened, false);
    this._listen(container, "TabClose", this.onTabClosed, false);
    this._listen(container, "TabSelect", this.onTabSelected, false);
    this._listen(container, "dragstart", this.onDragStart, false);
    this._listen(container, "drop", this.onDrop, false);
    // TODO what other events can we listen for here?  What if we put the
    // listener on the browser or the window?

    this._listen(container, "mousedown", this.onClick, true);
    this._listen(container, "mouseup", this.onMouseUp, true);
    this._listen(container, "keydown", this.onKey, true);

    // apparently there are events called ondragover, ondragleave, ondragstart,
    // ondragend, and ondrop.

    // For URL loads, we register a DOMContentLoaded on the appcontent:
    let appcontent = this._window.document.getElementById("appcontent");
    if (appcontent) {
      this._listen(appcontent, "DOMContentLoaded", this.onUrlLoad, true);
    }

    // Record the window-opening event:
    this._dataStore.storeEvent({
      event_code: TabsExperimentConstants.OPEN_WINDOW_EVENT,
      timestamp: Date.now(),
      num_tabs: container.itemCount,
      tab_window: self._windowId
    });
  },

  uninstall: function TabsExperimentObserver_uninstall() {
    for (let i = 0; i < this._registeredListeners.length; i++) {
      let rl = this._registeredListeners[i];
      rl.container.removeEventListener(rl.eventName, rl.handler, rl.catchCap);
    }

    // Record the window-closing event:
    // (TODO uninstall is not always the result of a window close... these
    // are two separate things now)
    console.info("Uninstalling tabsExperimentObserver.\n");
    let windowId = this._windowId;
    this._dataStore.storeEvent({
      event_code: TabsExperimentConstants.CLOSE_WINDOW_EVENT,
      timestamp: Date.now(),
      tab_window: windowId
    });
  },

  onClick: function TabsExperimentObserver_onClick(event) {
    console.info("You clicked on tabs bar.\n");
    this._lastEventWasClick = true;
  },

  onMouseUp: function TabsExperimentObserver_onMouseUp(event) {
    console.info("You released your click on the tabs bar.\n");
    this._lastEventWasClick = false;
  },

  onDragStart: function TabsExperimentObserver_onDragStart(event) {
    console.info("You started dragging a tab.\n");
    let index = event.target.parentNode.getIndexOfItem(event.target);
    console.info("Index is " + index + "\n");
    let windowId = this._windowId;
    this._dataStore.storeEvent({
      event_code: TabsExperimentConstants.DRAG_EVENT,
      timestamp: Date.now(),
      tab_position: index,
      num_tabs: event.target.parentNode.itemCount,
      ui_method: TabsExperimentConstants.UI_CLICK,
      tab_window: windowId
    });
  },

  onDrop: function TabsExperimentObserver_onDrop(event) {
    console.info("You dropped a dragged tab.\n");
    let index = event.target.parentNode.getIndexOfItem(event.target);
    console.info("Index is " + index + "\n");
    let windowId = this._windowId;
    this._dataStore.storeEvent({
      event_code: TabsExperimentConstants.DROP_EVENT,
      timestamp: Date.now(),
      tab_position: index,
      num_tabs: event.target.parentNode.itemCount,
      ui_method: TabsExperimentConstants.UI_CLICK,
      tab_window: windowId
    });
  },

  getUrlInTab: function TabsExperimentObserver_getUrlInTab(index) {
    let tabbrowser = this._window.getBrowser();
    let currentBrowser = tabbrowser.getBrowserAtIndex(index);
    if (!currentBrowser.currentURI) {
      return null;
    }
    return currentBrowser.currentURI.spec;
  },

  onUrlLoad: function TabsExperimentObserver_onUrlLoaded(event) {
    let url = event.originalTarget.URL;
    let tabBrowserSet = this._window.getBrowser();
    let browser = tabBrowserSet.getBrowserForDocument(event.target);
    if (!browser) {
      return;
    }

    let index = null;
    for (let i = 0; i < tabBrowserSet.browsers.length; i ++) {
      if (tabBrowserSet.getBrowserAtIndex(i) == browser) {
	index = i;
	break;
      }
    }
    let groupId = ObserverHelper.getTabGroupIdFromUrl(url);
    let windowId = this._windowId;
    // TODO ui_method for this load event.
    this._dataStore.storeEvent({
      event_code: TabsExperimentConstants.LOAD_EVENT,
      timestamp: Date.now(),
      tab_position: index,
      num_tabs: tabBrowserSet.browsers.length,
      tab_site_hash: groupId,
      tab_window: windowId
    });
  },

  onTabOpened: function TabsExperimentObserver_onTabOpened(event) {
    console.info("Tab opened. Last event was click? " + this._lastEventWasClick + "\n");
    // TODO Not registering click here on open events -- because mouse up and
    // mousedown both happen before the tab open event.
    let uiMethod = this._lastEventWasClick ? TabsExperimentConstants.UI_CLICK:TabsExperimentConstants.UI_KEYBOARD;
    console.info("Recording uiMethod of " + uiMethod + "\n");
    let index = event.target.parentNode.getIndexOfItem(event.target);
    let windowId = this._windowId;
    let url = this.getUrlInTab(index);
    if (url == "about:blank") {
      // Url will be undefined if you open a new blank tab, but it will be
      // "about:blank" if you opened the tab through a link (or by opening a
      // recently-closed tab from the history menu).  Go figure.
      uiMethod = TabsExperimentConstants.UI_LINK;
    }
    this._dataStore.storeEvent({
      event_code: TabsExperimentConstants.OPEN_EVENT,
      timestamp: Date.now(),
      tab_position: index,
      num_tabs: event.target.parentNode.itemCount,
      ui_method: uiMethod,
      tab_window: windowId
    });
    // TODO add tab_position, tab_parent_position, tab_window, tab_parent_window,
    // ui_method, tab_site_hash, and num_tabs.
    // event has properties:
    // target, originalTarget, currentTarget, type.
    // Target is the tab.  currentTarget is the tabset (xul:tabs).
  },

  onTabClosed: function TabsExperimentObserver_onTabClosed(event) {
    console.info("Tab closed.\n");
    let index = event.target.parentNode.getIndexOfItem(event.target);
    let windowId = this._windowId;
    // TODO not registering click here on close events.
    // cuz mouseup and mousedown both happen before the tab open event.
    let uiMethod = this._lastEventWasClick ? TabsExperimentConstants.UI_CLICK:TabsExperimentConstants.UI_KEYBOARD;
    this._dataStore.storeEvent({
      event_code: TabsExperimentConstants.CLOSE_EVENT,
      timestamp: Date.now(),
      tab_position: index,
      num_tabs: event.target.parentNode.itemCount,
      ui_method: uiMethod,
      tab_window: windowId
    });
  },

  onTabSelected: function TabsExperimentObserver_onTabSelected(event) {
    // TODO there is an automatic tab-selection event after each open and
    // after each close.  Right now these get listed as 'keyboard', which is
    // not accurate.  Should we try to figure them out and mark them as auto-
    // matic?
    let index = event.target.parentNode.getIndexOfItem(event.target);
    let windowId = this._windowId;
    console.info("Tab selected.  Last event was click? " + this._lastEventWasClick + "\n");
    let uiMethod = this._lastEventWasClick ? TabsExperimentConstants.UI_CLICK:TabsExperimentConstants.UI_KEYBOARD;

    console.info("Recording uiMethod of " + uiMethod + "\n");
    this._dataStore.storeEvent({
      event_code: TabsExperimentConstants.SWITCH_EVENT,
      timestamp: Date.now(),
      tab_position: index,
      num_tabs: event.target.parentNode.itemCount,
      ui_method: uiMethod,
      tab_window: windowId
    });
  }
};

// TODO my experimentID must be passed along to other pages such as status-quit.html.
exports.webContent = {
  inProgressHtml: ' <h2>Hello Test Pilot,</h2> \
    <h3>Thank you for helping with our <a href="https://testpilot.mozillalabs.com/testcases/tab-open-close.html">"Tab Open/Close" </a>study.</h3> \
    <p><b>This study aims to understand what users typically do next after opening or closing a tab.</b> You don\'t have to do anything except use the Web normally.</p> \
    <p>When you interact with tabs, Test Pilot will record what you do (open/close/switch etc) and when you do it (timestamp). We will then analyze this data to detect patterns that will help us build a better browser. More information is available on <a href="https://testpilot.mozillalabs.com/testcases/tab-open-close.html">the study\'s website.</a></p> \
    <p>So, buckle up and get ready for your first flight! </p> \
    <h4>This study is currently running.  It will end <span id="test-end-time"></span>. If you don\'t want to participate, please <a href="chrome://testpilot/content/status-quit.html">click here to quit</a>.</h4> \
    <h3>The fine print:</h3> \
      <ul> \
	<li>The websites (URLs) that you visit will never be recorded.</li> \
    <li>At the end of the test, you will be able to choose if you want to submit your test data or not.</li> \
       <li>All test data you submit will be anonymized and will not be personally identifiable.</li> \
      </ul> \
	<div class="dataBox"> \
          <h3>View Your Data:</h3> \
 	  <p>You are using the <span id="md-locale"></span> language version of Firefox <span id="md-version"></span> on <span id="md-os"></span> with <span id="md-num-ext"></span> installed.</p> \
	  <p>The graphs below are just two examples of the kind of questions we\'ll be able to answer using the data collected in this study.  If you like, you can look at <a onclick="showRawData(1);">the complete raw data set</a> which we hope will be able to answer many other questions as well.</p> \
	  <p>1. How many tabs did you have open at a time? <a href="https://testpilot.mozillalabs.com/testcases/tab-open-close.html">(More info...)</a></p> \
          <canvas id="tabs-over-time-canvas" width="450" height="220"></canvas> \
	  <p>2. When you closed a tab, did you stay on the default tab or did you switch to another one immediately? <a href="https://testpilot.mozillalabs.com/testcases/tab-open-close.html">(More info...)</a></p> \
        <canvas id="tab-close-pie-chart-canvas" width="350" height="250"></canvas> \
        </div>',

  completedHtml: '<h2>Congratulations!</h2> \
    <h3>You have completed the <a href="">Tab Open/Close Study</a>!</h3> \
    <p>&nbsp;</p> \
    <div class="home_callout_continue"><img class="homeIcon" src="chrome://testpilot/skin/images/home_computer.png"> <span id="upload-status"><a onclick="uploadData();">Submit your data &raquo;</a></span></div> \
    <p>&nbsp;</p> \
    <p>We will analyze the data submitted by all Test Pilots in order to to detect patterns that will help us build a better browser.  When the analysis is done, we will let you know where you can see the results.</p>      <p><a onclick="showRawData(1);">Click here</a> to see a display of all the collected data in its raw form, exactly as it will be sent. If there is anything there that you are not comfortable with sending to us, you can <a href="chrome://testpilot/content/status-quit.html">click here to delete the data without sending it</a>.</p> \
    <h3>The fine print:</h3> \
    <ul> \
      <li>The websites (URLs) that you visit have not been recorded.</li> \
      <li>All test data you submit will be anonymized and will not be personally identifiable.</li> \
      <li>After you submit the data, it will be deleted from your computer.</li> \
    </ul> \
    <div class="dataBox"> \
    <h3>View Your Data:</h3>\
    <p>You are using the <span id="md-locale"></span> language version of Firefox <span id="md-version"></span> on <span id="md-os"></span> with <span id="md-num-ext"></span> installed.</p> \
    <p>1. How many tabs did you have open at a time? <a href="https://testpilot.mozillalabs.com/testcases/tab-open-close.html">(More info...)</a></p> \
    <canvas id="tabs-over-time-canvas" width="450" height="220"></canvas> \
    <p>2. When you closed a tab, did you stay on the default tab or did you switch to another one immediately? <a href="https://testpilot.mozillalabs.com/testcases/tab-open-close.html">(More info...)</a></p> \
    <canvas id="tab-close-pie-chart-canvas" width="350" height="250"></canvas> \
    </div>',

  upcomingHtml: "",    // For tests which don't start automatically, this gets
                       // displayed in status page before test starts.

  _drawNumTabsTimeSeries: function(rawData, canvas, graphUtils) {
    let data = [];
    let row;
    let boundingRect = { originX: 40,
                         originY: 210,
                         width: 400,
                         height: 200 };
    // Time Series plot of tabs over time:
    let firstTimestamp = null;
    let maxTabs = 0;
    for (row = 0; row < rawData.length; row++) {
      if (row == 0) {
        firstTimestamp = rawData[row].timestamp;
      }
      if (rawData[row].num_tabs > maxTabs) {
        maxTabs = rawData[row].num_tabs;
      }
      if (row > 0) {
        data.push( [rawData[row].timestamp - firstTimestamp,
	            rawData[row-1].num_tabs] );
      }
      data.push( [ rawData[row].timestamp - firstTimestamp,
                   rawData[row].num_tabs ] );
    }

    let lastTimestamp = data[data.length - 1][0];

    let red = "rgb(200,0,0)";
    let axes = {xScale: boundingRect.width / lastTimestamp,
                yScale: boundingRect.height / maxTabs,
                xMin: firstTimestamp,
                xMax: lastTimestamp,
                yMin: 0,
                yMax: maxTabs };
    // drawTimeSeriesGraph is defined in client-side graphs.js
    graphUtils.drawTimeSeriesGraph(canvas, data, boundingRect, axes, red);
  },

  _drawTabClosePieChart: function(rawData, canvas, graphUtils) {
    let origin = {x: 125, y: 125};
    let radius = 100;
    let row;

    // Pie chart of close-and-switch vs. close-and-don't-switch
    let minTimeDiff = 5000; // 5 seconds

    let numCloseEvents = 0;
    let numSwitchEvents = 0;
    let numClosedAndSwitched = 0;
    let lastCloseEventTime = 0;

    // TODO should we interpret it differently if you close a tab that
    // is not the one you're looking at?
    for (row=0; row < rawData.length; row++) {
      if ( rawData[row].event_code == TabsExperimentConstants.CLOSE_EVENT ) {
        numCloseEvents ++;
        numSwitchEvents = 0;
        lastCloseEventTime = rawData[row].timestamp;
      }
      if (rawData[row].event_code == TabsExperimentConstants.SWITCH_EVENT ) {
       numSwitchEvents ++;
        if (numSwitchEvents == 2 &&
           (rawData[row].timestamp - lastCloseEventTime) <= minTimeDiff) {
          numClosedAndSwitched ++;
        }
      }
    }

    if (numCloseEvents > 0) {
      let data = [numClosedAndSwitched,
                  numCloseEvents - numClosedAndSwitched];
      graphUtils.drawPieChart(canvas, data, origin, radius,
                   ["rgb(200, 0, 0)", "rgb(0, 0, 200)"],
                   ["Switched", "Stayed"]);
    }
  },

  onPageLoad: function(experiment, document, graphUtils) {
    // Get raw data:
    let rawData = experiment.dataStoreAsJSON;
    // Graph it:
    if (rawData.length > 0) {
      let canvas1 = document.getElementById("tabs-over-time-canvas");
      let canvas2 = document.getElementById("tab-close-pie-chart-canvas");
      this._drawNumTabsTimeSeries(rawData, canvas1, graphUtils);
      this._drawTabClosePieChart(rawData, canvas2, graphUtils);
      return;
    } // Otherwise, there's nothing to graph.
  }
};