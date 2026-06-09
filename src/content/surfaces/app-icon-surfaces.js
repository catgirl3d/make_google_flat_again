(function attachAppIconSurfaces(globalScope) {
  const runtime = globalScope.__MGFA_RUNTIME__ || require("../../shared/runtime.js");
  const appsApi = globalScope.MakeGoogleFlatAgain?.apps || require("../../shared/apps.js");
  const debugApi = globalScope.MakeGoogleFlatAgain?.debugLogger || require("../debug-logger.js");
  const settingsApi = globalScope.MakeGoogleFlatAgain?.settings || require("../../shared/settings.js");
  const surfaceRegistry = globalScope.MakeGoogleFlatAgain?.surfaceRegistry || require("../surface-registry.js");
  const logger = debugApi.create("app-icon-surfaces");

  const STYLE_ID = "mgfa-app-icon-surfaces-style";
  const ATTR_NAME = "data-mgfa-app-icon-surfaces";
  // These selectors share one style element and refresh cycle, so they stay in one runtime surface.
  const APP_ICON_SURFACE_NAMES = ["sidePanel", "sidePanelLoading", "appLauncher", "docsHomescreenMenu", "productLogo"];
  let refreshSurface = () => {};

  function escapeCssUrl(url) {
    return String(url).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  function getSurfaceAssetPath(app, surfaceName, options) {
    return app.surfaces[surfaceName]?.assetPath || appsApi.getAssetPath(app, options);
  }

  function buildReplacementRule(app, surfaceName, options) {
    const surfaceConfig = app.surfaces[surfaceName];
    const iconUrl = escapeCssUrl(runtime.getRuntimeUrl(getSurfaceAssetPath(app, surfaceName, options)));
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

  function buildDocsHomescreenMenuRule(app, surfaceName, options) {
    const surfaceConfig = app.surfaces.docsHomescreenMenu;
    const iconUrl = escapeCssUrl(runtime.getRuntimeUrl(getSurfaceAssetPath(app, "docsHomescreenMenu", options)));
    const iconSize = `${surfaceConfig.iconSize || 24}px`;
    const selectors = surfaceConfig.selectors.join(",\n");
    const beforeSelectors = surfaceConfig.selectors
      .map((selector) => `${selector}::before`)
      .join(",\n");

    return `
${selectors} {
  background-image: url("${iconUrl}") !important;
  background-repeat: no-repeat !important;
  background-position: center center !important;
  background-size: ${iconSize} ${iconSize} !important;
  display: block !important;
  width: ${iconSize} !important;
  height: ${iconSize} !important;
  left: 0 !important;
  top: 0 !important;
}

${beforeSelectors} {
  content: "" !important;
}
`.trim();
  }

  function buildProductLogoRule(app, surfaceName, options) {
    const surfaceConfig = app.surfaces[surfaceName];
    const iconUrl = escapeCssUrl(runtime.getRuntimeUrl(getSurfaceAssetPath(app, surfaceName, options)));
    const selectors = surfaceConfig.selectors.join(",\n");
    const sourceMarker = surfaceConfig.sourceMarker
      ? `  --mgfa-logo-source: "${surfaceConfig.sourceMarker}" !important;\n`
      : "";

    return `
${selectors} {
${sourceMarker}  content: url("${iconUrl}") !important;
}
`.trim();
  }

  function getEnabledSurfaceApps(surfaceName, options) {
    return appsApi
      .getAppsWithSurface(surfaceName)
      .filter((app) => settingsApi.appEnabled(app.id, options));
  }

  function buildSurfaceCss(surfaceName, options) {
    const ruleBuilder = {
      docsHomescreenMenu: buildDocsHomescreenMenuRule,
      productLogo: buildProductLogoRule
    }[surfaceName] || buildReplacementRule;

    return getEnabledSurfaceApps(surfaceName, options)
      .map((app) => ruleBuilder(app, surfaceName, options))
      .join("\n\n");
  }

  function buildSidePanelCss(options) {
    return buildSurfaceCss("sidePanel", options);
  }

  function buildSidePanelLoadingCss(options) {
    return buildSurfaceCss("sidePanelLoading", options);
  }

  function buildAppLauncherCss(options) {
    return buildSurfaceCss("appLauncher", options);
  }

  function buildDocsHomescreenMenuCss(options) {
    return buildSurfaceCss("docsHomescreenMenu", options);
  }

  function buildProductLogoCss(options) {
    return buildSurfaceCss("productLogo", options);
  }

  function buildManagedSurfaceState(options) {
    const cssChunks = [];
    const enabledApps = [];
    const enabledSurfaceEntries = [];
    const seenAppIds = new Set();

    for (const surfaceName of APP_ICON_SURFACE_NAMES) {
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
      if (!document.documentElement) {
        cleanup("missing-root");
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
          result[`${entry.surfaceName}:${entry.app.id}`] = runtime.getRuntimeUrl(
            getSurfaceAssetPath(entry.app, entry.surfaceName, context.options)
          );
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

    refreshSurface = () => apply();

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

  function refresh() {
    refreshSurface();
  }

  const api = {
    name: "app-icon-surfaces",
    start,
    refresh,
    escapeCssUrl,
    buildSidePanelCss,
    buildSidePanelLoadingCss,
    buildAppLauncherCss,
    buildDocsHomescreenMenuCss,
    buildProductLogoCss
  };

  surfaceRegistry.register(api);

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
