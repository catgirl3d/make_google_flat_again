const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getPauseRule,
  shouldPauseOnPage
} = require("../src/shared/guards.js");

test("calendar settings page is paused", () => {
  const rule = getPauseRule({
    hostname: "calendar.google.com",
    pathname: "/calendar/u/0/r/settings",
    href: "https://calendar.google.com/calendar/u/0/r/settings"
  });

  assert.equal(rule?.id, "calendar-sensitive-screens");
});

test("docs picker page is paused", () => {
  assert.equal(
    shouldPauseOnPage({
      hostname: "docs.google.com",
      pathname: "/picker",
      href: "https://docs.google.com/picker?protocol=gadgets"
    }),
    true
  );
});

test("normal drive page is not paused", () => {
  assert.equal(
    shouldPauseOnPage({
      hostname: "drive.google.com",
      pathname: "/drive/u/0/my-drive",
      href: "https://drive.google.com/drive/u/0/my-drive"
    }),
    false
  );
});
