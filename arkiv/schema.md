# Resona demo data contract

This is the authoritative target for demo data and security invariants. Implementation status is explicit below; a planned field or rule is not evidence of an implemented feature. Update this document and tests when the contract changes. Arkiv is public: never store raw World ID proofs or nullifiers, signing keys, personal details, or audio there.

## Ticket — `resona.ticket` (implemented)

Organizer-owned, mutable; all reads filter by the trusted organizer and event. `server/src/arkiv/tickets.ts` defines the schema. `*` means indexed.

| Field | Type | Meaning |
|---|---|---|
| `passId`* | string | Random UUID, stable identifier |
| `eventId`* | string | Stable event identifier |
| `holder`* | address | Assigned wallet |
| `tier`* | string | Ticket tier |
| `status`* | string | `issued`, `claimed`, `skipped`, `checked_in`, `revoked` |
| `ensName` | optional string | Normalized ENS pass name |
| `ensNode` | optional string | Pass Node, 32-byte hex |
| `ensRegistry` | optional address | ENSv2 registry that holds the pass |
| `ensChainId` | optional string | Decimal chain ID of that registry |

ENS fields are optional for compatibility with existing tickets. The standalone Sepolia CLI can issue a matching ENS pass, but it does not write these fields to Arkiv; the HTTP ticket API does not populate or validate them. Any stored ENS fields are **unverified metadata**, not evidence of ownership. Arkiv ticket issuance and status changes currently work; ENS/Arkiv reconciliation, check-in, and revocation do not. Existing tickets remain readable. The Arkiv entity key identifies the record, not the pass ID.

Expiry is configured as days from issuance, currently 1–180; expired entities disappear from queries. The plan's event-end-plus-30-days expiry is not yet implemented. Extending the configured value does not extend existing records.

## Check-in — `resona.checkin` (planned, not implemented)

Organizer-owned, `readonly` attributes. Fields: indexed `eventId`, `passId`, `holder`; `checkedInAt` and `ordinal`. Create only after sonar passes, the holder signature is verified, and the ticket is eligible. Read-only attributes do not prevent owner deletion or ownership transfer. Do not store audio. Duplicate prevention and ordinal assignment need a crash-safe, serialized design; a query followed by a write is not atomic.

## World ID uniqueness and claim — `resona.claim` (partially implemented)

One human per event is the target. Bind a unique World action to each event and environment, verify the proof server-side and bind its signal to the holder wallet. `skipped` is never a verified claim.

The organizer-owned read-only-attributes `resona.claim` entity has indexed `operationId`, `eventId`, `passId`, and `holder`. It is public and links the wallet to the event. It contains no nullifier or proof. The claim and ticket's `claimed` status are written in one atomic Arkiv batch, expiring after the configured ticket lifetime from the claim time. Expiration, deletion, and ownership transfer mean it is not a permanent uniqueness authority.

SQLite remains the chosen durable coordinator: it atomically reserves the canonical raw nullifier and action in the existing unique table together with a pending operation ID, pass and holder. Existing nullifier entries remain consumed. A successful Arkiv batch completes the operation; an exception leaves it pending and the ticket blocked from claim or skip. **Pending reconciliation and user recovery are not yet implemented**, including a crash after World verification but before reservation. Run exactly one server process against one durable, backed-up database; the in-process claim/skip queue is not a multi-instance lock. No automatic retry may release a reservation on an ambiguous outcome. The World simulator flow remains unverified.

The verified migration blockers and acceptance criteria are in [world-claim-design.md](world-claim-design.md).

## ENS and door invariants (planned)

ENSv2 on Sepolia supplies the pass and transfer policy; Arkiv supplies application status. Normalize ENS names using ENSIP-15. The ENS address record is not proof of ownership. Once ENS is active, check the actual pass owner in the expected registry and chain against the Arkiv holder before accepting a check-in; fail closed on missing or inconsistent data. Public ENS metadata should contain only the `eventId`, `passId`, and a public link; never duplicate mutable status or World ID data as authoritative metadata. Writes to ENS and Arkiv are not atomic and require reconciliation.

The demo additionally requires a fresh-session wallet signature and sonar pass. Neither a QR code, ENS name, nor Arkiv record proves proximity. Browser clients cannot attest their timing; modified-client resistance is outside the demo.

## Changes and migration

Keep the current schema tag and optional fields readable unless a migration is explicitly implemented. New indexed fields must support a real query. For any schema or status change, update the server, API types, tests and this document together. Verify state transitions and reject claims/skips on `checked_in` or `revoked` tickets. Never infer safe concurrency or unique enforcement from a schema field alone.
