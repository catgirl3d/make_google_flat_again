const test = require("node:test");
const assert = require("node:assert/strict");

const CORE_PATH = "../src/platform/content-script-registry-core.js";
const REGISTRY_PATH = "../src/platform/chrome/content-script-registry.js";

function loadChromeRegistry(globals = {}) {
  delete globalThis.MakeGoogleFlatAgain;
  delete globalThis.__MGFA_RUNTIME__;
  delete globalThis.browser;
  delete globalThis.chrome;

  delete require.cache[require.resolve("../src/shared/runtime.js")];
  delete require.cache[require.resolve(CORE_PATH)];
  delete require.cache[require.resolve(REGISTRY_PATH)];

  Object.assign(globalThis, globals);

  require("../src/shared/runtime.js");
  return require(REGISTRY_PATH);
}

function createDesiredScript(id = "mgfa-header-docs") {
  return {
    id,
    matches: ["https://docs.google.com/document/*"],
    cssFile: "src/content/styles/header-docs.css",
    runAt: "document_start"
  };
}

function createExpectedRegistration(id = "mgfa-header-docs") {
  return {
    id,
    matches: ["https://docs.google.com/document/*"],
    css: ["src/content/styles/header-docs.css"],
    runAt: "document_start",
    persistAcrossSessions: true
  };
}

test("chrome adapter maps desired scripts to scripting.registerContentScripts", async () => {
  const registerCalls = [];
  const registry = loadChromeRegistry();
  const fakeApi = {
    runtime: {
      lastError: null
    },
    scripting: {
      getRegisteredContentScripts(_filter, callback) {
        callback([]);
      },
      registerContentScripts(payload, callback) {
        registerCalls.push(payload);
        callback();
      },
      unregisterContentScripts(_payload, callback) {
        callback();
      }
    }
  };

  const result = await registry.syncManagedCssScripts(
    {
      managedIds: ["mgfa-header-docs"],
      desiredScripts: [
        createDesiredScript()
      ]
    },
    fakeApi
  );

  assert.deepEqual(registerCalls, [
    [
      createExpectedRegistration()
    ]
  ]);
  assert.deepEqual(result.addedIds, ["mgfa-header-docs"]);
});

test("chrome adapter unregisters stale managed ids", async () => {
  const getRegisteredCalls = [];
  const registerCalls = [];
  const unregisterCalls = [];
  const registry = loadChromeRegistry();
  const fakeApi = {
    runtime: {
      lastError: null
    },
    scripting: {
      getRegisteredContentScripts(filter) {
        getRegisteredCalls.push(filter);
        return Promise.resolve([
          { id: "mgfa-header-docs" },
          { id: "mgfa-header-sheets" }
        ]);
      },
      registerContentScripts(payload) {
        registerCalls.push(payload);
        return Promise.resolve();
      },
      unregisterContentScripts(payload) {
        unregisterCalls.push(payload);
        return Promise.resolve();
      }
    }
  };

  await registry.syncManagedCssScripts(
    {
      managedIds: ["mgfa-header-docs", "mgfa-header-sheets"],
      desiredScripts: [
        {
          id: "mgfa-header-sheets",
          matches: ["https://docs.google.com/spreadsheets/*"],
          cssFile: "src/content/styles/header-sheets.css",
          runAt: "document_start"
        }
      ]
    },
    fakeApi
  );

  assert.deepEqual(getRegisteredCalls, [{ ids: ["mgfa-header-docs", "mgfa-header-sheets"] }]);
  assert.deepEqual(unregisterCalls, [{ ids: ["mgfa-header-docs"] }]);
  assert.deepEqual(registerCalls, []);
});

test("chrome adapter skips when scripting registration API is unavailable", async () => {
  const registry = loadChromeRegistry();

  const result = await registry.syncManagedCssScripts(
    {
      managedIds: ["mgfa-header-docs"],
      desiredScripts: [createDesiredScript()]
    },
    { runtime: { lastError: null } }
  );

  assert.equal(result.skipped, true);
  assert.deepEqual(result.removedIds, []);
  assert.deepEqual(result.addedIds, []);
});

test("chrome adapter falls back to clear-and-register when registered script listing is unavailable", async () => {
  const unregisterCalls = [];
  const registerCalls = [];
  const registry = loadChromeRegistry();
  const fakeApi = {
    runtime: {
      lastError: null
    },
    scripting: {
      registerContentScripts(payload) {
        registerCalls.push(payload);
        return Promise.resolve();
      },
      unregisterContentScripts(payload) {
        unregisterCalls.push(payload);
        return Promise.resolve();
      }
    }
  };

  const result = await registry.syncManagedCssScripts(
    {
      managedIds: ["mgfa-header-docs", "mgfa-header-sheets"],
      desiredScripts: [createDesiredScript("mgfa-header-sheets")]
    },
    fakeApi
  );

  assert.equal(result.usedFallback, true);
  assert.deepEqual(result.removedIds, ["mgfa-header-docs", "mgfa-header-sheets"]);
  assert.deepEqual(result.addedIds, ["mgfa-header-sheets"]);
  assert.deepEqual(unregisterCalls, [{ ids: ["mgfa-header-docs", "mgfa-header-sheets"] }]);
  assert.deepEqual(registerCalls, [
    [
      createExpectedRegistration("mgfa-header-sheets")
    ]
  ]);
});

