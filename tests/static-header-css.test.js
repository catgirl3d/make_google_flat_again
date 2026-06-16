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

const DOCS_SUITE_CONTRACTS = [
  {
    fileName: "header-docs.css",
    iconClass: "docs-icon-docs-2026",
    productPath: "document",
    productLogo: "docs_2026",
    asset: "docs-classic.svg"
  },
  {
    fileName: "header-sheets.css",
    iconClass: "docs-icon-sheets-2026",
    productPath: "spreadsheets",
    productLogo: "sheets_2026",
    asset: "sheets-classic.svg"
  },
  {
    fileName: "header-slides.css",
    iconClass: "docs-icon-slides-2026",
    productPath: "presentation",
    productLogo: "slides_2026",
    asset: "slides-classic.svg"
  },
  {
    fileName: "header-forms.css",
    iconClass: "docs-icon-forms-2026",
    productPath: "forms",
    productLogo: "forms_2026",
    asset: "forms-classic.png"
  }
];

function readHeaderCss(fileName) {
  return fs.readFileSync(path.join(__dirname, "..", "src", "content", "styles", fileName), "utf8");
}

for (const [appId, fileName] of Object.entries(FILES_BY_APP)) {
  test(`${fileName} stays an unconditional replacement stylesheet`, () => {
    const css = readHeaderCss(fileName);
    assert.equal(css.includes(`html[data-mgfa-app="${appId}"]`), false);
    assert.equal(css.includes("content: url("), true);
    assert.equal(css.includes("../../../assets/icons/apps/"), true);
  });
}

test("header-gmail.css targets the Gmail lockup asset directly", () => {
  const css = readHeaderCss("header-gmail.css");

  assert.equal(css.includes('a[href="#inbox"] > img[src*="logo_gmail_lockup_default_"]'), true);
  assert.equal(css.includes('a[href="#inbox"] > img[srcset*="logo_gmail_lockup_default_"]'), true);
  assert.equal(css.includes('img[src*="/icons/mail/rfr/logo_gmail_lockup_default_"]'), true);
  assert.equal(css.includes('img[srcset*="/icons/mail/rfr/logo_gmail_lockup_default_"]'), true);
  assert.equal(css.includes('--mgfa-logo-source: "header-gmail-lockup"'), true);
  assert.equal(css.includes('logo_gmail_lockup_default_1x_r7.png'), true);
});

test("header-gmail.css replaces the loading splash logo with the classic Gmail icon", () => {
  const css = readHeaderCss("header-gmail.css");

  assert.equal(css.includes('#loading img[src*="/icons/mail/logo_loading"]'), true);
  assert.equal(css.includes('#loading img[srcset*="/icons/mail/logo_loading"]'), true);
  assert.equal(css.includes('--mgfa-logo-source: "header-gmail-loading"'), true);
  assert.equal(css.includes('gmail-classic.svg'), true);
  assert.equal(css.includes('object-fit: contain'), true);
});

test("header-chat.css targets the Chat lockup asset directly", () => {
  const css = readHeaderCss("header-chat.css");

  assert.equal(css.includes('a[href="/home"] > img[src*="/ui/v1/icons/mail/chatlogo/chat_2026_lockup_"]'), true);
  assert.equal(css.includes('a[href="/home"] > img[srcset*="/ui/v1/icons/mail/chatlogo/chat_2026_lockup_"]'), true);
  assert.equal(css.includes('img[src*="/ui/v1/icons/mail/chatlogo/chat_2026_lockup_"]'), true);
  assert.equal(css.includes('img[srcset*="/ui/v1/icons/mail/chatlogo/chat_2026_lockup_"]'), true);
  assert.equal(css.includes('--mgfa-logo-source: "header-chat-lockup"'), true);
  assert.equal(css.includes('logo_chat.png'), true);
});

