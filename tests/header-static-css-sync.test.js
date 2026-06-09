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

test("header static css definitions cover Gmail, Chat, Meet, Keep, Tasks, Drive, Vids, and the docs suite", () => {
  const { HEADER_SCRIPT_DEFINITIONS } = loadHeaderStaticCss();

  assert.deepEqual(
    HEADER_SCRIPT_DEFINITIONS.map(({ appId, id, matches, cssFile }) => ({ appId, id, matches, cssFile })),
    [
      {
        appId: "gmail",
        id: "mgfa-header-gmail",
        matches: ["https://mail.google.com/*"],
        cssFile: "src/content/styles/header-gmail.css"
      },
      {
        appId: "drive",
        id: "mgfa-header-drive",
        matches: ["https://drive.google.com/*"],
        cssFile: "src/content/styles/header-drive.css"
      },
      {
        appId: "docs",
        id: "mgfa-header-docs",
        matches: ["https://docs.google.com/document/*"],
        cssFile: "src/content/styles/header-docs.css"
      },
      {
        appId: "sheets",
        id: "mgfa-header-sheets",
        matches: ["https://docs.google.com/spreadsheets/*"],
        cssFile: "src/content/styles/header-sheets.css"
      },
      {
        appId: "slides",
        id: "mgfa-header-slides",
        matches: ["https://docs.google.com/presentation/*"],
        cssFile: "src/content/styles/header-slides.css"
      },
      {
        appId: "forms",
        id: "mgfa-header-forms",
        matches: ["https://docs.google.com/forms/*"],
        cssFile: "src/content/styles/header-forms.css"
      },
      {
        appId: "vids",
        id: "mgfa-header-vids",
        matches: ["https://docs.google.com/videos/*"],
        cssFile: "src/content/styles/header-vids.css"
      },
      {
        appId: "meet",
        id: "mgfa-header-meet",
        matches: ["https://meet.google.com/*"],
        cssFile: "src/content/styles/header-meet.css"
      },
      {
        appId: "chat",
        id: "mgfa-header-chat",
        matches: ["https://chat.google.com/*"],
        cssFile: "src/content/styles/header-chat.css"
      },
      {
        appId: "keep",
        id: "mgfa-header-keep",
        matches: ["https://keep.google.com/*"],
        cssFile: "src/content/styles/header-keep.css"
      },
      {
        appId: "tasks",
        id: "mgfa-header-tasks",
        matches: ["https://tasks.google.com/*"],
        cssFile: "src/content/styles/header-tasks.css"
      }
    ]
  );
});

test("buildContentScripts returns every managed header CSS script by default", () => {
  const { buildContentScripts } = loadHeaderStaticCss();
  const scripts = buildContentScripts({ enabled: true, apps: {} });

  assert.deepEqual(scripts.map((script) => script.id), [
    "mgfa-header-gmail",
    "mgfa-header-drive",
    "mgfa-header-docs",
    "mgfa-header-sheets",
    "mgfa-header-slides",
    "mgfa-header-forms",
    "mgfa-header-vids",
    "mgfa-header-meet",
    "mgfa-header-chat",
    "mgfa-header-keep",
    "mgfa-header-tasks"
  ]);
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

  assert.deepEqual(scripts.map((script) => script.id), [
    "mgfa-header-drive",
    "mgfa-header-sheets",
    "mgfa-header-forms",
    "mgfa-header-vids",
    "mgfa-header-meet",
    "mgfa-header-chat",
    "mgfa-header-keep"
  ]);
});

test("sync forwards managed ids and desired scripts to the platform registry", async () => {
  const calls = [];
  const registry = {
    syncManagedCssScripts(payload) {
      calls.push(payload);
      return Promise.resolve({ ok: true });
    }
  };
  const headerStaticCss = loadHeaderStaticCss(registry);

  const result = await headerStaticCss.sync(null, {
    enabled: true,
    apps: {
      docs: false
    }
  });

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].managedIds, headerStaticCss.MANAGED_SCRIPT_IDS);
  assert.deepEqual(calls[0].desiredScripts.map((script) => script.id), [
    "mgfa-header-gmail",
    "mgfa-header-drive",
    "mgfa-header-sheets",
    "mgfa-header-slides",
    "mgfa-header-forms",
    "mgfa-header-vids",
    "mgfa-header-meet",
    "mgfa-header-chat",
    "mgfa-header-keep",
    "mgfa-header-tasks"
  ]);
  assert.deepEqual(result.activeAppIds, ["gmail", "drive", "sheets", "slides", "forms", "vids", "meet", "chat", "keep", "tasks"]);
  assert.deepEqual(result.desiredScriptIds, [
    "mgfa-header-gmail",
    "mgfa-header-drive",
    "mgfa-header-sheets",
    "mgfa-header-slides",
    "mgfa-header-forms",
    "mgfa-header-vids",
    "mgfa-header-meet",
    "mgfa-header-chat",
    "mgfa-header-keep",
    "mgfa-header-tasks"
  ]);
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
  assert.deepEqual(result.desiredScriptIds, [
    "mgfa-header-gmail",
    "mgfa-header-drive",
    "mgfa-header-docs",
    "mgfa-header-sheets",
    "mgfa-header-slides",
    "mgfa-header-forms",
    "mgfa-header-vids",
    "mgfa-header-meet",
    "mgfa-header-chat",
    "mgfa-header-keep",
    "mgfa-header-tasks"
  ]);
  assert.deepEqual(result.desiredScripts.map((script) => script.id), [
    "mgfa-header-gmail",
    "mgfa-header-drive",
    "mgfa-header-docs",
    "mgfa-header-sheets",
    "mgfa-header-slides",
    "mgfa-header-forms",
    "mgfa-header-vids",
    "mgfa-header-meet",
    "mgfa-header-chat",
    "mgfa-header-keep",
    "mgfa-header-tasks"
  ]);
});
