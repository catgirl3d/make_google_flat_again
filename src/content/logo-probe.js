(function attachLogoProbe(globalScope) {
  const runtime = globalScope.__MGFA_RUNTIME__ || require("../shared/runtime.js");

  const PROBE_DEFINITIONS = Object.freeze([
    Object.freeze({
      key: "gmailHeaderLockup",
      hosts: Object.freeze(["mail.google.com"]),
      selectors: Object.freeze([
        'a[href="#inbox"] > img[src*="logo_gmail_lockup_default_"]',
        'a[href="#inbox"] > img[srcset*="logo_gmail_lockup_default_"]',
        'img[src*="/icons/mail/rfr/logo_gmail_lockup_default_"]',
        'img[srcset*="/icons/mail/rfr/logo_gmail_lockup_default_"]'
      ])
    }),
    Object.freeze({
      key: "gmailLoadingLogo",
      hosts: Object.freeze(["mail.google.com"]),
      selectors: Object.freeze([
        '#loading img[src*="/icons/mail/logo_loading"]',
        '#loading img[srcset*="/icons/mail/logo_loading"]'
      ])
    }),
    Object.freeze({
      key: "tasksProductlogo",
      hosts: Object.freeze(["tasks.google.com"]),
      selectors: Object.freeze([
        'img[src*="/images/branding/productlogos/tasks_2026/"]',
        'img[srcset*="/images/branding/productlogos/tasks_2026/"]'
      ])
    })
  ]);

  function getReplacementSource(element, viewLike) {
    if (!element || typeof viewLike?.getComputedStyle !== "function") {
      return "";
    }

    return String(viewLike.getComputedStyle(element).getPropertyValue("--mgfa-logo-source") || "")
      .trim()
      .replace(/^['"]|['"]$/g, "");
  }

  function getProbeElements(documentLike, selectors) {
    const elements = new Map();

    for (const selector of selectors) {
      for (const element of documentLike.querySelectorAll(selector)) {
        elements.set(element, element);
      }
    }

    return [...elements.values()];
  }

  function summarizeProbe(documentLike, viewLike, definition) {
    const elements = getProbeElements(documentLike, definition.selectors);
    const replacementSources = [...new Set(elements.map((element) => getReplacementSource(element, viewLike)).filter(Boolean))];

    return {
      count: elements.length,
      replacementMatched: replacementSources.length > 0,
      replacementSources,
      sampleSources: elements.slice(0, 2).map((element) => ({
        src: element.getAttribute?.("src") || "",
        srcset: element.getAttribute?.("srcset") || ""
      }))
    };
  }

  function collect(viewLike, documentLike) {
    if (typeof documentLike?.querySelectorAll !== "function") {
      return null;
    }

    const hostname = String(viewLike?.location?.hostname || "");
    const pathname = String(viewLike?.location?.pathname || "/");
    const activeDefinitions = PROBE_DEFINITIONS.filter((definition) => definition.hosts.includes(hostname));

    if (activeDefinitions.length === 0) {
      return null;
    }

    return activeDefinitions.reduce((result, definition) => {
      result.hostname = hostname;
      result.pathname = pathname;
      result[definition.key] = summarizeProbe(documentLike, viewLike, definition);
      return result;
    }, {});
  }

  const api = {
    PROBE_DEFINITIONS,
    getReplacementSource,
    collect
  };

  runtime.attach("logoProbe", api);

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
