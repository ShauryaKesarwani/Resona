import { Router } from "express";
import { LabRooms } from "../services/lab.service.ts";

export const labRoutes = Router();
const rooms = new LabRooms();

labRoutes.post("/lab/:room/report", (req, res) => {
  const { role, elapsedSeconds } = (req.body ?? {}) as { role?: unknown; elapsedSeconds?: unknown };
  if ((role !== "door" && role !== "holder") || typeof elapsedSeconds !== "number" || !Number.isFinite(elapsedSeconds)) {
    res.status(400).json({ error: "expected_role_and_elapsed_seconds" });
    return;
  }
  rooms.report(req.params.room, role, elapsedSeconds);
  res.json({ ok: true });
});

labRoutes.get("/lab/:room", (req, res) => {
  res.json({ result: rooms.result(req.params.room) });
});
