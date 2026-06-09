const test = require("node:test");
const assert = require("node:assert/strict");

const {
  relIsIcon,
  getFaviconAssetPath,
  getAppMimeType,
  shouldKeepObserverActive
} = require("../src/content/surfaces/favicon.js");
const { getAppById } = require("../src/shared/apps.js");

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

test("getFaviconAssetPath respects favicon-specific overrides and day-aware assets", () => {
  assert.equal(getFaviconAssetPath(getAppById("keep")), "assets/icons/apps/keep_icon_1.svg");
  assert.equal(getFaviconAssetPath(getAppById("calendar"), { dayNumber: 7 }), "assets/icons/calendar/calendar-07.webp");
});

test("relIsIcon ignores unrelated rel values with icon substring noise", () => {
  assert.equal(relIsIcon("preload stylesheet"), false);
  assert.equal(relIsIcon("apple-touch-icon-precomposed"), true);
});

test("favicon observer only stays active while the surface is enabled and attached", () => {
  assert.equal(shouldKeepObserverActive({ app: { id: "docs" }, hasHead: true }), true);
  assert.equal(shouldKeepObserverActive({ app: null, hasHead: true }), false);
  assert.equal(shouldKeepObserverActive({ app: { id: "docs" }, hasHead: false }), false);
});
