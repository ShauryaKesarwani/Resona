# Resona demo data contract

This is the authoritative target for demo data and security invariants. Implementation status is explicit below; a planned field or rule is not evidence of an implemented feature. Update this document and tests when the contract changes. Arkiv is public: never store raw World ID proofs or nullifiers, signing keys, personal details, or audio there.

## Storage

Arkiv is the only persistent store. There is no SQL database: the server has no SQLite code or dependency, and nothing reads a leftover local `server/resona.db`. Live check-in sessions and a few in-process guards are held in server memory and are lost on restart. `arkiv-writes.log` is a local journal of write intents and hashes, not a data store.

Anyone can write any schema tag, so a record counts only if the read filters it to a trusted address. Schemas are defined in `server/src/arkiv/` and repeated in `app/src/services/arkiv.ts`; keep both copies identical.

| Entity | Written by | Attributes | Trusted read filter | Status |
|---|---|---|---|---|
| `resona.account` | Organizer | Read-only | `createdBy(organizer)` | Implemented |
| `resona.event` | Organizer | Read-only | `createdBy(organizer)` | Implemented |
| `resona.ticket` | Organizer (issued) or buyer's wallet (bought) | Mutable | Issued: `ownedBy(organizer)`. Bought: `createdBy(holder)` | Implemented, see known gaps |
| `resona.claim` | Organizer | Read-only | `createdBy(organizer)` | Partially implemented |
| `resona.payment` | Buyer's wallet | Read-only | `createdBy(buyer)`, then checked against the chain | Partially implemented |
| `resona.checkin` | Organizer | Read-only | `createdBy(organizer)` | Partially implemented |

`*` in the tables below means indexed. Relationships are matching indexed values, not foreign keys, and nothing enforces them.

**Expiry.** Every entity is written with `ExpirationTime.max()`, about six months, and expired entities disappear from queries. Records written earlier keep their original expiry. Event-end-plus-retention expiry and lifetime extension are not implemented, so an expired account or claim stops counting towards uniqueness.

**Identifiers.** `eventId` is the SHA-256 hex of the event slug; tickets issued by the server use the hash of `ARKIV_EVENT_ID`. `userId` is the SHA-256 hex of `nullifierHash`. The Arkiv entity key identifies a record, not a pass ID.

## Account — `resona.account` (implemented)

One record per human and wallet, defined in `server/src/arkiv/accounts.ts`.

| Field | Type | Meaning |
|---|---|---|
| `wallet`* | address | The account's wallet |
| `nullifierHash`* | string | HMAC-SHA-256 of the canonical World nullifier, keyed by `NULLIFIER_HASH_KEY` |
| `userId`* | optional string | Stable public user ID. If missing, derive it from `nullifierHash` |
| `sessionHash` | optional string | HMAC-SHA-256 of `session:<World session ID>`, same key |

`NULLIFIER_HASH_KEY` must stay secret and must not change: a new key stops every lookup from matching. An account made before World sessions existed gains a second read-only record that adds `sessionHash`, and the record with a session wins when reading. A record is written once the proof is verified, then read back to wait for indexing.

## Event — `resona.event` (implemented)

Created with `npm run arkiv:event`, defined in `server/src/arkiv/records.ts`.

| Field | Type | Meaning |
|---|---|---|
| `eventId`* | string | Hash of the event slug |
| `eventName` | string | Display name |
| `organiser`* | address | Organizer address, also the payment recipient |
| `eventDate` | string | `YYYY-MM-DD`. The event has ended once this date has passed, in UTC |
| `priceWei` | string | Ticket price in wei of tGLM |

Nothing stops a second event with the same `eventId`, and reads take the first match. An event with no record never counts as ended.

## Ticket — `resona.ticket` (implemented)

Defined in `server/src/arkiv/tickets.ts`.

| Field | Type | Meaning |
|---|---|---|
| `passId`* | string | Random UUID, stable identifier |
| `eventId`* | string | Hash of the event slug |
| `holder`* | address | Assigned wallet |
| `tier`* | string | Ticket tier |
| `status`* | string | `issued`, `claimed`, `skipped`, `checked_in`, `revoked` |
| `ensName` | optional string | Normalized ENS pass name |
| `ensNode` | optional string | Pass Node, 32-byte hex |
| `ensRegistry` | optional address | ENSv2 registry that holds the pass |
| `ensChainId` | optional string | Decimal chain ID of that registry |

