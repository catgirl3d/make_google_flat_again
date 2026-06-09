const test = require("node:test");
const assert = require("node:assert/strict");

const RUNTIME_PATH = "../src/shared/runtime.js";
const BUILD_FLAGS_PATH = "../src/shared/build-flags.js";
const LOGO_PROBE_PATH = "../src/content/logo-probe.js";

function resetLogoProbeEnvironment() {
  delete globalThis.MakeGoogleFlatAgain;
  delete globalThis.__MGFA_RUNTIME__;

  delete require.cache[require.resolve(RUNTIME_PATH)];
  delete require.cache[require.resolve(BUILD_FLAGS_PATH)];
  delete require.cache[require.resolve(LOGO_PROBE_PATH)];
}

function loadLogoProbe(buildFlags) {
  resetLogoProbeEnvironment();
  require(RUNTIME_PATH);

  if (buildFlags) {
    globalThis.MakeGoogleFlatAgain.buildFlags = buildFlags;
  }

  return require(LOGO_PROBE_PATH);
}

function createElement({ src = "", srcset = "", replacementSource = "" } = {}) {
  return {
    _replacementSource: replacementSource,
    getAttribute(name) {
      if (name === "src") {
        return src;
      }

      if (name === "srcset") {
        return srcset;
      }

      return "";
    }
  };
}

let logoProbe = null;

test.beforeEach(() => {
  logoProbe = loadLogoProbe();
});

test("getReplacementSource reads the CSS marker from computed styles", () => {
  const element = createElement({ replacementSource: '"header-tasks"' });
  const viewLike = {
    getComputedStyle(target) {
      assert.equal(target, element);
      return {
        getPropertyValue() {
          return target._replacementSource;
        }
      };
    }
  };

  assert.equal(logoProbe.getReplacementSource(element, viewLike), "header-tasks");
});

test("collect reports Tasks logo candidates and replacement matches", () => {
  const element = createElement({
    src: "https://www.gstatic.com/images/branding/productlogos/tasks_2026/v2/web/192px.svg",
    replacementSource: '"header-tasks"'
  });
  const documentLike = {
    querySelectorAll(selector) {
      return selector.includes("tasks_2026") ? [element] : [];
    }
  };
  const viewLike = {
    location: {
      hostname: "tasks.google.com",
      pathname: "/tasks/"
    },
    getComputedStyle(target) {
      return {
        getPropertyValue() {
          return target._replacementSource;
        }
      };
    }
  };

  assert.deepEqual(logoProbe.collect(viewLike, documentLike), {
    hostname: "tasks.google.com",
    pathname: "/tasks/",
    tasksProductlogo: {
      count: 1,
      replacementMatched: true,
      replacementSources: ["header-tasks"],
      sampleSources: [
        {
          src: "https://www.gstatic.com/images/branding/productlogos/tasks_2026/v2/web/192px.svg",
          srcset: ""
        }
      ]
    }
  });
});

test("production build flags disable logo probe collection", () => {
  const prodLogoProbe = loadLogoProbe({ isDevelopment: false });

  assert.equal(prodLogoProbe.collect({ location: { hostname: "tasks.google.com" } }, { querySelectorAll() { return []; } }), null);
});
