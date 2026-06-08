(function attachApps(globalScope) {
  const runtime = globalScope.__MGFA_RUNTIME__ || require("./runtime.js");

  // Launcher cards reuse shared obfuscated classes, so product identity has to come from href/data-pid.
  function buildAppLauncherSelectors(dataPid, hrefIncludes) {
    const hrefSelectorList = (Array.isArray(hrefIncludes) ? hrefIncludes : [hrefIncludes])
      .filter(Boolean)
      .map((hrefPart) => `a.tX9u1b[href*="${hrefPart}"] .CgwTDb .MrEfLc`);

    return hrefSelectorList.concat(`a.tX9u1b[data-pid="${dataPid}"] .CgwTDb .MrEfLc`);
  }

  function createAppLauncherSurface(dataPid, hrefIncludes, iconSize = 40) {
    return {
      iconSize,
      selectors: buildAppLauncherSelectors(dataPid, hrefIncludes)
    };
  }

  function createDocsHomescreenMenuSurface(spriteClassName, iconSize = 24) {
    return {
      iconSize,
      selectors: [`.docs-homescreen-leftmenu .docs-homescreen-img.${spriteClassName}`]
    };
  }

  const apps = [
    {
      id: "gmail",
      label: "Gmail",
      asset: { type: "svg", path: "assets/icons/apps/gmail-classic.svg" },
      matches: [{ hostname: "mail.google.com", pathnamePrefixes: ["/"] }],
      surfaces: {
        favicon: {},
        appLauncher: createAppLauncherSurface("23", "mail.google.com")
      }
    },
    {
      id: "calendar",
      label: "Google Calendar",
      asset: { type: "calendar-day" },
      matches: [{ hostname: "calendar.google.com", pathnamePrefixes: ["/"] }],
      surfaces: {
        favicon: { hardLock: true },
        appLauncher: createAppLauncherSurface("24", "calendar.google.com"),
        sidePanel: {
          iconSize: 20,
          selectors: [
            '.app-switcher-button[data-guest-app-id="6"] .app-switcher-button-icon-container',
            '[data-guest-app-id="6"] .app-switcher-button-icon-container',
            '.app-switcher-button-icon-container[style*="calendar_"]',
            '[style*="/companion/icon_assets/calendar_"]',
            '[style*="calendar_2026_2x"]',
            '.Yb-Il-d-c-j[style*="calendar_"]',
            '.aT5-aOt-I-JX-Jw[style*="calendar_"]'
          ]
        }
      }
    },
    {
      id: "drive",
      label: "Google Drive",
      asset: { type: "svg", path: "assets/icons/apps/drive-classic.svg" },
      matches: [{ hostname: "drive.google.com", pathnamePrefixes: ["/"] }],
      surfaces: {
        favicon: {},
        appLauncher: createAppLauncherSurface("49", "drive.google.com"),
        docsHomescreenMenu: createDocsHomescreenMenuSurface("docs-homescreen-drive-2026-24")
      }
    },
    {
      id: "docs",
      label: "Google Docs",
      asset: { type: "svg", path: "assets/icons/apps/docs-classic.svg" },
      matches: [{ hostname: "docs.google.com", pathnamePrefixes: ["/document/"] }],
      urlIncludes: ["docs.google.com/document"],
      surfaces: {
        favicon: {},
        appLauncher: createAppLauncherSurface("25", "docs.google.com/document"),
        docsHomescreenMenu: createDocsHomescreenMenuSurface("docs-homescreen-docs-2026-24")
      }
    },
    {
      id: "sheets",
      label: "Google Sheets",
      asset: { type: "svg", path: "assets/icons/apps/sheets-classic.svg" },
      matches: [{ hostname: "docs.google.com", pathnamePrefixes: ["/spreadsheets/"] }],
      urlIncludes: ["docs.google.com/spreadsheets"],
      surfaces: {
        favicon: {},
        appLauncher: createAppLauncherSurface("283", "docs.google.com/spreadsheets"),
        docsHomescreenMenu: createDocsHomescreenMenuSurface("docs-homescreen-sheets-2026-24")
      }
    },
    {
      id: "slides",
      label: "Google Slides",
      asset: { type: "svg", path: "assets/icons/apps/slides-classic.svg" },
      matches: [{ hostname: "docs.google.com", pathnamePrefixes: ["/presentation/"] }],
      urlIncludes: ["docs.google.com/presentation"],
      surfaces: {
        favicon: {},
        appLauncher: createAppLauncherSurface("281", "docs.google.com/presentation"),
        docsHomescreenMenu: createDocsHomescreenMenuSurface("docs-homescreen-slides-2026-24")
      }
    },
    {
      id: "forms",
      label: "Google Forms",
      asset: { type: "png", path: "assets/icons/apps/forms-classic.png" },
      matches: [{ hostname: "docs.google.com", pathnamePrefixes: ["/forms/"] }],
      urlIncludes: ["docs.google.com/forms"],
      surfaces: {
        favicon: {},
        appLauncher: createAppLauncherSurface("330", "docs.google.com/forms"),
        docsHomescreenMenu: createDocsHomescreenMenuSurface("docs-homescreen-forms-2026-24")
      }
    },
    {
      id: "vids",
      label: "Google Vids",
      asset: { type: "svg", path: "assets/icons/apps/vids-classic.svg" },
      matches: [{ hostname: "docs.google.com", pathnamePrefixes: ["/videos/"] }],
      urlIncludes: ["docs.google.com/videos"],
      surfaces: {
        appLauncher: createAppLauncherSurface("682", "docs.google.com/videos"),
        docsHomescreenMenu: createDocsHomescreenMenuSurface("docs-homescreen-vids-2026-24")
      }
    },
    {
      id: "meet",
      label: "Google Meet",
      asset: { type: "svg", path: "assets/icons/apps/meet-classic.svg" },
      matches: [{ hostname: "meet.google.com", pathnamePrefixes: ["/"] }],
      surfaces: {
        favicon: {},
        appLauncher: createAppLauncherSurface("411", "meet.google.com")
      }
    },
    {
      id: "chat",
      label: "Google Chat",
      asset: { type: "svg", path: "assets/icons/apps/chat-classic.svg" },
      matches: [{ hostname: "chat.google.com", pathnamePrefixes: ["/"] }],
      surfaces: {
        favicon: {},
        appLauncher: createAppLauncherSurface("385", "chat.google.com")
      }
    },
    {
      id: "keep",
      label: "Google Keep",
      asset: { type: "svg", path: "assets/icons/apps/keep-classic.svg" },
      matches: [{ hostname: "keep.google.com", pathnamePrefixes: ["/"] }],
      surfaces: {
        favicon: {},
        appLauncher: createAppLauncherSurface("136", "keep.google.com"),
        sidePanel: {
          assetPath: "assets/icons/apps/keep-classic-square.svg",
          iconSize: 20,
          selectors: [
            '.app-switcher-button[data-guest-app-id="2"] .app-switcher-button-icon-container',
            '[data-guest-app-id="2"] .app-switcher-button-icon-container',
            '.app-switcher-button-icon-container[style*="keep_"]',
            '[style*="/companion/icon_assets/keep_"]',
            '[style*="keep_2026_2x"]',
            '.Yb-Il-d-c-j[style*="keep_"]',
            '.aT5-aOt-I-JX-Jw[style*="keep_"]'
          ]
        }
      }
    },
    {
      id: "tasks",
      label: "Google Tasks",
      asset: { type: "svg", path: "assets/icons/apps/tasks-classic.svg" },
      matches: [{ hostname: "tasks.google.com", pathnamePrefixes: ["/tasks"] }],
      urlIncludes: ["tasks.google.com/tasks"],
      surfaces: {
        appLauncher: createAppLauncherSurface("39", "tasks.google.com/tasks"),
        sidePanel: {
          iconSize: 20,
          selectors: [
            '.app-switcher-button[data-guest-app-id="4"] .app-switcher-button-icon-container',
            '[data-guest-app-id="4"] .app-switcher-button-icon-container',
            '.app-switcher-button-icon-container[style*="tasks_"]',
            '[style*="/companion/icon_assets/tasks_"]',
            '[style*="tasks_2026_2x"]',
            '.Yb-Il-d-c-j[style*="tasks_"]',
            '.aT5-aOt-I-JX-Jw[style*="tasks_"]'
          ]
        }
      }
    },
    {
      id: "maps",
      label: "Google Maps",
      asset: { type: "png", path: "assets/icons/apps/maps-classic.png" },
      matches: [
        { hostname: "maps.google.com", pathnamePrefixes: ["/"] },
        { hostname: "www.google.com", pathnamePrefixes: ["/maps", "/maps/"] }
      ],
      urlIncludes: ["www.google.com/maps"],
      surfaces: {
        favicon: { hardLock: true },
        appLauncher: createAppLauncherSurface("8", ["maps.google.com", "www.google.com/maps"]),
        sidePanel: {
          iconSize: 20,
          selectors: [
            '.app-switcher-button[data-guest-app-id="8"] .app-switcher-button-icon-container',
            '[data-guest-app-id="8"] .app-switcher-button-icon-container',
            '.app-switcher-button-icon-container[style*="logo_maps"]',
            '[style*="logo_maps_2025"]',
            '[style*="logo_maps"]',
            '.Yb-Il-d-c-j[style*="logo_maps"]',
            '.aT5-aOt-I-JX-Jw[style*="logo_maps"]'
          ]
        }
      }
    }
  ];

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
    buildCalendarAssetPath,
    getAssetPath
  };

  runtime.attach("apps", api);

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
