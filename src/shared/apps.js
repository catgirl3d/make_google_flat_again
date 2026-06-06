(function attachApps(globalScope) {
  const runtime = globalScope.__MGFA_RUNTIME__ || require("./runtime.js");

  const apps = [
    {
      id: "gmail",
      label: "Gmail",
      asset: { type: "svg", path: "assets/icons/apps/gmail-classic.svg" },
      matches: [{ hostname: "mail.google.com", pathnamePrefixes: ["/"] }],
      surfaces: {
        favicon: {},
        header: {
          keywords: ["gmail", "mail", "logo_gmail", "gmail_lockup", "mail/rfr"],
          maxLeft: 230,
          maxTop: 95,
          minScore: 30,
          sizeMin: 30,
          sizeMax: 36,
          useExtendedDetection: false
        }
      }
    },
    {
      id: "calendar",
      label: "Google Calendar",
      asset: { type: "calendar-day" },
      matches: [{ hostname: "calendar.google.com", pathnamePrefixes: ["/"] }],
      surfaces: {
        favicon: { hardLock: true },
        header: {
          keywords: ["calendar", "calendari", "calendario", "logo_calendar", "calendar_2020q4"],
          maxLeft: 260,
          maxTop: 100,
          minScore: 20,
          sizeMin: 30,
          sizeMax: 38,
          useExtendedDetection: false
        },
        sidePanel: {
          iconSize: 24,
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
        header: {
          keywords: ["drive", "logo_drive", "drive_2020q4", "drive-product-icon"],
          maxLeft: 240,
          maxTop: 95,
          minScore: 20,
          sizeMin: 30,
          sizeMax: 38,
          useExtendedDetection: false
        }
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
        header: {
          targetSelectors: ["#docs-branding-logo"],
          hideRoots: ["#docs-branding-logo", "#docs-drive-logo"],
          keywords: ["docs", "documents", "documentos", "document", "logo_docs", "docs_2020q4"],
          sizeMin: 24,
          sizeMax: 34,
          maxLeft: 210,
          maxTop: 90,
          minScore: 12,
          coverPadding: 3,
          useExtendedDetection: true,
          forceBrandingSelector: "#docs-branding-logo"
        }
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
        header: {
          targetSelectors: ["#docs-branding-logo"],
          hideRoots: ["#docs-branding-logo", "#docs-drive-logo"],
          keywords: ["sheets", "fulls", "hojas", "spreadsheet", "spreadsheets", "logo_sheets", "sheets_2020q4"],
          sizeMin: 24,
          sizeMax: 34,
          maxLeft: 210,
          maxTop: 90,
          minScore: 12,
          coverPadding: 3,
          useExtendedDetection: true,
          forceBrandingSelector: "#docs-branding-logo"
        }
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
        header: {
          targetSelectors: ["#docs-branding-logo"],
          hideRoots: ["#docs-branding-logo", "#docs-drive-logo"],
          keywords: ["slides", "presentacions", "presentaciones", "presentation", "logo_slides", "slides_2020q4"],
          sizeMin: 24,
          sizeMax: 34,
          maxLeft: 210,
          maxTop: 90,
          minScore: 12,
          coverPadding: 3,
          useExtendedDetection: true,
          forceBrandingSelector: "#docs-branding-logo"
        }
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
        header: {
          keywords: ["forms", "formularis", "formularios", "form", "google forms"],
          maxLeft: 230,
          maxTop: 100,
          minScore: 12,
          sizeMin: 24,
          sizeMax: 36,
          useExtendedDetection: true,
          coverPadding: 3
        }
      }
    },
    {
      id: "meet",
      label: "Google Meet",
      asset: { type: "svg", path: "assets/icons/apps/meet-classic.svg" },
      matches: [{ hostname: "meet.google.com", pathnamePrefixes: ["/"] }],
      surfaces: {
        favicon: {},
        header: {
          keywords: ["meet", "logo_meet", "meet_2020q4"],
          maxLeft: 260,
          maxTop: 110,
          minScore: 18,
          sizeMin: 30,
          sizeMax: 40,
          useExtendedDetection: false
        }
      }
    },
    {
      id: "chat",
      label: "Google Chat",
      asset: { type: "svg", path: "assets/icons/apps/chat-classic.svg" },
      matches: [{ hostname: "chat.google.com", pathnamePrefixes: ["/"] }],
      surfaces: {
        favicon: {},
        header: {
          keywords: ["chat", "xat", "logo_chat", "chat_2020q4"],
          maxLeft: 260,
          maxTop: 110,
          minScore: 18,
          sizeMin: 30,
          sizeMax: 40,
          useExtendedDetection: false
        }
      }
    },
    {
      id: "keep",
      label: "Google Keep",
      asset: { type: "svg", path: "assets/icons/apps/keep-classic.svg" },
      matches: [{ hostname: "keep.google.com", pathnamePrefixes: ["/"] }],
      surfaces: {
        favicon: {},
        header: {
          keywords: ["keep", "notes", "logo_keep", "keep_2020q4"],
          maxLeft: 260,
          maxTop: 110,
          minScore: 18,
          sizeMin: 30,
          sizeMax: 40,
          useExtendedDetection: false
        },
        sidePanel: {
          iconSize: 24,
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
        header: {
          keywords: ["maps", "mapes", "mapas", "google maps", "logo_maps"],
          maxLeft: 300,
          maxTop: 120,
          minScore: 14,
          sizeMin: 30,
          sizeMax: 42,
          useExtendedDetection: false
        },
        sidePanel: {
          iconSize: 24,
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
