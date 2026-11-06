import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LabRooms } from "./lab.service.ts";

describe("lab rooms", () => {
  it("waits until both phones have reported", () => {
    const rooms = new LabRooms();
    assert.equal(rooms.result("a"), null);
    rooms.report("a", "door", 1.5, 1000);
    assert.equal(rooms.result("a"), null);
  });

  it("combines reports from the same run", () => {
    const rooms = new LabRooms();
    rooms.report("a", "door", 1.501, 1000);
    rooms.report("a", "holder", 1.5, 2000);
    const result = rooms.result("a");
    assert.ok(Math.abs((result?.cm ?? 0) - 17.15) < 0.01);
    assert.equal(result?.verdict, "near");
  });

  it("doesn't pair a report with one from an earlier run", () => {
    const rooms = new LabRooms();
    rooms.report("a", "door", 1.5, 1000);
    rooms.report("a", "holder", 1.5, 9000);
    assert.equal(rooms.result("a"), null);
  });

  it("keeps rooms separate", () => {
    const rooms = new LabRooms();
    rooms.report("a", "door", 1.5, 1000);
    rooms.report("b", "holder", 1.5, 1000);
    assert.equal(rooms.result("a"), null);
    assert.equal(rooms.result("b"), null);
  });
});
