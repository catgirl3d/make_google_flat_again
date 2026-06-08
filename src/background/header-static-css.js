(function attachHeaderStaticCss(globalScope) {
  const runtime = globalScope.__MGFA_RUNTIME__ || require("../shared/runtime.js");
  const settingsApi = globalScope.MakeGoogleFlatAgain?.settings || require("../shared/settings.js");
  const HEADER_SCRIPT_DEFINITIONS = Object.freeze([
    Object.freeze({
      appId: "gmail",
      id: "mgfa-header-gmail",
      matches: Object.freeze(["https://mail.google.com/*"]),
      cssFile: "src/content/styles/header-gmail.css",
      runAt: "document_start"
    }),
    Object.freeze({
      appId: "tasks",
      id: "mgfa-header-tasks",
      matches: Object.freeze(["https://tasks.google.com/*"]),
      cssFile: "src/content/styles/header-tasks.css",
      runAt: "document_start"
    }),
    Object.freeze({
      appId: "drive",
      id: "mgfa-header-drive",
      matches: Object.freeze(["https://drive.google.com/*"]),
      cssFile: "src/content/styles/header-drive.css",
      runAt: "document_start"
    }),
    Object.freeze({
      appId: "docs",
      id: "mgfa-header-docs",
      matches: Object.freeze(["https://docs.google.com/document/*"]),
      cssFile: "src/content/styles/header-docs.css",
      runAt: "document_start"
    }),
    Object.freeze({
      appId: "sheets",
      id: "mgfa-header-sheets",
      matches: Object.freeze(["https://docs.google.com/spreadsheets/*"]),
      cssFile: "src/content/styles/header-sheets.css",
      runAt: "document_start"
    }),
    Object.freeze({
      appId: "slides",
      id: "mgfa-header-slides",
      matches: Object.freeze(["https://docs.google.com/presentation/*"]),
      cssFile: "src/content/styles/header-slides.css",
      runAt: "document_start"
    }),
    Object.freeze({
      appId: "forms",
      id: "mgfa-header-forms",
      matches: Object.freeze(["https://docs.google.com/forms/*"]),
      cssFile: "src/content/styles/header-forms.css",
      runAt: "document_start"
    })
  ]);
  const MANAGED_SCRIPT_IDS = Object.freeze(HEADER_SCRIPT_DEFINITIONS.map((definition) => definition.id));

  function getActiveHeaderDefinitionsFromNormalized(normalizedOptions) {
    if (normalizedOptions.enabled === false) {
      return [];
    }

    return HEADER_SCRIPT_DEFINITIONS.filter((definition) => normalizedOptions.apps[definition.appId] !== false);
  }

  function buildContentScript(definition) {
    return {
      id: definition.id,
      matches: [...definition.matches],
      cssFile: definition.cssFile,
      runAt: definition.runAt
    };
  }

  function buildContentScriptsFromNormalized(normalizedOptions) {
    return getActiveHeaderDefinitionsFromNormalized(normalizedOptions).map((definition) => buildContentScript(definition));
  }

  function buildContentScripts(options) {
    const normalizedOptions = settingsApi.normalizeOptions(options || settingsApi.DEFAULT_OPTIONS);
    return buildContentScriptsFromNormalized(normalizedOptions);
  }

  function getContentScriptRegistry() {
    return globalScope.MakeGoogleFlatAgain?.contentScriptRegistry || runtime.get("contentScriptRegistry") || null;
  }

  function sync(extensionApi, options) {
    const normalizedOptions = settingsApi.normalizeOptions(options || settingsApi.DEFAULT_OPTIONS);
    const activeDefinitions = getActiveHeaderDefinitionsFromNormalized(normalizedOptions);
    const desiredScripts = activeDefinitions.map((definition) => buildContentScript(definition));
    const registry = getContentScriptRegistry();
    const payload = {
      managedIds: [...MANAGED_SCRIPT_IDS],
      desiredScripts
    };

    if (!registry?.syncManagedCssScripts) {
      return Promise.resolve({
        ...payload,
        activeAppIds: activeDefinitions.map((definition) => definition.appId),
        options: normalizedOptions,
        desiredScriptIds: desiredScripts.map((script) => script.id),
        skipped: true
      });
    }

    return Promise.resolve(registry.syncManagedCssScripts(payload, extensionApi)).then((result) => {
      return {
        activeAppIds: activeDefinitions.map((definition) => definition.appId),
        ...result,
        managedIds: [...MANAGED_SCRIPT_IDS],
        desiredScripts,
        desiredScriptIds: desiredScripts.map((script) => script.id),
        options: normalizedOptions
      };
    });
  }

  const api = {
    HEADER_SCRIPT_DEFINITIONS,
    MANAGED_SCRIPT_IDS,
    buildContentScript,
    buildContentScripts,
    sync
  };

  runtime.attach("headerStaticCss", api);

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
