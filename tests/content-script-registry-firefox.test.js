const test = require("node:test");
const assert = require("node:assert/strict");

const CORE_PATH = "../src/platform/content-script-registry-core.js";
const REGISTRY_PATH = "../src/platform/firefox/content-script-registry.js";

function loadFirefoxRegistry(globals = {}) {
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

test("firefox adapter maps desired scripts to browser.scripting.registerContentScripts", async () => {
  const registerCalls = [];
  const registry = loadFirefoxRegistry();
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

test("firefox adapter unregisters stale managed ids", async () => {
  const getRegisteredCalls = [];
  const registerCalls = [];
  const unregisterCalls = [];
  const registry = loadFirefoxRegistry();
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

test("firefox adapter skips when scripting registration API is unavailable", async () => {
  const registry = loadFirefoxRegistry();

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

test("firefox adapter falls back to clear-and-register when registered script listing is unavailable", async () => {
  const unregisterCalls = [];
  const registerCalls = [];
  const registry = loadFirefoxRegistry();
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

test("firefox adapter unregisters stale ids when desired set is empty", async () => {
  const unregisterCalls = [];
  const registry = loadFirefoxRegistry();
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

test("firefox adapter rejects callback path when runtime.lastError is set", async () => {
  const registry = loadFirefoxRegistry();
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

test("firefox adapter exposes getRegisteredContentScripts promise rejection message", async () => {
  const registry = loadFirefoxRegistry();
  const fakeApi = {
    runtime: {
      lastError: null
    },
    scripting: {
      getRegisteredContentScripts() {
        return Promise.reject(new Error("Cannot enumerate registered scripts"));
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

test("firefox adapter exposes unregisterContentScripts promise rejection message", async () => {
  const registry = loadFirefoxRegistry();
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
        throw new Error("registerContentScripts should not run when stale unregister fails.");
      },
      unregisterContentScripts() {
        return Promise.reject(new Error("Cannot unregister stale scripts"));
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

test("firefox adapter prefers global browser before chrome fallback without explicit extensionApi", async () => {
  const registerCalls = [];
  const registry = loadFirefoxRegistry({
    browser: {
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
    },
    chrome: {
      runtime: { lastError: null },
      scripting: {
        getRegisteredContentScripts() {
          throw new Error("chrome API should not be used by the Firefox adapter.");
        },
        registerContentScripts() {
          throw new Error("chrome API should not be used by the Firefox adapter.");
        },
        unregisterContentScripts() {
          throw new Error("chrome API should not be used by the Firefox adapter.");
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
