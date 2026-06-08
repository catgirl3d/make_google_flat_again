(function attachApps(globalScope) {
  const runtime = globalScope.__MGFA_RUNTIME__ || require("./runtime.js");
  const registryApi = globalScope.MakeGoogleFlatAgain?.appRegistry || require("./app-registry.js");

  const apps = registryApi.apps;
  const appsById = Object.fromEntries(apps.map((app) => [app.id, app]));

  function pathnameMatches(pathname, pathnamePrefixes) {
    if (!Array.isArray(pathnamePrefixes) || pathnamePrefixes.length === 0) {
      return true;
    }

    return pathnamePrefixes.some((prefix) => pathname.startsWith(prefix));
  }

  function locationMatchesRule(locationLike, rule) {
    if (!locationLike || !rule) {
      return false;
    }

    if (rule.hostname && (locationLike.hostname || "") !== rule.hostname) {
      return false;
    }

    if (Array.isArray(rule.hrefIncludes) && rule.hrefIncludes.length > 0) {
      const href = String(locationLike.href || `${locationLike.hostname || ""}${locationLike.pathname || "/"}`);
      return rule.hrefIncludes.some((part) => href.includes(part));
    }

    return pathnameMatches(locationLike.pathname || "/", rule.pathnamePrefixes);
  }

  function appMatchesLocation(app, locationLike) {
    if (!app || !locationLike) {
      return false;
    }

    if (app.matches.some((rule) => locationMatchesRule(locationLike, rule))) {
      return true;
    }

    if (Array.isArray(app.urlIncludes) && app.urlIncludes.length > 0) {
      const href = String(locationLike.href || `${locationLike.hostname || ""}${locationLike.pathname || "/"}`);
      return app.urlIncludes.some((part) => href.includes(part));
    }

    return false;
  }

  function findMatchingApps(locationLike) {
    return apps.filter((app) => {
      return appMatchesLocation(app, locationLike);
    });
  }

  function findPrimaryApp(locationLike) {
    return findMatchingApps(locationLike)[0] || null;
  }

  function getAppById(appId) {
    return appsById[appId] || null;
  }

  function getAppsWithSurface(surfaceName) {
    return apps.filter((app) => Boolean(app.surfaces?.[surfaceName]));
  }

  function getAppsWithManagedFeature(featureName) {
    return apps.filter((app) => Boolean(app.managed?.[featureName]));
  }

  function normalizeDayNumber(dayNumber) {
    const parsed = Number.parseInt(dayNumber, 10);

    if (Number.isNaN(parsed)) {
      return new Date().getDate();
    }

    return Math.min(31, Math.max(1, parsed));
  }

  function buildCalendarAssetPath(dayNumber) {
    const normalizedDay = String(normalizeDayNumber(dayNumber)).padStart(2, "0");
    return `assets/icons/calendar/calendar-${normalizedDay}.webp`;
  }

  function getAssetPath(appOrId, options) {
    const app = typeof appOrId === "string" ? getAppById(appOrId) : appOrId;

    if (!app) {
      return null;
    }

    if (app.asset.type === "calendar-day") {
      return buildCalendarAssetPath(options?.dayNumber);
    }

    return app.asset.path;
  }

  const api = {
    apps,
    pathnameMatches,
    locationMatchesRule,
    appMatchesLocation,
    findMatchingApps,
    findPrimaryApp,
    getAppById,
    getAppsWithSurface,
    getAppsWithManagedFeature,
    buildCalendarAssetPath,
    getAssetPath
  };

  runtime.attach("apps", api);

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