test("chrome adapter unregisters stale ids when desired set is empty", async () => {
  const unregisterCalls = [];
  const registry = loadChromeRegistry();
  const fakeApi = {
    runtime: {
      lastError: null
    },
    scripting: {
      getRegisteredContentScripts() {
        return Promise.resolve([
          { id: "mgfa-header-docs" },
          { id: "mgfa-header-sheets" }
        ]);
      },
      registerContentScripts() {
        throw new Error("registerContentScripts should not run for an empty desired set.");
      },
      unregisterContentScripts(payload) {
        unregisterCalls.push(payload);
        return Promise.resolve();
      }
    }
  };

  const result = await registry.syncManagedCssScripts(
    {
      managedIds: ["mgfa-header-docs", "mgfa-header-sheets"],
      desiredScripts: []
    },
    fakeApi
  );

  assert.deepEqual(result.removedIds, ["mgfa-header-docs", "mgfa-header-sheets"]);
  assert.deepEqual(result.addedIds, []);
  assert.deepEqual(unregisterCalls, [{ ids: ["mgfa-header-docs", "mgfa-header-sheets"] }]);
});

test("chrome adapter rejects callback path when runtime.lastError is set", async () => {
  const registry = loadChromeRegistry();
  const fakeApi = {
    runtime: {
      lastError: null
    },
    scripting: {
      getRegisteredContentScripts(_filter, callback) {
        callback([]);
      },
      registerContentScripts(_payload, callback) {
        fakeApi.runtime.lastError = { message: "Registration denied" };
        callback();
      },
      unregisterContentScripts(_payload, callback) {
        callback();
      }
    }
  };

  await assert.rejects(
    registry.syncManagedCssScripts(
      {
        managedIds: ["mgfa-header-docs"],
        desiredScripts: [createDesiredScript()]
      },
      fakeApi
    ),
    /Registration denied/
  );
});

test("chrome adapter exposes getRegisteredContentScripts callback lastError message", async () => {
  const registry = loadChromeRegistry();
  const fakeApi = {
    runtime: {
      lastError: null
    },
    scripting: {
      getRegisteredContentScripts(_filter, callback) {
        fakeApi.runtime.lastError = { message: "Cannot enumerate registered scripts" };
        callback();
      },
      registerContentScripts() {
        throw new Error("registerContentScripts should not run after listing fails.");
      },
      unregisterContentScripts() {
        throw new Error("unregisterContentScripts should not run after listing fails.");
      }
    }
  };

  await assert.rejects(
    registry.syncManagedCssScripts(
      {
        managedIds: ["mgfa-header-docs"],
        desiredScripts: [createDesiredScript()]
      },
      fakeApi
    ),
    { message: "Cannot enumerate registered scripts" }
  );
});

test("chrome adapter exposes unregisterContentScripts callback lastError message", async () => {
  const registry = loadChromeRegistry();
  const fakeApi = {
    runtime: {
      lastError: null
    },
    scripting: {
      getRegisteredContentScripts(_filter, callback) {
        callback([
          { id: "mgfa-header-docs" },
          { id: "mgfa-header-sheets" }
        ]);
      },
      registerContentScripts() {
        throw new Error("registerContentScripts should not run when stale unregister fails.");
      },
      unregisterContentScripts(_payload, callback) {
        fakeApi.runtime.lastError = { message: "Cannot unregister stale scripts" };
        callback();
      }
    }
  };

  await assert.rejects(
    registry.syncManagedCssScripts(
      {
        managedIds: ["mgfa-header-docs", "mgfa-header-sheets"],
        desiredScripts: [createDesiredScript("mgfa-header-sheets")]
      },
      fakeApi
    ),
    { message: "Cannot unregister stale scripts" }
  );
});

test("chrome adapter prefers global chrome before runtime fallback without explicit extensionApi", async () => {
  const registerCalls = [];
  const registry = loadChromeRegistry({
    browser: {
      runtime: { lastError: null },
      scripting: {
        getRegisteredContentScripts() {
          throw new Error("browser API should not be used by the Chrome adapter.");
        },
        registerContentScripts() {
          throw new Error("browser API should not be used by the Chrome adapter.");
        },
        unregisterContentScripts() {
          throw new Error("browser API should not be used by the Chrome adapter.");
        }
      }
    },
    chrome: {
      runtime: { lastError: null },
      scripting: {
        getRegisteredContentScripts() {
          return Promise.resolve([]);
        },
        registerContentScripts(payload) {
          registerCalls.push(payload);
          return Promise.resolve();
        },
        unregisterContentScripts() {
          return Promise.resolve();
        }
      }
    }
  });

  await registry.syncManagedCssScripts({
    managedIds: ["mgfa-header-docs"],
    desiredScripts: [createDesiredScript()]
  });

  assert.equal(registerCalls.length, 1);
});
