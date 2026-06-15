const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { stageExtension } = require("../scripts/package-extension.js");
const { buildManifest } = require("../scripts/build-manifest.js");
const { parseArgs } = require("../scripts/stage-extension.js");

const TEST_DIST_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "mgfa-stage-extension-"));
const FIREFOX_STAGE_DIR = path.join(TEST_DIST_DIR, "firefox-package");
const CHROME_STAGE_DIR = path.join(TEST_DIST_DIR, "chrome-package");
const SOURCE_HEADER_STYLES_DIR = path.join(__dirname, "..", "src", "content", "styles");
const HEADER_STYLE_FILE_PATTERN = /^header-.*\.css$/;

function removePath(targetPath) {
  fs.rmSync(targetPath, { recursive: true, force: true });
}

function assertExists(targetPath) {
  assert.equal(fs.existsSync(targetPath), true, `${targetPath} should exist`);
}

function assertMissing(targetPath) {
  assert.equal(fs.existsSync(targetPath), false, `${targetPath} should not exist`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function assertBuildFlag(stageDir, expectedValue) {
  const buildFlags = fs.readFileSync(path.join(stageDir, "src", "shared", "build-flags.js"), "utf8");

  assert.equal(buildFlags.includes(`const DEFAULT_IS_DEVELOPMENT = ${expectedValue};`), true);
}

function readStageFile(stageDir, relativePath) {
  return fs.readFileSync(path.join(stageDir, relativePath), "utf8");
}

function getHeaderStyleFileNames() {
  return fs.readdirSync(SOURCE_HEADER_STYLES_DIR)
    .filter((fileName) => HEADER_STYLE_FILE_PATTERN.test(fileName))
    .sort();
}

function readSourceHeaderCss(fileName) {
  return fs.readFileSync(path.join(SOURCE_HEADER_STYLES_DIR, fileName), "utf8");
}

function assertCommonStageContract(result, { target, mode, stageDir }) {
  const manifestPath = path.join(stageDir, "manifest.json");
  const manifest = readJson(manifestPath);

  assert.equal(result.stageDir, stageDir);
  assert.equal(path.dirname(result.stageDir), TEST_DIST_DIR);
  assert.equal(result.mode, mode);
  assert.deepEqual(result.manifest, buildManifest(target));
  assert.deepEqual(manifest, result.manifest);
  assertExists(path.join(stageDir, "assets", "extension", "icon-16.png"));
  assertExists(path.join(stageDir, "assets", "icons", "apps", "gmail-classic.svg"));
  assertExists(path.join(stageDir, "src", "content", "main.js"));
  assertExists(path.join(stageDir, "src", "shared", "runtime.js"));
}

test("stageExtension prepares clean target-specific Firefox and Chrome stages", () => {
  for (const targetPath of [FIREFOX_STAGE_DIR, CHROME_STAGE_DIR]) {
    removePath(targetPath);
  }

  try {
    assert.throws(() => stageExtension({ target: "chrome", mode: "staging", distDir: TEST_DIST_DIR }), /Unsupported build mode/);

    fs.mkdirSync(path.join(CHROME_STAGE_DIR, "stale-dir"), { recursive: true });
    fs.writeFileSync(path.join(CHROME_STAGE_DIR, "stale-dir", "old-file.txt"), "stale", "utf8");

    const chromeResult = stageExtension({ target: "chrome", mode: "dev", distDir: TEST_DIST_DIR });

    assertCommonStageContract(chromeResult, { target: "chrome", mode: "dev", stageDir: CHROME_STAGE_DIR });
    assertBuildFlag(CHROME_STAGE_DIR, "true");
    assertMissing(path.join(CHROME_STAGE_DIR, "stale-dir", "old-file.txt"));
    assertMissing(path.join(CHROME_STAGE_DIR, "src", "platform", "firefox"));
    assertExists(path.join(CHROME_STAGE_DIR, "src", "platform", "chrome", "content-script-registry.js"));
    assertExists(path.join(CHROME_STAGE_DIR, "src", "background", "background-chrome.js"));

    fs.mkdirSync(path.join(FIREFOX_STAGE_DIR, "stale-dir"), { recursive: true });
    fs.writeFileSync(path.join(FIREFOX_STAGE_DIR, "stale-dir", "old-file.txt"), "stale", "utf8");

    const firefoxResult = stageExtension({ target: "firefox", mode: "prod", distDir: TEST_DIST_DIR });

    assertCommonStageContract(firefoxResult, { target: "firefox", mode: "prod", stageDir: FIREFOX_STAGE_DIR });
    assertBuildFlag(FIREFOX_STAGE_DIR, "false");
    assertMissing(path.join(FIREFOX_STAGE_DIR, "stale-dir", "old-file.txt"));
    assertMissing(path.join(FIREFOX_STAGE_DIR, "src", "platform", "chrome"));
    assertMissing(path.join(FIREFOX_STAGE_DIR, "src", "background", "background-chrome.js"));
    assertExists(path.join(FIREFOX_STAGE_DIR, "src", "platform", "firefox", "content-script-registry.js"));
    assertExists(path.join(FIREFOX_STAGE_DIR, "src", "background", "background-core.js"));
  } finally {
    removePath(TEST_DIST_DIR);
  }
});

test("stageExtension keeps source header CSS intact for Firefox and removes relative app asset paths from every Chrome header stylesheet", () => {
  for (const targetPath of [FIREFOX_STAGE_DIR, CHROME_STAGE_DIR]) {
    removePath(targetPath);
  }

  try {
    stageExtension({ target: "chrome", mode: "dev", distDir: TEST_DIST_DIR });
    stageExtension({ target: "firefox", mode: "dev", distDir: TEST_DIST_DIR });

    const headerStyleFileNames = getHeaderStyleFileNames();
    let sawSvgDataUrl = false;
    let sawPngDataUrl = false;

    for (const fileName of headerStyleFileNames) {
      const sourceCss = readSourceHeaderCss(fileName);
      const chromeCss = readStageFile(CHROME_STAGE_DIR, path.join("src", "content", "styles", fileName));
      const firefoxCss = readStageFile(FIREFOX_STAGE_DIR, path.join("src", "content", "styles", fileName));

      assert.equal(sourceCss.includes("../../../assets/icons/apps/"), true, `${fileName} source CSS should keep SSOT asset paths`);
      assert.equal(firefoxCss, sourceCss, `${fileName} Firefox stage should keep source CSS unchanged`);
      assert.equal(chromeCss.includes("../../../assets/icons/apps/"), false, `${fileName} Chrome stage should not keep relative app asset paths`);

      if (chromeCss.includes("data:image/svg+xml;base64,")) {
        sawSvgDataUrl = true;
      }

      if (chromeCss.includes("data:image/png;base64,")) {
        sawPngDataUrl = true;
      }
    }

    assert.equal(sawSvgDataUrl, true, "Chrome stage should inline at least one SVG header asset");
    assert.equal(sawPngDataUrl, true, "Chrome stage should inline at least one PNG header asset");
  } finally {
    removePath(TEST_DIST_DIR);
  }
});

test("stage-extension CLI parseArgs requires target and mode", () => {
  assert.deepEqual(parseArgs(["firefox", "prod"]), { target: "firefox", mode: "prod" });
  assert.deepEqual(parseArgs(["chrome", "dev"]), { target: "chrome", mode: "dev" });
  assert.throws(() => parseArgs(["firefox"]), /Usage: node scripts\/stage-extension\.js <firefox\|chrome> <dev\|prod>/);
  assert.throws(() => parseArgs([]), /Usage: node scripts\/stage-extension\.js <firefox\|chrome> <dev\|prod>/);
});
