const test = require("node:test");
const assert = require("node:assert/strict");

const SETTINGS_MODULE_PATH = "../src/shared/settings.js";

function loadSettings() {
  delete require.cache[require.resolve(SETTINGS_MODULE_PATH)];
  return require(SETTINGS_MODULE_PATH);
}

let settings = null;

test.beforeEach(() => {
  settings = loadSettings();
});

function captureConsoleWarn() {
  const originalWarn = console.warn;
  const calls = [];

  console.warn = (...args) => {
    calls.push(args);
  };

  return {
    calls,
    restore() {
      console.warn = originalWarn;
    }
  };
}

test("default options use the public storage key and enable every registered app", () => {
  assert.equal(settings.APP_KEYS.length > 0, true);
  assert.equal(settings.STORAGE_KEY, "mgfaOptions");
  assert.deepEqual(Object.keys(settings.DEFAULT_OPTIONS.apps).sort(), [...settings.APP_KEYS].sort());

  for (const appId of settings.APP_KEYS) {
    assert.equal(settings.DEFAULT_OPTIONS.apps[appId], true);
  }

  assert.equal(settings.countEnabledApps(settings.DEFAULT_OPTIONS), settings.APP_KEYS.length);
});

test("normalizeOptions preserves explicit false values and ignores unknown app ids", () => {
  const normalized = settings.normalizeOptions({
    enabled: false,
    apps: {
      gmail: false,
      drive: false,
      unknownWorkspaceApp: false
    }
  });

  assert.equal(normalized.enabled, false);
  assert.deepEqual(Object.keys(normalized.apps).sort(), [...settings.APP_KEYS].sort());
  assert.equal(normalized.apps.gmail, false);
  assert.equal(normalized.apps.drive, false);
  assert.equal(normalized.apps.docs, true);
  assert.equal(Object.prototype.hasOwnProperty.call(normalized.apps, "unknownWorkspaceApp"), false);
});

test("normalizeOptions safely defaults missing and invalid input", () => {
  for (const value of [undefined, null, false, "invalid", 123, { apps: null }, { apps: false }]) {
    assert.deepEqual(settings.normalizeOptions(value), settings.DEFAULT_OPTIONS);
  }
});

test("appEnabled respects global toggle", () => {
  assert.equal(settings.appEnabled("gmail", { enabled: false, apps: { gmail: true } }), false);
});

test("getOptions queries and reads only the mgfaOptions storage key", async () => {
  const queries = [];
  const persistedOptions = {
    enabled: true,
    apps: {
      gmail: false
    }
  };
  const fakeApi = {
    storage: {
      sync: {
        get(query) {
          queries.push(query);

          return Promise.resolve({
            otherOptions: { enabled: false, apps: { gmail: true } },
            mgfaOptions: persistedOptions
          });
        }
      }
    }
  };

  const options = await settings.getOptions(fakeApi);

  assert.deepEqual(queries, [{ mgfaOptions: settings.DEFAULT_OPTIONS }]);
  assert.equal(options.apps.gmail, false);
  assert.equal(options.apps.drive, true);
  assert.deepEqual(options, settings.normalizeOptions(persistedOptions));
});

test("getOptions falls back from sync to local when sync read fails", async () => {
  const rejection = new Error("sync unavailable");
  const warnSpy = captureConsoleWarn();
  const localOptions = {
    enabled: true,
    apps: {
      docs: false,
      gmail: true
    }
  };
  const fakeApi = {
    storage: {
      sync: {
        get() {
          return Promise.reject(rejection);
        }
      },
      local: {
        get(query) {
          assert.deepEqual(query, { mgfaOptions: settings.DEFAULT_OPTIONS });

          return Promise.resolve({
            mgfaOptions: localOptions
          });
        }
      }
    }
  };

  try {
    const options = await settings.getOptions(fakeApi);

    assert.deepEqual(options, settings.normalizeOptions(localOptions));
    assert.equal(warnSpy.calls.length, 1);
    assert.equal(warnSpy.calls[0][0], "[mgfa/settings] Failed to load options in sync storage. Falling back to local.");
    assert.equal(warnSpy.calls[0][1], rejection);
  } finally {
    warnSpy.restore();
  }
});

