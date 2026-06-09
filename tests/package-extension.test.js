const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const yauzl = require("yauzl");

const { packageExtension } = require("../scripts/package-extension.js");

const TEST_DIST_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "mgfa-package-extension-"));
const FIREFOX_OUTPUT_PATH = path.join(TEST_DIST_DIR, "packaging-firefox-smoke.xpi");
const CHROME_OUTPUT_PATH = path.join(TEST_DIST_DIR, "packaging-chrome-smoke.zip");
const FIREFOX_STAGE_DIR = path.join(TEST_DIST_DIR, "firefox-package");
const CHROME_STAGE_DIR = path.join(TEST_DIST_DIR, "chrome-package");

function removePath(targetPath) {
  fs.rmSync(targetPath, { recursive: true, force: true });
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function readArchiveEntries(archivePath) {
  return new Promise((resolve, reject) => {
    yauzl.open(archivePath, { lazyEntries: true }, (openError, zipFile) => {
      if (openError) {
        reject(openError);
        return;
      }

      const entries = [];
      let settled = false;

      function finish(error) {
        if (settled) {
          return;
        }

        settled = true;

        if (error) {
          reject(error);
          return;
        }

        resolve(entries);
      }

      zipFile.once("error", finish);
      zipFile.once("end", () => {
        zipFile.close();
        finish();
      });
      zipFile.on("entry", (entry) => {
        entries.push({
          compressionMethod: entry.compressionMethod,
          fileName: entry.fileName
        });
        zipFile.readEntry();
      });

      zipFile.readEntry();
    });
  });
}

test("packageExtension builds deterministic Firefox and Chrome artifacts", async () => {
  for (const targetPath of [FIREFOX_OUTPUT_PATH, CHROME_OUTPUT_PATH, FIREFOX_STAGE_DIR, CHROME_STAGE_DIR]) {
    removePath(targetPath);
  }

  try {
    await assert.rejects(
      packageExtension({ target: "firefox", outputName: "nested/file", distDir: TEST_DIST_DIR }),
      /plain filename/
    );

    const firefoxResult = await packageExtension({ target: "firefox", outputName: "packaging-firefox-smoke", distDir: TEST_DIST_DIR });
    const firefoxEntries = await readArchiveEntries(firefoxResult.outputPath);
    const firefoxEntryNames = firefoxEntries.map((entry) => entry.fileName);
    const firefoxHash = sha256(firefoxResult.outputPath);

    assert.equal(path.basename(firefoxResult.outputPath), "packaging-firefox-smoke.xpi");
    assert.equal(fs.existsSync(path.join(FIREFOX_STAGE_DIR, "manifest.json")), true);
    assert.equal(fs.existsSync(path.join(FIREFOX_STAGE_DIR, "src", "platform", "chrome")), false);
    assert.equal(fs.existsSync(path.join(FIREFOX_STAGE_DIR, "src", "background", "background-chrome.js")), false);
    assert.equal(fs.existsSync(path.join(FIREFOX_STAGE_DIR, "src", "platform", "firefox", "content-script-registry.js")), true);
    assert.equal(
      fs.readFileSync(path.join(FIREFOX_STAGE_DIR, "src", "shared", "build-flags.js"), "utf8").includes("const DEFAULT_IS_DEVELOPMENT = false;"),
      true
    );
    assert.deepEqual(firefoxEntryNames, [...firefoxEntryNames].sort());
    assert.equal(firefoxEntries.every((entry) => entry.compressionMethod === 0), true);
    assert.equal(firefoxEntryNames.some((fileName) => fileName.endsWith("/")), false);
    assert.equal(firefoxEntryNames.includes("manifest.json"), true);
    assert.equal(firefoxEntryNames.some((fileName) => fileName.startsWith("assets/")), true);
    assert.equal(firefoxEntryNames.some((fileName) => fileName.startsWith("src/")), true);
    assert.equal(firefoxEntryNames.includes("src/platform/chrome/content-script-registry.js"), false);
    assert.equal(firefoxEntryNames.includes("src/background/background-chrome.js"), false);

    await packageExtension({ target: "firefox", outputName: "packaging-firefox-smoke", distDir: TEST_DIST_DIR });
    assert.equal(sha256(firefoxResult.outputPath), firefoxHash);

    const chromeResult = await packageExtension({ target: "chrome", outputName: "packaging-chrome-smoke", distDir: TEST_DIST_DIR });
    const chromeEntries = await readArchiveEntries(chromeResult.outputPath);
    const chromeEntryNames = chromeEntries.map((entry) => entry.fileName);
    const chromeHash = sha256(chromeResult.outputPath);

    assert.equal(path.basename(chromeResult.outputPath), "packaging-chrome-smoke.zip");
    assert.equal(fs.existsSync(path.join(CHROME_STAGE_DIR, "manifest.json")), true);
    assert.equal(fs.existsSync(path.join(CHROME_STAGE_DIR, "src", "platform", "firefox")), false);
    assert.equal(fs.existsSync(path.join(CHROME_STAGE_DIR, "src", "platform", "chrome", "content-script-registry.js")), true);
    assert.equal(
      fs.readFileSync(path.join(CHROME_STAGE_DIR, "src", "shared", "build-flags.js"), "utf8").includes("const DEFAULT_IS_DEVELOPMENT = false;"),
      true
    );
    assert.deepEqual(chromeEntryNames, [...chromeEntryNames].sort());
    assert.equal(chromeEntries.every((entry) => entry.compressionMethod === 0), true);
    assert.equal(chromeEntryNames.some((fileName) => fileName.endsWith("/")), false);
    assert.equal(chromeEntryNames.includes("manifest.json"), true);
    assert.equal(chromeEntryNames.some((fileName) => fileName.startsWith("assets/")), true);
    assert.equal(chromeEntryNames.some((fileName) => fileName.startsWith("src/")), true);
    assert.equal(chromeEntryNames.includes("src/platform/firefox/content-script-registry.js"), false);

    await packageExtension({ target: "chrome", outputName: "packaging-chrome-smoke", distDir: TEST_DIST_DIR });
    assert.equal(sha256(chromeResult.outputPath), chromeHash);
  } finally {
    removePath(TEST_DIST_DIR);
  }
});
