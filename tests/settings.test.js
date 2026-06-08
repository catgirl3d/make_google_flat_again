const test = require("node:test");
const assert = require("node:assert/strict");

const {
  APP_KEYS,
  DEFAULT_OPTIONS,
  normalizeOptions,
  getOptions,
  setOptions,
  appEnabled,
  countEnabledApps,
  getChangedOptions,
  observeOptions
} = require("../src/shared/settings.js");

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
  assert.equal(APP_KEYS.length > 0, true);
  assert.equal(countEnabledApps(DEFAULT_OPTIONS), APP_KEYS.length);
});

test("normalizeOptions keeps missing apps enabled by default", () => {
  const normalized = normalizeOptions({
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
  assert.equal(appEnabled("gmail", { enabled: false, apps: { gmail: true } }), false);
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

  const options = await getOptions(fakeApi);
  assert.equal(options.apps.gmail, false);
  assert.equal(options.apps.drive, true);
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
    const options = await getOptions(fakeApi);

    assert.deepEqual(options, normalizeOptions(DEFAULT_OPTIONS));
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
    const options = await getOptions(fakeApi);

    assert.deepEqual(options, normalizeOptions(DEFAULT_OPTIONS));
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

  await setOptions({ enabled: true, apps: { gmail: false } }, fakeApi);

  assert.equal(writtenValue.mgfaOptions.apps.gmail, false);
  assert.equal(writtenValue.mgfaOptions.apps.docs, true);
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

  await assert.rejects(setOptions({ enabled: true }, fakeApi), /quota exceeded/);
});

test("getChangedOptions normalizes partial storage updates", () => {
  const options = getChangedOptions({
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

test("observeOptions listens for mgfaOptions changes on the active storage area", () => {
  let handler = null;
  const observed = [];
  const fakeApi = {
    storage: {
      sync: {},
      local: {},
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

  const stopObserving = observeOptions((options, meta) => {
    observed.push({ options, meta });
  }, fakeApi);

  handler({ mgfaOptions: { newValue: { enabled: false, apps: { docs: false } } } }, "sync");
  handler({ mgfaOptions: { newValue: { enabled: true, apps: { docs: true } } } }, "local");
  stopObserving();

  assert.equal(observed.length, 1);
  assert.equal(observed[0].options.enabled, false);
  assert.equal(observed[0].options.apps.docs, false);
  assert.equal(observed[0].meta.areaName, "sync");
  assert.equal(handler, null);
});
