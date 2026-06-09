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
    if (api?.storage?.sync) {
      return "sync";
    }
    if (api?.storage?.local) {
      return "local";
    }
    return null;
  }

  function toStorageError(error, fallbackMessage) {
    if (error instanceof Error) {
      return error;
    }
    return new Error(error?.message || fallbackMessage);
  }

  function warnStorageDefault(areaName, error) {
    globalScope.console?.warn(
      `[mgfa/settings] Failed to load options from ${areaName} storage. Using defaults.`,
      error
    );
  }

  function fetchFromArea(area, query, extensionApi) {
    try {
      if (area.get.length < 2) {
        return Promise.resolve(area.get(query));
      }
      return new Promise((resolve, reject) => {
        area.get(query, (result) => {
          const api = extensionApi || runtime.getExtensionApi();
          if (api?.runtime?.lastError) {
            reject(api.runtime.lastError);
          } else {
            resolve(result);
          }
        });
      });
    } catch (error) {
      return Promise.reject(error);
    }
  }

  function saveToArea(area, payload, extensionApi) {
    try {
      if (area.set.length < 2) {
        return Promise.resolve(area.set(payload));
      }
      return new Promise((resolve, reject) => {
        area.set(payload, () => {
          const api = extensionApi || runtime.getExtensionApi();
          if (api?.runtime?.lastError) {
            reject(api.runtime.lastError);
          } else {
            resolve();
          }
        });
      });
    } catch (error) {
      return Promise.reject(error);
    }
  }

  async function getOptions(extensionApi) {
    const api = extensionApi || runtime.getExtensionApi();
    const query = { [STORAGE_KEY]: DEFAULT_OPTIONS };

    if (api?.storage?.sync) {
      try {
        const result = await fetchFromArea(api.storage.sync, query, api);
        return normalizeOptions(result?.[STORAGE_KEY]);
      } catch (error) {
        if (api?.storage?.local) {
          globalScope.console?.warn(
            "[mgfa/settings] Failed to load options in sync storage. Falling back to local.",
            error
          );
        } else {
          warnStorageDefault("sync", error);
          return normalizeOptions(DEFAULT_OPTIONS);
        }
      }
    }

    if (api?.storage?.local) {
      try {
        const result = await fetchFromArea(api.storage.local, query, api);
        return normalizeOptions(result?.[STORAGE_KEY]);
      } catch (error) {
        warnStorageDefault("local", error);
      }
    }

    return normalizeOptions(DEFAULT_OPTIONS);
  }

  async function setOptions(options, extensionApi) {
    const api = extensionApi || runtime.getExtensionApi();
    const normalizedOptions = normalizeOptions(options);
    const payload = { [STORAGE_KEY]: normalizedOptions };

    if (api?.storage?.sync) {
      try {
        await saveToArea(api.storage.sync, payload, api);
        return normalizedOptions;
      } catch (error) {
        if (api?.storage?.local) {
          globalScope.console?.warn(
            "[mgfa/settings] Failed to save options in sync storage. Falling back to local.",
            error
          );
        } else {
          throw toStorageError(error, "Failed to persist options.");
        }
      }
    }

    if (api?.storage?.local) {
      try {
        await saveToArea(api.storage.local, payload, api);
        return normalizedOptions;
      } catch (error) {
        throw toStorageError(error, "Failed to persist options.");
      }
    }

    return normalizedOptions;
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

    const handler = (changes, areaName) => {
      if (!changes || !Object.prototype.hasOwnProperty.call(changes, STORAGE_KEY)) {
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
