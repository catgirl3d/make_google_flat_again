if (typeof importScripts === "function") {
  importScripts(
    "../shared/runtime.js",
    "../shared/app-registry.js",
    "../shared/apps.js",
    "../shared/settings.js",
    "../platform/content-script-registry-core.js",
    "../platform/chrome/content-script-registry.js",
    "./header-static-css.js",
    "./background-core.js"
  );
}
