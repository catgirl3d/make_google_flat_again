const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { buildManifest } = require("../scripts/build-manifest.js");

const PROJECT_ROOT = path.join(__dirname, "..");

const EXPECTED_FIREFOX_BACKGROUND_SCRIPTS = [
  "src/shared/runtime.js",
  "src/shared/app-registry.js",
  "src/shared/apps.js",
  "src/shared/settings.js",
  "src/platform/content-script-registry-core.js",
  "src/platform/firefox/content-script-registry.js",
  "src/background/header-static-css.js",
  "src/background/background-core.js"
];

const EXPECTED_CHROME_IMPORT_SCRIPTS = [
  "../shared/runtime.js",
  "../shared/app-registry.js",
  "../shared/apps.js",
  "../shared/settings.js",
  "../platform/content-script-registry-core.js",
  "../platform/chrome/content-script-registry.js",
  "./header-static-css.js",
  "./background-core.js"
];

const EXPECTED_PRIMARY_CONTENT_SCRIPT_JS = [
  "src/shared/runtime.js",
  "src/shared/app-registry.js",
  "src/shared/apps.js",
  "src/shared/settings.js",
  "src/content/debug-logger.js",
  "src/content/logo-probe.js",
  "src/content/surface-registry.js",
  "src/content/surfaces/favicon.js",
  "src/content/surfaces/app-icon-surfaces.js",
  "src/content/main.js"
];

const EXPECTED_OGS_IFRAME_CONTENT_SCRIPT_JS = [
  "src/shared/runtime.js",
  "src/shared/app-registry.js",
  "src/shared/apps.js",
  "src/shared/settings.js",
  "src/content/debug-logger.js",
  "src/content/logo-probe.js",
  "src/content/surface-registry.js",
  "src/content/surfaces/app-icon-surfaces.js",
  "src/content/main.js"
];

function findContentScriptByMatch(manifest, matchPattern) {
  return manifest.content_scripts.find((entry) => Array.isArray(entry.matches) && entry.matches.includes(matchPattern));
}