An **issued** ticket is written by the organizer with status `issued`. Its allowed transitions are:

- `issued` to `skipped`, when the wallet has no account and `ALLOW_WORLD_SKIP` is on. `skipped` is never a verified claim.
- `issued` or `skipped` to `claimed`, when the wallet has an account, in one batch with the claim.
- `claimed` to `checked_in`, or `skipped` to `checked_in` when skip is allowed, in one batch with the check-in.

A **bought** ticket is written by the buyer's own wallet with status `claimed`, in one batch with its payment record. The buyer owns it, so its fields are self-reported and the organizer cannot patch it. Its status stays `claimed` after admission, which makes `resona.checkin`, not ticket status, the authority for whether a bought ticket was used.

`revoked` is refused at the door, but nothing sets it: revocation is not implemented.

ENS fields are optional for compatibility with existing tickets. The standalone Sepolia CLI can issue a matching ENS pass, but it does not write these fields to Arkiv; the HTTP ticket API does not populate them. Any stored ENS fields are **unverified metadata**, not evidence of ownership. When configured, the read-only `/api/ens/pass/:passId` endpoint derives the expected pass name from the ticket `passId` and compares its current Sepolia registry owner and expiry with the Arkiv holder. This live read does not persist or validate the optional ENS fields. The wallet uses the endpoint to display the result. The transfer-check endpoint runs an `eth_call` and accepts only the exact `TransferDisallowed` error; it does not submit a transaction. There is no ENS/Arkiv write reconciliation.

## Payment — `resona.payment` (partially implemented)

Written by the buyer's wallet from the browser, defined in `server/src/arkiv/records.ts`. A purchase is a plain tGLM transfer from the buyer to the organizer on Rabdi, followed by the ticket and payment batch. Neither record is proof of payment by itself.

| Field | Type | Meaning |
|---|---|---|
| `txnHash`* | string | The payment transaction |
| `eventId`* | string | Hash of the event slug |
| `userId`* | string | The buyer's user ID, self-reported and not checked at the door |
| `passId`* | string | The ticket this pays for |
| `amountWei` | string | Self-reported amount. The door uses the chain's value instead |
| `createdAt`* | string | ISO timestamp |

The door accepts a bought ticket only if the buyer's payment record matches the pass and event, that transaction backs no other payment record from the buyer, the event exists, and the chain shows a successful transaction from the buyer to the organizer worth at least `priceWei`.

## World ID uniqueness and claim — `resona.claim` (partially implemented)

One human per event is the target. The implementation has two steps, neither of which is an atomic uniqueness constraint.

**Sign-up.** One World action, `WORLD_ACTION`, covers first sign-in for the whole app; it is not per event. The server verifies the proof server-side, binds its signal to the wallet, and refuses a nullifier hash or a wallet that already has an account. Later sign-ins prove the account's own World session from its wallet. World rejecting a replayed nullifier is the only external check.

**Claim.** A claim needs no new proof: the wallet's account stands in for it, and `userId` plus `eventId` give one claim per human per event.

| Field | Type | Meaning |
|---|---|---|
| `operationId`* | string | Random UUID for this claim |
| `eventId`* | string | Hash of the event slug |
| `passId`* | string | The claimed ticket |
| `holder`* | address | The claiming wallet |
| `userId`* | string | The account's user ID |

The claim contains no nullifier or proof, but it is public and links the wallet and user ID to the event. The claim and the ticket's `claimed` status are written in one atomic Arkiv batch. Expiration, deletion, and ownership transfer mean it is not a permanent uniqueness authority.

Duplicate protection is an Arkiv query followed by a write, inside an in-process queue, plus an in-memory set of recent claims. That covers concurrent requests in one process only, so **run exactly one server process.** It does not cover a second instance, or a restart combined with indexing lag. An error is never retried automatically. Claims written before `userId` was added are not found by the duplicate check.