test("header-chat.css replaces the Chat loading logo with the classic icon", () => {
  const css = readHeaderCss("header-chat.css");

  assert.equal(css.includes('#loading img[src*="/ui/v1/icons/mail/chatlogo/"]'), true);
  assert.equal(css.includes('#loading img[srcset*="/ui/v1/icons/mail/chatlogo/"]'), true);
  assert.equal(css.includes('--mgfa-logo-source: "header-chat-loading"'), true);
  assert.equal(css.includes('chat-classic.svg'), true);
  assert.equal(css.includes('object-fit: contain'), true);
});

test("header-chat.css replaces the 220dp Chat hero logo with the classic icon", () => {
  const css = readHeaderCss("header-chat.css");

  assert.equal(css.includes('.YFKohd > img[src*="/dynamite/images/product/chat_2026_220dp"]'), true);
  assert.equal(css.includes('img[src*="/dynamite/images/product/chat_2026_220dp"]'), true);
  assert.equal(css.includes('--mgfa-logo-source: "header-chat-hero"'), true);
  assert.equal(css.includes('chat-classic.svg'), true);
  assert.equal(css.includes('object-fit: contain'), true);
});

test("header-meet.css targets the Meet lockup asset directly", () => {
  const css = readHeaderCss("header-meet.css");

  assert.equal(css.includes('#sdgBod > img[src*="/meet/icons/logo_meet_2026_"]'), true);
  assert.equal(css.includes('#sdgBod > img[srcset*="/meet/icons/logo_meet_2026_"]'), true);
  assert.equal(css.includes('img[src*="/meet/icons/logo_meet_2026_"]'), true);
  assert.equal(css.includes('img[srcset*="/meet/icons/logo_meet_2026_"]'), true);
  assert.equal(css.includes('--mgfa-logo-source: "header-meet-lockup"'), true);
  assert.equal(css.includes('logo_meet.png'), true);
});

test("header-tasks.css targets Tasks productlogo images directly", () => {
  const css = readHeaderCss("header-tasks.css");

  assert.equal(css.includes('img[src*="/images/branding/productlogos/tasks_2026/"]'), true);
  assert.equal(css.includes('img[srcset*="/images/branding/productlogos/tasks_2026/"]'), true);
  assert.equal(css.includes('--mgfa-logo-source: "header-tasks"'), true);
  assert.equal(css.includes('tasks-classic.svg'), true);
});

test("header-keep.css targets Keep productlogo images directly", () => {
  const css = readHeaderCss("header-keep.css");

  assert.equal(css.includes('img[src*="/images/branding/productlogos/keep_2026/"]'), true);
  assert.equal(css.includes('img[srcset*="/images/branding/productlogos/keep_2026/"]'), true);
  assert.equal(css.includes('--mgfa-logo-source: "header-keep"'), true);
  assert.equal(css.includes('keep_icon_1.svg'), true);
  assert.equal(css.includes('width: 35px !important;'), true);
  assert.equal(css.includes('height: 35px !important;'), true);
  assert.equal(css.includes('margin-right: 3px !important;'), true);
});

test("header-vids.css targets the Vids branding icon and productlogo images directly", () => {
  const css = readHeaderCss("header-vids.css");
  const brandingIconSelector = '#docs-branding-logo .docs-branding-icon-img[class*="docs-icon-vids-2026"]';

  assert.equal(css.includes("#docs-branding-logo .docs-branding-icon {"), true);
  assert.equal(css.includes("position: relative !important;"), true);
  assert.equal(css.includes(`${brandingIconSelector} {`), true);
  assert.equal(css.includes('background: url("../../../assets/icons/apps/vids-classic.svg") center / contain no-repeat !important;'), true);
  assert.equal(css.includes("position: absolute !important;"), true);
  assert.equal(css.includes("inset: 0 !important;"), true);
  assert.equal(css.includes("opacity: 1 !important;"), true);
  assert.equal(css.includes("visibility: visible !important;"), true);
  assert.equal(css.includes("filter: none !important;"), true);
  assert.equal(css.includes("transform: none !important;"), true);

  assert.equal(css.includes(`${brandingIconSelector}::before,`), true);
  assert.equal(css.includes(`${brandingIconSelector}::after {`), true);
  assert.equal(css.includes("content: none !important;"), true);
  assert.equal(css.includes("background-image: none !important;"), true);
  assert.equal(css.includes("-webkit-mask-image: none !important;"), true);
  assert.equal(css.includes("mask-image: none !important;"), true);

  assert.equal(css.includes('img[src*="/images/branding/productlogos/vids_2026/"]'), true);
  assert.equal(css.includes('img[srcset*="/images/branding/productlogos/vids_2026/"]'), true);
  assert.equal(css.includes('--mgfa-logo-source: "header-vids"'), true);
  assert.equal(css.includes('vids-classic.svg'), true);
});

