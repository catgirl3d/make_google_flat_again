const test = require("node:test");
const assert = require("node:assert/strict");

const { buildManifest, loadManifestFragment } = require("../scripts/build-manifest.js");

test("chrome manifest keeps web accessible resources in base ssot while build output broadens the google.com origin", () => {
  const chromeFragment = loadManifestFragment("chrome");
  const chromeManifest = buildManifest("chrome");
  const chromeWar = chromeManifest.web_accessible_resources?.[0];

  assert.equal(Object.prototype.hasOwnProperty.call(chromeFragment, "web_accessible_resources"), false);
  assert.equal(Array.isArray(chromeWar?.matches), true);
  assert.equal(chromeWar.matches.includes("https://www.google.com/*"), true);
  assert.equal(chromeWar.matches.includes("https://www.google.com/maps*"), false);
  assert.equal(chromeWar.matches.includes("https://www.google.com/maps/*"), false);
});
