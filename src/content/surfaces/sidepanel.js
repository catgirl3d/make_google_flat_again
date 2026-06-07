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
  const MANAGED_SURFACE_NAMES = ["sidePanel", "appLauncher"];

  function escapeCssUrl(url) {
    return String(url).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  function getSurfaceAssetPath(app, surfaceName) {
    return app.surfaces[surfaceName]?.assetPath || appsApi.getAssetPath(app);
  }

  function buildReplacementRule(app, surfaceName) {
    const surfaceConfig = app.surfaces[surfaceName];
    const iconUrl = escapeCssUrl(runtime.getRuntimeUrl(getSurfaceAssetPath(app, surfaceName)));
    const iconSize = `${surfaceConfig.iconSize || 20}px`;
    const selectors = surfaceConfig.selectors.join(",\n");

    return `
${selectors} {
  background-image: url("${iconUrl}") !important;
  background-repeat: no-repeat !important;
  background-position: center center !important;
  background-size: ${iconSize} ${iconSize} !important;
}
`.trim();
  }

  function getEnabledSurfaceApps(surfaceName, options) {
    return appsApi
      .getAppsWithSurface(surfaceName)
      .filter((app) => settingsApi.appEnabled(app.id, options));
  }

  function buildSurfaceCss(surfaceName, options) {
    return getEnabledSurfaceApps(surfaceName, options)
      .map((app) => buildReplacementRule(app, surfaceName))
      .join("\n\n");
  }

  function buildSidePanelCss(options) {
    return buildSurfaceCss("sidePanel", options);
  }

  function buildAppLauncherCss(options) {
    return buildSurfaceCss("appLauncher", options);
  }

  function buildManagedSurfaceState(options) {
    const cssChunks = [];
    const enabledApps = [];
    const enabledSurfaceEntries = [];
    const seenAppIds = new Set();

    for (const surfaceName of MANAGED_SURFACE_NAMES) {
      const surfaceCss = buildSurfaceCss(surfaceName, options).trim();

      if (surfaceCss) {
        cssChunks.push(surfaceCss);
      }

      for (const app of getEnabledSurfaceApps(surfaceName, options)) {
        enabledSurfaceEntries.push({ app, surfaceName });

        if (seenAppIds.has(app.id)) {
          continue;
        }

        seenAppIds.add(app.id);
        enabledApps.push(app.id);
      }
    }

    return {
      cssText: cssChunks.join("\n\n"),
      enabledApps,
      enabledSurfaceEntries
    };
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

      const { cssText, enabledApps, enabledSurfaceEntries } = buildManagedSurfaceState(context.options);

      if (!cssText.trim()) {
        cleanup("no-enabled-icon-surfaces");
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
        assets: enabledSurfaceEntries.reduce((result, entry) => {
          result[`${entry.surfaceName}:${entry.app.id}`] = runtime.getRuntimeUrl(getSurfaceAssetPath(entry.app, entry.surfaceName));
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
    buildSidePanelCss,
    buildAppLauncherCss
  };

  surfaceRegistry.register(api);

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
