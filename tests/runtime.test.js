const test = require("node:test");
const assert = require("node:assert/strict");

function loadRuntimeWithGlobals(globals) {
  delete globalThis.MakeGoogleFlatAgain;
  delete globalThis.__MGFA_RUNTIME__;
  delete globalThis.browser;
  delete globalThis.chrome;
  delete require.cache[require.resolve("../src/shared/runtime.js")];

  Object.assign(globalThis, globals);

  return require("../src/shared/runtime.js");
}

test("runtime prefers browser namespace over chrome", () => {
  const browserApi = { runtime: { getURL(path) { return `browser://${path}`; } } };
  const chromeApi = { runtime: { getURL(path) { return `chrome://${path}`; } } };
  const runtime = loadRuntimeWithGlobals({ browser: browserApi, chrome: chromeApi });

  assert.equal(runtime.getExtensionApi(), browserApi);
  assert.equal(runtime.getRuntimeUrl("src/test.js"), "browser://src/test.js");

  delete globalThis.browser;
  delete globalThis.chrome;
  delete globalThis.MakeGoogleFlatAgain;
  delete globalThis.__MGFA_RUNTIME__;
});
