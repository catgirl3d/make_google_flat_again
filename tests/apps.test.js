const test = require("node:test");
const assert = require("node:assert/strict");

const {
  apps,
  appMatchesLocation,
  findMatchingApps,
  getAppById,
  getAppsWithSurface,
  getAssetPath,
  buildCalendarAssetPath
} = require("../src/shared/apps.js");

test("app ids stay unique", () => {
  const ids = apps.map((app) => app.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("sheets route resolves to sheets app", () => {
  const matches = findMatchingApps({
    hostname: "docs.google.com",
    pathname: "/spreadsheets/d/example/edit"
  }).map((app) => app.id);

  assert.deepEqual(matches, ["sheets"]);
});

test("docs suite matching tolerates extra path segments", () => {
  const sheets = apps.find((app) => app.id === "sheets");

  assert.equal(
    appMatchesLocation(sheets, {
      hostname: "docs.google.com",
      pathname: "/spreadsheets/u/0/d/example/edit",
      href: "https://docs.google.com/spreadsheets/u/0/d/example/edit"
    }),
    true
  );
});

test("vids route resolves to vids app", () => {
  const matches = findMatchingApps({
    hostname: "docs.google.com",
    pathname: "/videos/create",
    href: "https://docs.google.com/videos/create?usp=vids_alc"
  }).map((app) => app.id);

  assert.deepEqual(matches, ["vids"]);
});

test("tasks route resolves to tasks app", () => {
  const matches = findMatchingApps({
    hostname: "tasks.google.com",
    pathname: "/tasks",
    href: "https://tasks.google.com/tasks?utm_source=OGB"
  }).map((app) => app.id);

  assert.deepEqual(matches, ["tasks"]);
});

test("maps route matches Google Maps on www.google.com", () => {
  const matches = findMatchingApps({
    hostname: "www.google.com",
    pathname: "/maps/dir/berlin"
  }).map((app) => app.id);

  assert.deepEqual(matches, ["maps"]);
});

test("calendar asset path is day-aware", () => {
  assert.equal(buildCalendarAssetPath(7), "assets/icons/calendar/calendar-07.webp");
  assert.equal(getAssetPath("calendar", { dayNumber: 31 }), "assets/icons/calendar/calendar-31.webp");
});

test("keep keeps its base asset outside the side panel override", () => {
  assert.equal(getAssetPath("keep"), "assets/icons/apps/keep-classic.svg");
  assert.equal(getAppById("keep").surfaces.sidePanel.assetPath, "assets/icons/apps/keep-classic-square.svg");
});

test("surface registry in app config stays centralized", () => {
  assert.deepEqual(getAppsWithSurface("header").map((app) => app.id), []);
  assert.deepEqual(getAppsWithSurface("sidePanel").map((app) => app.id), ["calendar", "keep", "tasks", "maps"]);
  assert.deepEqual(getAppsWithSurface("docsHomescreenMenu").map((app) => app.id), [
    "drive",
    "docs",
    "sheets",
    "slides",
    "forms",
    "vids"
  ]);
  assert.deepEqual(getAppsWithSurface("appLauncher").map((app) => app.id), [
    "gmail",
    "calendar",
    "drive",
    "docs",
    "sheets",
    "slides",
    "forms",
    "vids",
    "meet",
    "chat",
    "keep",
    "tasks",
    "maps"
  ]);
});

test("app launcher selectors match products by href and pid instead of localized labels", () => {
  assert.deepEqual(getAppById("drive").surfaces.appLauncher.selectors, [
    'a.tX9u1b[href*="drive.google.com"] .CgwTDb .MrEfLc',
    'a.tX9u1b[data-pid="49"] .CgwTDb .MrEfLc'
  ]);
  assert.deepEqual(getAppById("docs").surfaces.appLauncher.selectors, [
    'a.tX9u1b[href*="docs.google.com/document"] .CgwTDb .MrEfLc',
    'a.tX9u1b[data-pid="25"] .CgwTDb .MrEfLc'
  ]);
  assert.deepEqual(getAppById("docs").surfaces.docsHomescreenMenu.selectors, [
    '.docs-homescreen-leftmenu .docs-homescreen-img.docs-homescreen-docs-2026-24'
  ]);
  assert.deepEqual(getAppById("maps").surfaces.appLauncher.selectors, [
    'a.tX9u1b[href*="maps.google.com"] .CgwTDb .MrEfLc',
    'a.tX9u1b[href*="www.google.com/maps"] .CgwTDb .MrEfLc',
    'a.tX9u1b[data-pid="8"] .CgwTDb .MrEfLc'
  ]);
  assert.deepEqual(getAppById("vids").surfaces.appLauncher.selectors, [
    'a.tX9u1b[href*="docs.google.com/videos"] .CgwTDb .MrEfLc',
    'a.tX9u1b[data-pid="682"] .CgwTDb .MrEfLc'
  ]);
  assert.deepEqual(getAppById("forms").surfaces.docsHomescreenMenu.selectors, [
    '.docs-homescreen-leftmenu .docs-homescreen-img.docs-homescreen-forms-2026-24'
  ]);
  assert.deepEqual(getAppById("tasks").surfaces.appLauncher.selectors, [
    'a.tX9u1b[href*="tasks.google.com/tasks"] .CgwTDb .MrEfLc',
    'a.tX9u1b[data-pid="39"] .CgwTDb .MrEfLc'
  ]);
  assert.deepEqual(getAppById("tasks").surfaces.sidePanel.selectors, [
    '.app-switcher-button[data-guest-app-id="4"] .app-switcher-button-icon-container',
    '[data-guest-app-id="4"] .app-switcher-button-icon-container',
    '.app-switcher-button-icon-container[style*="tasks_"]',
    '[style*="/companion/icon_assets/tasks_"]',
    '[style*="tasks_2026_2x"]',
    '.Yb-Il-d-c-j[style*="tasks_"]',
    '.aT5-aOt-I-JX-Jw[style*="tasks_"]'
  ]);
});

test("apps config no longer carries late header runtime metadata", () => {
  for (const app of apps) {
    assert.equal(Boolean(app.surfaces?.header), false);
  }
});
