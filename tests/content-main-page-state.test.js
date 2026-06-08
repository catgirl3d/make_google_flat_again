const test = require("node:test");
const assert = require("node:assert/strict");

const { apps } = require("../src/shared/apps.js");

const MAIN_PATH = "../src/content/main.js";
const MODULES_TO_RESET = [
  "../src/shared/runtime.js",
  "../src/shared/apps.js",
  "../src/shared/settings.js",
  "../src/shared/guards.js",
  "../src/content/logo-probe.js",
  MAIN_PATH
];

const APP_ROUTE_CASES = {
  gmail: {
    location: { hostname: "mail.google.com", pathname: "/mail/u/0/#inbox" },
    active: "gmail"
  },
  calendar: {
    location: { hostname: "calendar.google.com", pathname: "/calendar/u/0/r" },
    active: "calendar"
  },
  drive: {
    location: { hostname: "drive.google.com", pathname: "/drive/u/0/my-drive" },
    active: "drive"
  },
  docs: {
    location: { hostname: "docs.google.com", pathname: "/document/d/example/edit" },
    active: "docs-shared docs"
  },
  sheets: {
    location: { hostname: "docs.google.com", pathname: "/spreadsheets/d/example/edit" },
    active: "docs-shared sheets"
  },
  slides: {
    location: { hostname: "docs.google.com", pathname: "/presentation/d/example/edit" },
    active: "docs-shared slides"
  },
  forms: {
    location: { hostname: "docs.google.com", pathname: "/forms/d/example/edit" },
    active: "docs-shared forms"
  },
  vids: {
    location: { hostname: "docs.google.com", pathname: "/videos/create", href: "https://docs.google.com/videos/create?usp=vids_alc" },
    active: "docs-shared vids"
  },
  meet: {
    location: { hostname: "meet.google.com", pathname: "/abc-defg-hij" },
    active: "meet"
  },
  chat: {
    location: { hostname: "chat.google.com", pathname: "/room/example" },
    active: "chat"
  },
  keep: {
    location: { hostname: "keep.google.com", pathname: "/u/0" },
    active: "keep"
  },
  tasks: {
    location: { hostname: "tasks.google.com", pathname: "/tasks", href: "https://tasks.google.com/tasks?utm_source=OGB" },
    active: "tasks"
  },
  maps: {
    location: { hostname: "www.google.com", pathname: "/maps/dir/berlin" },
    active: "maps"
  }
};

