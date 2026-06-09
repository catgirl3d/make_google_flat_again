const test = require("node:test");
const assert = require("node:assert/strict");

function createDeferred() {
  let resolve = null;
  let reject = null;
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return { promise, resolve, reject };
}

function clearBackgroundGlobals() {
  delete globalThis.MakeGoogleFlatAgain;
  delete globalThis.__MGFA_RUNTIME__;
  delete globalThis.__MGFA_BACKGROUND_SYNC_INITIALIZED__;
}

async function flushAsyncWork(times = 4) {
  for (let index = 0; index < times; index += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

test("background core serializes repeated sync triggers", async () => {
  clearBackgroundGlobals();
  delete require.cache[require.resolve("../src/background/background-core.js")];

  const originalConsoleLog = console.log;
  let onInstalled = null;
  let observedListener = null;
  const pendingSyncs = [];
  const extensionApi = {
    runtime: {
      onInstalled: {
        addListener(listener) {
          onInstalled = listener;
        }
      },
      onStartup: {
        addListener() {}
      }
    }
  };

  globalThis.MakeGoogleFlatAgain = {
    buildFlags: { isDevelopment: true },
    runtime: {
      getExtensionApi() {
        return extensionApi;
      }
    },
    settings: {
      getOptions() {
        return Promise.resolve({ enabled: true, apps: {} });
      },
      observeOptions(listener) {
        observedListener = listener;
        return () => {};
      }
    },
    headerStaticCss: {
      sync() {
        const deferred = createDeferred();
        pendingSyncs.push(deferred);
        return deferred.promise;
      }
    },
    contentScriptRegistry: {
      syncManagedCssScripts() {
        return Promise.resolve();
      }
    }
  };

  console.log = () => {};

  try {
    require("../src/background/background-core.js");

    await flushAsyncWork();

    assert.equal(typeof observedListener, "function");
    assert.equal(typeof onInstalled, "function");
    assert.equal(pendingSyncs.length, 1);

    onInstalled();
    await flushAsyncWork();

    assert.equal(pendingSyncs.length, 1);

    pendingSyncs[0].resolve();
    await flushAsyncWork();

    assert.equal(pendingSyncs.length, 2);

    pendingSyncs[1].resolve();
    await flushAsyncWork();
  } finally {
    console.log = originalConsoleLog;
    clearBackgroundGlobals();
  }
});

test("background core logs successful header static CSS sync summaries", async () => {
  clearBackgroundGlobals();
  delete require.cache[require.resolve("../src/background/background-core.js")];

  const capturedLogs = [];
  const originalConsoleLog = console.log;
  const extensionApi = {
    runtime: {
      onInstalled: { addListener() {} },
      onStartup: { addListener() {} }
    }
  };

  console.log = (...args) => {
    capturedLogs.push(args);
  };

  globalThis.MakeGoogleFlatAgain = {
    buildFlags: { isDevelopment: true },
    runtime: {
      getExtensionApi() {
        return extensionApi;
      }
    },
    settings: {
      getOptions() {
        return Promise.resolve({ enabled: true, apps: { docs: false } });
      },
      observeOptions() {
        return () => {};
      }
    },
    headerStaticCss: {
      sync() {
        return Promise.resolve({
          activeAppIds: ["gmail", "tasks"],
          addedIds: ["mgfa-header-tasks"],
          desiredScriptIds: ["mgfa-header-gmail", "mgfa-header-tasks"],
          removedIds: [],
          skipped: false,
          usedFallback: false
        });
      }
    },
    contentScriptRegistry: {
      syncManagedCssScripts() {
        return Promise.resolve();
      }
    }
  };

  try {
    require("../src/background/background-core.js");
    await flushAsyncWork();

    assert.deepEqual(capturedLogs, [
      [
        "[mgfa/background] header static CSS sync",
        {
          activeAppIds: ["gmail", "tasks"],
          addedIds: ["mgfa-header-tasks"],
          desiredScriptIds: ["mgfa-header-gmail", "mgfa-header-tasks"],
          removedIds: [],
          skipped: false,
          usedFallback: false
        }
      ]
    ]);
  } finally {
    console.log = originalConsoleLog;
    clearBackgroundGlobals();
  }
});

test("background core suppresses success logs in production mode", async () => {
  clearBackgroundGlobals();
  delete require.cache[require.resolve("../src/background/background-core.js")];

  const capturedLogs = [];
  const originalConsoleLog = console.log;
  const extensionApi = {
    runtime: {
      onInstalled: { addListener() {} },
      onStartup: { addListener() {} }
    }
  };

  console.log = (...args) => {
    capturedLogs.push(args);
  };

  globalThis.MakeGoogleFlatAgain = {
    buildFlags: { isDevelopment: false },
    runtime: {
      getExtensionApi() {
        return extensionApi;
      }
    },
    settings: {
      getOptions() {
        return Promise.resolve({ enabled: true, apps: {} });
      },
      observeOptions() {
        return () => {};
      }
    },
    headerStaticCss: {
      sync() {
        return Promise.resolve({ skipped: false, usedFallback: false });
      }
    }
  };

  try {
    require("../src/background/background-core.js");
    await flushAsyncWork();

    assert.deepEqual(capturedLogs, []);
  } finally {
    console.log = originalConsoleLog;
    clearBackgroundGlobals();
  }
});

test("background core keeps warning logs in production mode", async () => {
  clearBackgroundGlobals();
  delete require.cache[require.resolve("../src/background/background-core.js")];

  const capturedWarnings = [];
  const originalConsoleWarn = console.warn;
  const extensionApi = {
    runtime: {
      onInstalled: { addListener() {} },
      onStartup: { addListener() {} }
    }
  };

  console.warn = (...args) => {
    capturedWarnings.push(args);
  };

  globalThis.MakeGoogleFlatAgain = {
    buildFlags: { isDevelopment: false },
    runtime: {
      getExtensionApi() {
        return extensionApi;
      }
    },
    settings: {
      getOptions() {
        return Promise.resolve({ enabled: true, apps: {} });
      },
      observeOptions() {
        return () => {};
      }
    },
    headerStaticCss: {
      sync() {
        return Promise.reject(new Error("broken sync"));
      }
    }
  };

  try {
    require("../src/background/background-core.js");
    await flushAsyncWork();

    assert.equal(capturedWarnings.length, 1);
    assert.equal(capturedWarnings[0][0], "[mgfa/background] header static CSS sync failed");
    assert.match(String(capturedWarnings[0][1]?.message || capturedWarnings[0][1]), /broken sync/);
  } finally {
    console.warn = originalConsoleWarn;
    clearBackgroundGlobals();
  }
});
