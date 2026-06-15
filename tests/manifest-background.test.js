const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { buildManifest } = require("../scripts/build-manifest.js");

// This suite owns generated manifest shipping shape and browser-specific manifest divergence,
// not runtime behavior of background/content/platform modules.

const EXPECTED_BASE_FIELDS = {
  manifest_version: 3,
  name: "Classic Google Workspace Icons",
  version: "0.1.1",
  description: "Extension for restoring classic Google Workspace icons with local assets and clean shared configuration.",
  icons: {
    16: "assets/extension/icon-16.png",
    32: "assets/extension/icon-32.png",
    48: "assets/extension/icon-48.png",
    128: "assets/extension/icon-128.png"
  },
  actionDefaultPopup: "src/popup/popup.html"
};

const EXPECTED_PERMISSIONS = ["scripting", "storage"];

const EXPECTED_HOST_PERMISSIONS = [
  "https://mail.google.com/*",
  "https://chat.google.com/*",
  "https://tasks.google.com/*",
  "https://keep.google.com/*",
  "https://drive.google.com/*",
  "https://docs.google.com/*",
  "https://meet.google.com/*"
];

const EXPECTED_PRIMARY_CONTENT_SCRIPT_MATCHES = [
  "https://chat.google.com/*",
  "https://keep.google.com/*",
  "https://tasks.google.com/*",
  "https://drive.google.com/*",
  "https://docs.google.com/*",
  "https://mail.google.com/*",
  "https://calendar.google.com/*",
  "https://maps.google.com/*",
  "https://meet.google.com/*",
  "https://www.google.com/maps*",
  "https://www.google.com/maps/*"
];

const EXPECTED_OGS_IFRAME_CONTENT_SCRIPT_MATCHES = ["https://ogs.google.com/*"];

const EXPECTED_FIREFOX_WEB_ACCESSIBLE_RESOURCES = [
  {
    resources: ["assets/icons/apps/*", "assets/icons/calendar/*"],
    matches: [
      "https://chat.google.com/*",
      "https://keep.google.com/*",
      "https://tasks.google.com/*",
      "https://drive.google.com/*",
      "https://docs.google.com/*",
      "https://mail.google.com/*",
      "https://calendar.google.com/*",
      "https://maps.google.com/*",
      "https://meet.google.com/*",
      "https://ogs.google.com/*",
      "https://www.google.com/maps*",
      "https://www.google.com/maps/*"
    ]
  }
];

const EXPECTED_CHROME_WEB_ACCESSIBLE_RESOURCES = [
  {
    resources: ["assets/icons/apps/*", "assets/icons/calendar/*"],
    matches: [
      "https://chat.google.com/*",
      "https://keep.google.com/*",
      "https://tasks.google.com/*",
      "https://drive.google.com/*",
      "https://docs.google.com/*",
      "https://mail.google.com/*",
      "https://calendar.google.com/*",
      "https://maps.google.com/*",
      "https://meet.google.com/*",
      "https://ogs.google.com/*",
      "https://www.google.com/*"
    ]
  }
];

const EXPECTED_CHROME_BACKGROUND_BOOTSTRAP_MODULES = [
  "../shared/runtime.js",
  "../shared/build-flags.js",
  "../shared/app-registry.js",
  "../shared/apps.js",
  "../shared/settings.js",
  "../platform/content-script-registry-core.js",
  "../platform/chrome/content-script-registry.js",
  "./header-static-css.js",
  "./background-core.js"
];

const CHROME_BACKGROUND_FILE = path.join(__dirname, "..", "src", "background", "background-chrome.js");

const EXPECTED_FIREFOX_BACKGROUND_SCRIPTS = [
  "src/shared/runtime.js",
  "src/shared/build-flags.js",
  "src/shared/app-registry.js",
  "src/shared/apps.js",
  "src/shared/settings.js",
  "src/platform/content-script-registry-core.js",
  "src/platform/firefox/content-script-registry.js",
  "src/background/header-static-css.js",
  "src/background/background-core.js"
];

