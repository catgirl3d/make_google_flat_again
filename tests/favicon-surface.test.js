const test = require("node:test");
const assert = require("node:assert/strict");

const MODULE_PATH = "../src/content/surfaces/favicon.js";
const MANAGED_SELECTOR = 'link[data-mgfa-favicon="1"]';
const ROOT_ATTR = "data-mgfa-favicon-app";

const settings = require("../src/shared/settings.js");
const { apps, getAppById, getAssetPath } = require("../src/shared/apps.js");

function buildOptions(disabledAppIds = [], extraOptions = {}) {
  const disabledSet = new Set(disabledAppIds);

  return {
    enabled: extraOptions.enabled !== false,
    dayNumber: extraOptions.dayNumber,
    apps: Object.fromEntries(apps.map((app) => [app.id, !disabledSet.has(app.id)]))
  };
}

function normalizeLocation(locationLike) {
  const protocol = locationLike.protocol || "https:";
  const hostname = locationLike.hostname;
  const pathname = locationLike.pathname || "/";
  const href = locationLike.href || `${protocol}//${hostname}${pathname}`;

  return { protocol, hostname, pathname, href };
}

function createDomEnvironment({
  location = { hostname: "keep.google.com", pathname: "/u/0" },
  readyState = "complete",
  visibilityState = "visible"
} = {}) {
  const documentListeners = new Map();
  const windowListeners = new Map();
  const headChildren = [];
  const observers = new Set();
  const timers = new Map();
  const clearedTimers = [];
  let nextTimerId = 0;

  function notifyMutation(record) {
    for (const observer of observers) {
      if (!observer.connected) {
        continue;
      }

      if (record.type === "attributes" && !observer.options.attributeFilter?.includes(record.attributeName)) {
        continue;
      }

      observer.callback([record]);
    }
  }

  function removeChild(node) {
    const index = headChildren.indexOf(node);
    if (index >= 0) {
      headChildren.splice(index, 1);
      node.parentNode = null;
      notifyMutation({ type: "childList", target: document.head });
    }
  }

  function createDatasetProxy(element) {
    const dataset = {};

    Object.defineProperties(dataset, {
      mgfaFavicon: {
        get() {
          return element.getAttribute("data-mgfa-favicon") || undefined;
        },
        set(value) {
          element.setAttribute("data-mgfa-favicon", value);
        }
      },
      mgfaFaviconApp: {
        get() {
          return element.getAttribute("data-mgfa-favicon-app") || undefined;
        },
        set(value) {
          element.setAttribute("data-mgfa-favicon-app", value);
        }
      },
      mgfaFaviconRole: {
        get() {
          return element.getAttribute("data-mgfa-favicon-role") || undefined;
        },
        set(value) {
          element.setAttribute("data-mgfa-favicon-role", value);
        }
      }
    });

    return dataset;
  }

  function createElement(tagName) {
    const attributes = new Map();
    const element = {
      tagName: tagName.toUpperCase(),
      parentNode: null,
      dataset: null,
      get rel() {
        return this.getAttribute("rel") || "";
      },
      set rel(value) {
        this.setAttribute("rel", value);
      },
      get href() {
        return this.getAttribute("href") || "";
      },
      set href(value) {
        this.setAttribute("href", value);
      },
      get type() {
        return this.getAttribute("type") || "";
      },
      set type(value) {
        this.setAttribute("type", value);
      },
      getAttribute(name) {
        return attributes.has(name) ? attributes.get(name) : null;
      },
      setAttribute(name, value) {
        attributes.set(name, String(value));
        if (this.parentNode === document.head) {
          notifyMutation({ type: "attributes", target: this, attributeName: name });
        }
      },
      removeAttribute(name) {
        attributes.delete(name);
        if (this.parentNode === document.head) {
          notifyMutation({ type: "attributes", target: this, attributeName: name });
        }
      },
      remove() {
        removeChild(this);
      }
    };

    element.dataset = createDatasetProxy(element);
    return element;
  }

  function matchesManagedSelector(element, selector) {
    if (element.tagName !== "LINK") {
      return false;
    }

    if (selector === "link") {
      return true;
    }

    if (!selector.startsWith(MANAGED_SELECTOR)) {
      return false;
    }

    if (element.getAttribute("data-mgfa-favicon") !== "1") {
      return false;
    }

    const roleMatch = selector.match(/\[data-mgfa-favicon-role="([^"]+)"\]/);
    return !roleMatch || element.getAttribute("data-mgfa-favicon-role") === roleMatch[1];
  }

  const documentElement = {
    attributes: new Map(),
    setAttribute(name, value) {
      this.attributes.set(name, String(value));
    },
    getAttribute(name) {
      return this.attributes.has(name) ? this.attributes.get(name) : null;
    },
    removeAttribute(name) {
      this.attributes.delete(name);
    }
  };

  const document = {
    readyState,
    visibilityState,
    documentElement,
    head: {
      get children() {
        return headChildren;
      },
      appendChild(node) {
        if (node.parentNode === this) {
          removeChild(node);
        }
        headChildren.push(node);
        node.parentNode = this;
        notifyMutation({ type: "childList", target: this });
        return node;
      }
    },
    createElement,
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] || null;
    },
    querySelectorAll(selector) {
      if (selector === "link" || selector.startsWith(MANAGED_SELECTOR)) {
        return headChildren.filter((element) => matchesManagedSelector(element, selector));
      }

      return [];
    },
    addEventListener(type, listener, options = {}) {
      const listeners = documentListeners.get(type) || [];
      listeners.push({ listener, once: Boolean(options.once) });
      documentListeners.set(type, listeners);
    },
    dispatchEvent(event) {
      const listeners = documentListeners.get(event.type) || [];
      const remaining = [];

      for (const entry of listeners) {
        entry.listener(event);
        if (!entry.once) {
          remaining.push(entry);
        }
      }

      documentListeners.set(event.type, remaining);
    }
  };

  const window = {
    location: normalizeLocation(location),
    addEventListener(type, listener) {
      const listeners = windowListeners.get(type) || [];
      listeners.push(listener);
      windowListeners.set(type, listeners);
    },
    dispatchEvent(event) {
      for (const listener of windowListeners.get(event.type) || []) {
        listener(event);
      }
    },
    requestAnimationFrame(callback) {
      return this.setTimeout(callback, 16);
    },
    setTimeout(callback, delay) {
      const id = `timer-${++nextTimerId}`;
      timers.set(id, { callback, delay });
      return id;
    }
  };

  class MutationObserver {
    constructor(callback) {
      this.callback = callback;
      this.connected = false;
      this.options = null;
    }

    observe(target, options) {
      assert.equal(target, document.head, "Favicon surface should observe the document head");
      this.connected = true;
      this.options = options;
      observers.add(this);
    }

    disconnect() {
      this.connected = false;
      observers.delete(this);
    }
  }

  return {
    document,
    window,
    MutationObserver,
    clearTimeout(timerId) {
      clearedTimers.push(timerId);
      timers.delete(timerId);
    },
    createLink(attributes) {
      const link = createElement("link");
      for (const [name, value] of Object.entries(attributes)) {
        link.setAttribute(name, value);
      }
      document.head.appendChild(link);
      return link;
    },
    dispatchDocument(type) {
      document.dispatchEvent({ type });
    },
    dispatchWindow(type) {
      window.dispatchEvent({ type });
    },
    getLinks() {
      return [...headChildren];
    },
    getManagedLinks() {
      return document.querySelectorAll(MANAGED_SELECTOR);
    },
    getTimers() {
      return [...timers.entries()].map(([id, timer]) => ({ id, ...timer }));
    },
    getClearedTimers() {
      return [...clearedTimers];
    },
    runTimersByDelay(delay) {
      const dueTimers = [...timers.entries()].filter(([, timer]) => timer.delay === delay);
      for (const [id, timer] of dueTimers) {
        if (!timers.has(id)) {
          continue;
        }
        timers.delete(id);
        timer.callback();
      }
    },
    runTimersAtOrBelow(maxDelay) {
      const dueTimers = [...timers.entries()].filter(([, timer]) => timer.delay <= maxDelay);
      for (const [id, timer] of dueTimers) {
        if (!timers.has(id)) {
          continue;
        }
        timers.delete(id);
        timer.callback();
      }
    },
    setLocation(locationLike) {
      window.location = normalizeLocation(locationLike);
    },
    setVisibilityState(nextVisibilityState) {
      document.visibilityState = nextVisibilityState;
    }
  };
}

