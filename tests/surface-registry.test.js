const test = require("node:test");
const assert = require("node:assert/strict");

test("surface registry exports registered surfaces", () => {
  delete globalThis.MakeGoogleFlatAgain;
  delete globalThis.__MGFA_RUNTIME__;

  require("../src/shared/runtime.js");
  const registry = require("../src/content/surface-registry.js");
  const favicon = require("../src/content/surfaces/favicon.js");
  const appIconSurfaces = require("../src/content/surfaces/app-icon-surfaces.js");

  const names = registry.getSurfaces().map((surface) => surface.name);

  assert.equal(names.includes(favicon.name), true);
  assert.equal(names.includes(appIconSurfaces.name), true);
});
