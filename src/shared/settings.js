(function attachSettings(globalScope) {
  const runtime = globalScope.__MGFA_RUNTIME__ || require("./runtime.js");
  const appsApi = globalScope.MakeGoogleFlatAgain?.apps || require("./apps.js");

  const STORAGE_KEY = "mgfaOptions";
  const APP_KEYS = appsApi.apps.map((app) => app.id);
  const DEFAULT_OPTIONS = {
    enabled: true,
    apps: Object.fromEntries(APP_KEYS.map((appId) => [appId, true]))
  };

  function normalizeOptions(value) {
    const source = value && typeof value === "object" ? value : {};
    const sourceApps = source.apps && typeof source.apps === "object" ? source.apps : {};

    return {
      enabled: source.enabled !== false,
      apps: Object.fromEntries(APP_KEYS.map((appId) => [appId, sourceApps[appId] !== false]))
    };
  }

  function getStorageArea(extensionApi) {
    const api = extensionApi || runtime.getExtensionApi();
    return api?.storage?.sync || api?.storage?.local || null;
  }

  function getOptions(extensionApi) {
    const storageArea = getStorageArea(extensionApi);

    if (!storageArea) {
      return Promise.resolve(normalizeOptions(DEFAULT_OPTIONS));
    }

    const query = { [STORAGE_KEY]: DEFAULT_OPTIONS };

    try {
      if (storageArea.get.length < 2) {
        return Promise.resolve(storageArea.get(query))
          .then((result) => normalizeOptions(result?.[STORAGE_KEY]))
          .catch(() => normalizeOptions(DEFAULT_OPTIONS));
      }

      return new Promise((resolve) => {
        storageArea.get(query, (result) => {
          const api = extensionApi || runtime.getExtensionApi();

          if (api?.runtime?.lastError) {
            resolve(normalizeOptions(DEFAULT_OPTIONS));
            return;
          }

          resolve(normalizeOptions(result?.[STORAGE_KEY]));
        });
      });
    } catch (_) {
      return Promise.resolve(normalizeOptions(DEFAULT_OPTIONS));
    }
  }

  function setOptions(options, extensionApi) {
    const storageArea = getStorageArea(extensionApi);
    const normalizedOptions = normalizeOptions(options);

    if (!storageArea) {
      return Promise.resolve(normalizedOptions);
    }

    const payload = { [STORAGE_KEY]: normalizedOptions };

    try {
      if (storageArea.set.length < 2) {
        return Promise.resolve(storageArea.set(payload))
          .then(() => normalizedOptions)
          .catch(() => normalizedOptions);
      }

      return new Promise((resolve) => {
        storageArea.set(payload, () => {
          resolve(normalizedOptions);
        });
      });
    } catch (_) {
      return Promise.resolve(normalizedOptions);
    }
  }

  function appEnabled(appId, options) {
    const normalizedOptions = normalizeOptions(options || DEFAULT_OPTIONS);
    return normalizedOptions.enabled !== false && normalizedOptions.apps[appId] !== false;
  }

  function countEnabledApps(options) {
    const normalizedOptions = normalizeOptions(options || DEFAULT_OPTIONS);
    return APP_KEYS.filter((appId) => normalizedOptions.apps[appId] !== false).length;
  }

  const api = {
    STORAGE_KEY,
    APP_KEYS,
    DEFAULT_OPTIONS,
    normalizeOptions,
    getStorageArea,
    getOptions,
    setOptions,
    appEnabled,
    countEnabledApps
  };

  runtime.attach("settings", api);

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
