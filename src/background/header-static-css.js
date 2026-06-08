(function attachHeaderStaticCss(globalScope) {
  const runtime = globalScope.__MGFA_RUNTIME__ || require("../shared/runtime.js");
  const appsApi = globalScope.MakeGoogleFlatAgain?.apps || require("../shared/apps.js");
  const settingsApi = globalScope.MakeGoogleFlatAgain?.settings || require("../shared/settings.js");
  const HEADER_SCRIPT_DEFINITIONS = Object.freeze(
    appsApi.getAppsWithManagedFeature("headerStaticCss").map((app) => {
      const feature = app.managed.headerStaticCss;
      return Object.freeze({
        appId: app.id,
        id: feature.scriptId,
        matches: Object.freeze([...feature.matches]),
        cssFile: feature.cssFile,
        runAt: feature.runAt
      });
    })
  );
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