const EXPECTED_PRIMARY_CONTENT_SCRIPT_JS = [
  "src/shared/runtime.js",
  "src/shared/build-flags.js",
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
  "src/shared/build-flags.js",
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

function assertNoDnrConfig(manifest) {
  assert.equal(Object.prototype.hasOwnProperty.call(manifest, "declarative_net_request"), false);
  assert.equal(manifest.permissions.includes("declarativeNetRequest"), false);
  assert.equal(manifest.permissions.includes("declarativeNetRequestFeedback"), false);
}

function assertBaseShippingFields(manifest) {
  assert.equal(manifest.manifest_version, EXPECTED_BASE_FIELDS.manifest_version);
  assert.equal(manifest.name, EXPECTED_BASE_FIELDS.name);
  assert.equal(manifest.version, EXPECTED_BASE_FIELDS.version);
  assert.equal(manifest.description, EXPECTED_BASE_FIELDS.description);
  assert.deepEqual(manifest.icons, EXPECTED_BASE_FIELDS.icons);
  assert.equal(manifest.action.default_popup, EXPECTED_BASE_FIELDS.actionDefaultPopup);
}

function assertCommonManifestOutput(manifest) {
  assertBaseShippingFields(manifest);
  assertNoDnrConfig(manifest);
  assert.deepEqual(manifest.permissions, EXPECTED_PERMISSIONS);
  assert.deepEqual(manifest.host_permissions, EXPECTED_HOST_PERMISSIONS);
  assert.deepEqual(
    manifest.content_scripts.filter((entry) => Array.isArray(entry.css) && entry.css.some((file) => file.includes("header-"))),
    []
  );
}

function readImportScriptsModules(filePath) {
  const fileContents = fs.readFileSync(filePath, "utf8");
  const importScriptsBlock = fileContents.match(/importScripts\(([\s\S]*?)\n\s*\);/);

  assert.ok(importScriptsBlock);

  return Array.from(importScriptsBlock[1].matchAll(/"([^"]+)"/g), (match) => match[1]);
}

test("built Firefox manifest output keeps Firefox-only background and browser settings", () => {
  const manifest = buildManifest("firefox");

  assertCommonManifestOutput(manifest);
  assert.deepEqual(manifest.web_accessible_resources, EXPECTED_FIREFOX_WEB_ACCESSIBLE_RESOURCES);
  assert.deepEqual(manifest.background.scripts, EXPECTED_FIREFOX_BACKGROUND_SCRIPTS);
  assert.equal(Object.prototype.hasOwnProperty.call(manifest.background, "service_worker"), false);
  assert.deepEqual(manifest.browser_specific_settings, {
    gecko: {
      id: "make-google-flat-again@catgirl3d.github.io",
      strict_min_version: "140.0",
      data_collection_permissions: {
        required: ["none"]
      }
    },
    gecko_android: {
      strict_min_version: "142.0"
    }
  });
});

test("built Chrome manifest output keeps Chrome-only service worker and no browser settings", () => {
  const manifest = buildManifest("chrome");

  assertCommonManifestOutput(manifest);
  assert.deepEqual(manifest.web_accessible_resources, EXPECTED_CHROME_WEB_ACCESSIBLE_RESOURCES);
  assert.equal(manifest.background.service_worker, "src/background/background-chrome.js");
  assert.equal(Object.prototype.hasOwnProperty.call(manifest.background, "scripts"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(manifest, "browser_specific_settings"), false);
});

test("chrome background service worker boots the expected modules", () => {
  assert.deepEqual(readImportScriptsModules(CHROME_BACKGROUND_FILE), EXPECTED_CHROME_BACKGROUND_BOOTSTRAP_MODULES);
});

test("built manifests keep release-critical content script match scopes and run timing", () => {
  const firefoxManifest = buildManifest("firefox");
  const chromeManifest = buildManifest("chrome");
  const firefoxPrimaryContentScript = findContentScriptByMatch(firefoxManifest, "https://drive.google.com/*");
  const chromePrimaryContentScript = findContentScriptByMatch(chromeManifest, "https://drive.google.com/*");
  const firefoxOgsContentScript = findContentScriptByMatch(firefoxManifest, "https://ogs.google.com/*");
  const chromeOgsContentScript = findContentScriptByMatch(chromeManifest, "https://ogs.google.com/*");

  assert.deepEqual(firefoxPrimaryContentScript.matches, EXPECTED_PRIMARY_CONTENT_SCRIPT_MATCHES);
  assert.deepEqual(chromePrimaryContentScript.matches, EXPECTED_PRIMARY_CONTENT_SCRIPT_MATCHES);
  assert.equal(firefoxPrimaryContentScript?.run_at, "document_start");
  assert.equal(chromePrimaryContentScript?.run_at, "document_start");
  assert.deepEqual(firefoxOgsContentScript.matches, EXPECTED_OGS_IFRAME_CONTENT_SCRIPT_MATCHES);
  assert.deepEqual(chromeOgsContentScript.matches, EXPECTED_OGS_IFRAME_CONTENT_SCRIPT_MATCHES);
  assert.equal(firefoxOgsContentScript?.run_at, "document_start");
  assert.equal(chromeOgsContentScript?.run_at, "document_start");
});

test("primary content script manifest entry ships the expected script files", () => {
  const firefoxContentScript = findContentScriptByMatch(buildManifest("firefox"), "https://drive.google.com/*");
  const chromeContentScript = findContentScriptByMatch(buildManifest("chrome"), "https://drive.google.com/*");

  assert.deepEqual(firefoxContentScript.js, EXPECTED_PRIMARY_CONTENT_SCRIPT_JS);
  assert.deepEqual(chromeContentScript.js, EXPECTED_PRIMARY_CONTENT_SCRIPT_JS);
});

test("ogs iframe content script manifest entry ships iframe-scoped app icon files", () => {
  const firefoxContentScript = findContentScriptByMatch(buildManifest("firefox"), "https://ogs.google.com/*");
  const chromeContentScript = findContentScriptByMatch(buildManifest("chrome"), "https://ogs.google.com/*");

  assert.equal(firefoxContentScript.all_frames, true);
  assert.equal(chromeContentScript.all_frames, true);
  assert.deepEqual(firefoxContentScript.js, EXPECTED_OGS_IFRAME_CONTENT_SCRIPT_JS);
  assert.deepEqual(chromeContentScript.js, EXPECTED_OGS_IFRAME_CONTENT_SCRIPT_JS);
  assert.equal(firefoxContentScript.js.includes("src/content/surfaces/favicon.js"), false);
  assert.equal(chromeContentScript.js.includes("src/content/surfaces/favicon.js"), false);
});
