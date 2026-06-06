(function attachProductlogoDnr(globalScope) {
  const runtime = globalScope.__MGFA_RUNTIME__ || require("../shared/runtime.js");
  const settingsApi = globalScope.MakeGoogleFlatAgain?.settings || require("../shared/settings.js");

  const RULE_DEFINITIONS = Object.freeze([
    Object.freeze({
      appId: "drive",
      extensionPath: "/assets/icons/apps/drive-classic.svg",
      id: 2001,
      initiatorDomains: Object.freeze(["drive.google.com"]),
      urlFilter: "||www.gstatic.com/images/branding/productlogos/drive_2026/"
    }),
    Object.freeze({
      appId: "docs",
      extensionPath: "/assets/icons/apps/docs-classic.svg",
      id: 2002,
      initiatorDomains: Object.freeze(["docs.google.com"]),
      urlFilter: "||www.gstatic.com/images/branding/productlogos/docs_2026/"
    }),
    Object.freeze({
      appId: "sheets",
      extensionPath: "/assets/icons/apps/sheets-classic.svg",
      id: 2003,
      initiatorDomains: Object.freeze(["docs.google.com"]),
      urlFilter: "||www.gstatic.com/images/branding/productlogos/sheets_2026/"
    }),
    Object.freeze({
      appId: "slides",
      extensionPath: "/assets/icons/apps/slides-classic.svg",
      id: 2004,
      initiatorDomains: Object.freeze(["docs.google.com"]),
      urlFilter: "||www.gstatic.com/images/branding/productlogos/slides_2026/"
    }),
    Object.freeze({
      appId: "forms",
      extensionPath: "/assets/icons/apps/forms-classic.png",
      id: 2005,
      initiatorDomains: Object.freeze(["docs.google.com"]),
      urlFilter: "||www.gstatic.com/images/branding/productlogos/forms_2026/"
    })
  ]);
  const RULE_IDS_BY_APP = Object.freeze(Object.fromEntries(RULE_DEFINITIONS.map((definition) => [definition.appId, definition.id])));
  const MANAGED_RULE_IDS = Object.freeze(RULE_DEFINITIONS.map((definition) => definition.id));

  function buildRule(definition) {
    return {
      id: definition.id,
      priority: 30,
      action: {
        type: "redirect",
        redirect: {
          extensionPath: definition.extensionPath
        }
      },
      condition: {
        urlFilter: definition.urlFilter,
        initiatorDomains: [...definition.initiatorDomains],
        resourceTypes: ["image"]
      }
    };
  }

  function buildDynamicRules(options) {
    const normalizedOptions = settingsApi.normalizeOptions(options || settingsApi.DEFAULT_OPTIONS);

    if (normalizedOptions.enabled === false) {
      return [];
    }

    return RULE_DEFINITIONS
      .filter((definition) => settingsApi.appEnabled(definition.appId, normalizedOptions))
      .map((definition) => buildRule(definition));
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
    const dynamicRules = buildDynamicRules(normalizedOptions);

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
