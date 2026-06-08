const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeTagName,
  readManifestVersion,
  validateReleaseTag
} = require("../scripts/validate-release-tag.js");

test("normalizeTagName accepts plain and v-prefixed release tags", () => {
  assert.equal(normalizeTagName("0.1.0"), "0.1.0");
  assert.equal(normalizeTagName("v0.1.0"), "0.1.0");
});

test("validateReleaseTag accepts the manifest version", () => {
  const manifestVersion = readManifestVersion();
  const prefixedResult = validateReleaseTag(`v${manifestVersion}`);
  const plainResult = validateReleaseTag(manifestVersion);

  assert.equal(prefixedResult.manifestVersion, manifestVersion);
  assert.equal(prefixedResult.normalizedTag, manifestVersion);
  assert.equal(plainResult.normalizedTag, manifestVersion);
});

test("validateReleaseTag rejects malformed tags", () => {
  assert.throws(
    () => validateReleaseTag("release-0.1.0"),
    /must look like/
  );
});

test("validateReleaseTag rejects version mismatches", () => {
  assert.throws(
    () => validateReleaseTag("v9.9.9"),
    /does not match/
  );
});
