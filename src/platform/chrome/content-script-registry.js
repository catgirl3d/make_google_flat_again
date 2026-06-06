(function attachChromeContentScriptRegistry(globalScope) {
  const runtime = globalScope.__MGFA_RUNTIME__ || require("../../shared/runtime.js");
  const registryCore = globalScope.MakeGoogleFlatAgain?.contentScriptRegistryCore || require("../content-script-registry-core.js");

  function getRootApi(extensionApi) {
    if (extensionApi?.scripting || extensionApi?.runtime) {
      return extensionApi;
    }

    return globalScope.chrome || runtime.getExtensionApi() || null;
  }
  const api = registryCore.createContentScriptRegistry({ getRootApi });

  runtime.attach("contentScriptRegistry", api);

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
