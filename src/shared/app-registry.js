(function attachAppRegistry(globalScope) {
  const runtime = globalScope.__MGFA_RUNTIME__ || require("./runtime.js");

  // Google app launcher cards reuse shared obfuscated classes, so product identity has to come from
  // href/data-pid. These data-pid values are taken from the live launcher DOM (`a.tX9u1b[data-pid]`)
  // and should be re-verified in DevTools against the matching href when Google changes launcher markup.
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

  function createProductLogoSurface(selectors, sourceMarker) {
    return {
      selectors: [...selectors],
      sourceMarker
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
      },
      managed: {
        headerStaticCss: {
          scriptId: "mgfa-header-gmail",
          matches: ["https://mail.google.com/*"],
          cssFile: "src/content/styles/header-gmail.css",
          runAt: "document_start"
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
        appLauncher: createAppLauncherSurface("24", "calendar.google.com"),
        productLogo: createProductLogoSurface([
          'img[src*="/images/branding/productlogos/calendar_2026_"]',
          'img[srcset*="/images/branding/productlogos/calendar_2026_"]'
        ], "header-calendar"),
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
      },
      managed: {
        headerStaticCss: {
          scriptId: "mgfa-header-drive",
          matches: ["https://drive.google.com/*"],
          cssFile: "src/content/styles/header-drive.css",
          runAt: "document_start"
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
        favicon: { assetPath: "assets/icons/apps/favicons/docs.ico" },
        appLauncher: createAppLauncherSurface("25", "docs.google.com/document"),
        docsHomescreenMenu: createDocsHomescreenMenuSurface("docs-homescreen-docs-2026-24")
      },
      managed: {
        headerStaticCss: {
          scriptId: "mgfa-header-docs",
          matches: ["https://docs.google.com/document/*"],
          cssFile: "src/content/styles/header-docs.css",
          runAt: "document_start"
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
        favicon: { assetPath: "assets/icons/apps/favicons/sheets.ico" },
        appLauncher: createAppLauncherSurface("283", "docs.google.com/spreadsheets"),
        docsHomescreenMenu: createDocsHomescreenMenuSurface("docs-homescreen-sheets-2026-24")
      },
      managed: {
        headerStaticCss: {
          scriptId: "mgfa-header-sheets",
          matches: ["https://docs.google.com/spreadsheets/*"],
          cssFile: "src/content/styles/header-sheets.css",
          runAt: "document_start"
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
        favicon: { assetPath: "assets/icons/apps/favicons/slides.ico" },
        appLauncher: createAppLauncherSurface("281", "docs.google.com/presentation"),
        docsHomescreenMenu: createDocsHomescreenMenuSurface("docs-homescreen-slides-2026-24")
      },
      managed: {
        headerStaticCss: {
          scriptId: "mgfa-header-slides",
          matches: ["https://docs.google.com/presentation/*"],
          cssFile: "src/content/styles/header-slides.css",
          runAt: "document_start"
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
        favicon: { assetPath: "assets/icons/apps/favicons/forms.ico" },
        appLauncher: createAppLauncherSurface("330", "docs.google.com/forms"),
        docsHomescreenMenu: createDocsHomescreenMenuSurface("docs-homescreen-forms-2026-24")
      },
      managed: {
        headerStaticCss: {
          scriptId: "mgfa-header-forms",
          matches: ["https://docs.google.com/forms/*"],
          cssFile: "src/content/styles/header-forms.css",
          runAt: "document_start"
        }
      }
    },
    {
      id: "vids",
      label: "Google Vids",
      asset: { type: "svg", path: "assets/icons/apps/vids-classic.svg" },
      matches: [{ hostname: "docs.google.com", pathnamePrefixes: ["/videos/"] }],
      urlIncludes: ["docs.google.com/videos"],
      surfaces: {
        favicon: { assetPath: "assets/icons/apps/favicons/vids.ico" },
        appLauncher: createAppLauncherSurface("682", "docs.google.com/videos"),
        docsHomescreenMenu: createDocsHomescreenMenuSurface("docs-homescreen-vids-2026-24")
      },
      managed: {
        headerStaticCss: {
          scriptId: "mgfa-header-vids",
          matches: ["https://docs.google.com/videos/*"],
          cssFile: "src/content/styles/header-vids.css",
          runAt: "document_start"
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
        appLauncher: createAppLauncherSurface("411", "meet.google.com")
      },
      managed: {
        headerStaticCss: {
          scriptId: "mgfa-header-meet",
          matches: ["https://meet.google.com/*"],
          cssFile: "src/content/styles/header-meet.css",
          runAt: "document_start"
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
        appLauncher: createAppLauncherSurface("385", "chat.google.com")
      },
      managed: {
        headerStaticCss: {
          scriptId: "mgfa-header-chat",
          matches: ["https://chat.google.com/*"],
          cssFile: "src/content/styles/header-chat.css",
          runAt: "document_start"
        }
      }
    },
    {
      id: "keep",
      label: "Google Keep",
      asset: { type: "svg", path: "assets/icons/apps/keep-classic.svg" },
      matches: [{ hostname: "keep.google.com", pathnamePrefixes: ["/"] }],
      surfaces: {
        favicon: {
          assetPath: "assets/icons/apps/keep_icon_1.svg"
        },
        appLauncher: createAppLauncherSurface("136", "keep.google.com"),
        sidePanelLoading: {
          assetPath: "assets/icons/apps/keep-classic-square.svg",
          iconSize: 128,
          selectors: [
            '[style*="/companion/icon_assets/logo_keep_"]'
          ]
        },
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
      },
      managed: {
        headerStaticCss: {
          scriptId: "mgfa-header-keep",
          matches: ["https://keep.google.com/*"],
          cssFile: "src/content/styles/header-keep.css",
          runAt: "document_start"
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
        favicon: {},
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
        },
        sidePanelLoading: {
          iconSize: 128,
          selectors: [
            '[style*="/companion/icon_assets/logo_tasks_"]'
          ]
        }
      },
      managed: {
        headerStaticCss: {
          scriptId: "mgfa-header-tasks",
          matches: ["https://tasks.google.com/*"],
          cssFile: "src/content/styles/header-tasks.css",
          runAt: "document_start"
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

  const api = {
    apps
  };

  runtime.attach("appRegistry", api);

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
