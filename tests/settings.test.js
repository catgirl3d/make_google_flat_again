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

test("default options enable every registered app", () => {
  assert.equal(settings.APP_KEYS.length > 0, true);
  assert.equal(settings.countEnabledApps(settings.DEFAULT_OPTIONS), settings.APP_KEYS.length);
});

test("normalizeOptions keeps missing apps enabled by default", () => {
  const normalized = settings.normalizeOptions({
    enabled: true,
    apps: {
      gmail: false,
      drive: false
    }
  });

  assert.equal(normalized.apps.gmail, false);
  assert.equal(normalized.apps.drive, false);
  assert.equal(normalized.apps.docs, true);
});

test("appEnabled respects global toggle", () => {
  assert.equal(settings.appEnabled("gmail", { enabled: false, apps: { gmail: true } }), false);
});

test("getOptions supports promise-based storage APIs", async () => {
  const fakeApi = {
    storage: {
      sync: {
        get(defaults) {
          return Promise.resolve({
            [Object.keys(defaults)[0]]: {
              enabled: true,
              apps: {
                gmail: false
              }
            }
          });
        }
      }
    }
  };

  const options = await settings.getOptions(fakeApi);
  assert.equal(options.apps.gmail, false);
  assert.equal(options.apps.drive, true);
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
        get(defaults) {
          const key = Object.keys(defaults)[0];
          return Promise.resolve({
            [key]: localOptions
          });
        },
        set() {
          return Promise.resolve();
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

test("setOptions supports promise-based storage APIs", async () => {
  let writtenValue = null;
  const fakeApi = {
    storage: {
      sync: {
        set(value) {
          writtenValue = value;
          return Promise.resolve();
        }
      }
    }
  };

  await settings.setOptions({ enabled: true, apps: { gmail: false } }, fakeApi);

  assert.equal(writtenValue.mgfaOptions.apps.gmail, false);
  assert.equal(writtenValue.mgfaOptions.apps.docs, true);
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
        get(defaults) {
          return Promise.resolve({ [Object.keys(defaults)[0]]: null });
        },
        set(value) {
          localPayload = value;
          return Promise.resolve();
        }
      }
    }
  };

  try {
    const saved = await settings.setOptions({ enabled: true, apps: { gmail: false } }, fakeApi);

    assert.equal(saved.apps.gmail, false);
    assert.equal(localPayload[settings.STORAGE_KEY].apps.gmail, false);
    assert.equal(warnSpy.calls.length, 1);
    assert.equal(warnSpy.calls[0][0], "[mgfa/settings] Failed to save options in sync storage. Falling back to local.");
    assert.equal(warnSpy.calls[0][1], rejection);
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

test("observeOptions accepts changes from storage", () => {
  let handler = null;
  const observed = [];
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

  handler({ [settings.STORAGE_KEY]: { newValue: { enabled: true, apps: { docs: true } } } }, "sync");
  stopObserving();

  assert.equal(observed.length, 1);
  assert.equal(observed[0].options.enabled, true);
  assert.equal(observed[0].options.apps.docs, true);
  assert.equal(observed[0].meta.areaName, "sync");
  assert.equal(handler, null);
});
