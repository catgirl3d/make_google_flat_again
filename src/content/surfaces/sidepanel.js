(function attachSidePanelSurface(globalScope) {
  const runtime = globalScope.__MGFA_RUNTIME__ || require("../../shared/runtime.js");
  const appsApi = globalScope.MakeGoogleFlatAgain?.apps || require("../../shared/apps.js");
  const debugApi = globalScope.MakeGoogleFlatAgain?.debugLogger || require("../debug-logger.js");
  const guardsApi = globalScope.MakeGoogleFlatAgain?.guards || require("../../shared/guards.js");
  const settingsApi = globalScope.MakeGoogleFlatAgain?.settings || require("../../shared/settings.js");
  const surfaceRegistry = globalScope.MakeGoogleFlatAgain?.surfaceRegistry || require("../surface-registry.js");
  const logger = debugApi.create("sidepanel");

  const STYLE_ID = "mgfa-sidepanel-style";
  const ATTR_NAME = "data-mgfa-sidepanel";

  function escapeCssUrl(url) {
    return String(url).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  function buildReplacementRule(app, selectorList) {
    const iconUrl = escapeCssUrl(runtime.getRuntimeUrl(appsApi.getAssetPath(app)));
    const iconSize = `${app.surfaces.sidePanel.iconSize || 24}px`;
    const selectors = selectorList.join(",\n");

    return `
${selectors} {
  background-image: url("${iconUrl}") !important;
  background-repeat: no-repeat !important;
  background-position: center center !important;
  background-size: ${iconSize} ${iconSize} !important;
}
`.trim();
  }

  function buildSidePanelCss(options) {
    return appsApi
      .getAppsWithSurface("sidePanel")
      .filter((app) => settingsApi.appEnabled(app.id, options))
      .map((app) => buildReplacementRule(app, app.surfaces.sidePanel.selectors))
      .join("\n\n");
  }

  function scheduleNextMidnight(callback) {
    const now = new Date();
    const next = new Date(now);
    next.setHours(24, 0, 5, 0);
    return window.setTimeout(callback, Math.max(1000, next.getTime() - now.getTime()));
  }

  function start(context) {
    let midnightTimer = null;

    function cleanup(reason) {
      logger.snapshot("cleanup", {
        reason: reason || "unspecified",
        stylePresent: Boolean(document.getElementById(STYLE_ID))
      });
      document.getElementById(STYLE_ID)?.remove();
      document.documentElement?.removeAttribute(ATTR_NAME);

      if (midnightTimer) {
        clearTimeout(midnightTimer);
        midnightTimer = null;
      }
    }

    function apply() {
      const paused = guardsApi.shouldPauseOnPage(window.location);
      if (paused || !document.documentElement) {
        cleanup(paused ? "paused" : "missing-root");
        return;
      }

      const cssText = buildSidePanelCss(context.options);
      const enabledApps = appsApi
        .getAppsWithSurface("sidePanel")
        .filter((app) => settingsApi.appEnabled(app.id, context.options))
        .map((app) => app.id);

      if (!cssText.trim()) {
        cleanup("no-enabled-sidepanel-apps");
        return;
      }

      let styleElement = document.getElementById(STYLE_ID);

      if (!styleElement) {
        styleElement = document.createElement("style");
        styleElement.id = STYLE_ID;
        (document.head || document.documentElement).appendChild(styleElement);
      }

      styleElement.textContent = cssText;
      document.documentElement.setAttribute(ATTR_NAME, "1");
      logger.snapshot("applied", {
        assets: enabledApps.reduce((result, appId) => {
          result[appId] = runtime.getRuntimeUrl(appsApi.getAssetPath(appId));
          return result;
        }, {}),
        cssLength: cssText.length,
        enabledApps,
        stylePresent: true
      });

      if (midnightTimer) {
        clearTimeout(midnightTimer);
      }

      midnightTimer = scheduleNextMidnight(apply);
    }

    logger.event("surface-started", { readyState: document.readyState });
    apply();

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", apply, { once: true });
    }

    window.addEventListener("focus", apply, { passive: true });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        apply();
      }
    }, { passive: true });
  }

  const api = {
    name: "sidepanel",
    start,
    escapeCssUrl,
    buildSidePanelCss
  };

  surfaceRegistry.register(api);

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