function expectedRuntimeAsset(appId, options) {
  const app = getAppById(appId);
  const assetPath = app.surfaces.favicon?.assetPath || getAssetPath(app, options);
  return `runtime://${assetPath}`;
}

function withFaviconSurface(environment, runAssertions) {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const previousClearTimeout = globalThis.clearTimeout;
  const previousMutationObserver = globalThis.MutationObserver;
  const previousRuntime = globalThis.__MGFA_RUNTIME__;
  const previousMgfa = globalThis.MakeGoogleFlatAgain;
  let registeredSurface = null;

  globalThis.document = environment.document;
  globalThis.window = environment.window;
  globalThis.clearTimeout = environment.clearTimeout;
  globalThis.MutationObserver = environment.MutationObserver;
  globalThis.__MGFA_RUNTIME__ = {
    attach() {
      return true;
    },
    getRuntimeUrl(assetPath) {
      return `runtime://${assetPath}`;
    }
  };
  globalThis.MakeGoogleFlatAgain = {
    apps: require("../src/shared/apps.js"),
    settings,
    debugLogger: {
      create() {
        return {
          event() {
            return true;
          },
          snapshot() {
            return true;
          }
        };
      }
    },
    surfaceRegistry: {
      register(surface) {
        registeredSurface = surface;
      }
    }
  };

  delete require.cache[require.resolve(MODULE_PATH)];

  try {
    const surface = require(MODULE_PATH);
    assert.equal(surface, registeredSurface, "Surface should register the exported API instance");
    runAssertions(surface);
  } finally {
    delete require.cache[require.resolve(MODULE_PATH)];
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
    globalThis.clearTimeout = previousClearTimeout;
    globalThis.MutationObserver = previousMutationObserver;
    globalThis.__MGFA_RUNTIME__ = previousRuntime;
    globalThis.MakeGoogleFlatAgain = previousMgfa;
  }
}

