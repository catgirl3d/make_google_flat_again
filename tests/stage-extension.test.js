const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { DIST_DIR, stageExtension } = require("../scripts/package-extension.js");

const FIREFOX_STAGE_DIR = path.join(DIST_DIR, "firefox-package");
const CHROME_STAGE_DIR = path.join(DIST_DIR, "chrome-package");

function removePath(targetPath) {
  fs.rmSync(targetPath, { recursive: true, force: true });
}

test("stageExtension prepares dev and prod stages with the expected build flags", () => {
  for (const targetPath of [FIREFOX_STAGE_DIR, CHROME_STAGE_DIR]) {
    removePath(targetPath);
  }

  try {
    assert.throws(() => stageExtension({ target: "chrome", mode: "staging" }), /Unsupported build mode/);

    const chromeResult = stageExtension({ target: "chrome", mode: "dev" });
    const chromeBuildFlags = fs.readFileSync(path.join(CHROME_STAGE_DIR, "src", "shared", "build-flags.js"), "utf8");

    assert.equal(chromeResult.stageDir, CHROME_STAGE_DIR);
    assert.equal(chromeResult.mode, "dev");
    assert.equal(chromeBuildFlags.includes("const DEFAULT_IS_DEVELOPMENT = true;"), true);
    assert.equal(fs.existsSync(path.join(CHROME_STAGE_DIR, "src", "platform", "firefox")), false);

    const firefoxResult = stageExtension({ target: "firefox", mode: "prod" });
    const firefoxBuildFlags = fs.readFileSync(path.join(FIREFOX_STAGE_DIR, "src", "shared", "build-flags.js"), "utf8");

    assert.equal(firefoxResult.stageDir, FIREFOX_STAGE_DIR);
    assert.equal(firefoxResult.mode, "prod");
    assert.equal(firefoxBuildFlags.includes("const DEFAULT_IS_DEVELOPMENT = false;"), true);
    assert.equal(fs.existsSync(path.join(FIREFOX_STAGE_DIR, "src", "background", "background-chrome.js")), false);
  } finally {
    for (const targetPath of [FIREFOX_STAGE_DIR, CHROME_STAGE_DIR]) {
      removePath(targetPath);
    }
  }
});
