const test = require("node:test");
const assert = require("node:assert/strict");

function resetRegistryEnvironment() {
  delete globalThis.MakeGoogleFlatAgain;
  delete globalThis.__MGFA_RUNTIME__;

  delete require.cache[require.resolve("../src/shared/runtime.js")];
  delete require.cache[require.resolve("../src/content/surface-registry.js")];
}

function loadRegistry({ logger } = {}) {
  resetRegistryEnvironment();
  const attachCalls = [];
  const testLogger = logger || {
    snapshot() {
      return false;
    },
    event() {
      return false;
    }
  };

  globalThis.__MGFA_RUNTIME__ = {
    attach(sectionName, value) {
      attachCalls.push({ sectionName, value });
      return true;
    }
  };

  globalThis.MakeGoogleFlatAgain = {
    debugLogger: {
      create(scope) {
        assert.equal(scope, "registry");
        return testLogger;
      }
    }
  };

  const registry = require("../src/content/surface-registry.js");

  assert.deepEqual(attachCalls, [{ sectionName: "surfaceRegistry", value: registry }]);

  return registry;
}

test("register returns the surface and rejects invalid or duplicate registrations", () => {
  const registry = loadRegistry();
  const surface = {
    name: "demo-surface",
    start() {}
  };

  assert.equal(registry.register(surface), surface);
  assert.throws(
    () => registry.register(null),
    /Surface registration requires a name and a start\(context\) function\./
  );
  assert.throws(
    () => registry.register({ name: "missing-start" }),
    /Surface registration requires a name and a start\(context\) function\./
  );
  assert.throws(
    () => registry.register({ name: "demo-surface", start() {} }),
    /Surface "demo-surface" is already registered\./
  );
});

test("getSurfaces returns a defensive copy preserving registered identity and order", () => {
  const registry = loadRegistry();
  const firstSurface = { name: "first-surface", start() {} };
  const secondSurface = { name: "second-surface", start() {} };

  registry.register(firstSurface);
  registry.register(secondSurface);

  const surfaces = registry.getSurfaces();
  surfaces.reverse();
  surfaces.push({ name: "external-mutation", start() {} });

  assert.deepEqual(registry.getSurfaces(), [firstSurface, secondSurface]);
});

test("startAll starts current registered surfaces with context and logs concrete lifecycle payloads", () => {
  const logEntries = [];
  const logger = {
    snapshot(label, payload) {
      logEntries.push({ type: "snapshot", label, payload });
      return true;
    },
    event(label, payload) {
      logEntries.push({ type: "event", label, payload });
      return true;
    }
  };
  const registry = loadRegistry({ logger });
  const calls = [];
  const firstContext = { options: { enabled: true } };
  const secondContext = { options: { enabled: false } };
  const firstSurface = {
    name: "first-surface",
    start(context) {
      calls.push({ surface: this.name, context });
    }
  };
  const secondSurface = {
    name: "second-surface",
    start(context) {
      calls.push({ surface: this.name, context });
    }
  };

  registry.register(firstSurface);
  registry.startAll(firstContext);
  registry.register(secondSurface);
  registry.startAll(secondContext);

  assert.deepEqual(calls, [
    { surface: "first-surface", context: firstContext },
    { surface: "first-surface", context: secondContext },
    { surface: "second-surface", context: secondContext }
  ]);
  assert.deepEqual(logEntries, [
    {
      type: "snapshot",
      label: "start-all",
      payload: { optionsEnabled: true, surfaceNames: ["first-surface"] }
    },
    { type: "event", label: "surface-start", payload: { surface: "first-surface" } },
    {
      type: "snapshot",
      label: "start-all",
      payload: { optionsEnabled: false, surfaceNames: ["first-surface", "second-surface"] }
    },
    { type: "event", label: "surface-start", payload: { surface: "first-surface" } },
    { type: "event", label: "surface-start", payload: { surface: "second-surface" } }
  ]);
});

test("startAll clears previously started surfaces before a new start attempt", () => {
  const registry = loadRegistry();
  const calls = [];
  const surface = {
    name: "restartable-surface",
    shouldThrow: false,
    start() {
      calls.push("start");
      if (this.shouldThrow) {
        throw new Error("start failed");
      }
    },
    refresh() {
      calls.push("refresh");
    }
  };

  registry.register(surface);
  registry.startAll({ options: { enabled: true } });
  registry.refreshAll({ options: { enabled: true } });

  surface.shouldThrow = true;
  assert.throws(() => registry.startAll({ options: { enabled: true } }), /start failed/);
  registry.refreshAll({ options: { enabled: true } });

  assert.deepEqual(calls, ["start", "refresh", "start"]);
});

test("refreshAll skips before start then refreshes only started surfaces with refresh hooks", () => {
  const logEntries = [];
  const logger = {
    snapshot(label, payload) {
      logEntries.push({ type: "snapshot", label, payload });
      return true;
    },
    event(label, payload) {
      logEntries.push({ type: "event", label, payload });
      return true;
    }
  };
  const registry = loadRegistry({ logger });
  const calls = [];
  const startContext = { options: { enabled: true } };
  const refreshContext = { options: { enabled: false } };
  const meta = { reason: "options-changed" };

  registry.register({
    name: "refreshable-surface",
    start(context) {
      calls.push({ type: "start", surface: "refreshable-surface", context });
    },
    refresh(context, refreshMeta) {
      calls.push({ type: "refresh", surface: "refreshable-surface", context, meta: refreshMeta });
    }
  });
  registry.register({
    name: "start-only-surface",
    start(context) {
      calls.push({ type: "start", surface: "start-only-surface", context });
    }
  });

  registry.refreshAll(refreshContext, meta);
  registry.startAll(startContext);
  registry.refreshAll(refreshContext, meta);

  assert.deepEqual(calls, [
    { type: "start", surface: "refreshable-surface", context: startContext },
    { type: "start", surface: "start-only-surface", context: startContext },
    { type: "refresh", surface: "refreshable-surface", context: refreshContext, meta }
  ]);
  assert.deepEqual(logEntries, [
    {
      type: "snapshot",
      label: "start-all",
      payload: { optionsEnabled: true, surfaceNames: ["refreshable-surface", "start-only-surface"] }
    },
    { type: "event", label: "surface-start", payload: { surface: "refreshable-surface" } },
    { type: "event", label: "surface-start", payload: { surface: "start-only-surface" } },
    {
      type: "snapshot",
      label: "refresh-all",
      payload: {
        optionsEnabled: false,
        reason: "options-changed",
        surfaceNames: ["refreshable-surface", "start-only-surface"]
      }
    },
    {
      type: "event",
      label: "surface-refresh",
      payload: { reason: "options-changed", surface: "refreshable-surface" }
    }
  ]);
});
