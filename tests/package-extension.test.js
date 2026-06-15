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
const EXPECTED_TOP_LEVEL_ENTRIES = ["assets", "manifest.json", "src"];
const COMMON_RELEASE_ENTRIES = [
  "assets/extension/icon-16.png",
  "assets/extension/icon-48.png",
  "assets/icons/apps/gmail-classic.svg",
  "assets/icons/calendar/calendar-01.webp",
  "manifest.json",
  "src/background/background-core.js",
  "src/background/header-static-css.js",
  "src/content/main.js",
  "src/content/surface-registry.js",
  "src/content/surfaces/app-icon-surfaces.js",
  "src/content/surfaces/favicon.js",
  "src/platform/content-script-registry-core.js",
  "src/popup/popup.css",
  "src/popup/popup.html",
  "src/popup/popup.js",
  "src/shared/app-registry.js",
  "src/shared/apps.js",
  "src/shared/build-flags.js",
  "src/shared/runtime.js",
  "src/shared/settings.js"
];

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

function readArchiveTextFile(archivePath, targetFileName) {
  return new Promise((resolve, reject) => {
    yauzl.open(archivePath, { lazyEntries: true }, (openError, zipFile) => {
      if (openError) {
        reject(openError);
        return;
      }

      let settled = false;

      function finish(error, result) {
        if (settled) {
          return;
        }

        settled = true;
        zipFile.close();

        if (error) {
          reject(error);
          return;
        }

        resolve(result);
      }

      zipFile.once("error", (error) => finish(error));
      zipFile.once("end", () => finish(new Error(`Archive entry not found: ${targetFileName}`)));
      zipFile.on("entry", (entry) => {
        if (entry.fileName !== targetFileName) {
          zipFile.readEntry();
          return;
        }

        zipFile.openReadStream(entry, (streamError, stream) => {
          if (streamError) {
            finish(streamError);
            return;
          }

          const chunks = [];
          stream.on("data", (chunk) => {
            chunks.push(chunk);
          });
          stream.once("error", (error) => finish(error));
          stream.once("end", () => {
            finish(null, Buffer.concat(chunks).toString("utf8"));
          });
        });
      });

      zipFile.readEntry();
    });
  });
}

function assertArchiveContract(entries, { expectedEntries, excludedEntries }) {
  const entryNames = entries.map((entry) => entry.fileName);
  const topLevelEntries = [...new Set(entryNames.map((fileName) => fileName.split("/")[0]))].sort();
  const missingEntries = expectedEntries.filter((fileName) => !entryNames.includes(fileName));
  const includedExcludedEntries = excludedEntries.filter((fileName) => entryNames.includes(fileName));

  assert.deepEqual(entryNames, [...entryNames].sort());
  assert.equal(entries.every((entry) => entry.compressionMethod === 0), true);
  assert.equal(entryNames.some((fileName) => fileName.endsWith("/")), false);
  assert.deepEqual(topLevelEntries, EXPECTED_TOP_LEVEL_ENTRIES);
  assert.deepEqual(missingEntries, []);
  assert.deepEqual(includedExcludedEntries, []);
}

test("packageExtension builds deterministic Firefox and Chrome artifacts", async () => {
  for (const targetPath of [FIREFOX_OUTPUT_PATH, CHROME_OUTPUT_PATH]) {
    removePath(targetPath);
  }

  try {
    await assert.rejects(
      packageExtension({ target: "firefox", outputName: "nested/file", distDir: TEST_DIST_DIR }),
      /plain filename/
    );

    const firefoxResult = await packageExtension({ target: "firefox", outputName: "packaging-firefox-smoke", distDir: TEST_DIST_DIR });
    const firefoxEntries = await readArchiveEntries(firefoxResult.outputPath);
    const firefoxBuildFlags = await readArchiveTextFile(firefoxResult.outputPath, "src/shared/build-flags.js");
    const firefoxEntryNames = firefoxEntries.map((entry) => entry.fileName);
    const firefoxHash = sha256(firefoxResult.outputPath);

    assert.equal(firefoxResult.outputPath, FIREFOX_OUTPUT_PATH);
    assert.equal(path.dirname(firefoxResult.outputPath), TEST_DIST_DIR);
    assert.equal(path.extname(firefoxResult.outputPath), ".xpi");
    assert.equal(path.basename(firefoxResult.outputPath), "packaging-firefox-smoke.xpi");
    assert.equal(firefoxResult.fileCount, firefoxEntryNames.length);
    assert.equal(firefoxBuildFlags.includes("const DEFAULT_IS_DEVELOPMENT = false;"), true);
    assertArchiveContract(firefoxEntries, {
      expectedEntries: [
        ...COMMON_RELEASE_ENTRIES,
        "src/platform/firefox/content-script-registry.js"
      ],
      excludedEntries: [
        "src/background/background-chrome.js",
        "src/platform/chrome/content-script-registry.js"
      ]
    });

    await packageExtension({ target: "firefox", outputName: "packaging-firefox-smoke", distDir: TEST_DIST_DIR });
    assert.equal(sha256(firefoxResult.outputPath), firefoxHash);

    const chromeResult = await packageExtension({ target: "chrome", outputName: "packaging-chrome-smoke", distDir: TEST_DIST_DIR });
    const chromeEntries = await readArchiveEntries(chromeResult.outputPath);
    const chromeBuildFlags = await readArchiveTextFile(chromeResult.outputPath, "src/shared/build-flags.js");
    const chromeEntryNames = chromeEntries.map((entry) => entry.fileName);
    const chromeHash = sha256(chromeResult.outputPath);

    assert.equal(chromeResult.outputPath, CHROME_OUTPUT_PATH);
    assert.equal(path.dirname(chromeResult.outputPath), TEST_DIST_DIR);
    assert.equal(path.extname(chromeResult.outputPath), ".zip");
    assert.equal(path.basename(chromeResult.outputPath), "packaging-chrome-smoke.zip");
    assert.equal(chromeResult.fileCount, chromeEntryNames.length);
    assert.equal(chromeBuildFlags.includes("const DEFAULT_IS_DEVELOPMENT = false;"), true);
    assertArchiveContract(chromeEntries, {
      expectedEntries: [
        ...COMMON_RELEASE_ENTRIES,
        "src/background/background-chrome.js",
        "src/platform/chrome/content-script-registry.js"
      ],
      excludedEntries: [
        "src/platform/firefox/content-script-registry.js"
      ]
    });

    await packageExtension({ target: "chrome", outputName: "packaging-chrome-smoke", distDir: TEST_DIST_DIR });
    assert.equal(sha256(chromeResult.outputPath), chromeHash);
  } finally {
    removePath(TEST_DIST_DIR);
  }
});
