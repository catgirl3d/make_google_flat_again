const test = require("node:test");
const assert = require("node:assert/strict");

const {
  relIsIcon,
  getAppMimeType,
  shouldKeepObserverActive
} = require("../src/content/surfaces/favicon.js");

test("relIsIcon recognizes icon rel values", () => {
  assert.equal(relIsIcon("icon"), true);
  assert.equal(relIsIcon("shortcut icon"), true);
  assert.equal(relIsIcon("mask-icon"), true);
  assert.equal(relIsIcon("stylesheet"), false);
});

test("getAppMimeType resolves known asset types", () => {
  assert.equal(getAppMimeType({ asset: { type: "svg" } }), "image/svg+xml");
  assert.equal(getAppMimeType({ asset: { type: "png" } }), "image/png");
  assert.equal(getAppMimeType({ asset: { type: "calendar-day" } }), "image/webp");
});

test("relIsIcon ignores unrelated rel values with icon substring noise", () => {
  assert.equal(relIsIcon("preload stylesheet"), false);
  assert.equal(relIsIcon("apple-touch-icon-precomposed"), true);
});

test("favicon observer only stays active while the surface is enabled and attached", () => {
  assert.equal(shouldKeepObserverActive({ paused: false, app: { id: "docs" }, hasHead: true }), true);
  assert.equal(shouldKeepObserverActive({ paused: true, app: { id: "docs" }, hasHead: true }), false);
  assert.equal(shouldKeepObserverActive({ paused: false, app: null, hasHead: true }), false);
  assert.equal(shouldKeepObserverActive({ paused: false, app: { id: "docs" }, hasHead: false }), false);
});
