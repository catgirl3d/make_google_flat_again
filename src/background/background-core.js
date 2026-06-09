(function initializeBackgroundSync(globalScope) {
  if (globalScope.__MGFA_BACKGROUND_SYNC_INITIALIZED__) {
    return;
  }

  const extension = globalScope.MakeGoogleFlatAgain;

  if (!extension?.runtime || !extension?.settings) {
    return;
  }

  const buildFlags = extension.buildFlags || require("../shared/build-flags.js");

  globalScope.__MGFA_BACKGROUND_SYNC_INITIALIZED__ = true;

  const extensionApi = extension.runtime.getExtensionApi();
  let syncQueue = Promise.resolve();

  function reportSyncError(label, error) {
    console.warn(`[mgfa/background] ${label} sync failed`, error);
  }

  function reportSyncResult(label, payload) {
    if (!buildFlags.isDevelopment) {
      return;
    }

    console.log(`[mgfa/background] ${label} sync`, payload);
  }

  function summarizeHeaderStaticCssSync(result) {
    return {
      activeAppIds: Array.isArray(result?.activeAppIds) ? result.activeAppIds : [],
      addedIds: Array.isArray(result?.addedIds) ? result.addedIds : [],
      desiredScriptIds: Array.isArray(result?.desiredScriptIds) ? result.desiredScriptIds : [],
      removedIds: Array.isArray(result?.removedIds) ? result.removedIds : [],
      skipped: result?.skipped === true,
      usedFallback: result?.usedFallback === true
    };
  }

  function enqueueSync(work) {
    // Dynamic content script registration must be serialized so install/startup/storage
    // events do not race and try to register or unregister the same IDs in parallel.
    const nextRun = syncQueue.catch(() => {}).then(() => work());
    syncQueue = nextRun;
    return nextRun;
  }

  function syncOptions(options) {
    const tasks = [];

    if (extension.headerStaticCss?.sync) {
      tasks.push(
        Promise.resolve(extension.headerStaticCss.sync(extensionApi, options))
          .then((result) => {
            reportSyncResult("header static CSS", summarizeHeaderStaticCssSync(result));
            return result;
          })
          .catch((error) => {
            reportSyncError("header static CSS", error);
          })
      );
    }

    return Promise.all(tasks);
  }

  function syncFromStorage() {
    return enqueueSync(() => {
      return extension.settings
        .getOptions(extensionApi)
        .then((options) => syncOptions(options))
        .catch((error) => {
          reportSyncError("settings", error);
        });
    });
  }

  extension.settings.observeOptions((options) => {
    void enqueueSync(() => syncOptions(options));
  }, extensionApi);

  if (extensionApi?.runtime?.onInstalled?.addListener) {
    extensionApi.runtime.onInstalled.addListener(() => {
      void syncFromStorage();
    });
  }

  if (extensionApi?.runtime?.onStartup?.addListener) {
    extensionApi.runtime.onStartup.addListener(() => {
      void syncFromStorage();
    });
  }

  void syncFromStorage();
})(typeof globalThis !== "undefined" ? globalThis : this);
