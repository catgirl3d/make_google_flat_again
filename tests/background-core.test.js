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

async function loadBackgroundCore({
  buildFlags = { isDevelopment: false },
  storedOptions = [],
  getOptionsError = null,
  headerSyncResult = null,
  headerSyncImplementation = null
} = {}) {
  clearBackgroundGlobals();
  delete require.cache[require.resolve("../src/background/background-core.js")];

  let onInstalled = null;
  let onStartup = null;
  let observedOptionsListener = null;
  let observeOptionsExtensionApi = null;

  const getOptionsCalls = [];
  const headerSyncCalls = [];
  const warningLogs = [];

  const originalConsoleWarn = console.warn;
  console.warn = (...args) => {
    warningLogs.push(args);
  };

  const extensionApi = {
    runtime: {
      onInstalled: {
        addListener(listener) {
          onInstalled = listener;
        }
      },
      onStartup: {
        addListener(listener) {
          onStartup = listener;
        }
      }
    }
  };

  const storedOptionsQueue = [...storedOptions];

  globalThis.MakeGoogleFlatAgain = {
    buildFlags,
    runtime: {
      getExtensionApi() {
        return extensionApi;
      }
    },
    settings: {
      getOptions(api) {
        getOptionsCalls.push(api);

        if (getOptionsError) {
          return Promise.reject(getOptionsError);
        }

        if (!storedOptionsQueue.length) {
          return Promise.reject(new Error("missing stored options fixture"));
        }

        return Promise.resolve(storedOptionsQueue.shift());
      },
      observeOptions(listener, api) {
        observedOptionsListener = listener;
        observeOptionsExtensionApi = api;
        return () => {};
      }
    },
    headerStaticCss: {
      sync(api, options) {
        headerSyncCalls.push({ api, options });

        if (typeof headerSyncImplementation === "function") {
          return headerSyncImplementation(api, options);
        }

        return Promise.resolve(headerSyncResult);
      }
    }
  };

  require("../src/background/background-core.js");
  await flushAsyncWork();

  return {
    extensionApi,
    getOptionsCalls,
    headerSyncCalls,
    observeOptionsExtensionApi,
    observedOptionsListener,
    onInstalled,
    onStartup,
    warningLogs,
    cleanup() {
      console.warn = originalConsoleWarn;
      clearBackgroundGlobals();
      delete require.cache[require.resolve("../src/background/background-core.js")];
    }
  };
}

test("background core syncs stored options on initial load and wires lifecycle listeners", async () => {
  const initialOptions = { enabled: true, apps: { gmail: true } };
  const context = await loadBackgroundCore({ storedOptions: [initialOptions] });

  try {
    assert.equal(typeof context.onInstalled, "function");
    assert.equal(typeof context.onStartup, "function");
    assert.equal(typeof context.observedOptionsListener, "function");
    assert.equal(context.observeOptionsExtensionApi, context.extensionApi);
    assert.deepEqual(context.getOptionsCalls, [context.extensionApi]);
    assert.deepEqual(context.headerSyncCalls, [
      {
        api: context.extensionApi,
        options: initialOptions
      }
    ]);
  } finally {
    context.cleanup();
  }
});

test("background core reloads stored options for onInstalled and onStartup events", async () => {
  const initialOptions = { enabled: true, apps: { gmail: true } };
  const installedOptions = { enabled: false, apps: { docs: true } };
  const startupOptions = { enabled: true, apps: { calendar: false } };
  const context = await loadBackgroundCore({
    storedOptions: [initialOptions, installedOptions, startupOptions]
  });

  try {
    context.onInstalled();
    await flushAsyncWork();

    context.onStartup();
    await flushAsyncWork();

    assert.deepEqual(context.getOptionsCalls, [
      context.extensionApi,
      context.extensionApi,
      context.extensionApi
    ]);
    assert.deepEqual(context.headerSyncCalls, [
      {
        api: context.extensionApi,
        options: initialOptions
      },
      {
        api: context.extensionApi,
        options: installedOptions
      },
      {
        api: context.extensionApi,
        options: startupOptions
      }
    ]);
  } finally {
    context.cleanup();
  }
});

