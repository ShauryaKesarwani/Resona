import { distanceCm, verdictFor, type Verdict } from "../../../app/src/sonar/distance.ts";

export type LabRole = "door" | "holder";
export type LabResult = { cm: number; verdict: Verdict };

type Report = { elapsedSeconds: number; receivedAt: number };
type Room = { door?: Report; holder?: Report };

/**
 * Phones report within a few seconds of each other, and a new run takes longer than this,
 * so a report never pairs with one from the previous run.
 */
const SAME_RUN_MS = 6000;
const MAX_ROOMS = 200;

/** In-memory results for the sonar lab page. Nothing here needs to survive a restart. */
export class LabRooms {
  private rooms = new Map<string, Room>();

  report(name: string, role: LabRole, elapsedSeconds: number, now = Date.now()): void {
    if (!this.rooms.has(name) && this.rooms.size >= MAX_ROOMS) {
      const oldest = this.rooms.keys().next().value;
      if (oldest !== undefined) this.rooms.delete(oldest);
    }
    const room = this.rooms.get(name) ?? {};
    room[role] = { elapsedSeconds, receivedAt: now };
    this.rooms.set(name, room);
  }

  result(name: string): LabResult | null {
    const room = this.rooms.get(name);
    if (!room?.door || !room.holder) return null;
    if (Math.abs(room.door.receivedAt - room.holder.receivedAt) > SAME_RUN_MS) return null;
    const cm = distanceCm(room.door.elapsedSeconds, room.holder.elapsedSeconds);
    return { cm, verdict: verdictFor(cm) };
  }
}
