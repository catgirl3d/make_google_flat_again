const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { stageExtension } = require("../scripts/package-extension.js");

const TEST_DIST_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "mgfa-stage-extension-"));
const FIREFOX_STAGE_DIR = path.join(TEST_DIST_DIR, "firefox-package");
const CHROME_STAGE_DIR = path.join(TEST_DIST_DIR, "chrome-package");

function removePath(targetPath) {
  fs.rmSync(targetPath, { recursive: true, force: true });
}

test("stageExtension prepares dev and prod stages with the expected build flags", () => {
  for (const targetPath of [FIREFOX_STAGE_DIR, CHROME_STAGE_DIR]) {
    removePath(targetPath);
  }

  try {
    assert.throws(() => stageExtension({ target: "chrome", mode: "staging", distDir: TEST_DIST_DIR }), /Unsupported build mode/);

    const chromeResult = stageExtension({ target: "chrome", mode: "dev", distDir: TEST_DIST_DIR });
    const chromeBuildFlags = fs.readFileSync(path.join(CHROME_STAGE_DIR, "src", "shared", "build-flags.js"), "utf8");

    assert.equal(chromeResult.stageDir, CHROME_STAGE_DIR);
    assert.equal(chromeResult.mode, "dev");
    assert.equal(chromeBuildFlags.includes("const DEFAULT_IS_DEVELOPMENT = true;"), true);
    assert.equal(fs.existsSync(path.join(CHROME_STAGE_DIR, "src", "platform", "firefox")), false);

    const firefoxResult = stageExtension({ target: "firefox", mode: "prod", distDir: TEST_DIST_DIR });
    const firefoxBuildFlags = fs.readFileSync(path.join(FIREFOX_STAGE_DIR, "src", "shared", "build-flags.js"), "utf8");

    assert.equal(firefoxResult.stageDir, FIREFOX_STAGE_DIR);
    assert.equal(firefoxResult.mode, "prod");
    assert.equal(firefoxBuildFlags.includes("const DEFAULT_IS_DEVELOPMENT = false;"), true);
    assert.equal(fs.existsSync(path.join(FIREFOX_STAGE_DIR, "src", "background", "background-chrome.js")), false);
  } finally {
    removePath(TEST_DIST_DIR);
  }
});