test("start inserts managed primary and shortcut favicons using real Keep matching and settings", () => {
  const environment = createDomEnvironment({
    location: { hostname: "keep.google.com", pathname: "/u/0" }
  });
  environment.createLink({ rel: "icon", href: "https://keep.google.com/favicon.ico", type: "image/x-icon", sizes: "32x32" });

  const options = buildOptions();

  withFaviconSurface(environment, (surface) => {
    surface.start({ options });

    const links = environment.getLinks();
    const managedLinks = environment.getManagedLinks();
    const [primary, shortcut] = managedLinks;

    assert.equal(links.length, 3, "Keep is not hard-locked, so the original icon should remain");
    assert.equal(managedLinks.length, 2);
    assert.equal(primary.getAttribute("data-mgfa-favicon-role"), "primary");
    assert.equal(primary.rel, "icon");
    assert.equal(primary.href, expectedRuntimeAsset("keep", options));
    assert.equal(primary.type, "image/svg+xml");
    assert.equal(primary.getAttribute("sizes"), "any");
    assert.equal(primary.dataset.mgfaFaviconApp, "keep");
    assert.equal(shortcut.getAttribute("data-mgfa-favicon-role"), "shortcut");
    assert.equal(shortcut.rel, "shortcut icon");
    assert.equal(shortcut.href, expectedRuntimeAsset("keep", options));
    assert.equal(shortcut.type, "image/svg+xml");
    assert.equal(shortcut.dataset.mgfaFaviconApp, "keep");
    assert.equal(environment.document.documentElement.getAttribute(ROOT_ATTR), "keep");
  });
});

