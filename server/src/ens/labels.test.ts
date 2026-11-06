import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeEventName, parsePassExpiry, passLabel } from "./labels.ts";

test("event names accept a normalized single ASCII .eth label", () => {
  assert.equal(normalizeEventName("  Demo-Event.ETH "), "demo-event.eth");
});

test("event names reject multiple, empty, or non-ASCII labels", () => {
  for (const name of ["demo.foo.eth", ".eth", "demo.xyz", "bücher.eth", "demo_.eth"]) {
    assert.throws(() => normalizeEventName(name));
  }
});

test("pass IDs become safe ENS labels while preserving UUID punctuation", () => {
  assert.equal(passLabel(" A1B2-C3 "), "a1b2-c3");
  assert.throws(() => passLabel("../alice"));
  assert.throws(() => passLabel("bücher"));
});

test("expiry must be a future safe integer no later than the event name", () => {
  assert.equal(parsePassExpiry("200", 100n, 300n), 200n);
  for (const [value, now, parentExpiry] of [
    ["100", 100n, 300n],
    ["301", 100n, 300n],
    ["1.5", 100n, 300n],
    [String(Number.MAX_SAFE_INTEGER + 1), 100n, BigInt(Number.MAX_SAFE_INTEGER + 1)],
  ] as const) {
    assert.throws(() => parsePassExpiry(value, now, parentExpiry));
  }
});
