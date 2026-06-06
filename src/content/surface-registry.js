(function attachSurfaceRegistry(globalScope) {
  const runtime = globalScope.__MGFA_RUNTIME__ || require("../shared/runtime.js");
  const debugApi = globalScope.MakeGoogleFlatAgain?.debugLogger || require("./debug-logger.js");
  const logger = debugApi.create("registry");

  const registeredSurfaces = [];

  function register(surface) {
    if (!surface || typeof surface.name !== "string" || typeof surface.start !== "function") {
      throw new Error("Surface registration requires a name and a start(context) function.");
    }

    if (registeredSurfaces.some((entry) => entry.name === surface.name)) {
      throw new Error(`Surface \"${surface.name}\" is already registered.`);
    }

    registeredSurfaces.push(surface);
    return surface;
  }

  function getSurfaces() {
    return [...registeredSurfaces];
  }

  function startAll(context) {
    logger.snapshot("start-all", {
      optionsEnabled: context?.options?.enabled !== false,
      surfaceNames: registeredSurfaces.map((surface) => surface.name)
    });

    for (const surface of registeredSurfaces) {
      logger.event("surface-start", { surface: surface.name });
      surface.start(context);
    }
  }

  const api = {
    register,
    getSurfaces,
    startAll
  };

  runtime.attach("surfaceRegistry", api);

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