test("background core syncs observer updates with the pushed options payload", async () => {
  const initialOptions = { enabled: true, apps: {} };
  const observedOptions = { enabled: true, apps: { meet: false, tasks: true } };
  const context = await loadBackgroundCore({ storedOptions: [initialOptions] });

  try {
    context.observedOptionsListener(observedOptions);
    await flushAsyncWork();

    assert.deepEqual(context.getOptionsCalls, [context.extensionApi]);
    assert.deepEqual(context.headerSyncCalls, [
      {
        api: context.extensionApi,
        options: initialOptions
      },
      {
        api: context.extensionApi,
        options: observedOptions
      }
    ]);
  } finally {
    context.cleanup();
  }
});

test("background core serializes lifecycle and observer sync work until the active sync completes", async () => {
  const initialOptions = { enabled: true, apps: { gmail: true } };
  const installedOptions = { enabled: true, apps: { docs: false } };
  const startupOptions = { enabled: true, apps: { calendar: false } };
  const observedOptions = { enabled: true, apps: { tasks: true } };
  const pendingSyncs = [];
  const context = await loadBackgroundCore({
    storedOptions: [initialOptions, installedOptions, startupOptions],
    headerSyncImplementation(api, options) {
      const deferred = createDeferred();
      pendingSyncs.push({ api, options, deferred });
      return deferred.promise;
    }
  });

  try {
    assert.deepEqual(context.getOptionsCalls, [context.extensionApi]);
    assert.deepEqual(context.headerSyncCalls, [
      {
        api: context.extensionApi,
        options: initialOptions
      }
    ]);

    context.onInstalled();
    context.onStartup();
    context.observedOptionsListener(observedOptions);
    await flushAsyncWork();

    assert.deepEqual(
      context.getOptionsCalls,
      [context.extensionApi],
      "Should not read storage for later syncs before the active sync settles"
    );
    assert.deepEqual(
      context.headerSyncCalls,
      [
        {
          api: context.extensionApi,
          options: initialOptions
        }
      ],
      "Should not start later header syncs before the active sync settles"
    );

    pendingSyncs[0].deferred.resolve();
    await flushAsyncWork();

    assert.deepEqual(context.getOptionsCalls, [
      context.extensionApi,
      context.extensionApi
    ]);
    assert.deepEqual(context.headerSyncCalls[1], {
      api: context.extensionApi,
      options: installedOptions
    });

    pendingSyncs[1].deferred.resolve();
    await flushAsyncWork();

    assert.deepEqual(context.getOptionsCalls, [
      context.extensionApi,
      context.extensionApi,
      context.extensionApi
    ]);
    assert.deepEqual(context.headerSyncCalls[2], {
      api: context.extensionApi,
      options: startupOptions
    });

    pendingSyncs[2].deferred.resolve();
    await flushAsyncWork();

    assert.deepEqual(context.getOptionsCalls, [
      context.extensionApi,
      context.extensionApi,
      context.extensionApi
    ]);
    assert.deepEqual(context.headerSyncCalls[3], {
      api: context.extensionApi,
      options: observedOptions
    });

    pendingSyncs[3].deferred.resolve();
    await flushAsyncWork();
  } finally {
    context.cleanup();
  }
});

test("background core warns and skips header sync when settings lookup fails", async () => {
  const failure = new Error("settings unavailable");
  const context = await loadBackgroundCore({ getOptionsError: failure });

  try {
    assert.deepEqual(context.headerSyncCalls, []);
    assert.deepEqual(context.warningLogs, [
      ["[mgfa/background] settings sync failed", failure]
    ]);
  } finally {
    context.cleanup();
  }
});

test("background core warns when header static CSS sync fails", async () => {
  const initialOptions = { enabled: true, apps: { docs: true } };
  const failure = new Error("broken sync");
  const context = await loadBackgroundCore({
    storedOptions: [initialOptions],
    headerSyncImplementation() {
      return Promise.reject(failure);
    }
  });

  try {
    assert.deepEqual(context.getOptionsCalls, [context.extensionApi]);
    assert.deepEqual(context.headerSyncCalls, [
      {
        api: context.extensionApi,
        options: initialOptions
      }
    ]);
    assert.deepEqual(context.warningLogs, [
      ["[mgfa/background] header static CSS sync failed", failure]
    ]);
  } finally {
    context.cleanup();
  }
});
