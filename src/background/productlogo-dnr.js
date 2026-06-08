(function attachProductlogoDnr(globalScope) {
  const runtime = globalScope.__MGFA_RUNTIME__ || require("../shared/runtime.js");
  const appsApi = globalScope.MakeGoogleFlatAgain?.apps || require("../shared/apps.js");
  const settingsApi = globalScope.MakeGoogleFlatAgain?.settings || require("../shared/settings.js");

  const RULE_DEFINITIONS = Object.freeze([
    Object.freeze({
      appId: "drive",
      id: 2001,
      initiatorDomains: Object.freeze(["drive.google.com"]),
      urlFilter: "||www.gstatic.com/images/branding/productlogos/drive_2026/"
    }),
    Object.freeze({
      appId: "docs",
      id: 2002,
      initiatorDomains: Object.freeze(["docs.google.com"]),
      urlFilter: "||www.gstatic.com/images/branding/productlogos/docs_2026/"
    }),
    Object.freeze({
      appId: "sheets",
      id: 2003,
      initiatorDomains: Object.freeze(["docs.google.com"]),
      urlFilter: "||www.gstatic.com/images/branding/productlogos/sheets_2026/"
    }),
    Object.freeze({
      appId: "slides",
      id: 2004,
      initiatorDomains: Object.freeze(["docs.google.com"]),
      urlFilter: "||www.gstatic.com/images/branding/productlogos/slides_2026/"
    }),
    Object.freeze({
      appId: "forms",
      id: 2005,
      initiatorDomains: Object.freeze(["docs.google.com"]),
      urlFilter: "||www.gstatic.com/images/branding/productlogos/forms_2026/"
    })
  ]);
  const RULE_IDS_BY_APP = Object.freeze(Object.fromEntries(RULE_DEFINITIONS.map((definition) => [definition.appId, definition.id])));
  const MANAGED_RULE_IDS = Object.freeze(RULE_DEFINITIONS.map((definition) => definition.id));

  function getExtensionPath(appId) {
    const assetPath = appsApi.getAssetPath(appId);

    if (!assetPath) {
      throw new Error(`Missing productlogo asset path for app: ${appId}`);
    }

    return `/${assetPath}`;
  }

  function buildRule(definition) {
    return {
      id: definition.id,
      priority: 30,
      action: {
        type: "redirect",
        redirect: {
          extensionPath: getExtensionPath(definition.appId)
        }
      },
      condition: {
        urlFilter: definition.urlFilter,
        initiatorDomains: [...definition.initiatorDomains],
        resourceTypes: ["image"]
      }
    };
  }

  function buildDynamicRulesFromNormalized(normalizedOptions) {
    if (normalizedOptions.enabled === false) {
      return [];
    }

    return RULE_DEFINITIONS
      .filter((definition) => normalizedOptions.apps[definition.appId] !== false)
      .map((definition) => buildRule(definition));
  }

  function buildDynamicRules(options) {
    const normalizedOptions = settingsApi.normalizeOptions(options || settingsApi.DEFAULT_OPTIONS);
    return buildDynamicRulesFromNormalized(normalizedOptions);
  }

  function updateDynamicRules(extensionApi, rules) {
    const api = extensionApi || runtime.getExtensionApi();
    const declarativeNetRequest = api?.declarativeNetRequest;
    const payload = {
      removeRuleIds: [...MANAGED_RULE_IDS],
      addRules: Array.isArray(rules) ? rules : []
    };

    if (!declarativeNetRequest?.updateDynamicRules) {
      return Promise.resolve(payload);
    }

    try {
      if (declarativeNetRequest.updateDynamicRules.length < 2) {
        return Promise.resolve(declarativeNetRequest.updateDynamicRules(payload)).then(() => payload);
      }

      return new Promise((resolve, reject) => {
        declarativeNetRequest.updateDynamicRules(payload, () => {
          const currentApi = extensionApi || runtime.getExtensionApi();

          if (currentApi?.runtime?.lastError) {
            reject(new Error(currentApi.runtime.lastError.message || "Failed to sync productlogo dynamic rules."));
            return;
          }

          resolve(payload);
        });
      });
    } catch (error) {
      return Promise.reject(error);
    }
  }

  function sync(extensionApi, options) {
    const normalizedOptions = settingsApi.normalizeOptions(options || settingsApi.DEFAULT_OPTIONS);
    const dynamicRules = buildDynamicRulesFromNormalized(normalizedOptions);

    return updateDynamicRules(extensionApi, dynamicRules).then((payload) => {
      return {
        ...payload,
        options: normalizedOptions
      };
    });
  }

  const api = {
    RULE_DEFINITIONS,
    RULE_IDS_BY_APP,
    MANAGED_RULE_IDS,
    getExtensionPath,
    buildRule,
    buildDynamicRules,
    updateDynamicRules,
    sync
  };

  runtime.attach("productlogoDnr", api);

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
