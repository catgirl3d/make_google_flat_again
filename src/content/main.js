(function initializeMakeGoogleFlatAgain() {
  const extension = globalThis.MakeGoogleFlatAgain;
  const debugApi = extension?.debugLogger || require("./debug-logger.js");
  const logger = debugApi.create("main");

  if (!extension?.apps || !extension?.guards || !extension?.settings || !extension?.targets || !extension?.surfaceRegistry) {
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

  function updatePageAttributes(options) {
    const pauseRule = extension.guards.getPauseRule(window.location);
    const matchingTargets = extension.targets.findMatchingTargets(window.location).filter((target) => {
      return !target.appId || extension.settings.appEnabled(target.appId, options);
    });
    const matchingApps = extension.apps.findMatchingApps(window.location).filter((app) => {
      return extension.settings.appEnabled(app.id, options);
    });
    const primaryApp = extension.apps.findPrimaryApp(window.location);

    if (pauseRule) {
      setDocumentAttribute("data-mgfa-paused", pauseRule.id);
    } else {
      removeDocumentAttribute("data-mgfa-paused");
    }

    if (matchingTargets.length > 0) {
      setDocumentAttribute("data-mgfa-active", matchingTargets.map((target) => target.id).join(" "));
    } else {
      removeDocumentAttribute("data-mgfa-active");
    }

    if (primaryApp && extension.settings.appEnabled(primaryApp.id, options)) {
      setDocumentAttribute("data-mgfa-app", primaryApp.id);
    } else {
      removeDocumentAttribute("data-mgfa-app");
    }

    logger.snapshot("page-state", {
      activeAttribute: matchingTargets.map((target) => target.id),
      enabledPrimaryApp: primaryApp && extension.settings.appEnabled(primaryApp.id, options) ? primaryApp.id : null,
      matchingApps: matchingApps.map((app) => app.id),
      matchingTargets: matchingTargets.map((target) => target.id),
      pauseRule: pauseRule?.id || null,
      pathname: window.location.pathname,
      readyState: document.readyState
    });
  }

  extension.settings.getOptions(extension.runtime.getExtensionApi()).then((options) => {
    logger.snapshot("options-loaded", {
      enabled: options.enabled !== false,
      enabledApps: extension.apps.apps
        .filter((app) => extension.settings.appEnabled(app.id, options))
        .map((app) => app.id)
    });

    if (options.enabled === false) {
      setDocumentAttribute("data-mgfa-disabled", "1");
      logger.event("bootstrap-skipped", { reason: "extension-disabled" });
      return;
    }

    updatePageAttributes(options);
    logger.event("start-surfaces", {
      surfaces: extension.surfaceRegistry.getSurfaces().map((surface) => surface.name)
    });
    extension.surfaceRegistry.startAll({ extension, options });

    const refreshPageAttributes = () => updatePageAttributes(options);

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", refreshPageAttributes, { once: true });
    }

    window.addEventListener("popstate", refreshPageAttributes, { passive: true });
    window.addEventListener("hashchange", refreshPageAttributes, { passive: true });
    window.addEventListener("focus", refreshPageAttributes, { passive: true });
  });
})();
