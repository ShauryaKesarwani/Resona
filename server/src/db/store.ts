import { DatabaseSync } from "node:sqlite";

export type TicketStatus = "issued" | "claimed" | "skipped";
export type Ticket = { passId: string; holder: string; tier: string; status: TicketStatus };

// Tickets live here until Arkiv is wired in. Nullifiers stay here for good,
// because they must not be public.
export function openStore(path: string) {
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE IF NOT EXISTS tickets (
      pass_id INTEGER PRIMARY KEY AUTOINCREMENT,
      holder  TEXT NOT NULL,
      tier    TEXT NOT NULL,
      status  TEXT NOT NULL DEFAULT 'issued'
    );
    CREATE TABLE IF NOT EXISTS nullifiers (
      nullifier TEXT NOT NULL,
      action    TEXT NOT NULL,
      UNIQUE (nullifier, action)
    );
  `);

  const toTicket = (row: any): Ticket => ({
    passId: String(row.pass_id),
    holder: row.holder,
    tier: row.tier,
    status: row.status,
  });

  return {
    issue(holder: string, tier: string): Ticket {
      const row = db
        .prepare("INSERT INTO tickets (holder, tier) VALUES (?, ?) RETURNING *")
        .get(holder.toLowerCase(), tier);
      return toTicket(row);
    },
    ticket(passId: string): Ticket | undefined {
      const row = db.prepare("SELECT * FROM tickets WHERE pass_id = ?").get(passId);
      return row ? toTicket(row) : undefined;
    },
    ticketsOf(holder: string): Ticket[] {
      return db
        .prepare("SELECT * FROM tickets WHERE holder = ? ORDER BY pass_id")
        .all(holder.toLowerCase())
        .map(toTicket);
    },
    setStatus(passId: string, status: TicketStatus) {
      db.prepare("UPDATE tickets SET status = ? WHERE pass_id = ?").run(status, passId);
    },
    /** Returns false if this person has already used this action. */
    useNullifier(nullifier: string, action: string): boolean {
      const { changes } = db
        .prepare("INSERT OR IGNORE INTO nullifiers (nullifier, action) VALUES (?, ?)")
        .run(nullifier, action);
      return changes === 1;
    },
  };
}

export type Store = ReturnType<typeof openStore>;