function getChromeImportScripts() {
  const source = fs.readFileSync(path.join(PROJECT_ROOT, "src/background/background-chrome.js"), "utf8");
  const importScriptsCall = source.match(/importScripts\(([\s\S]*?)\);/);

  return [...importScriptsCall[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}

function assertNoDnrConfig(manifest) {
  assert.equal(Object.prototype.hasOwnProperty.call(manifest, "declarative_net_request"), false);
  assert.equal(manifest.permissions.includes("declarativeNetRequest"), false);
  assert.equal(manifest.permissions.includes("declarativeNetRequestFeedback"), false);
}

test("built Firefox manifest keeps Firefox-only background wiring and dynamic header CSS permissions", () => {
  const manifest = buildManifest("firefox");

  assert.equal(manifest.manifest_version, 3);
  assertNoDnrConfig(manifest);
  assert.deepEqual(manifest.background.scripts, EXPECTED_FIREFOX_BACKGROUND_SCRIPTS);
  assert.equal(Object.prototype.hasOwnProperty.call(manifest.background, "service_worker"), false);
  assert.equal(manifest.permissions.includes("scripting"), true);
  assert.equal(manifest.host_permissions.includes("https://www.gstatic.com/*"), false);
  assert.equal(manifest.host_permissions.includes("https://mail.google.com/*"), true);
  assert.equal(manifest.host_permissions.includes("https://chat.google.com/*"), true);
  assert.equal(manifest.host_permissions.includes("https://tasks.google.com/*"), true);
  assert.equal(manifest.host_permissions.includes("https://keep.google.com/*"), true);
  assert.equal(manifest.host_permissions.includes("https://drive.google.com/*"), true);
  assert.equal(manifest.host_permissions.includes("https://docs.google.com/*"), true);
  assert.equal(manifest.host_permissions.includes("https://meet.google.com/*"), true);
  assert.equal(manifest.browser_specific_settings.gecko.id, "make-google-flat-again@catgirl3d.github.io");
  assert.deepEqual(
    manifest.content_scripts.filter((entry) => Array.isArray(entry.css) && entry.css.some((file) => file.includes("header-"))),
    []
  );
});

test("built Chrome manifest keeps Chrome-only background wiring and scripting permission", () => {
  const manifest = buildManifest("chrome");

  assertNoDnrConfig(manifest);
  assert.equal(manifest.background.service_worker, "src/background/background-chrome.js");
  assert.deepEqual(getChromeImportScripts(), EXPECTED_CHROME_IMPORT_SCRIPTS);
  assert.equal(Object.prototype.hasOwnProperty.call(manifest.background, "scripts"), false);
  assert.equal(manifest.permissions.includes("scripting"), true);
  assert.equal(manifest.host_permissions.includes("https://mail.google.com/*"), true);
  assert.equal(manifest.host_permissions.includes("https://chat.google.com/*"), true);
  assert.equal(manifest.host_permissions.includes("https://tasks.google.com/*"), true);
  assert.equal(manifest.host_permissions.includes("https://keep.google.com/*"), true);
  assert.equal(manifest.host_permissions.includes("https://meet.google.com/*"), true);
  assert.equal(Object.prototype.hasOwnProperty.call(manifest, "browser_specific_settings"), false);
  assert.deepEqual(
    manifest.content_scripts.filter((entry) => Array.isArray(entry.css) && entry.css.some((file) => file.includes("header-"))),
    []
  );
});

test("common JS content script still runs at document_start", () => {
  const firefoxManifest = buildManifest("firefox");
  const chromeManifest = buildManifest("chrome");
  const firefoxPrimaryContentScript = findContentScriptByMatch(firefoxManifest, "https://drive.google.com/*");
  const chromePrimaryContentScript = findContentScriptByMatch(chromeManifest, "https://drive.google.com/*");
  const firefoxTasksContentScript = findContentScriptByMatch(firefoxManifest, "https://tasks.google.com/*");
  const chromeTasksContentScript = findContentScriptByMatch(chromeManifest, "https://tasks.google.com/*");
  const firefoxOgsContentScript = findContentScriptByMatch(firefoxManifest, "https://ogs.google.com/*");
  const chromeOgsContentScript = findContentScriptByMatch(chromeManifest, "https://ogs.google.com/*");

  assert.equal(firefoxPrimaryContentScript?.run_at, "document_start");
  assert.equal(chromePrimaryContentScript?.run_at, "document_start");
  assert.equal(firefoxTasksContentScript?.run_at, "document_start");
  assert.equal(chromeTasksContentScript?.run_at, "document_start");
  assert.equal(firefoxOgsContentScript?.run_at, "document_start");
  assert.equal(chromeOgsContentScript?.run_at, "document_start");
});

test("tasks route uses the primary content script chain and can access extension assets", () => {
  const firefoxManifest = buildManifest("firefox");
  const chromeManifest = buildManifest("chrome");
  const firefoxTasksContentScript = findContentScriptByMatch(firefoxManifest, "https://tasks.google.com/*");
  const chromeTasksContentScript = findContentScriptByMatch(chromeManifest, "https://tasks.google.com/*");

  assert.deepEqual(firefoxTasksContentScript.js, EXPECTED_PRIMARY_CONTENT_SCRIPT_JS);
  assert.deepEqual(chromeTasksContentScript.js, EXPECTED_PRIMARY_CONTENT_SCRIPT_JS);
  assert.equal(firefoxManifest.web_accessible_resources[0].matches.includes("https://tasks.google.com/*"), true);
  assert.equal(chromeManifest.web_accessible_resources[0].matches.includes("https://tasks.google.com/*"), true);
});

test("primary content script chain stays exact and has no stale target layer", () => {
  const firefoxContentScript = findContentScriptByMatch(buildManifest("firefox"), "https://drive.google.com/*");
  const chromeContentScript = findContentScriptByMatch(buildManifest("chrome"), "https://drive.google.com/*");

  assert.deepEqual(firefoxContentScript.js, EXPECTED_PRIMARY_CONTENT_SCRIPT_JS);
  assert.deepEqual(chromeContentScript.js, EXPECTED_PRIMARY_CONTENT_SCRIPT_JS);
  assert.equal(firefoxContentScript.js.includes("src/shared/targets.js"), false);
  assert.equal(chromeContentScript.js.includes("src/shared/targets.js"), false);
});

test("ogs iframe content script stays scoped to app icon surface support", () => {
  const firefoxContentScript = findContentScriptByMatch(buildManifest("firefox"), "https://ogs.google.com/*");
  const chromeContentScript = findContentScriptByMatch(buildManifest("chrome"), "https://ogs.google.com/*");

  assert.equal(firefoxContentScript.all_frames, true);
  assert.equal(chromeContentScript.all_frames, true);
  assert.deepEqual(firefoxContentScript.js, EXPECTED_OGS_IFRAME_CONTENT_SCRIPT_JS);
  assert.deepEqual(chromeContentScript.js, EXPECTED_OGS_IFRAME_CONTENT_SCRIPT_JS);
  assert.equal(firefoxContentScript.js.includes("src/content/surfaces/favicon.js"), false);
  assert.equal(chromeContentScript.js.includes("src/content/surfaces/favicon.js"), false);
});
