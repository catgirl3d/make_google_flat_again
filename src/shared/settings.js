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

  function getStorageAreaName(extensionApi) {
    const api = extensionApi || runtime.getExtensionApi();

    if (api?.storage?.sync && getStorageArea(api) === api.storage.sync) {
      return "sync";
    }

    if (api?.storage?.local && getStorageArea(api) === api.storage.local) {
      return "local";
    }

    return null;
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
          .then(() => normalizedOptions);
      }

      return new Promise((resolve, reject) => {
        storageArea.set(payload, () => {
          const api = extensionApi || runtime.getExtensionApi();

          if (api?.runtime?.lastError) {
            reject(new Error(api.runtime.lastError.message || "Failed to persist options."));
            return;
          }

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

  function getChangedOptions(changeRecord) {
    return normalizeOptions(changeRecord?.newValue || DEFAULT_OPTIONS);
  }

  function observeOptions(listener, extensionApi) {
    const api = extensionApi || runtime.getExtensionApi();

    if (!api?.storage?.onChanged?.addListener || typeof listener !== "function") {
      return () => {};
    }

    const expectedAreaName = getStorageAreaName(api);
    const handler = (changes, areaName) => {
      if (!changes || !Object.prototype.hasOwnProperty.call(changes, STORAGE_KEY)) {
        return;
      }

      if (expectedAreaName && areaName && areaName !== expectedAreaName) {
        return;
      }

      listener(getChangedOptions(changes[STORAGE_KEY]), {
        areaName,
        changeRecord: changes[STORAGE_KEY]
      });
    };

    api.storage.onChanged.addListener(handler);

    return () => {
      if (api.storage.onChanged.removeListener) {
        api.storage.onChanged.removeListener(handler);
      }
    };
  }

  const api = {
    STORAGE_KEY,
    APP_KEYS,
    DEFAULT_OPTIONS,
    normalizeOptions,
    getStorageArea,
    getStorageAreaName,
    getOptions,
    setOptions,
    appEnabled,
    countEnabledApps,
    getChangedOptions,
    observeOptions
  };

  runtime.attach("settings", api);

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
