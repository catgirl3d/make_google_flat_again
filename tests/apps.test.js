const test = require("node:test");
const assert = require("node:assert/strict");

const {
  apps,
  appMatchesLocation,
  findMatchingApps,
  findPrimaryApp,
  getAppById,
  getAssetPath,
  buildCalendarAssetPath
} = require("../src/shared/apps.js");

test("app ids stay unique", () => {
  const ids = apps.map((app) => app.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("findPrimaryApp falls back to urlIncludes when pathname no longer carries the product prefix", () => {
  const locationLike = {
    hostname: "docs.google.com",
    pathname: "/",
    href: "https://docs.google.com/spreadsheets/d/example/edit?usp=sharing"
  };

  assert.equal(appMatchesLocation(getAppById("sheets"), locationLike), true);
  assert.equal(findPrimaryApp(locationLike), getAppById("sheets"));
  assert.deepEqual(findMatchingApps(locationLike).map((app) => app.id), ["sheets"]);
});

test("docs-suite pathname prefixes still match account-scoped routes", () => {
  const locationLike = {
    hostname: "docs.google.com",
    pathname: "/spreadsheets/u/0/d/example/edit",
    href: "https://docs.google.com/spreadsheets/u/0/d/example/edit"
  };

  assert.equal(appMatchesLocation(getAppById("sheets"), locationLike), true);
  assert.equal(findPrimaryApp(locationLike), getAppById("sheets"));
  assert.deepEqual(findMatchingApps(locationLike).map((app) => app.id), ["sheets"]);
});

test("urlIncludes fallback still respects the product-specific href instead of matching every docs.google.com page", () => {
  const locationLike = {
    hostname: "docs.google.com",
    pathname: "/",
    href: "https://docs.google.com/drive/folders/example"
  };

  assert.equal(appMatchesLocation(getAppById("docs"), locationLike), false);
  assert.equal(appMatchesLocation(getAppById("sheets"), locationLike), false);
  assert.equal(appMatchesLocation(getAppById("slides"), locationLike), false);
  assert.equal(appMatchesLocation(getAppById("forms"), locationLike), false);
  assert.equal(appMatchesLocation(getAppById("vids"), locationLike), false);
});

test("findPrimaryApp returns maps for the www.google.com maps route and null when nothing matches", () => {
  const mapsLocation = {
    hostname: "www.google.com",
    pathname: "/maps/dir/berlin"
  };
  const noMatchLocation = {
    hostname: "www.google.com",
    pathname: "/search",
    href: "https://www.google.com/search?q=workspace"
  };

  assert.equal(findPrimaryApp(mapsLocation), getAppById("maps"));
  assert.deepEqual(findMatchingApps(noMatchLocation), []);
  assert.equal(findPrimaryApp(noMatchLocation), null);
});

test("calendar asset path stays day-aware and per-surface overrides stay isolated", () => {
  assert.equal(buildCalendarAssetPath(7), "assets/icons/calendar/calendar-07.webp");
  assert.equal(getAssetPath("calendar", { dayNumber: 31 }), "assets/icons/calendar/calendar-31.webp");
  assert.equal(getAssetPath("docs"), "assets/icons/apps/docs-classic.svg");
  assert.equal(getAppById("docs").surfaces.favicon.assetPath, "assets/icons/apps/favicons/docs.ico");
  assert.equal(getAssetPath("sheets"), "assets/icons/apps/sheets-classic.svg");
  assert.equal(getAppById("sheets").surfaces.favicon.assetPath, "assets/icons/apps/favicons/sheets.ico");
  assert.equal(getAssetPath("slides"), "assets/icons/apps/slides-classic.svg");
  assert.equal(getAppById("slides").surfaces.favicon.assetPath, "assets/icons/apps/favicons/slides.ico");
  assert.equal(getAssetPath("forms"), "assets/icons/apps/forms-classic.png");
  assert.equal(getAppById("forms").surfaces.favicon.assetPath, "assets/icons/apps/favicons/forms.ico");
  assert.equal(getAssetPath("vids"), "assets/icons/apps/vids-classic.svg");
  assert.equal(getAppById("vids").surfaces.favicon.assetPath, "assets/icons/apps/favicons/vids.ico");
  assert.equal(getAssetPath("keep"), "assets/icons/apps/keep-classic.svg");
  assert.equal(getAppById("keep").surfaces.favicon.assetPath, "assets/icons/apps/keep_icon_1.svg");
  assert.equal(getAppById("keep").surfaces.sidePanel.assetPath, "assets/icons/apps/keep-classic-square.svg");
});