function createDeferred() {
  let resolve = null;
  const promise = new Promise((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}

async function flushAsyncWork(times = 4) {
  for (let index = 0; index < times; index += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

function resetGlobals() {
  delete globalThis.MakeGoogleFlatAgain;
  delete globalThis.__MGFA_RUNTIME__;
  delete globalThis.browser;
  delete globalThis.chrome;
  delete globalThis.document;
  delete globalThis.window;
  delete globalThis.Event;

  for (const modulePath of MODULES_TO_RESET) {
    delete require.cache[require.resolve(modulePath)];
  }
}

function createDocumentElement() {
  const attributes = new Map();

  return {
    getAttribute(name) {
      return attributes.has(name) ? attributes.get(name) : null;
    },
    hasAttribute(name) {
      return attributes.has(name);
    },
    removeAttribute(name) {
      attributes.delete(name);
    },
    setAttribute(name, value) {
      attributes.set(name, String(value));
    }
  };
}

function normalizeLocation(locationLike) {
  const protocol = locationLike.protocol || "https:";
  const pathname = locationLike.pathname || "/";
  const hostname = locationLike.hostname;

  return {
    hostname,
    href: locationLike.href || `${protocol}//${hostname}${pathname}`,
    pathname,
    protocol
  };
}

function createPageEnvironment({ location, readyState = "complete" }) {
  resetGlobals();

  const runtime = require("../src/shared/runtime.js");
  const appsApi = require("../src/shared/apps.js");
  const settingsApi = require("../src/shared/settings.js");
  const guardsApi = require("../src/shared/guards.js");
  const optionsDeferred = createDeferred();
  const windowListeners = new Map();
  const documentElement = createDocumentElement();
  const extensionApi = { runtime: { lastError: null } };
  const startedContexts = [];
  let observedOptionsListener = null;

  globalThis.Event = class Event {
    constructor(type) {
      this.type = type;
    }
  };

  globalThis.document = {
    documentElement,
    querySelectorAll() {
      return [];
    },
    readyState,
    addEventListener() {}
  };

  globalThis.window = {
    getComputedStyle() {
      return {
        getPropertyValue() {
          return "";
        }
      };
    },
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
    }
  };

  globalThis.MakeGoogleFlatAgain = {
    runtime: {
      ...runtime,
      getExtensionApi() {
        return extensionApi;
      }
    },
    apps: appsApi,
    guards: guardsApi,
    settings: {
      ...settingsApi,
      getOptions() {
        return optionsDeferred.promise;
      },
      observeOptions(listener) {
        observedOptionsListener = listener;
        return () => {};
      }
    },
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
    logoProbe: require("../src/content/logo-probe.js"),
    surfaceRegistry: {
      getSurfaces() {
        return [];
      },
      startAll(context) {
        startedContexts.push(context);
      }
    }
  };

  delete require.cache[require.resolve(MAIN_PATH)];
  require(MAIN_PATH);

  return {
    documentElement,
    getObservedOptionsListener() {
      return observedOptionsListener;
    },
    async resolveOptions(options) {
      optionsDeferred.resolve(options);
      await flushAsyncWork();
    },
    startedContexts,
    async updateOptions(options) {
      observedOptionsListener(options);
      await flushAsyncWork();
    }
  };
}

test("real main bootstraps primary app before async options load", async () => {
  const page = createPageEnvironment(APP_ROUTE_CASES.docs);

  assert.equal(page.documentElement.getAttribute("data-mgfa-app"), "docs");
  assert.equal(page.documentElement.getAttribute("data-mgfa-active"), null);

  await page.resolveOptions({ enabled: true, apps: {} });

  assert.equal(page.documentElement.getAttribute("data-mgfa-active"), "docs-shared docs");
  assert.equal(page.documentElement.getAttribute("data-mgfa-app"), "docs");
  assert.equal(page.startedContexts.length, 1);
  assert.equal(typeof page.getObservedOptionsListener(), "function");
});

test("real main page-state contract covers every app route", async () => {
  assert.deepEqual(Object.keys(APP_ROUTE_CASES).sort(), apps.map((app) => app.id).sort());

  for (const [appId, routeCase] of Object.entries(APP_ROUTE_CASES)) {
    const page = createPageEnvironment(routeCase);

    await page.resolveOptions({ enabled: true, apps: {} });

    assert.equal(page.documentElement.getAttribute("data-mgfa-active"), routeCase.active, appId);
    assert.equal(page.documentElement.getAttribute("data-mgfa-app"), appId, appId);
    assert.equal(page.documentElement.getAttribute("data-mgfa-disabled"), null, appId);
  }
});

test("real main global disable clears active/app state and marks page disabled", async () => {
  const page = createPageEnvironment(APP_ROUTE_CASES.sheets);

  assert.equal(page.documentElement.getAttribute("data-mgfa-app"), "sheets");

  await page.resolveOptions({ enabled: false, apps: { sheets: true } });

  assert.equal(page.documentElement.getAttribute("data-mgfa-disabled"), "1");
  assert.equal(page.documentElement.getAttribute("data-mgfa-active"), null);
  assert.equal(page.documentElement.getAttribute("data-mgfa-app"), null);
});

test("real main docs-suite app disable keeps docs-shared only while globally enabled", async () => {
  const page = createPageEnvironment(APP_ROUTE_CASES.sheets);

  await page.resolveOptions({ enabled: true, apps: { sheets: false } });

  assert.equal(page.documentElement.getAttribute("data-mgfa-disabled"), null);
  assert.equal(page.documentElement.getAttribute("data-mgfa-active"), "docs-shared");
  assert.equal(page.documentElement.getAttribute("data-mgfa-app"), null);
});

test("real main non-docs app disable clears the app-specific active target", async () => {
  const page = createPageEnvironment(APP_ROUTE_CASES.drive);

  await page.resolveOptions({ enabled: true, apps: { drive: false } });

  assert.equal(page.documentElement.getAttribute("data-mgfa-active"), null);
  assert.equal(page.documentElement.getAttribute("data-mgfa-app"), null);
});

test("real main observeOptions callback refreshes attributes without targets dependency", async () => {
  const page = createPageEnvironment(APP_ROUTE_CASES.docs);

  await page.resolveOptions({ enabled: true, apps: {} });
  assert.equal(page.documentElement.getAttribute("data-mgfa-active"), "docs-shared docs");

  await page.updateOptions({ enabled: true, apps: { docs: false } });
  assert.equal(page.documentElement.getAttribute("data-mgfa-active"), "docs-shared");
  assert.equal(page.documentElement.getAttribute("data-mgfa-app"), null);

  await page.updateOptions({ enabled: false, apps: { docs: true } });
  assert.equal(page.documentElement.getAttribute("data-mgfa-disabled"), "1");
  assert.equal(page.documentElement.getAttribute("data-mgfa-active"), null);
  assert.equal(page.documentElement.getAttribute("data-mgfa-app"), null);
});

test("real main pause state does not replace active/app state", async () => {
  const page = createPageEnvironment({
    location: { hostname: "calendar.google.com", pathname: "/settings" }
  });

  await page.resolveOptions({ enabled: true, apps: {} });

  assert.equal(page.documentElement.getAttribute("data-mgfa-paused"), "calendar-sensitive-screens");
  assert.equal(page.documentElement.getAttribute("data-mgfa-active"), "calendar");
  assert.equal(page.documentElement.getAttribute("data-mgfa-app"), "calendar");
});

test("real main ignores unrelated hosts", async () => {
  const page = createPageEnvironment({
    location: { hostname: "example.com", pathname: "/" }
  });

  await page.resolveOptions({ enabled: true, apps: {} });

  assert.equal(page.documentElement.getAttribute("data-mgfa-disabled"), null);
  assert.equal(page.documentElement.getAttribute("data-mgfa-active"), null);
  assert.equal(page.documentElement.getAttribute("data-mgfa-app"), null);
});
