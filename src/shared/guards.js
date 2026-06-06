(function attachGuards(globalScope) {
  const runtime = globalScope.__MGFA_RUNTIME__ || require("./runtime.js");

  const pauseRules = [
    {
      id: "calendar-sensitive-screens",
      label: "Calendar settings/import/export",
      description: "Avoid touching Calendar settings pages and local import/export flows.",
      test(locationLike) {
        const host = locationLike.hostname;
        const href = locationLike.href;
        const path = locationLike.pathname;

        if (host !== "calendar.google.com") {
          return false;
        }

        return (
          path.includes("/settings") ||
          href.includes("settings/export") ||
          href.includes("settings/import") ||
          path.includes("/import") ||
          path.includes("/export")
        );
      }
    },
    {
      id: "docs-drive-picker-and-upload",
      label: "Docs/Drive picker and upload",
      description: "Avoid picker and upload surfaces where Google handles file selection and upload UI.",
      test(locationLike) {
        const host = locationLike.hostname;
        const href = locationLike.href;
        const path = locationLike.pathname;

        if (host !== "docs.google.com" && host !== "drive.google.com") {
          return false;
        }

        return (
          path.includes("/picker") ||
          path.includes("/upload") ||
          href.includes("picker?") ||
          href.includes("filepicker")
        );
      }
    }
  ];

  function normalizeLocation(locationLike) {
    const hostname = String(locationLike?.hostname || "").toLowerCase();
    const pathname = String(locationLike?.pathname || "/").toLowerCase();
    const href = String(locationLike?.href || `${hostname}${pathname}`).toLowerCase();

    return {
      hostname,
      pathname,
      href
    };
  }

  function getPauseRule(locationLike) {
    const normalizedLocation = normalizeLocation(locationLike);
    return pauseRules.find((rule) => rule.test(normalizedLocation)) || null;
  }

  function shouldPauseOnPage(locationLike) {
    return Boolean(getPauseRule(locationLike));
  }

  const api = {
    pauseRules,
    getPauseRule,
    shouldPauseOnPage
  };

  runtime.attach("guards", api);

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
