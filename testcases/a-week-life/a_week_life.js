/* Basic panel experiment */
const TYPE_INT_32 = 0;
const TYPE_DOUBLE = 1;

exports.experimentInfo = {
  startDate: null,
  duration: 7,
  testName: "A Week in the Life of a Browser",
  testId: 2,
  testInfoUrl: "https://testpilot.mozillalabs.com/testcases/a-week-life.html",
  testResultsUrl: undefined,
  optInRequired: false,
  recursAutomatically: true,
  recurrenceInterval: 60,
  versionNumber: 1
};

const WeekEventCodes = {
  BROWSER_START: 1,
  BROWSER_SHUTDOWN: 2,
  BROWSER_RESTART: 3,
  BROWSER_ACTIVATE: 4,
  BROWSER_INACTIVE: 5,
  SEARCHBAR_SEARCH: 6,
  SEARCHBAR_SWITCH: 7,
  BOOKMARK_STATUS: 8,
  BOOKMARK_CREATE: 9,
  BOOKMARK_CHOOSE: 10,
  BOOKMARK_MODIFY: 11,
  DOWNLOAD: 12,
  DOWNLOAD_MODIFY: 13,
  ADDON_STATUS: 14,
  ADDON_INSTALL: 15,
  ADDON_UNINSTALL: 16,
  PRIVATE_ON: 17,
  PRIVATE_OFF: 18
};

exports.dataStoreInfo = {
  fileName: "testpilot_week_in_the_life_results.sqlite",
  tableName: "week_in_the_life",
  columns: [{property: "event_code", type: TYPE_INT_32, displayName: "Event"},
            {property: "data1", type: TYPE_INT_32, displayName: "Data 1"},
            {property: "data2", type: TYPE_INT_32, displayName: "Data 2"},
            {property: "data3", type: TYPE_INT_32, displayName: "Data 2"},
            {property: "timestamp", type: TYPE_DOUBLE, displayName: "Time"}]
};

exports.Observer = function WeekLifeObserver(window, store) {
  this._init(window, store);
};
exports.Observer.prototype = {
  _init: function(window, store) {
    this._window = window;
    this._dataStore = store;

    this._inPrivateBrowsingMode = false; // TODO SHOULD BE IN CORE
    this.install();
    // TODO this is going to install per window, which is not what we want.
  },

  onItemAdded: function(itemId, parentId, index, type) {
    console.info("Bookmark added!");
  },

  onItemRemoved: function(itemId, parentId, index, type) {
    console.info("Bookmark removed!");
  },

  onItemChanged: function(bookmarkId, property, isAnnotation,
                          newValue, lastModified, type) {
    console.info("Bookmark modified!");
  },

  onItemVisited: function(bookmarkId, visitId, time) {
    console.info("Bookmark visited!");
  },

  onItemMoved: function(itemId, oldParentId, oldIndex, newParentId,
                        newIndex, type) {
    console.info("Bookmark moved!");
  },

  install: function() {
    // Registering observers goes here!  We observe stuff like crazy!!

    // If I'm using this object itself as the Observer, must implement
    // all the interfaces and support QueryInterface, right?  So I need to be
    // a nsINavBookmarkObserver?
    /*
     topic              data
     private-browsing 	enter
     private-browsing 	exit

     idle 	The length of time the user has been idle, in seconds. 	Sent when the user becomes idle.
     idle-daily 	The length of time the user has been idle, in seconds. 	Sent once a day while the user is idle. Requires Gecko 1.9.2
     back 	The length of time the user has been idle, in seconds.
     See: https://developer.mozilla.org/en/nsIIdleService

     em-action-requested 	item-installed 	A new extension has been installed.
     em-action-requested 	item-upgraded 	A different version of an existing extension has been installed.
     em-action-requested 	item-uninstalled 	An addon has been marked to be uninstalled.
     em-action-requested 	item-enabled 	An addon has been enabled.
     em-action-requested 	item-disabled 	An addon has been disabled.
     em-action-requested 	item-cancel-action 	A previous action has been cancelled.

     quit-application 	The application is about to quit. This can be in response to a normal shutdown, or a restart.
     Note: The data value for this notification is either 'shutdown' or 'restart'.

     How to catch startup/session-restore without needing to modify extension?

     Bookmark stuff:  See
     https://developer.mozilla.org/en/nsINavBookmarkObserver and
     https://developer.mozilla.org/en/nsINavBookmarksService

     note observer has onItemAdded, onItemRemoved, onItemChanged, onItemVisited,
     onItemMoved.
     */

    /*var idleService = Cc["@mozilla.org/widget/idleservice;1"]
       .getService(Ci.nsIIdleService);
    var idleObserver = {
      observe: function(subject, topic, data) {
        alert("topic: " + topic + "\ndata: " + data);
      }
    };
    idleService.addIdleObserver(idleObserver, 60); // one minute
    // ...
    // Don't forget to remove the observer using removeIdleObserver!
    idleService.removeIdleObserver(idleObserver, 60);
     */

    var bmsvc = Cc["@mozilla.org/browser/nav-bookmarks-service;1"]
      .getService(Ci.nsINavBookmarksService);
    bmsvc.addObserver(this, false);

  },

  uninstall: function() {
    var bmsvc = Cc["@mozilla.org/browser/nav-bookmarks-service;1"]
      .getService(Ci.nsINavBookmarksService);
    bmsvc.removeObserver(this, false);

  }
};

exports.webContent = {
  inProgressHtml: "<h2>A Week in the Life of a Browser</h2><p>In progress.</p>",
  completedHtml: "<h2>A Week in the Life of a Browser</h2><p>Completed.</p>",
  upcomingHtml: "<h2>A Week in the Life of a Browser</h2><p>In progress.</p>",
  onPageLoad: function(experiment, document, graphUtils) {
  }
};