test("start hard-locks Calendar favicons and cleanup restores captured originals when Calendar is disabled", () => {
  const environment = createDomEnvironment({
    location: { hostname: "calendar.google.com", pathname: "/calendar/u/0/r" }
  });
  environment.createLink({ rel: "icon", href: "https://calendar.google.com/favicon.ico", type: "image/x-icon", sizes: "32x32" });
  environment.createLink({ rel: "apple-touch-icon", href: "https://calendar.google.com/apple-touch.png", sizes: "180x180" });
  environment.createLink({ rel: "stylesheet", href: "https://calendar.google.com/app.css" });

  const options = buildOptions([], { dayNumber: 7 });

  withFaviconSurface(environment, (surface) => {
    surface.start({ options });

    assert.deepEqual(
      environment.getLinks().map((link) => link.rel),
      ["stylesheet", "icon", "shortcut icon"],
      "Calendar hardLock should remove original icon links while keeping unrelated links"
    );
    assert.deepEqual(
      environment.getManagedLinks().map((link) => [link.href, link.type, link.dataset.mgfaFaviconApp]),
      [
        [expectedRuntimeAsset("calendar", options), "image/webp", "calendar"],
        [expectedRuntimeAsset("calendar", options), "image/webp", "calendar"]
      ]
    );
    assert.equal(environment.document.documentElement.getAttribute(ROOT_ATTR), "calendar");

    options.apps.calendar = false;
    surface.refresh();
    environment.runTimersByDelay(60);

    assert.equal(environment.getManagedLinks().length, 0, "Disabled Calendar should remove managed favicons");
    assert.equal(environment.document.documentElement.getAttribute(ROOT_ATTR), null);
    assert.deepEqual(
      environment.getLinks().map((link) => [link.rel, link.href, link.type, link.getAttribute("sizes")]),
      [
        ["stylesheet", "https://calendar.google.com/app.css", "", null],
        ["icon", "https://calendar.google.com/favicon.ico", "image/x-icon", "32x32"],
        ["apple-touch-icon", "https://calendar.google.com/apple-touch.png", "", "180x180"]
      ],
      "Cleanup should restore captured originals when no favicon links remain"
    );
    assert.ok(environment.getClearedTimers().length >= 1, "Calendar cleanup should clear the active midnight refresh timer");
  });
});

test("refresh cleanup removes managed links when the route no longer resolves to a favicon app", () => {
  const environment = createDomEnvironment({
    location: { hostname: "docs.google.com", pathname: "/document/d/example/edit" }
  });
  const options = buildOptions();

  withFaviconSurface(environment, (surface) => {
    surface.start({ options });
    assert.equal(environment.getManagedLinks().length, 2);
    assert.equal(environment.document.documentElement.getAttribute(ROOT_ATTR), "docs");

    environment.setLocation({ hostname: "docs.google.com", pathname: "/videos/create", href: "https://docs.google.com/videos/create?usp=vids_alc" });
    surface.refresh();
    environment.runTimersByDelay(60);

    assert.equal(environment.getManagedLinks().length, 0, "Vids has no favicon surface and should clean up Docs favicons");
    assert.equal(environment.document.documentElement.getAttribute(ROOT_ATTR), null);
  });
});

test("start and refresh leave unrelated hosts without favicon DOM mutations", () => {
  const environment = createDomEnvironment({
    location: { hostname: "example.com", pathname: "/" }
  });
  environment.createLink({ rel: "icon", href: "https://example.com/favicon.ico", type: "image/x-icon" });
  const options = buildOptions();

  withFaviconSurface(environment, (surface) => {
    surface.start({ options });
    surface.refresh();
    environment.runTimersByDelay(60);

    assert.deepEqual(
      environment.getLinks().map((link) => [link.rel, link.href, link.type]),
      [["icon", "https://example.com/favicon.ico", "image/x-icon"]]
    );
    assert.equal(environment.getManagedLinks().length, 0);
    assert.equal(environment.document.documentElement.getAttribute(ROOT_ATTR), null);
  });
});

