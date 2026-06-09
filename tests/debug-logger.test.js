const test = require("node:test");
const assert = require("node:assert/strict");

const RUNTIME_PATH = "../src/shared/runtime.js";
const BUILD_FLAGS_PATH = "../src/shared/build-flags.js";
const DEBUG_LOGGER_PATH = "../src/content/debug-logger.js";

function resetDebugLoggerEnvironment() {
  delete globalThis.MakeGoogleFlatAgain;
  delete globalThis.__MGFA_RUNTIME__;
  delete globalThis.__MGFA_DEBUG__;

  delete require.cache[require.resolve(RUNTIME_PATH)];
  delete require.cache[require.resolve(BUILD_FLAGS_PATH)];
  delete require.cache[require.resolve(DEBUG_LOGGER_PATH)];
}

function loadDebugLogger(buildFlags) {
  resetDebugLoggerEnvironment();
  require(RUNTIME_PATH);

  if (buildFlags) {
    globalThis.MakeGoogleFlatAgain.buildFlags = buildFlags;
  }

  return require(DEBUG_LOGGER_PATH);
}

let debugLogger = null;

test.beforeEach(() => {
  debugLogger = loadDebugLogger();
});

test("stableSerialize normalizes object key order", () => {
  assert.equal(
    debugLogger.stableSerialize({ b: 1, a: { d: 2, c: 3 } }),
    debugLogger.stableSerialize({ a: { c: 3, d: 2 }, b: 1 })
  );
});

test("snapshot logging deduplicates identical payloads", () => {
  const scope = `debug-test-${Date.now()}`;
  const logger = debugLogger.create(scope);

  assert.equal(logger.snapshot("state", { a: 1, b: 2 }), true);
  assert.equal(logger.snapshot("state", { b: 2, a: 1 }), false);
  assert.equal(logger.snapshot("state", { a: 1, b: 3 }), true);
});

test("production build flags turn debug logger into a no-op", () => {
  const originalConsoleLog = console.log;
  const calls = [];
  console.log = (...args) => {
    calls.push(args);
  };

  try {
    const prodDebugLogger = loadDebugLogger({ isDevelopment: false });
    const logger = prodDebugLogger.create("prod-scope");

    assert.equal(logger.event("boot", { enabled: true }), false);
    assert.equal(logger.snapshot("state", { enabled: true }), false);
    assert.equal(logger.read("state"), null);
    assert.equal(globalThis.__MGFA_DEBUG__, undefined);
    assert.deepEqual(calls, []);
  } finally {
    console.log = originalConsoleLog;
  }
});
