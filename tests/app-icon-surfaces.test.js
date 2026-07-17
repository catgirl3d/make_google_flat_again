const test = require("node:test");
const assert = require("node:assert/strict");

const MODULE_PATH = "../src/content/surfaces/app-icon-surfaces.js";
const STYLE_ID = "mgfa-app-icon-surfaces-style";
const ATTR_NAME = "data-mgfa-app-icon-surfaces";

const settings = require("../src/shared/settings.js");
const { apps, getAppById, getAssetPath } = require("../src/shared/apps.js");

function buildOptions(enabledAppIds, extraOptions = {}) {
  const enabledSet = new Set(enabledAppIds);

  return {
    enabled: extraOptions.enabled !== false,
    dayNumber: extraOptions.dayNumber,
    apps: Object.fromEntries(apps.map((app) => [app.id, enabledSet.has(app.id)]))
  };
}

function createDomEnvironment({ readyState = "complete", visibilityState = "visible" } = {}) {
  const documentListeners = new Map();
  const windowListeners = new Map();
  const headChildren = [];
  const rootChildren = [];
  const clearedTimeouts = [];
  let nextTimerId = 0;

  function removeChild(children, node) {
    const index = children.indexOf(node);
    if (index >= 0) {
      children.splice(index, 1);
    }
    node.parentNode = null;
  }

  function createNode(tagName) {
    return {
      tagName,
      id: "",
      textContent: "",
      parentNode: null,
      remove() {
        if (this.parentNode === document.head) {
          removeChild(headChildren, this);
        } else if (this.parentNode === document.documentElement) {
          removeChild(rootChildren, this);
        }
      }
    };
  }

  function appendChild(children, parent, node) {
    children.push(node);
    node.parentNode = parent;
    return node;
  }

  const documentElement = {
    attributes: new Map(),
    appendChild(node) {
      return appendChild(rootChildren, this, node);
    },
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
    head: {
      children: headChildren,
      appendChild(node) {
        return appendChild(headChildren, this, node);
      }
    },
    documentElement,
    createElement(tagName) {
      return createNode(tagName);
    },
    getElementById(id) {
      return [...headChildren, ...rootChildren].find((node) => node.id === id) || null;
    },
    addEventListener(type, listener) {
      const listeners = documentListeners.get(type) || [];
      listeners.push(listener);
      documentListeners.set(type, listeners);
    }
  };

  const scheduledTimers = new Map();
  const window = {
    addEventListener(type, listener) {
      const listeners = windowListeners.get(type) || [];
      listeners.push(listener);
      windowListeners.set(type, listeners);
    },
    setTimeout(callback, delay) {
      const id = `timer-${++nextTimerId}`;
      scheduledTimers.set(id, { callback, delay });
      return id;
    }
  };

  return {
    document,
    window,
    clearTimeout(timerId) {
      clearedTimeouts.push(timerId);
      scheduledTimers.delete(timerId);
    },
    dispatchDocument(type) {
      for (const listener of documentListeners.get(type) || []) {
        listener({ type });
      }
    },
    dispatchWindow(type) {
      for (const listener of windowListeners.get(type) || []) {
        listener({ type });
      }
    },
    setVisibilityState(nextVisibilityState) {
      document.visibilityState = nextVisibilityState;
    },
    getClearedTimeouts() {
      return [...clearedTimeouts];
    },
    getScheduledTimeoutIds() {
      return [...scheduledTimers.keys()];
    }
  };
}

function expectedRuntimeAsset(appId, surfaceName, options) {
  const app = getAppById(appId);
  const assetPath = app.surfaces[surfaceName]?.assetPath || getAssetPath(app, options);
  return `runtime://${assetPath}`;
}

function withSurfaceModule(environment, runAssertions) {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const previousClearTimeout = globalThis.clearTimeout;
  const previousRuntime = globalThis.__MGFA_RUNTIME__;
  const previousMgfa = globalThis.MakeGoogleFlatAgain;
  let registeredSurface = null;

  globalThis.document = environment.document;
  globalThis.window = environment.window;
  globalThis.clearTimeout = environment.clearTimeout;
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
    globalThis.__MGFA_RUNTIME__ = previousRuntime;
    globalThis.MakeGoogleFlatAgain = previousMgfa;
  }
}

