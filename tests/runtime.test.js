const test = require("node:test");
const assert = require("node:assert/strict");

const RUNTIME_PATH = require.resolve("../src/shared/runtime.js");
const RUNTIME_GLOBALS = ["MakeGoogleFlatAgain", "__MGFA_RUNTIME__", "browser", "chrome"];

function snapshotGlobals(names) {
  return names.map((name) => ({
    name,
    exists: Object.prototype.hasOwnProperty.call(globalThis, name),
    value: globalThis[name]
  }));
}

function restoreGlobals(snapshot) {
  for (const { name, exists, value } of snapshot) {
    if (exists) {
      globalThis[name] = value;
    } else {
      delete globalThis[name];
    }
  }
}

function withRuntimeGlobals(globals, assertRuntime) {
  const globalsSnapshot = snapshotGlobals(RUNTIME_GLOBALS);
  const cachedRuntime = require.cache[RUNTIME_PATH];

  try {
    for (const name of RUNTIME_GLOBALS) {
      delete globalThis[name];
    }

    Object.assign(globalThis, globals);
    delete require.cache[RUNTIME_PATH];

    return assertRuntime(require("../src/shared/runtime.js"));
  } finally {
    if (cachedRuntime) {
      require.cache[RUNTIME_PATH] = cachedRuntime;
    } else {
      delete require.cache[RUNTIME_PATH];
    }

    restoreGlobals(globalsSnapshot);
  }
}

test("runtime bootstraps the shared namespace and exported singleton", () => {
  const namespace = { existingSection: { enabled: true } };

  withRuntimeGlobals({ MakeGoogleFlatAgain: namespace }, (runtime) => {
    const section = { ready: true };

    assert.equal(globalThis.MakeGoogleFlatAgain, namespace);
    assert.equal(globalThis.MakeGoogleFlatAgain.runtime, runtime);
    assert.equal(globalThis.__MGFA_RUNTIME__, runtime);
    assert.equal(require("../src/shared/runtime.js"), runtime);
    assert.equal(runtime.getNamespace(), namespace);
    assert.equal(runtime.get("existingSection"), namespace.existingSection);
    assert.equal(runtime.attach("testSection", section), section);
    assert.equal(runtime.get("testSection"), section);
    assert.equal(namespace.testSection, section);
  });
});

test("runtime prefers browser extension API over chrome", () => {
  const browserApi = { runtime: { getURL(path) { return `browser://${path}`; } } };
  const chromeApi = { runtime: { getURL(path) { return `chrome://${path}`; } } };

  withRuntimeGlobals({ browser: browserApi, chrome: chromeApi }, (runtime) => {
    assert.equal(runtime.getExtensionApi(), browserApi);
    assert.equal(runtime.getRuntimeUrl("src/test.js"), "browser://src/test.js");
  });
});

test("runtime falls back to chrome extension API when browser is absent", () => {
  const chromeApi = { runtime: { getURL(path) { return `chrome://${path}`; } } };

  withRuntimeGlobals({ chrome: chromeApi }, (runtime) => {
    assert.equal(runtime.getExtensionApi(), chromeApi);
    assert.equal(runtime.getRuntimeUrl("src/test.js"), "chrome://src/test.js");
  });
});

test("runtime returns null extension API and raw path when no extension API exists", () => {
  withRuntimeGlobals({}, (runtime) => {
    assert.equal(runtime.getExtensionApi(), null);
    assert.equal(runtime.getRuntimeUrl("src/test.js"), "src/test.js");
  });
});

test("runtime global setup restores pre-existing globals", () => {
  const globalsSnapshot = snapshotGlobals(RUNTIME_GLOBALS);
  const previousNamespace = { previous: true };
  const previousRuntime = { previous: "runtime" };
  const previousBrowser = { previous: "browser" };
  const previousChrome = { previous: "chrome" };

  try {
    globalThis.MakeGoogleFlatAgain = previousNamespace;
    globalThis.__MGFA_RUNTIME__ = previousRuntime;
    globalThis.browser = previousBrowser;
    globalThis.chrome = previousChrome;

    withRuntimeGlobals({}, () => {});

    assert.equal(globalThis.MakeGoogleFlatAgain, previousNamespace);
    assert.equal(globalThis.__MGFA_RUNTIME__, previousRuntime);
    assert.equal(globalThis.browser, previousBrowser);
    assert.equal(globalThis.chrome, previousChrome);
  } finally {
    restoreGlobals(globalsSnapshot);
  }
});
