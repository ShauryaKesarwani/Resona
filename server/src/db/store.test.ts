import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { openStore } from "./store.ts";

test("reservations survive restart and block duplicate nullifiers across connections", () => {
  const dir = mkdtempSync(join(tmpdir(), "resona-coordinator-"));
  const path = join(dir, "test.db");
  const one = openStore(path);
  const two = openStore(path);
  try {
    const id = one.reserveClaim("123", "event-action", "pass-a", "0xabc");
    assert.ok(id);
    assert.equal(two.reserveClaim("123", "event-action", "pass-b", "0xdef"), undefined);
    one.close();
    const reopened = openStore(path);
    try {
      assert.equal(reopened.pendingClaim("pass-a"), true);
      assert.equal(reopened.reserveClaim("123", "event-action", "pass-b", "0xdef"), undefined);
      reopened.completeClaim(id);
      assert.equal(reopened.pendingClaim("pass-a"), false);
      assert.equal(reopened.reserveClaim("123", "event-action", "pass-b", "0xdef"), undefined);
    } finally { reopened.close(); }
  } finally { two.close(); rmSync(dir, { recursive: true, force: true }); }
});
