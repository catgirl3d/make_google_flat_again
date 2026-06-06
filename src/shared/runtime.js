(function attachRuntime(globalScope) {
  const namespace = globalScope.MakeGoogleFlatAgain || {};
  globalScope.MakeGoogleFlatAgain = namespace;

  function getExtensionApi() {
    return globalScope.browser || globalScope.chrome || null;
  }

  function getRuntimeUrl(path) {
    const extensionApi = getExtensionApi();

    if (!extensionApi?.runtime?.getURL) {
      return path;
    }

    return extensionApi.runtime.getURL(path);
  }

  const runtime = {
    attach(sectionName, value) {
      namespace[sectionName] = value;
      return value;
    },
    get(sectionName) {
      return namespace[sectionName];
    },
    getNamespace() {
      return namespace;
    },
    getExtensionApi,
    getRuntimeUrl
  };

  runtime.attach("runtime", runtime);
  globalScope.__MGFA_RUNTIME__ = runtime;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = runtime;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
