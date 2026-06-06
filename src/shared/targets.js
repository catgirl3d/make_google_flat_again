(function attachTargets(globalScope) {
  const runtime = globalScope.__MGFA_RUNTIME__ || require("./runtime.js");
  const appsApi = globalScope.MakeGoogleFlatAgain?.apps || require("./apps.js");

  const sharedTargets = [
    {
      id: "docs-shared",
      label: "Docs Shared UI",
      appId: null,
      matches: [{ hostname: "docs.google.com", pathnamePrefixes: ["/"] }],
      stylesheet: ""
    }
  ];

  const appTargets = appsApi.apps.map((app) => ({
    id: app.id,
    label: app.label,
    appId: app.id,
    matches: app.matches,
    stylesheet: ""
  }));

  const targets = [...sharedTargets, ...appTargets];
  const targetsById = Object.fromEntries(targets.map((target) => [target.id, target]));

  function findMatchingTargets(locationLike) {
    return targets.filter((target) => {
      if (target.appId) {
        const app = appsApi.getAppById(target.appId);
        return appsApi.appMatchesLocation(app, locationLike);
      }

      return target.matches.some((rule) => appsApi.locationMatchesRule(locationLike, rule));
    });
  }

  function getTargetById(targetId) {
    return targetsById[targetId] || null;
  }

  const api = {
    targets,
    getTargetById,
    findMatchingTargets
  };

  runtime.attach("targets", api);

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
