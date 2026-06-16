(function attachFaviconSurface(globalScope) {
  const runtime = globalScope.__MGFA_RUNTIME__ || require("../../shared/runtime.js");
  const appsApi = globalScope.MakeGoogleFlatAgain?.apps || require("../../shared/apps.js");
  const debugApi = globalScope.MakeGoogleFlatAgain?.debugLogger || require("../debug-logger.js");
  const settingsApi = globalScope.MakeGoogleFlatAgain?.settings || require("../../shared/settings.js");
  const surfaceRegistry = globalScope.MakeGoogleFlatAgain?.surfaceRegistry || require("../surface-registry.js");
  const logger = debugApi.create("favicon");

  const MANAGED_ICON_SELECTOR = 'link[data-mgfa-favicon="1"]';
  let refreshSurface = () => {};

  function relIsIcon(rel) {
    return /\bicon\b/i.test(String(rel || "")) || /apple-touch-icon|mask-icon/i.test(String(rel || ""));
  }

  function nodeIsIconLink(node) {
    return node?.tagName === "LINK" && relIsIcon(node.rel);
  }

  function mutationTouchesIconLink(record) {
    if (record.type === "attributes") {
      return record.target?.tagName === "LINK" && (record.attributeName === "rel" || relIsIcon(record.target.rel));
    }

    if (record.type !== "childList") {
      return false;
    }

    return Array.from(record.addedNodes || []).some(nodeIsIconLink)
      || Array.from(record.removedNodes || []).some(nodeIsIconLink);
  }

  function getFaviconAssetPath(app, options) {
    return app?.surfaces?.favicon?.assetPath || appsApi.getAssetPath(app, options);
  }

  function getAppIconUrl(app, options) {
    return runtime.getRuntimeUrl(getFaviconAssetPath(app, options));
  }

  function getAppMimeType(app, options) {
    const assetPath = String(getFaviconAssetPath(app, options) || "").toLowerCase();

    if (assetPath.endsWith(".png")) {
      return "image/png";
    }

    if (assetPath.endsWith(".ico")) {
      return "image/x-icon";
    }

    if (assetPath.endsWith(".webp")) {
      return "image/webp";
    }

    return "image/svg+xml";
  }

  function createManagedLink(rel, href, type, appId) {
    const link = document.createElement("link");
    link.dataset.mgfaFavicon = "1";
    link.dataset.mgfaFaviconApp = appId;
    link.rel = rel;
    link.href = href;
    link.type = type;
    return link;
  }

  function scheduleNextMidnight(callback) {
    const now = new Date();
    const next = new Date(now);
    next.setHours(24, 0, 5, 0);
    return window.setTimeout(callback, Math.max(1000, next.getTime() - now.getTime()));
  }

  function shouldKeepObserverActive({ app, hasHead }) {
    return Boolean(app) && Boolean(hasHead);
  }

  function start(context) {
    let originalIcons = null;
    let observer = null;
    let scheduled = false;
    let applying = false;
    let midnightTimer = null;

    function getCurrentApp() {
      const app = appsApi.findPrimaryApp(window.location);

      if (!app) {
        return null;
      }

      if (!app.surfaces?.favicon) {
        return null;
      }

      if (!settingsApi.appEnabled(app.id, context.options)) {
        return null;
      }

      return app;
    }

    function captureOriginalIcons() {
      if (originalIcons !== null || !document.head) {
        return;
      }

      originalIcons = Array.from(document.querySelectorAll("link"))
        .filter((element) => relIsIcon(element.rel) && element.dataset.mgfaFavicon !== "1")
        .map((element) => ({
          rel: element.getAttribute("rel") || "icon",
          href: element.getAttribute("href") || "",
          type: element.getAttribute("type") || "",
          sizes: element.getAttribute("sizes") || "",
          color: element.getAttribute("color") || ""
        }))
        .filter((item) => item.href);

      logger.snapshot("original-icons", {
        captured: originalIcons.length,
        hrefs: originalIcons.map((item) => item.href)
      });
    }

    function restoreOriginalIconsIfNeeded() {
      if (!document.head || !originalIcons?.length) {
        return;
      }

      const hasAnyIcon = Array.from(document.querySelectorAll("link")).some((element) => relIsIcon(element.rel));

      if (hasAnyIcon) {
        return;
      }

      for (const item of originalIcons) {
        const link = document.createElement("link");
        link.rel = item.rel;
        link.href = item.href;
        if (item.type) link.type = item.type;
        if (item.sizes) link.setAttribute("sizes", item.sizes);
        if (item.color) link.setAttribute("color", item.color);
        document.head.appendChild(link);
      }
    }

    function cleanup(reason) {
      logger.snapshot("cleanup", {
        managedIcons: document.querySelectorAll(MANAGED_ICON_SELECTOR).length,
        reason: reason || "unspecified",
        restoredOriginalIcons: Boolean(originalIcons?.length)
      });
      stopObserver();
      document.querySelectorAll(MANAGED_ICON_SELECTOR).forEach((element) => element.remove());
      document.documentElement?.removeAttribute("data-mgfa-favicon-app");
      restoreOriginalIconsIfNeeded();

      if (midnightTimer) {
        clearTimeout(midnightTimer);
        midnightTimer = null;
      }
    }

    function scheduleMidnightRefresh(app) {
      if (app.id !== "calendar") {
        if (midnightTimer) {
          clearTimeout(midnightTimer);
          midnightTimer = null;
        }
        return;
      }

      if (midnightTimer) {
        clearTimeout(midnightTimer);
      }

      midnightTimer = scheduleNextMidnight(() => {
        apply();
      });
    }

    function apply() {
      const app = getCurrentApp();
      const hasHead = Boolean(document.head);

      if (!shouldKeepObserverActive({ app, hasHead })) {
        cleanup(!hasHead ? "missing-head" : "no-app");
        return;
      }

      startObserver();

      captureOriginalIcons();

      const href = getAppIconUrl(app, context.options);
      const type = getAppMimeType(app, context.options);
      const hardLock = Boolean(app.surfaces.favicon.hardLock);

      logger.snapshot("apply-input", {
        appId: app.id,
        hardLock,
        href,
        managedIcons: document.querySelectorAll(MANAGED_ICON_SELECTOR).length,
        readyState: document.readyState,
        type
      });

      applying = true;

      try {
        if (hardLock) {
          Array.from(document.querySelectorAll("link"))
            .filter((element) => relIsIcon(element.rel) && element.dataset.mgfaFavicon !== "1")
            .forEach((element) => element.remove());
        }

        let primary = document.querySelector(`${MANAGED_ICON_SELECTOR}[data-mgfa-favicon-role="primary"]`);
        if (!primary) {
          primary = createManagedLink("icon", href, type, app.id);
          primary.dataset.mgfaFaviconRole = "primary";
          primary.setAttribute("sizes", "any");
        }

        primary.rel = "icon";
        primary.href = href;
        primary.type = type;
        primary.setAttribute("sizes", "any");

        let shortcut = document.querySelector(`${MANAGED_ICON_SELECTOR}[data-mgfa-favicon-role="shortcut"]`);
        if (!shortcut) {
          shortcut = createManagedLink("shortcut icon", href, type, app.id);
          shortcut.dataset.mgfaFaviconRole = "shortcut";
        }

        shortcut.rel = "shortcut icon";
        shortcut.href = href;
        shortcut.type = type;

        document.head.appendChild(primary);
        document.head.appendChild(shortcut);
        document.documentElement?.setAttribute("data-mgfa-favicon-app", app.id);
        logger.snapshot("applied", {
          appId: app.id,
          hardLock,
          href,
          managedIcons: document.querySelectorAll(MANAGED_ICON_SELECTOR).length,
          primaryHref: primary.href,
          shortcutHref: shortcut.href,
          type
        });
        scheduleMidnightRefresh(app);
      } finally {
        window.setTimeout(() => {
          applying = false;
        }, 0);
      }
    }

    function ensureHeadAndApply() {
      if (document.head) {
        apply();
        return;
      }

      window.requestAnimationFrame(ensureHeadAndApply);
    }

    function schedule(delay = 60) {
      if (scheduled) {
        return;
      }

      scheduled = true;
      window.setTimeout(() => {
        scheduled = false;
        ensureHeadAndApply();
      }, delay);
    }

    refreshSurface = () => schedule(60);

    function startObserver() {
      if (observer || !document.head) {
        return;
      }

      observer = new MutationObserver((records) => {
        if (applying) {
          return;
        }

        if (records.some(mutationTouchesIconLink)) {
          ensureHeadAndApply();
          return;
        }

        schedule(50);
      });

      observer.observe(document.head, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["href", "rel", "type", "sizes"]
      });
    }

    function stopObserver() {
      if (!observer) {
        return;
      }

      observer.disconnect();
      observer = null;
    }

    logger.event("surface-started", { readyState: document.readyState });
    ensureHeadAndApply();

    if (document.readyState === "loading") {
      document.addEventListener(
        "DOMContentLoaded",
        () => {
          ensureHeadAndApply();
        },
        { once: true }
      );
    }

    window.addEventListener("focus", () => schedule(60), { passive: true });
    window.addEventListener("popstate", () => schedule(60), { passive: true });
    window.addEventListener("hashchange", () => schedule(60), { passive: true });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        schedule(60);
      }
    }, { passive: true });
  }

  function refresh() {
    refreshSurface();
  }

  const api = {
    name: "favicon",
    start,
    refresh,
    relIsIcon,
    getFaviconAssetPath,
    getAppMimeType,
    shouldKeepObserverActive
  };

  surfaceRegistry.register(api);

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