test("header-drive.css targets Drive productlogo images directly", () => {
  const css = readHeaderCss("header-drive.css");

  assert.equal(css.includes('a[href*="drive.google.com/drive/"] img[src*="productlogos/drive_2026"]'), true);
  assert.equal(css.includes('a[href*="drive.google.com/drive/"] img[srcset*="productlogos/drive_2026"]'), true);
  assert.equal(css.includes('a[href*="drive.google.com"] img[src*="productlogos/drive_2026"]'), true);
  assert.equal(css.includes('a[href*="drive.google.com"] img[srcset*="productlogos/drive_2026"]'), true);
  assert.equal(css.includes('content: url("../../../assets/icons/apps/drive-classic.svg") !important;'), true);
});

test("header-forms.css targets the Forms inline svg logo", () => {
  const css = readHeaderCss("header-forms.css");

  assert.equal(css.includes('span[jsslot].XuQwKc > span.GmuOkf > .cYkUI {'), true);
  assert.equal(css.includes('span[jsslot].XuQwKc > span.GmuOkf > .cYkUI > svg {'), true);
  assert.equal(css.includes('span[jsslot].XuQwKc > span.GmuOkf > .cYkUI::after {'), true);
  assert.equal(css.includes('position: relative !important;'), true);
  assert.equal(css.includes('opacity: 0 !important;'), true);
  assert.equal(css.includes('content: "" !important;'), true);
  assert.equal(css.includes('pointer-events: none !important;'), true);
  assert.equal(css.includes('background: url("../../../assets/icons/apps/forms-classic.png") center / contain no-repeat !important;'), true);
});

for (const { fileName, iconClass, productPath, productLogo, asset } of DOCS_SUITE_CONTRACTS) {
  test(`${fileName} replaces the docs-suite branding icon and productlogo image`, () => {
    const css = readHeaderCss(fileName);
    const brandingIconSelector = `#docs-branding-logo .docs-branding-icon-img[class*="${iconClass}"]`;

    assert.equal(css.includes("#docs-branding-logo .docs-branding-icon {"), true);
    assert.equal(css.includes("position: relative !important;"), true);
    assert.equal(css.includes(`${brandingIconSelector} {`), true);
    assert.equal(css.includes(`background: url("../../../assets/icons/apps/${asset}") center / contain no-repeat !important;`), true);
    assert.equal(css.includes("position: absolute !important;"), true);
    assert.equal(css.includes("inset: 0 !important;"), true);
    assert.equal(css.includes("opacity: 1 !important;"), true);
    assert.equal(css.includes("visibility: visible !important;"), true);
    assert.equal(css.includes("filter: none !important;"), true);
    assert.equal(css.includes("transform: none !important;"), true);

    assert.equal(css.includes(`${brandingIconSelector}::before,`), true);
    assert.equal(css.includes(`${brandingIconSelector}::after {`), true);
    assert.equal(css.includes("content: none !important;"), true);
    assert.equal(css.includes("background-image: none !important;"), true);
    assert.equal(css.includes("-webkit-mask-image: none !important;"), true);
    assert.equal(css.includes("mask-image: none !important;"), true);

    assert.equal(css.includes(`a[href*="docs.google.com/${productPath}/"] > img[src*="productlogos/${productLogo}"]`), true);
    assert.equal(css.includes(`a[href*="docs.google.com/${productPath}/"] > img[srcset*="productlogos/${productLogo}"]`), true);
    assert.equal(css.includes(`content: url("../../../assets/icons/apps/${asset}") !important;`), true);
  });
}