test("scheduled refresh and MutationObserver reapply managed favicons after route and DOM changes", () => {
  const environment = createDomEnvironment({
    location: { hostname: "drive.google.com", pathname: "/drive/u/0/my-drive" }
  });
  const options = buildOptions();

  withFaviconSurface(environment, (surface) => {
    surface.start({ options });
    let primary = environment.document.querySelector(`${MANAGED_SELECTOR}[data-mgfa-favicon-role="primary"]`);
    assert.equal(primary.href, expectedRuntimeAsset("drive", options));

    environment.setLocation({ hostname: "docs.google.com", pathname: "/spreadsheets/d/example/edit" });
    surface.refresh();
    assert.equal(primary.href, expectedRuntimeAsset("drive", options), "refresh should be scheduled, not synchronously applied");
    environment.runTimersByDelay(60);

    primary = environment.document.querySelector(`${MANAGED_SELECTOR}[data-mgfa-favicon-role="primary"]`);
    const shortcut = environment.document.querySelector(`${MANAGED_SELECTOR}[data-mgfa-favicon-role="shortcut"]`);
    assert.equal(primary.href, expectedRuntimeAsset("sheets", options));
    assert.equal(shortcut.href, expectedRuntimeAsset("sheets", options));
    assert.equal(environment.document.documentElement.getAttribute(ROOT_ATTR), "sheets");

    environment.runTimersAtOrBelow(0);
    primary.href = "https://docs.google.com/broken-favicon.ico";
    assert.equal(primary.href, "https://docs.google.com/broken-favicon.ico");
    environment.runTimersByDelay(50);

    assert.equal(primary.href, expectedRuntimeAsset("sheets", options), "MutationObserver should repair externally changed managed hrefs");
  });
});

test("visible lifecycle events schedule reapply while hidden visibility changes do not", () => {
  const environment = createDomEnvironment({
    location: { hostname: "mail.google.com", pathname: "/mail/u/0/#inbox" },
    visibilityState: "hidden"
  });
  const options = buildOptions();

  withFaviconSurface(environment, (surface) => {
    surface.start({ options });
    assert.equal(environment.document.documentElement.getAttribute(ROOT_ATTR), "gmail");

    environment.setLocation({ hostname: "meet.google.com", pathname: "/abc-defg-hij" });
    environment.dispatchDocument("visibilitychange");
    environment.runTimersByDelay(60);
    assert.equal(environment.document.documentElement.getAttribute(ROOT_ATTR), "gmail", "Hidden visibility changes should not refresh favicon state");

    environment.setVisibilityState("visible");
    environment.dispatchDocument("visibilitychange");
    environment.runTimersByDelay(60);
    assert.equal(environment.document.documentElement.getAttribute(ROOT_ATTR), "meet");

    environment.setLocation({ hostname: "chat.google.com", pathname: "/room/example" });
    environment.dispatchWindow("focus");
    environment.runTimersByDelay(60);
    assert.equal(environment.document.documentElement.getAttribute(ROOT_ATTR), "chat");

    environment.setLocation({ hostname: "tasks.google.com", pathname: "/tasks" });
    environment.dispatchWindow("popstate");
    environment.runTimersByDelay(60);
    assert.equal(environment.document.documentElement.getAttribute(ROOT_ATTR), "tasks");

    environment.setLocation({ hostname: "keep.google.com", pathname: "/u/0#notes" });
    environment.dispatchWindow("hashchange");
    environment.runTimersByDelay(60);
    assert.equal(environment.document.documentElement.getAttribute(ROOT_ATTR), "keep");
  });
});

