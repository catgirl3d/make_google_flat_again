const test = require("node:test");
const assert = require("node:assert/strict");

const {
  escapeCssUrl,
  buildSidePanelCss,
  buildAppLauncherCss,
  buildDocsHomescreenMenuCss
} = require("../src/content/surfaces/app-icon-surfaces.js");

test("escapeCssUrl escapes quotes and slashes", () => {
  assert.equal(escapeCssUrl('foo\\bar"baz'), 'foo\\\\bar\\"baz', "Should escape backslashes and double quotes");
});

test("buildSidePanelCss includes enabled side panel apps only", () => {
  const css = buildSidePanelCss({
    enabled: true,
    apps: {
      calendar: true,
      keep: true,
      tasks: true,
      maps: true
    }
  });

  assert.ok(css.includes('data-guest-app-id="6"'), "Should include Calendar side panel surface");
  assert.ok(css.includes('data-guest-app-id="4"'), "Should include Tasks side panel surface");
  assert.ok(css.includes('data-guest-app-id="8"'), "Should include Maps side panel surface");
  assert.ok(css.includes('data-guest-app-id="2"'), "Should include Keep side panel surface");
  assert.ok(css.includes("keep-classic-square.svg"), "Should use square SVG asset for Keep side panel");
  assert.ok(css.includes('data-guest-app-id="2"] .app-switcher-button-icon-container'), "Should include Keep icon container selector");
  assert.ok(css.includes('[style*="tasks_2026_2x"]'), "Should include Tasks 2026 selector pattern");
});

test("buildSidePanelCss returns empty string if disabled globally", () => {
  const css = buildSidePanelCss({
    enabled: false,
    apps: {
      calendar: true,
      keep: true,
      tasks: true,
      maps: true
    }
  });

  assert.equal(css.trim(), "", "Should return empty CSS if not enabled globally");
});

test("buildAppLauncherCss includes launcher-grid selectors for enabled apps only", () => {
  const css = buildAppLauncherCss({
    enabled: true,
    apps: {
      docs: false,
      keep: false
    }
  });

  assert.ok(css.includes('a.tX9u1b[data-pid="49"] .CgwTDb .MrEfLc'), "Should include Drive launcher selectors");
  assert.ok(css.includes('a.tX9u1b[data-pid="385"] .CgwTDb .MrEfLc'), "Should include Chat launcher selectors");
  assert.ok(css.includes('a.tX9u1b[data-pid="682"] .CgwTDb .MrEfLc'), "Should include Vids launcher selectors");
  assert.ok(css.includes('a.tX9u1b[data-pid="39"] .CgwTDb .MrEfLc'), "Should include Tasks launcher selectors");
  assert.ok(css.includes("background-size: 40px 40px !important;"), "Should apply standard 40px launcher icon size");
  assert.ok(!css.includes('a.tX9u1b[data-pid="25"] .CgwTDb .MrEfLc'), "Should omit Docs launcher selectors since Docs is disabled");
  assert.ok(!css.includes('a.tX9u1b[data-pid="136"] .CgwTDb .MrEfLc'), "Should omit Keep launcher selectors since Keep is disabled");
});

test("buildAppLauncherCss returns empty string if disabled globally", () => {
  const css = buildAppLauncherCss({
    enabled: false,
    apps: {
      docs: true,
      keep: true
    }
  });

  assert.equal(css.trim(), "", "Should return empty CSS if not enabled globally");
});

test("buildDocsHomescreenMenuCss replaces left-menu sprite icons via element backgrounds", () => {
  const css = buildDocsHomescreenMenuCss({
    enabled: true,
    apps: {
      drive: true,
      docs: true,
      sheets: true,
      slides: false,
      forms: true,
      vids: true
    }
  });

  assert.ok(css.includes('.docs-homescreen-leftmenu .docs-homescreen-img.docs-homescreen-docs-2026-24'), "Should replace Docs sprite icon");
  assert.ok(css.includes('.docs-homescreen-leftmenu .docs-homescreen-img.docs-homescreen-drive-2026-24'), "Should replace Drive sprite icon");
  assert.ok(css.includes('.docs-homescreen-leftmenu .docs-homescreen-img.docs-homescreen-forms-2026-24'), "Should replace Forms sprite icon");
  assert.ok(!css.includes('.docs-homescreen-leftmenu .docs-homescreen-img.docs-homescreen-slides-2026-24'), "Should omit Slides menu icon since Slides is disabled");
  assert.ok(css.includes('::before'), "Should insert content via ::before psuedo-elements");
  assert.ok(css.includes('content: "" !important;'), "Should clear default icon sprite content");
  assert.ok(css.includes('background-size: 24px 24px !important;'), "Should size replacement backgrounds to 24px");
  assert.ok(css.includes('left: 0 !important;'), "Should position replacement icons at left 0");
  assert.ok(css.includes('top: 0 !important;'), "Should position replacement icons at top 0");
});

test("buildDocsHomescreenMenuCss returns empty string if disabled globally", () => {
  const css = buildDocsHomescreenMenuCss({
    enabled: false,
    apps: {
      drive: true,
      docs: true
    }
  });

  assert.equal(css.trim(), "", "Should return empty CSS if not enabled globally");
});
