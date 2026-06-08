const test = require("node:test");
const assert = require("node:assert/strict");

const { create, stableSerialize } = require("../src/content/debug-logger.js");

test("stableSerialize normalizes object key order", () => {
  assert.equal(
    stableSerialize({ b: 1, a: { d: 2, c: 3 } }),
    stableSerialize({ a: { c: 3, d: 2 }, b: 1 })
  );
});

test("snapshot logging deduplicates identical payloads", () => {
  const scope = `debug-test-${Date.now()}`;
  const logger = create(scope);

  assert.equal(logger.snapshot("state", { a: 1, b: 2 }), true);
  assert.equal(logger.snapshot("state", { b: 2, a: 1 }), false);
  assert.equal(logger.snapshot("state", { a: 1, b: 3 }), true);
});