test("Calendar schedules midnight refresh, reschedules it on reapply, and clears it outside Calendar", () => {
  const environment = createDomEnvironment({
    location: { hostname: "calendar.google.com", pathname: "/calendar/u/0/r" }
  });
  const options = buildOptions([], { dayNumber: 5 });

  withFaviconSurface(environment, (surface) => {
    surface.start({ options });
    const firstMidnightTimer = environment.getTimers().find((timer) => timer.delay > 1000);
    assert.ok(firstMidnightTimer, "Calendar start should schedule the next midnight refresh");
    assert.ok(firstMidnightTimer.delay <= 24 * 60 * 60 * 1000 + 5000);

    options.dayNumber = 6;
    firstMidnightTimer.callback();

    const primary = environment.document.querySelector(`${MANAGED_SELECTOR}[data-mgfa-favicon-role="primary"]`);
    assert.equal(primary.href, expectedRuntimeAsset("calendar", options), "Midnight refresh should update Calendar day-aware asset");
    const rescheduledMidnightTimer = environment.getTimers().find((timer) => timer.delay > 1000 && timer.id !== firstMidnightTimer.id);
    assert.ok(rescheduledMidnightTimer, "Calendar midnight refresh should reschedule itself after applying");
    assert.ok(environment.getClearedTimers().includes(firstMidnightTimer.id));

    environment.setLocation({ hostname: "maps.google.com", pathname: "/" });
    surface.refresh();
    environment.runTimersByDelay(60);

    assert.equal(environment.document.documentElement.getAttribute(ROOT_ATTR), "maps");
    assert.ok(environment.getClearedTimers().includes(rescheduledMidnightTimer.id), "Leaving Calendar should clear the midnight timer");
    assert.equal(environment.getTimers().some((timer) => timer.delay > 1000), false);
  });
});

test("favicon helper contracts back runtime icon detection and asset typing", () => {
  const {
    relIsIcon,
    getFaviconAssetPath,
    getAppMimeType,
    shouldKeepObserverActive
  } = require(MODULE_PATH);

  assert.equal(relIsIcon("shortcut icon"), true);
  assert.equal(relIsIcon("apple-touch-icon-precomposed"), true);
  assert.equal(relIsIcon("mask-icon"), true);
  assert.equal(relIsIcon("preload stylesheet"), false);
  assert.equal(getFaviconAssetPath(getAppById("docs")), "assets/icons/apps/favicons/docs.ico");
  assert.equal(getFaviconAssetPath(getAppById("forms")), "assets/icons/apps/favicons/forms.ico");
  assert.equal(getFaviconAssetPath(getAppById("keep")), "assets/icons/apps/keep_icon_1.svg");
  assert.equal(getFaviconAssetPath(getAppById("calendar"), { dayNumber: 7 }), "assets/icons/calendar/calendar-07.webp");
  assert.equal(getFaviconAssetPath(getAppById("sheets")), "assets/icons/apps/favicons/sheets.ico");
  assert.equal(getFaviconAssetPath(getAppById("slides")), "assets/icons/apps/favicons/slides.ico");
  assert.equal(getAppMimeType(getAppById("docs")), "image/x-icon");
  assert.equal(getAppMimeType(getAppById("forms")), "image/x-icon");
  assert.equal(getAppMimeType(getAppById("sheets")), "image/x-icon");
  assert.equal(getAppMimeType(getAppById("slides")), "image/x-icon");
  assert.equal(getAppMimeType(getAppById("calendar"), { dayNumber: 7 }), "image/webp");
  assert.equal(getAppMimeType(getAppById("keep")), "image/svg+xml");
  assert.equal(shouldKeepObserverActive({ app: getAppById("docs"), hasHead: true }), true);
  assert.equal(shouldKeepObserverActive({ app: null, hasHead: true }), false);
  assert.equal(shouldKeepObserverActive({ app: getAppById("docs"), hasHead: false }), false);
});
