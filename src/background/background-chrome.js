if (typeof importScripts === "function") {
  importScripts(
    "../shared/runtime.js",
    "../shared/apps.js",
    "../shared/settings.js",
    "../platform/chrome/content-script-registry.js",
    "./productlogo-dnr.js",
    "./header-static-css.js",
    "./background-core.js"
  );
}
