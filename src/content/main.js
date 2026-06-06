(function initializeMakeGoogleFlatAgain() {
  const extension = globalThis.MakeGoogleFlatAgain;
  const debugApi = extension?.debugLogger || require("./debug-logger.js");
  const logger = debugApi.create("main");
  const DOCS_SHARED_ACTIVE_ID = "docs-shared";
  const DOCS_SHARED_MATCH = { hostname: "docs.google.com", pathnamePrefixes: ["/"] };

  if (!extension?.apps || !extension?.guards || !extension?.settings || !extension?.surfaceRegistry) {
    return;
  }

  function setDocumentAttribute(attributeName, value) {
    if (!document.documentElement) {
      return false;
    }

    document.documentElement.setAttribute(attributeName, value);
    return true;
  }

  function removeDocumentAttribute(attributeName) {
    document.documentElement?.removeAttribute(attributeName);
  }

  function findActiveTargetIds(locationLike, enabledMatchingApps, options) {
    if (options?.enabled === false) {
      return [];
    }

    const targetIds = [];

    if (extension.apps.locationMatchesRule(locationLike, DOCS_SHARED_MATCH)) {
      targetIds.push(DOCS_SHARED_ACTIVE_ID);
    }

    return targetIds.concat(enabledMatchingApps.map((app) => app.id));
  }

  function updatePageAttributes(options) {
    const extensionEnabled = options?.enabled !== false;
    const pauseRule = extension.guards.getPauseRule(window.location);
    const matchingApps = extension.apps.findMatchingApps(window.location).filter((app) => {
      return extensionEnabled && extension.settings.appEnabled(app.id, options);
    });
    const activeTargetIds = findActiveTargetIds(window.location, matchingApps, options);
    const primaryApp = extension.apps.findPrimaryApp(window.location);

    if (!extensionEnabled) {
      setDocumentAttribute("data-mgfa-disabled", "1");
    } else {
      removeDocumentAttribute("data-mgfa-disabled");
    }

    if (pauseRule) {
      setDocumentAttribute("data-mgfa-paused", pauseRule.id);
    } else {
      removeDocumentAttribute("data-mgfa-paused");
    }

    if (activeTargetIds.length > 0) {
      setDocumentAttribute("data-mgfa-active", activeTargetIds.join(" "));
    } else {
      removeDocumentAttribute("data-mgfa-active");
    }

    if (extensionEnabled && primaryApp && extension.settings.appEnabled(primaryApp.id, options)) {
      setDocumentAttribute("data-mgfa-app", primaryApp.id);
    } else {
      removeDocumentAttribute("data-mgfa-app");
    }

    logger.snapshot("page-state", {
      activeAttribute: activeTargetIds,
      enabledPrimaryApp: primaryApp && extension.settings.appEnabled(primaryApp.id, options) ? primaryApp.id : null,
      matchingApps: matchingApps.map((app) => app.id),
      matchingTargets: activeTargetIds,
      pauseRule: pauseRule?.id || null,
      pathname: window.location.pathname,
      readyState: document.readyState
    });
  }

  const extensionApi = extension.runtime.getExtensionApi();
  const bootstrapPrimaryApp = extension.apps.findPrimaryApp(window.location);

  if (bootstrapPrimaryApp) {
    setDocumentAttribute("data-mgfa-app", bootstrapPrimaryApp.id);
    logger.event("bootstrap-primary-app", {
      appId: bootstrapPrimaryApp.id,
      pathname: window.location.pathname,
      readyState: document.readyState
    });
  }

  extension.settings.getOptions(extensionApi).then((options) => {
    const context = { extension, options };

    logger.snapshot("options-loaded", {
      enabled: options.enabled !== false,
      enabledApps: extension.apps.apps
        .filter((app) => extension.settings.appEnabled(app.id, options))
        .map((app) => app.id)
    });

    if (options.enabled === false) {
      logger.event("extension-disabled-at-startup", { reason: "extension-disabled" });
    }

    updatePageAttributes(context.options);
    logger.event("start-surfaces", {
      surfaces: extension.surfaceRegistry.getSurfaces().map((surface) => surface.name)
    });
    extension.surfaceRegistry.startAll(context);

    const refreshPageAttributes = () => updatePageAttributes(context.options);

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", refreshPageAttributes, { once: true });
    }

    window.addEventListener("popstate", refreshPageAttributes, { passive: true });
    window.addEventListener("hashchange", refreshPageAttributes, { passive: true });
    window.addEventListener("focus", refreshPageAttributes, { passive: true });

    extension.settings.observeOptions((nextOptions) => {
      context.options = nextOptions;
      refreshPageAttributes();
      logger.snapshot("options-changed", {
        enabled: nextOptions.enabled !== false,
        enabledApps: extension.apps.apps
          .filter((app) => extension.settings.appEnabled(app.id, nextOptions))
          .map((app) => app.id)
      });
      window.dispatchEvent(new Event("focus"));
    }, extensionApi);
  });
})();
