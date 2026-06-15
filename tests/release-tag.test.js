const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const {
  normalizeTagName,
  readManifestVersion,
  validateReleaseTag
} = require("../scripts/validate-release-tag.js");

const PROJECT_ROOT = path.join(__dirname, "..");
const REPOSITORY_MANIFEST_PATH = path.join(PROJECT_ROOT, "manifests", "base.json");
const VALIDATOR_SCRIPT_PATH = path.join(PROJECT_ROOT, "scripts", "validate-release-tag.js");

function readRepositoryManifestVersion() {
  return JSON.parse(fs.readFileSync(REPOSITORY_MANIFEST_PATH, "utf8")).version;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function runValidatorCli(args) {
  return spawnSync(process.execPath, [VALIDATOR_SCRIPT_PATH, ...args], {
    cwd: PROJECT_ROOT,
    encoding: "utf8"
  });
}

function runValidatorNpmScript(args) {
  const command = ["npm", "run", "validate:release-tag", "--", ...args].join(" ");

  return spawnSync(command, {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
    shell: true
  });
}

test("normalizeTagName accepts plain and v-prefixed release tags", () => {
  assert.equal(normalizeTagName("0.1.0"), "0.1.0");
  assert.equal(normalizeTagName("v0.1.0"), "0.1.0");
});

test("validateReleaseTag accepts the repository manifest version", () => {
  const manifestVersion = readRepositoryManifestVersion();
  const prefixedResult = validateReleaseTag(`v${manifestVersion}`);
  const plainResult = validateReleaseTag(manifestVersion);

  assert.equal(readManifestVersion(), manifestVersion);
  assert.equal(prefixedResult.manifestVersion, manifestVersion);
  assert.equal(prefixedResult.normalizedTag, manifestVersion);
  assert.equal(prefixedResult.tagName, `v${manifestVersion}`);
  assert.equal(plainResult.normalizedTag, manifestVersion);
  assert.equal(plainResult.tagName, manifestVersion);
});

test("validateReleaseTag rejects malformed tags with the received tag", () => {
  assert.throws(
    () => validateReleaseTag("release-0.1.0"),
    /Release tag must look like v1\.2\.3 or 1\.2\.3\. Received 'release-0\.1\.0'\./
  );
});

test("validateReleaseTag rejects empty tags with a required-tag message", () => {
  assert.throws(
    () => validateReleaseTag("  "),
    /A release tag is required\./
  );
});

test("validateReleaseTag rejects version mismatches against manifests/base.json", () => {
  const manifestVersion = readRepositoryManifestVersion();

  assert.throws(
    () => validateReleaseTag("v9.9.9"),
    new RegExp(`Release tag 'v9\\.9\\.9' does not match manifests/base\\.json version '${escapeRegExp(manifestVersion)}'\\.`)
  );
});

test("CLI accepts a valid tag and prints the validation message", () => {
  const manifestVersion = readRepositoryManifestVersion();
  const result = runValidatorCli([`v${manifestVersion}`]);

  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.equal(
    result.stdout,
    `Validated release tag v${manifestVersion} against manifests/base.json version ${manifestVersion}.\n`
  );
});

test("npm release-tag script accepts the same tag CI passes", () => {
  const manifestVersion = readRepositoryManifestVersion();
  const result = runValidatorNpmScript([`v${manifestVersion}`]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, new RegExp(`Validated release tag v${escapeRegExp(manifestVersion)} against manifests/base\\.json version ${escapeRegExp(manifestVersion)}\\.`));
  assert.equal(result.stderr, "");
});

test("CLI rejects invalid and missing tags on stderr", () => {
  const invalidResult = runValidatorCli(["not-a-version"]);
  const missingResult = runValidatorCli([]);

  assert.notEqual(invalidResult.status, 0);
  assert.equal(
    invalidResult.stderr,
    "Release tag must look like v1.2.3 or 1.2.3. Received 'not-a-version'.\n"
  );
  assert.equal(invalidResult.stdout, "");

  assert.notEqual(missingResult.status, 0);
  assert.equal(missingResult.stderr, "A release tag is required.\n");
  assert.equal(missingResult.stdout, "");
});
