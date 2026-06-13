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

function captureConsoleLog(callback) {
  const originalConsoleLog = console.log;
  const calls = [];
  console.log = (...args) => {
    calls.push(args);
  };

  try {
    return callback(calls);
  } finally {
    console.log = originalConsoleLog;
  }
}

test.beforeEach(() => {
  debugLogger = loadDebugLogger();
});

test("default development build creates a scoped debug store with history, last, and readable snapshots", () => {
  captureConsoleLog((calls) => {
    assert.equal(globalThis.MakeGoogleFlatAgain.buildFlags.isDevelopment, true);
    assert.equal(globalThis.__MGFA_DEBUG__, undefined);

    const logger = debugLogger.create("dev-scope");
    const payload = { b: 2, a: { d: 4, c: 3 } };

    assert.equal(logger.snapshot("state", payload), true);

    const expectedSnapshot = { a: { c: 3, d: 4 }, b: 2 };
    assert.deepEqual(logger.read("state"), expectedSnapshot);
    assert.deepEqual(globalThis.__MGFA_DEBUG__.scopes["dev-scope"].snapshots.state, expectedSnapshot);
    assert.deepEqual(globalThis.__MGFA_DEBUG__.scopes["dev-scope"].serialized, {
      state: JSON.stringify(expectedSnapshot)
    });
    assert.equal(globalThis.__MGFA_DEBUG__.version, 1);
    assert.deepEqual(Object.keys(globalThis.__MGFA_DEBUG__.scopes), ["dev-scope"]);
    assert.equal(globalThis.__MGFA_DEBUG__.history.length, 1);
    assert.equal(globalThis.__MGFA_DEBUG__.history[0], globalThis.__MGFA_DEBUG__.last);
    assert.deepEqual(
      {
        kind: globalThis.__MGFA_DEBUG__.last.kind,
        label: globalThis.__MGFA_DEBUG__.last.label,
        payload: globalThis.__MGFA_DEBUG__.last.payload,
        scope: globalThis.__MGFA_DEBUG__.last.scope
      },
      {
        kind: "snapshot",
        label: "state",
        payload: expectedSnapshot,
        scope: "dev-scope"
      }
    );
    assert.equal(typeof globalThis.__MGFA_DEBUG__.last.timestamp, "number");
    assert.deepEqual(calls, [["[MGFA:dev-scope] state", expectedSnapshot]]);
  });
});

test("snapshot logging deduplicates by normalized payload and records only changed snapshots", () => {
  captureConsoleLog(() => {
    const logger = debugLogger.create("dedupe-scope");

    assert.equal(logger.snapshot("state", { a: 1, b: 2 }), true);
    assert.equal(logger.snapshot("state", { b: 2, a: 1 }), false);
    assert.equal(logger.snapshot("state", { a: 1, b: 3 }), true);

    assert.deepEqual(logger.read("state"), { a: 1, b: 3 });
    assert.equal(globalThis.__MGFA_DEBUG__.history.length, 2);
    assert.deepEqual(
      globalThis.__MGFA_DEBUG__.history.map(({ kind, label, payload, scope }) => ({ kind, label, payload, scope })),
      [
        { kind: "snapshot", label: "state", payload: { a: 1, b: 2 }, scope: "dedupe-scope" },
        { kind: "snapshot", label: "state", payload: { a: 1, b: 3 }, scope: "dedupe-scope" }
      ]
    );
  });
});

test("event and snapshot payloads are isolated from original mutations and scopes do not share state", () => {
  captureConsoleLog(() => {
    const alpha = debugLogger.create("alpha");
    const beta = debugLogger.create("beta");
    const alphaPayload = { nested: { value: 1 }, list: [{ id: "first" }] };
    const betaPayload = { nested: { value: 2 }, list: [{ id: "second" }] };

    assert.equal(alpha.event("event-state", alphaPayload), true);
    assert.equal(beta.snapshot("state", betaPayload), true);

    alphaPayload.nested.value = 99;
    alphaPayload.list[0].id = "mutated-first";
    betaPayload.nested.value = 88;
    betaPayload.list.push({ id: "mutated-second" });

    assert.deepEqual(alpha.read("event-state"), {
      list: [{ id: "first" }],
      nested: { value: 1 }
    });
    assert.deepEqual(beta.read("state"), {
      list: [{ id: "second" }],
      nested: { value: 2 }
    });
    assert.equal(alpha.read("state"), null);
    assert.equal(beta.read("event-state"), null);
    assert.deepEqual(Object.keys(globalThis.__MGFA_DEBUG__.scopes).sort(), ["alpha", "beta"]);
    assert.deepEqual(globalThis.__MGFA_DEBUG__.history.map(({ scope, label }) => ({ scope, label })), [
      { scope: "alpha", label: "event-state" },
      { scope: "beta", label: "state" }
    ]);
  });
});

test("production build flags turn debug logger into a no-op", () => {
  captureConsoleLog((calls) => {
    const prodDebugLogger = loadDebugLogger({ isDevelopment: false });
    const logger = prodDebugLogger.create("prod-scope");

    assert.equal(globalThis.MakeGoogleFlatAgain.buildFlags.isDevelopment, false);
    assert.equal(logger.event("boot", { enabled: true }), false);
    assert.equal(logger.snapshot("state", { enabled: true }), false);
    assert.equal(logger.read("state"), null);
    assert.equal(globalThis.__MGFA_DEBUG__, undefined);
    assert.deepEqual(calls, []);
  });
});