**Recovery is not implemented.** If World accepts a proof and the account write then fails, the proof is spent and no account exists; a retry gets `human_has_account`. A write that fails with an uncertain outcome is logged to the journal and must be checked by hand. The World simulator flow remains unverified.

The original requirements for replacing SQLite are in [world-claim-design.md](world-claim-design.md). The Arkiv-only implementation does not meet all of them.

## Check-in — `resona.checkin` (partially implemented)

Defined in `server/src/arkiv/records.ts`. The session logic is in `server/src/services/checkin.service.ts`, with tests that use a fake store. It has not been verified on live Arkiv or on the demo phones.

| Field | Type | Meaning |
|---|---|---|
| `eventId`* | string | Hash of the event slug |
| `passId`* | string | The admitted ticket |
| `holder`* | address | The admitted wallet |
| `ordinal` | string | Arrival number within the event |
| `distanceCm` | string | The measured distance, rounded |
| `checkedInAt` | string | ISO timestamp |

Create a record only after every one of these holds:

1. The holder's wallet signed the start request and owns the ticket.
2. The ticket is `claimed`, or `skipped` when skip is allowed, and the event has not ended.
3. This wallet has no check-in for the event.
4. A bought ticket passes the payment check above.
5. Each phone reported once for a session with a fresh random seed: the door with its session token, and the holder with a signature over the session and reading.
6. The server computed the distance from both reports and it passed.

Failed attempts write nothing. Sessions live in server memory and expire. `DOOR_PIN` guards the door; if it is unset, anyone can act as the door. Never store audio.

An issued ticket's check-in and its `checked_in` status land in one atomic batch; a bought ticket only gets the check-in record. Read-only attributes do not prevent owner deletion or ownership transfer.

Duplicate prevention and ordinals are not crash-safe. Both are a query followed by a write in one process, with in-memory floors for indexing lag, and the count reads at most 1,000 records. A restart during indexing lag can repeat an ordinal or allow a second admission. A failed write ends the session as `failed` and is never retried, even though it may have landed, so the organizer must check it before admitting the holder.

## ENS and door invariants (partially implemented)

ENSv2 on Sepolia supplies the pass and transfer policy; Arkiv supplies application status. The implementation currently restricts pass labels and event names to a single ASCII `.eth` label; this is the accepted subset for which ASCII case folding is ENSIP-15 safe. The ENS address record is not proof of ownership. A read-only API checks the configured event-registry link, current pass owner, expiry and Arkiv holder match, and the wallet can display that result. **Check-in does not call this check**, so ENS ownership is not enforced at the door. Check-in must fail closed on missing or inconsistent ENS data immediately before its Arkiv write once this is added. Public ENS metadata is not implemented; if added, it should contain only `eventId`, `passId`, and a public link, never mutable status or World ID data as authoritative metadata. Writes to ENS and Arkiv are not atomic and require reconciliation.

The demo additionally requires a holder wallet signature and sonar pass. Neither a QR code, ENS name, nor Arkiv record proves proximity. Browser clients cannot attest their timing; modified-client resistance is outside the demo.

## Known gaps

- **Forged issued tickets.** Issued tickets are trusted by `ownedBy(organizer)` alone, and an Arkiv ownership transfer needs no recipient consent. Anyone could write a ticket and transfer it to the organizer, and it would read as issued, skipping the payment check. Trusted reads should also require `createdBy(organizer)`. This follows from Arkiv's documented behaviour and has not been tested live.
- **Bought tickets skip World ID.** The one-ticket-per-human check for purchases runs only in the browser, and the door does not require an account or a claim for a bought ticket. A wallet with no World ID can pay, write its own ticket and be admitted. Separate wallets of one human are not linked.
- **Open issuance.** `POST /issue` has no organizer authorization.
- **Single process.** All uniqueness and ordering depends on one server process.

## Changes and migration

Keep the current schema tags and optional fields readable unless a migration is explicitly implemented. New indexed fields must support a real query. For any schema or status change, update the server, the browser schema copies, API types, tests and this document together. Verify state transitions and reject claims/skips on `checked_in` or `revoked` tickets. Never infer safe concurrency or unique enforcement from a schema field alone.

SQLite data was not migrated. Old demo tickets and nullifiers do not carry over, so create fresh tickets through the Arkiv API.
