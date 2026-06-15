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

function createView(hostname, pathname = "/", computedStyleCalls = []) {
  return {
    location: {
      hostname,
      pathname
    },
    getComputedStyle(target) {
      computedStyleCalls.push(target);
      return {
        getPropertyValue(name) {
          assert.equal(name, "--mgfa-logo-source");
          return target._replacementSource;
        }
      };
    }
  };
}

function createProbeDocument(matchesBySelector) {
  const queriedSelectors = [];

  return {
    queriedSelectors,
    querySelectorAll(selector) {
      queriedSelectors.push(selector);
      return matchesBySelector.get(selector) || [];
    }
  };
}

function definitionByKey(key) {
  return logoProbe.PROBE_DEFINITIONS.find((definition) => definition.key === key);
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

test("collect ignores hosts without logo probe definitions", () => {
  let queried = false;

  assert.equal(logoProbe.collect(createView("drive.google.com"), {
    querySelectorAll() {
      queried = true;
      return [];
    }
  }), null);
  assert.equal(queried, false);
});

test("collect reports no-match snapshots for active Gmail probe definitions", () => {
  const documentLike = createProbeDocument(new Map());

  assert.deepEqual(logoProbe.collect(createView("mail.google.com", "/mail/u/0/"), documentLike), {
    hostname: "mail.google.com",
    pathname: "/mail/u/0/",
    gmailHeaderLockup: {
      count: 0,
      replacementMatched: false,
      replacementSources: [],
      sampleSources: []
    },
    gmailLoadingLogo: {
      count: 0,
      replacementMatched: false,
      replacementSources: [],
      sampleSources: []
    }
  });
  assert.deepEqual(documentLike.queriedSelectors, [
    ...definitionByKey("gmailHeaderLockup").selectors,
    ...definitionByKey("gmailLoadingLogo").selectors
  ]);
});

test("collect reports both Gmail probe branches on the same host", () => {
  const headerElement = createElement({
    src: "https://www.gstatic.com/icons/mail/rfr/logo_gmail_lockup_default_1x_r7.png",
    replacementSource: "'header-gmail-lockup'"
  });
  const loadingElement = createElement({
    srcset: "https://ssl.gstatic.com/ui/v1/icons/mail/logo_loading_2x.png 2x",
    replacementSource: '"header-gmail-loading"'
  });
  const matchesBySelector = new Map([
    [definitionByKey("gmailHeaderLockup").selectors[2], [headerElement]],
    [definitionByKey("gmailLoadingLogo").selectors[1], [loadingElement]]
  ]);
  const documentLike = createProbeDocument(matchesBySelector);

  assert.deepEqual(logoProbe.collect(createView("mail.google.com", "/mail/u/0/"), documentLike), {
    hostname: "mail.google.com",
    pathname: "/mail/u/0/",
    gmailHeaderLockup: {
      count: 1,
      replacementMatched: true,
      replacementSources: ["header-gmail-lockup"],
      sampleSources: [
        {
          src: "https://www.gstatic.com/icons/mail/rfr/logo_gmail_lockup_default_1x_r7.png",
          srcset: ""
        }
      ]
    },
    gmailLoadingLogo: {
      count: 1,
      replacementMatched: true,
      replacementSources: ["header-gmail-loading"],
      sampleSources: [
        {
          src: "",
          srcset: "https://ssl.gstatic.com/ui/v1/icons/mail/logo_loading_2x.png 2x"
        }
      ]
    }
  });
  assert.deepEqual(documentLike.queriedSelectors, [
    ...definitionByKey("gmailHeaderLockup").selectors,
    ...definitionByKey("gmailLoadingLogo").selectors
  ]);
});

test("collect reports Tasks logo candidates and normalized replacement markers", () => {
  const element = createElement({
    src: "https://www.gstatic.com/images/branding/productlogos/tasks_2026/v2/web/192px.svg",
    replacementSource: '"header-tasks"'
  });
  const duplicateSelectorElement = createElement({
    srcset: "https://www.gstatic.com/images/branding/productlogos/tasks_2026/v2/web/192px.svg 1x",
    replacementSource: "'header-tasks'"
  });
  const tasksDefinition = definitionByKey("tasksProductlogo");
  const documentLike = createProbeDocument(new Map([
    [tasksDefinition.selectors[0], [element, duplicateSelectorElement]],
    [tasksDefinition.selectors[1], [duplicateSelectorElement]]
  ]));

  assert.deepEqual(logoProbe.collect(createView("tasks.google.com", "/tasks/"), documentLike), {
    hostname: "tasks.google.com",
    pathname: "/tasks/",
    tasksProductlogo: {
      count: 2,
      replacementMatched: true,
      replacementSources: ["header-tasks"],
      sampleSources: [
        {
          src: "https://www.gstatic.com/images/branding/productlogos/tasks_2026/v2/web/192px.svg",
          srcset: ""
        },
        {
          src: "",
          srcset: "https://www.gstatic.com/images/branding/productlogos/tasks_2026/v2/web/192px.svg 1x"
        }
      ]
    }
  });
  assert.deepEqual(documentLike.queriedSelectors, [...tasksDefinition.selectors]);
});

test("production build flags disable logo probe collection", () => {
  const prodLogoProbe = loadLogoProbe({ isDevelopment: false });
  let queried = false;

  assert.equal(prodLogoProbe.collect(createView("tasks.google.com"), {
    querySelectorAll() {
      queried = true;
      return [];
    }
  }), null);
  assert.equal(queried, false);
});
