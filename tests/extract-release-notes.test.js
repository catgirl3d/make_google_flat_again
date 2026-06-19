const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  extractReleaseNotes,
  writeReleaseNotes
} = require("../scripts/extract-release-notes.js");

function createTempChangelog(contents) {
  const directoryPath = fs.mkdtempSync(path.join(os.tmpdir(), "mgfa-release-notes-"));
  const changelogPath = path.join(directoryPath, "changelog.md");
  fs.writeFileSync(changelogPath, contents, "utf8");
  return { directoryPath, changelogPath };
}

test("extractReleaseNotes returns the matching version section for plain and prefixed tags", () => {
  const { changelogPath } = createTempChangelog(
    [
      "# Changelog",
      "",
      "## v0.1.2 - 2026-06-19",
      "",
      "Current release notes.",
      "",
      "- Item one",
      "- Item two",
      "",
      "## v0.1.1 - 2026-06-08",
      "",
      "Previous release notes."
    ].join("\n")
  );

  const expected = [
    "## v0.1.2 - 2026-06-19",
    "",
    "Current release notes.",
    "",
    "- Item one",
    "- Item two"
  ].join("\n");

  assert.equal(extractReleaseNotes("v0.1.2", changelogPath), expected);
  assert.equal(extractReleaseNotes("0.1.2", changelogPath), expected);
});

test("extractReleaseNotes rejects missing changelog sections", () => {
  const { changelogPath } = createTempChangelog(
    [
      "# Changelog",
      "",
      "## v0.1.1 - 2026-06-08",
      "",
      "Previous release notes."
    ].join("\n")
  );

  assert.throws(
    () => extractReleaseNotes("v0.1.2", changelogPath),
    /Could not find changelog section for version '0\.1\.2' in changelog\.md\./
  );
});

test("writeReleaseNotes writes the extracted section to the requested file", () => {
  const { directoryPath, changelogPath } = createTempChangelog(
    [
      "# Changelog",
      "",
      "## v0.1.2 - 2026-06-19",
      "",
      "Current release notes."
    ].join("\n")
  );
  const outputPath = path.join(directoryPath, "release-notes.md");

  writeReleaseNotes("v0.1.2", outputPath, changelogPath);

  assert.equal(fs.readFileSync(outputPath, "utf8"), "## v0.1.2 - 2026-06-19\n\nCurrent release notes.\n");
});
