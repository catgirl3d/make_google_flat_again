const test = require("node:test");
const assert = require("node:assert/strict");

function resetRegistryEnvironment() {
  delete globalThis.MakeGoogleFlatAgain;
  delete globalThis.__MGFA_RUNTIME__;

  delete require.cache[require.resolve("../src/shared/runtime.js")];
  delete require.cache[require.resolve("../src/content/surface-registry.js")];
  delete require.cache[require.resolve("../src/content/surfaces/favicon.js")];
  delete require.cache[require.resolve("../src/content/surfaces/app-icon-surfaces.js")];
}

test("surface registry exports registered surfaces", () => {
  resetRegistryEnvironment();

  require("../src/shared/runtime.js");
  const registry = require("../src/content/surface-registry.js");
  const favicon = require("../src/content/surfaces/favicon.js");
  const appIconSurfaces = require("../src/content/surfaces/app-icon-surfaces.js");

  const names = registry.getSurfaces().map((surface) => surface.name);

  assert.equal(names.includes(favicon.name), true);
  assert.equal(names.includes(appIconSurfaces.name), true);
});

test("surface registry refreshes started surfaces through explicit refresh hooks", () => {
  resetRegistryEnvironment();

  require("../src/shared/runtime.js");
  const registry = require("../src/content/surface-registry.js");
  const calls = [];
  const context = { options: { enabled: true } };
  const refreshContext = { options: { enabled: false } };

  registry.register({
    name: "demo-surface",
    start(startContext) {
      calls.push({ type: "start", value: startContext });
    },
    refresh(nextContext, meta) {
      calls.push({ type: "refresh", value: nextContext, meta });
    }
  });

  registry.refreshAll(refreshContext, { reason: "options-changed" });
  registry.startAll(context);
  registry.refreshAll(refreshContext, { reason: "options-changed" });

  assert.deepEqual(calls, [
    { type: "start", value: context },
    { type: "refresh", value: refreshContext, meta: { reason: "options-changed" } }
  ]);
});