test("getOptions falls back to defaults and logs local failure when sync and local reads fail", async () => {
  const syncRejection = new Error("sync unavailable");
  const localRejection = new Error("local unavailable");
  const warnSpy = captureConsoleWarn();
  const fakeApi = {
    storage: {
      sync: {
        get(query) {
          assert.deepEqual(query, { mgfaOptions: settings.DEFAULT_OPTIONS });

          return Promise.reject(syncRejection);
        }
      },
      local: {
        get(query) {
          assert.deepEqual(query, { mgfaOptions: settings.DEFAULT_OPTIONS });

          return Promise.reject(localRejection);
        }
      }
    }
  };

  try {
    const options = await settings.getOptions(fakeApi);

    assert.deepEqual(options, settings.normalizeOptions(settings.DEFAULT_OPTIONS));
    assert.deepEqual(warnSpy.calls, [
      ["[mgfa/settings] Failed to load options in sync storage. Falling back to local.", syncRejection],
      ["[mgfa/settings] Failed to load options from local storage. Using defaults.", localRejection]
    ]);
  } finally {
    warnSpy.restore();
  }
});

test("getOptions supports callback-based sync to local fallback", async () => {
  const syncLastError = { message: "sync read failed" };
  const localOptions = {
    enabled: true,
    apps: {
      sheets: false
    }
  };
  const warnSpy = captureConsoleWarn();
  const fakeApi = {
    runtime: {
      lastError: null
    },
    storage: {
      sync: {
        get(query, callback) {
          assert.deepEqual(query, { mgfaOptions: settings.DEFAULT_OPTIONS });

          fakeApi.runtime.lastError = syncLastError;
          callback({});
          fakeApi.runtime.lastError = null;
        }
      },
      local: {
        get(query, callback) {
          assert.deepEqual(query, { mgfaOptions: settings.DEFAULT_OPTIONS });

          callback({ mgfaOptions: localOptions });
        }
      }
    }
  };

  try {
    const options = await settings.getOptions(fakeApi);

    assert.deepEqual(options, settings.normalizeOptions(localOptions));
    assert.deepEqual(warnSpy.calls, [
      ["[mgfa/settings] Failed to load options in sync storage. Falling back to local.", syncLastError]
    ]);
  } finally {
    warnSpy.restore();
  }
});

test("getOptions logs and falls back to defaults when promise-based storage rejects", async () => {
  const rejection = new Error("storage unavailable");
  const fakeApi = {
    storage: {
      sync: {
        get() {
          return Promise.reject(rejection);
        }
      }
    }
  };
  const warnSpy = captureConsoleWarn();

  try {
    const options = await settings.getOptions(fakeApi);

    assert.deepEqual(options, settings.normalizeOptions(settings.DEFAULT_OPTIONS));
    assert.equal(warnSpy.calls.length, 1);
    assert.equal(warnSpy.calls[0][0], "[mgfa/settings] Failed to load options from sync storage. Using defaults.");
    assert.equal(warnSpy.calls[0][1], rejection);
  } finally {
    warnSpy.restore();
  }
});

test("getOptions logs and falls back to defaults when callback storage exposes runtime.lastError", async () => {
  const lastError = { message: "sync read failed" };
  const fakeApi = {
    runtime: {
      lastError: null
    },
    storage: {
      sync: {
        get(_defaults, callback) {
          fakeApi.runtime.lastError = lastError;
          callback({});
          fakeApi.runtime.lastError = null;
        }
      }
    }
  };
  const warnSpy = captureConsoleWarn();

  try {
    const options = await settings.getOptions(fakeApi);

    assert.deepEqual(options, settings.normalizeOptions(settings.DEFAULT_OPTIONS));
    assert.equal(warnSpy.calls.length, 1);
    assert.equal(warnSpy.calls[0][0], "[mgfa/settings] Failed to load options from sync storage. Using defaults.");
    assert.equal(warnSpy.calls[0][1], lastError);
  } finally {
    warnSpy.restore();
  }
});

test("setOptions writes normalized options to the mgfaOptions storage key", async () => {
  let writtenPayload = null;
  const inputOptions = { enabled: true, apps: { gmail: false } };
  const fakeApi = {
    storage: {
      sync: {
        set(payload) {
          writtenPayload = payload;

          return Promise.resolve();
        }
      }
    }
  };

  const saved = await settings.setOptions(inputOptions, fakeApi);
  const normalizedOptions = settings.normalizeOptions(inputOptions);

  assert.deepEqual(saved, normalizedOptions);
  assert.deepEqual(writtenPayload, { mgfaOptions: normalizedOptions });
});

test("setOptions falls back to local when sync write fails", async () => {
  const rejection = new Error("sync quota exceeded");
  const warnSpy = captureConsoleWarn();
  let localPayload = null;
  const fakeApi = {
    storage: {
      sync: {
        set() {
          return Promise.reject(rejection);
        }
      },
      local: {
        set(value) {
          localPayload = value;
          return Promise.resolve();
        }
      }
    }
  };

  try {
    const saved = await settings.setOptions({ enabled: true, apps: { gmail: false } }, fakeApi);
    const normalizedOptions = settings.normalizeOptions({ enabled: true, apps: { gmail: false } });

    assert.deepEqual(saved, normalizedOptions);
    assert.deepEqual(localPayload, { mgfaOptions: normalizedOptions });
    assert.equal(warnSpy.calls.length, 1);
    assert.equal(warnSpy.calls[0][0], "[mgfa/settings] Failed to save options in sync storage. Falling back to local.");
    assert.equal(warnSpy.calls[0][1], rejection);
  } finally {
    warnSpy.restore();
  }
});

