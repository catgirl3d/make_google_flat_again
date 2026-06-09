const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const FILES_BY_APP = {
  gmail: "header-gmail.css",
  chat: "header-chat.css",
  meet: "header-meet.css",
  tasks: "header-tasks.css",
  keep: "header-keep.css",
  drive: "header-drive.css",
  docs: "header-docs.css",
  sheets: "header-sheets.css",
  slides: "header-slides.css",
  forms: "header-forms.css",
  vids: "header-vids.css"
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

test("header-chat.css targets the Chat lockup asset directly", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "src", "content", "styles", "header-chat.css"), "utf8");

  assert.equal(css.includes('a[href="/home"] > img[src*="/ui/v1/icons/mail/chatlogo/chat_2026_lockup_"]'), true);
  assert.equal(css.includes('img[src*="/ui/v1/icons/mail/chatlogo/chat_2026_lockup_"]'), true);
  assert.equal(css.includes('--mgfa-logo-source: "header-chat-lockup"'), true);
  assert.equal(css.includes('logo_chat.png'), true);
});

test("header-chat.css replaces the Chat loading logo with the classic icon", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "src", "content", "styles", "header-chat.css"), "utf8");

  assert.equal(css.includes('#loading img[src*="/ui/v1/icons/mail/chatlogo/"]'), true);
  assert.equal(css.includes('#loading img[srcset*="/ui/v1/icons/mail/chatlogo/"]'), true);
  assert.equal(css.includes('--mgfa-logo-source: "header-chat-loading"'), true);
  assert.equal(css.includes('chat-classic.svg'), true);
  assert.equal(css.includes('object-fit: contain'), true);
});

test("header-chat.css replaces the 220dp Chat hero logo with the classic icon", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "src", "content", "styles", "header-chat.css"), "utf8");

  assert.equal(css.includes('.YFKohd > img[src*="/dynamite/images/product/chat_2026_220dp"]'), true);
  assert.equal(css.includes('img[src*="/dynamite/images/product/chat_2026_220dp"]'), true);
  assert.equal(css.includes('--mgfa-logo-source: "header-chat-hero"'), true);
  assert.equal(css.includes('chat-classic.svg'), true);
  assert.equal(css.includes('object-fit: contain'), true);
});

test("header-meet.css targets the Meet lockup asset directly", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "src", "content", "styles", "header-meet.css"), "utf8");

  assert.equal(css.includes('#sdgBod > img[src*="/meet/icons/logo_meet_2026_"]'), true);
  assert.equal(css.includes('img[src*="/meet/icons/logo_meet_2026_"]'), true);
  assert.equal(css.includes('--mgfa-logo-source: "header-meet-lockup"'), true);
  assert.equal(css.includes('logo_meet.png'), true);
});

test("header-tasks.css targets Tasks productlogo images directly", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "src", "content", "styles", "header-tasks.css"), "utf8");

  assert.equal(css.includes('img[src*="/images/branding/productlogos/tasks_2026/"]'), true);
  assert.equal(css.includes('img[srcset*="/images/branding/productlogos/tasks_2026/"]'), true);
  assert.equal(css.includes('--mgfa-logo-source: "header-tasks"'), true);
  assert.equal(css.includes('tasks-classic.svg'), true);
});

test("header-keep.css targets Keep productlogo images directly", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "src", "content", "styles", "header-keep.css"), "utf8");

  assert.equal(css.includes('img[src*="/images/branding/productlogos/keep_2026/"]'), true);
  assert.equal(css.includes('img[srcset*="/images/branding/productlogos/keep_2026/"]'), true);
  assert.equal(css.includes('--mgfa-logo-source: "header-keep"'), true);
  assert.equal(css.includes('keep_icon_1.svg'), true);
  assert.equal(css.includes('width: 35px !important;'), true);
  assert.equal(css.includes('height: 35px !important;'), true);
  assert.equal(css.includes('margin-right: 3px !important;'), true);
});

test("header-vids.css targets Vids productlogo images directly", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "src", "content", "styles", "header-vids.css"), "utf8");

  assert.equal(css.includes('img[src*="/images/branding/productlogos/vids_2026/"]'), true);
  assert.equal(css.includes('img[srcset*="/images/branding/productlogos/vids_2026/"]'), true);
  assert.equal(css.includes('--mgfa-logo-source: "header-vids"'), true);
  assert.equal(css.includes('vids-classic.svg'), true);
});
