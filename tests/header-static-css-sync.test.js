const test = require("node:test");
const assert = require("node:assert/strict");

function loadHeaderStaticCss(registry) {
  delete globalThis.MakeGoogleFlatAgain;
  delete globalThis.__MGFA_RUNTIME__;

  delete require.cache[require.resolve("../src/shared/runtime.js")];
  delete require.cache[require.resolve("../src/shared/app-registry.js")];
  delete require.cache[require.resolve("../src/shared/apps.js")];
  delete require.cache[require.resolve("../src/shared/settings.js")];
  delete require.cache[require.resolve("../src/background/header-static-css.js")];

  const runtime = require("../src/shared/runtime.js");
  require("../src/shared/app-registry.js");
  require("../src/shared/apps.js");
  require("../src/shared/settings.js");

  if (registry) {
    runtime.attach("contentScriptRegistry", registry);
  }

  return require("../src/background/header-static-css.js");
}

const EXPECTED_DEFINITIONS = [
  {
    appId: "gmail",
    id: "mgfa-header-gmail",
    matches: ["https://mail.google.com/*"],
    cssFile: "src/content/styles/header-gmail.css",
    runAt: "document_start"
  },
  {
    appId: "drive",
    id: "mgfa-header-drive",
    matches: ["https://drive.google.com/*"],
    cssFile: "src/content/styles/header-drive.css",
    runAt: "document_start"
  },
  {
    appId: "docs",
    id: "mgfa-header-docs",
    matches: ["https://docs.google.com/document/*"],
    cssFile: "src/content/styles/header-docs.css",
    runAt: "document_start"
  },
  {
    appId: "sheets",
    id: "mgfa-header-sheets",
    matches: ["https://docs.google.com/spreadsheets/*"],
    cssFile: "src/content/styles/header-sheets.css",
    runAt: "document_start"
  },
  {
    appId: "slides",
    id: "mgfa-header-slides",
    matches: ["https://docs.google.com/presentation/*"],
    cssFile: "src/content/styles/header-slides.css",
    runAt: "document_start"
  },
  {
    appId: "forms",
    id: "mgfa-header-forms",
    matches: ["https://docs.google.com/forms/*"],
    cssFile: "src/content/styles/header-forms.css",
    runAt: "document_start"
  },
  {
    appId: "vids",
    id: "mgfa-header-vids",
    matches: ["https://docs.google.com/videos/*"],
    cssFile: "src/content/styles/header-vids.css",
    runAt: "document_start"
  },
  {
    appId: "meet",
    id: "mgfa-header-meet",
    matches: ["https://meet.google.com/*"],
    cssFile: "src/content/styles/header-meet.css",
    runAt: "document_start"
  },
  {
    appId: "chat",
    id: "mgfa-header-chat",
    matches: ["https://chat.google.com/*"],
    cssFile: "src/content/styles/header-chat.css",
    runAt: "document_start"
  },
  {
    appId: "keep",
    id: "mgfa-header-keep",
    matches: ["https://keep.google.com/*"],
    cssFile: "src/content/styles/header-keep.css",
    runAt: "document_start"
  },
  {
    appId: "tasks",
    id: "mgfa-header-tasks",
    matches: ["https://tasks.google.com/*"],
    cssFile: "src/content/styles/header-tasks.css",
    runAt: "document_start"
  }
];

function expectedScriptsFor(appIds) {
  return EXPECTED_DEFINITIONS
    .filter((definition) => appIds.includes(definition.appId))
    .map(({ id, matches, cssFile, runAt }) => ({ id, matches, cssFile, runAt }));
}

test("header static css definitions cover Gmail, Chat, Meet, Keep, Tasks, Drive, Vids, and the docs suite", () => {
  const { HEADER_SCRIPT_DEFINITIONS } = loadHeaderStaticCss();

  assert.deepEqual(
    HEADER_SCRIPT_DEFINITIONS.map(({ appId, id, matches, cssFile, runAt }) => ({ appId, id, matches, cssFile, runAt })),
    EXPECTED_DEFINITIONS
  );
});

test("buildContentScripts returns every active managed header CSS registration by default", () => {
  const { buildContentScripts } = loadHeaderStaticCss();
  const scripts = buildContentScripts({ enabled: true, apps: {} });

  assert.deepEqual(scripts, expectedScriptsFor(EXPECTED_DEFINITIONS.map((definition) => definition.appId)));
});

test("buildContentScripts returns an empty list when the extension is globally disabled", () => {
  const { buildContentScripts } = loadHeaderStaticCss();
  assert.deepEqual(buildContentScripts({ enabled: false, apps: { docs: true } }), []);
});

test("buildContentScripts excludes only disabled apps", () => {
  const { buildContentScripts } = loadHeaderStaticCss();
  const scripts = buildContentScripts({
    enabled: true,
    apps: {
      gmail: false,
      tasks: false,
      docs: false,
      slides: false
    }
  });

  assert.deepEqual(scripts, expectedScriptsFor(["drive", "sheets", "forms", "vids", "meet", "chat", "keep"]));
});

test("sync forwards managed ids and desired scripts to the platform registry", async () => {
  const calls = [];
  const extensionApi = { runtime: { id: "extension-api" } };
  const registry = {
    syncManagedCssScripts(payload, receivedExtensionApi) {
      calls.push({ payload, extensionApi: receivedExtensionApi });
      return Promise.resolve({ ok: true });
    }
  };
  const headerStaticCss = loadHeaderStaticCss(registry);

  const result = await headerStaticCss.sync(extensionApi, {
    enabled: true,
    apps: {
      docs: false
    }
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].extensionApi, extensionApi);
  assert.deepEqual(calls[0].payload, {
    managedIds: headerStaticCss.MANAGED_SCRIPT_IDS,
    desiredScripts: expectedScriptsFor(["gmail", "drive", "sheets", "slides", "forms", "vids", "meet", "chat", "keep", "tasks"])
  });
  assert.deepEqual(result.activeAppIds, ["gmail", "drive", "sheets", "slides", "forms", "vids", "meet", "chat", "keep", "tasks"]);
  assert.deepEqual(result.desiredScripts, expectedScriptsFor(["gmail", "drive", "sheets", "slides", "forms", "vids", "meet", "chat", "keep", "tasks"]));
  assert.deepEqual(result.desiredScriptIds, result.desiredScripts.map((script) => script.id));
  assert.equal(result.options.apps.docs, false);
});

test("sync reports skipped when content script registry is unavailable", async () => {
  const headerStaticCss = loadHeaderStaticCss();

  const result = await headerStaticCss.sync(null, {
    enabled: true,
    apps: {
      docs: true
    }
  });

  assert.equal(result.skipped, true);
  assert.deepEqual(result.managedIds, headerStaticCss.MANAGED_SCRIPT_IDS);
  assert.deepEqual(result.activeAppIds, ["gmail", "drive", "docs", "sheets", "slides", "forms", "vids", "meet", "chat", "keep", "tasks"]);
  assert.deepEqual(result.desiredScripts, expectedScriptsFor(EXPECTED_DEFINITIONS.map((definition) => definition.appId)));
  assert.deepEqual(result.desiredScriptIds, result.desiredScripts.map((script) => script.id));
});
