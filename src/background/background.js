try {
  importScripts("../shared/runtime.js", "../shared/apps.js", "../shared/settings.js", "./productlogo-dnr.js");
} catch (_) {
  // importScripts is unavailable in Firefox background documents.
}

(function initializeBackgroundSync(globalScope) {
  if (globalScope.__MGFA_BACKGROUND_SYNC_INITIALIZED__) {
    return;
  }

  const extension = globalScope.MakeGoogleFlatAgain;

  if (!extension?.runtime || !extension?.settings || !extension?.productlogoDnr) {
    return;
  }

  const extensionApi = extension.runtime.getExtensionApi();

  if (!extensionApi?.declarativeNetRequest) {
    return;
  }

  globalScope.__MGFA_BACKGROUND_SYNC_INITIALIZED__ = true;

  function reportSyncError(error) {
    console.warn("[mgfa/background] productlogo dynamic rule sync failed", error);
  }

  function syncFromStorage() {
    return extension.settings
      .getOptions(extensionApi)
      .then((options) => extension.productlogoDnr.sync(extensionApi, options))
      .catch(reportSyncError);
  }

  extension.settings.observeOptions((options) => {
    extension.productlogoDnr.sync(extensionApi, options).catch(reportSyncError);
  }, extensionApi);

  if (extensionApi.runtime?.onInstalled?.addListener) {
    extensionApi.runtime.onInstalled.addListener(() => {
      void syncFromStorage();
    });
  }

  if (extensionApi.runtime?.onStartup?.addListener) {
    extensionApi.runtime.onStartup.addListener(() => {
      void syncFromStorage();
    });
  }

  void syncFromStorage();
})(typeof globalThis !== "undefined" ? globalThis : this);