test("setOptions rejects with local error when sync and local writes fail", async () => {
  const syncRejection = new Error("sync quota exceeded");
  const localRejection = new Error("local quota exceeded");
  const warnSpy = captureConsoleWarn();
  const inputOptions = { enabled: true, apps: { drive: false } };
  const normalizedOptions = settings.normalizeOptions(inputOptions);
  const localPayloads = [];
  const fakeApi = {
    storage: {
      sync: {
        set(payload) {
          assert.deepEqual(payload, { mgfaOptions: normalizedOptions });

          return Promise.reject(syncRejection);
        }
      },
      local: {
        set(payload) {
          localPayloads.push(payload);

          return Promise.reject(localRejection);
        }
      }
    }
  };

  try {
    await assert.rejects(settings.setOptions(inputOptions, fakeApi), localRejection);
    assert.deepEqual(localPayloads, [{ mgfaOptions: normalizedOptions }]);
    assert.deepEqual(warnSpy.calls, [
      ["[mgfa/settings] Failed to save options in sync storage. Falling back to local.", syncRejection]
    ]);
  } finally {
    warnSpy.restore();
  }
});

test("setOptions rejects synchronous storage throws when no fallback exists", async () => {
  const fakeApi = {
    storage: {
      sync: {
        set() {
          throw new Error("sync exploded");
        }
      }
    }
  };

  await assert.rejects(settings.setOptions({ enabled: true }, fakeApi), /sync exploded/);
});

test("setOptions rejects callback-based storage failures via runtime.lastError", async () => {
  const fakeApi = {
    runtime: {
      lastError: null
    },
    storage: {
      sync: {
        set(_value, callback) {
          fakeApi.runtime.lastError = { message: "quota exceeded" };
          callback();
          fakeApi.runtime.lastError = null;
        }
      }
    }
  };

  await assert.rejects(settings.setOptions({ enabled: true }, fakeApi), /quota exceeded/);
});

test("getChangedOptions normalizes partial storage updates", () => {
  const options = settings.getChangedOptions({
    newValue: {
      enabled: true,
      apps: {
        docs: false
      }
    }
  });

  assert.equal(options.enabled, true);
  assert.equal(options.apps.docs, false);
  assert.equal(options.apps.gmail, true);
});

test("observeOptions ignores unrelated keys and reports normalized storage changes", () => {
  let handler = null;
  const observed = [];
  const changeRecord = {
    oldValue: { enabled: true, apps: { docs: true } },
    newValue: { enabled: false, apps: { docs: false, unknownWorkspaceApp: false } }
  };
  const fakeApi = {
    storage: {
      onChanged: {
        addListener(listener) {
          handler = listener;
        },
        removeListener(listener) {
          if (handler === listener) {
            handler = null;
          }
        }
      }
    }
  };

  const stopObserving = settings.observeOptions((options, meta) => {
    observed.push({ options, meta });
  }, fakeApi);

  handler({ unrelatedKey: { newValue: { enabled: false } } }, "sync");
  handler({ [settings.STORAGE_KEY]: changeRecord }, "sync");
  stopObserving();

  assert.equal(observed.length, 1);
  assert.equal(observed[0].options.enabled, false);
  assert.equal(observed[0].options.apps.docs, false);
  assert.equal(observed[0].options.apps.gmail, true);
  assert.equal(Object.prototype.hasOwnProperty.call(observed[0].options.apps, "unknownWorkspaceApp"), false);
  assert.equal(observed[0].meta.areaName, "sync");
  assert.equal(observed[0].meta.changeRecord, changeRecord);
  assert.equal(handler, null);
});

test("observeOptions stop function is a no-op when removeListener is unavailable", () => {
  let handler = null;
  const fakeApi = {
    storage: {
      onChanged: {
        addListener(listener) {
          handler = listener;
        }
      }
    }
  };

  const stopObserving = settings.observeOptions(() => {}, fakeApi);

  assert.doesNotThrow(stopObserving);
  assert.equal(typeof handler, "function");
});

test("observeOptions returns no-op without listener or storage observer", () => {
  for (const stopObserving of [
    settings.observeOptions(null, {}),
    settings.observeOptions(() => {}, { storage: {} }),
    settings.observeOptions(() => {}, { storage: { onChanged: {} } })
  ]) {
    assert.equal(typeof stopObserving, "function");
    assert.doesNotThrow(stopObserving);
  }
});
