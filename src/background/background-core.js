(function initializeBackgroundSync(globalScope) {
  if (globalScope.__MGFA_BACKGROUND_SYNC_INITIALIZED__) {
    return;
  }

  const extension = globalScope.MakeGoogleFlatAgain;

  if (!extension?.runtime || !extension?.settings) {
    return;
  }

  globalScope.__MGFA_BACKGROUND_SYNC_INITIALIZED__ = true;

  const extensionApi = extension.runtime.getExtensionApi();
  let syncQueue = Promise.resolve();

  function reportSyncError(label, error) {
    console.warn(`[mgfa/background] ${label} sync failed`, error);
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

    if (extensionApi?.declarativeNetRequest && extension.productlogoDnr?.sync) {
      tasks.push(
        Promise.resolve(extension.productlogoDnr.sync(extensionApi, options)).catch((error) => {
          reportSyncError("productlogo DNR", error);
        })
      );
    }

    if (extension.headerStaticCss?.sync && extension.contentScriptRegistry?.syncManagedCssScripts) {
      tasks.push(
        Promise.resolve(extension.headerStaticCss.sync(extensionApi, options)).catch((error) => {
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