test("start applies one managed style for enabled icon surfaces and marks the root", () => {
  const environment = createDomEnvironment();
  const options = buildOptions(["calendar", "tasks"], { dayNumber: 9 });

  withSurfaceModule(environment, (surface) => {
    surface.start({ options });

    const styleElement = environment.document.getElementById(STYLE_ID);
    assert.ok(styleElement, "Should insert the managed style element");
    assert.equal(environment.document.head.children.length, 1, "Should manage a single shared style element");
    assert.equal(environment.document.documentElement.getAttribute(ATTR_NAME), "1", "Should mark the root while active");

    assert.match(styleElement.textContent, new RegExp(getAppById("calendar").surfaces.sidePanel.selectors[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(styleElement.textContent, new RegExp(getAppById("tasks").surfaces.sidePanelLoading.selectors[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.ok(
      styleElement.textContent.includes(expectedRuntimeAsset("calendar", "productLogo", options)),
      "Should use the day-aware Calendar asset in the managed CSS"
    );
    assert.ok(
      !styleElement.textContent.includes(getAppById("keep").surfaces.sidePanel.selectors[0]),
      "Should exclude disabled surface apps from the shared stylesheet"
    );
  });
});

test("refresh reuses the managed style element and cleanup removes it when nothing stays enabled", () => {
  const environment = createDomEnvironment();
  const options = buildOptions(["keep"]);

  withSurfaceModule(environment, (surface) => {
    surface.start({ options });

    const originalStyle = environment.document.getElementById(STYLE_ID);
    const firstTimerId = environment.getScheduledTimeoutIds()[0];

    options.apps.keep = false;
    options.apps.tasks = true;
    surface.refresh();

    const refreshedStyle = environment.document.getElementById(STYLE_ID);
    assert.equal(refreshedStyle, originalStyle, "Should reuse the existing managed style element on refresh");
    assert.ok(refreshedStyle.textContent.includes(getAppById("tasks").surfaces.sidePanel.selectors[0]));
    assert.ok(!refreshedStyle.textContent.includes(getAppById("keep").surfaces.sidePanel.selectors[0]));

    options.enabled = false;
    surface.refresh();

    assert.equal(environment.document.getElementById(STYLE_ID), null, "Should remove the managed style when no icon surfaces are enabled");
    assert.equal(environment.document.documentElement.getAttribute(ATTR_NAME), null, "Should clear the managed root marker after cleanup");
    assert.deepEqual(
      environment.getClearedTimeouts(),
      [firstTimerId, "timer-2"],
      "Should clear the active midnight timers on refresh and cleanup"
    );
  });
});

test("builder APIs keep launcher, docs-menu, loading, and product-logo CSS contracts", () => {
  const environment = createDomEnvironment();

  withSurfaceModule(environment, (surface) => {
    const launcherCss = surface.buildAppLauncherCss(buildOptions(["drive"]));
    const docsMenuCss = surface.buildDocsHomescreenMenuCss(buildOptions(["docs", "forms"]));
    const loadingCss = surface.buildSidePanelLoadingCss(buildOptions(["calendar", "keep", "tasks"], { dayNumber: 9 }));
    const productLogoCss = surface.buildProductLogoCss(buildOptions(["calendar"], { dayNumber: 9 }));

    assert.deepEqual(getAppById("calendar").surfaces.sidePanelLoading.selectors, ['[style*="/companion/icon_assets/logo_calendar_"]']);
    assert.deepEqual(getAppById("keep").surfaces.sidePanelLoading.selectors, ['[style*="/companion/icon_assets/logo_keep_"]']);
    assert.deepEqual(getAppById("tasks").surfaces.sidePanelLoading.selectors, ['[style*="/companion/icon_assets/logo_tasks_"]']);

    assert.ok(launcherCss.includes(getAppById("drive").surfaces.appLauncher.selectors[0]));
    assert.ok(launcherCss.includes(getAppById("drive").surfaces.appLauncher.selectors[1]));
    assert.ok(launcherCss.includes(expectedRuntimeAsset("drive", "appLauncher", {})));

    assert.ok(docsMenuCss.includes(getAppById("docs").surfaces.docsHomescreenMenu.selectors[0]));
    assert.ok(docsMenuCss.includes(getAppById("forms").surfaces.docsHomescreenMenu.selectors[0]));
    assert.ok(!docsMenuCss.includes(getAppById("slides").surfaces.docsHomescreenMenu.selectors[0]));
    assert.ok(docsMenuCss.includes(`${getAppById("docs").surfaces.docsHomescreenMenu.selectors[0]}::before`));
    assert.ok(docsMenuCss.includes('content: "" !important;'));

    assert.ok(loadingCss.includes(getAppById("calendar").surfaces.sidePanelLoading.selectors[0]));
    assert.ok(loadingCss.includes("runtime://assets/icons/calendar/google-calendar.svg"));
    assert.ok(loadingCss.includes(getAppById("keep").surfaces.sidePanelLoading.selectors[0]));
    assert.ok(loadingCss.includes(expectedRuntimeAsset("keep", "sidePanelLoading", {})));
    assert.ok(loadingCss.includes(getAppById("tasks").surfaces.sidePanelLoading.selectors[0]));
    assert.ok(loadingCss.includes(expectedRuntimeAsset("tasks", "sidePanelLoading", {})));
    assert.ok(loadingCss.includes("background: transparent url(\"runtime://assets/icons/calendar/google-calendar.svg\") center center / 128px 128px no-repeat !important;"));

    assert.ok(productLogoCss.includes(getAppById("calendar").surfaces.productLogo.selectors[0]));
    assert.ok(productLogoCss.includes(getAppById("calendar").surfaces.productLogo.selectors[1]));
    assert.ok(productLogoCss.includes('--mgfa-logo-source: "header-calendar" !important;'));
    assert.ok(productLogoCss.includes(expectedRuntimeAsset("calendar", "productLogo", { dayNumber: 9 })));
  });
});

test("start keeps the surface reactive to focus and visibility-driven reapply", () => {
  const environment = createDomEnvironment({ readyState: "loading", visibilityState: "hidden" });
  const options = buildOptions([]);

  withSurfaceModule(environment, (surface) => {
    surface.start({ options });

    assert.equal(environment.document.getElementById(STYLE_ID), null, "Should not create a style before any surface is enabled");

    options.apps.maps = true;
    environment.dispatchDocument("DOMContentLoaded");

    const styleAfterReady = environment.document.getElementById(STYLE_ID);
    assert.ok(styleAfterReady, "Should apply once the page becomes ready");
    assert.ok(styleAfterReady.textContent.includes(getAppById("maps").surfaces.sidePanel.selectors[0]));

    options.apps.maps = false;
    options.apps.tasks = true;
    environment.dispatchWindow("focus");

    const styleAfterFocus = environment.document.getElementById(STYLE_ID);
    assert.ok(styleAfterFocus.textContent.includes(getAppById("tasks").surfaces.sidePanel.selectors[0]));
    assert.ok(!styleAfterFocus.textContent.includes(getAppById("maps").surfaces.sidePanel.selectors[0]));

    options.apps.tasks = false;
    options.apps.calendar = true;
    environment.setVisibilityState("visible");
    environment.dispatchDocument("visibilitychange");

    const styleAfterVisibility = environment.document.getElementById(STYLE_ID);
    assert.ok(styleAfterVisibility.textContent.includes(getAppById("calendar").surfaces.sidePanel.selectors[0]));
    assert.ok(!styleAfterVisibility.textContent.includes(getAppById("tasks").surfaces.sidePanel.selectors[0]));
  });
});
