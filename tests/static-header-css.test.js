const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const FILES_BY_APP = {
  gmail: "header-gmail.css",
  tasks: "header-tasks.css",
  drive: "header-drive.css",
  docs: "header-docs.css",
  sheets: "header-sheets.css",
  slides: "header-slides.css",
  forms: "header-forms.css"
};

for (const [appId, fileName] of Object.entries(FILES_BY_APP)) {
  test(`${fileName} stays an unconditional replacement stylesheet`, () => {
    const css = fs.readFileSync(path.join(__dirname, "..", "src", "content", "styles", fileName), "utf8");
    assert.equal(css.includes(`html[data-mgfa-app="${appId}"]`), false);
    assert.equal(css.includes("content: url("), true);
  });
}

test("header-gmail.css targets the Gmail lockup asset directly", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "src", "content", "styles", "header-gmail.css"), "utf8");

  assert.equal(css.includes('a[href="#inbox"] > img[src*="logo_gmail_lockup_default_"]'), true);
  assert.equal(css.includes('img[src*="/icons/mail/rfr/logo_gmail_lockup_default_"]'), true);
  assert.equal(css.includes('--mgfa-logo-source: "header-gmail-lockup"'), true);
  assert.equal(css.includes('logo_gmail_lockup_default_1x_r7.png'), true);
});

test("header-gmail.css replaces the loading splash logo with the classic Gmail icon", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "src", "content", "styles", "header-gmail.css"), "utf8");

  assert.equal(css.includes('#loading img[src*="/icons/mail/logo_loading"]'), true);
  assert.equal(css.includes('#loading img[srcset*="/icons/mail/logo_loading"]'), true);
  assert.equal(css.includes('--mgfa-logo-source: "header-gmail-loading"'), true);
  assert.equal(css.includes('gmail-classic.svg'), true);
  assert.equal(css.includes('object-fit: contain'), true);
});

test("header-tasks.css targets Tasks productlogo images directly", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "src", "content", "styles", "header-tasks.css"), "utf8");

  assert.equal(css.includes('img[src*="/images/branding/productlogos/tasks_2026/"]'), true);
  assert.equal(css.includes('img[srcset*="/images/branding/productlogos/tasks_2026/"]'), true);
  assert.equal(css.includes('--mgfa-logo-source: "header-tasks"'), true);
  assert.equal(css.includes('tasks-classic.svg'), true);
});
