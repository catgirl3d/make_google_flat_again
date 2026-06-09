(function attachBuildFlags(globalScope) {
  const runtime = globalScope.__MGFA_RUNTIME__ || require("./runtime.js");
  const DEFAULT_IS_DEVELOPMENT = true;
  const existingFlags = globalScope.MakeGoogleFlatAgain?.buildFlags;
  const isDevelopment = typeof existingFlags?.isDevelopment === "boolean"
    ? existingFlags.isDevelopment
    : DEFAULT_IS_DEVELOPMENT;

  const api = Object.freeze({
    isDevelopment
  });

  runtime.attach("buildFlags", api);

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
