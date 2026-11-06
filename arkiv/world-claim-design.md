# Arkiv World ID claim: requirements and status

Status: **SQLite is removed and the server is Arkiv-only, by team decision, but the requirements below are not all met.** This was written as a gate on that move. The move went ahead for the demo, so this document now records what the Arkiv-only design still lacks. It does not claim that World ID or the full check-in is complete. The current data contract is in [schema.md](schema.md).

## Verified facts

- Arkiv [`executeBatch`](https://docs.arkiv.network/writing/batches/) applies all operations in one transaction or none. A claim create and a ticket patch can therefore be committed together on Arkiv; this does not make the preceding World ID verification part of that transaction.
- Arkiv [entity keys](https://docs.arkiv.network/json-rpc/mutating-entities/#entity-keys) include the owner's entity nonce. Using a fixed salt derived from a nullifier does not by itself create a unique key for that nullifier. The documented create operation does not accept a caller-selected key.
- The [documented write operations](https://docs.arkiv.network/json-rpc/mutating-entities/#operations) expose no indexed-field unique constraint, conditional create, or compare-and-swap. This is a finding about the documented API, not a proof about undocumented or future capabilities. Indexed attributes enable queries, not a documented uniqueness guarantee.
- World ID's [integration guide](https://docs.world.org/world-id/idkit/integrate) requires the backend to check and store the action-scoped nullifier with a uniqueness constraint after verification. The Portal verifies the proof; its guide does not make a successful verification a substitute for application-side uniqueness.
- Arkiv [entities expire](https://docs.arkiv.network/writing/expiration/), so a record used for replay protection must remain live for the entire period in which the corresponding action can be used. A deleted, expired, or transferred record cannot be treated as proof that no earlier use occurred.

## Requirements and current state

| # | Requirement | State |
|---|---|---|
| 1 | Prevent duplicates across concurrent requests, overlapping instances, restarts, and delayed or ambiguous responses. A process-local queue or an Arkiv query followed by create is insufficient | **Not met.** Sign-up and claims use exactly that, so only one server process may run |
| 2 | Commit the claim record and ticket status atomically, with a tested way to reconcile an unknown transaction outcome | **Partly met.** The batch is atomic. Reconciliation is manual, from `arkiv-writes.log` |
| 3 | Show a safe recovery when World verification succeeds but the server crashes before Arkiv commits. `nullifier_replayed` does not prove an earlier success | **Not met.** The proof is spent, no account exists, and a retry gets `human_has_account` |
| 4 | Canonicalize nullifiers before deriving a replay key, keep raw proofs and nullifiers off Arkiv, define secret management and rotation, and stop records expiring during the active action | **Partly met.** Nullifiers are canonicalized and stored only as keyed hashes. `NULLIFIER_HASH_KEY` has no rotation path, and records expire after about six months with no extension |
| 5 | Handle existing SQLite nullifiers without exposing them or opening a replay window | **Not migrated.** See below |
| 6 | Test across independent processes, restarts, RPC and indexing delays, duplicate proofs and recovery, with the World simulator and the real Arkiv network | **Not done.** Only unit tests with fake stores exist |

## How it works now

Sign-up checks Arkiv for the nullifier hash and wallet, verifies the proof with World, then writes `resona.account` and reads it back, all inside one in-process queue. A claim needs no new proof: it finds the wallet's account, checks for a claim with the same `userId` and `eventId`, then atomically creates the claim and patches the ticket. A failed write is logged and never retried automatically.

World's own replay rejection is the one check outside this process, and it covers the sign-in action only.

## Old SQLite data

No code reads SQLite any more. A gitignored `server/resona.db` remains in one workspace, with 7 tickets and 1 nullifier for the retired action `claim-devcon8-demo-r1`, seen on 2026-11-07. The nullifier table stored only a nullifier and action, not the ticket or operation, so an entry cannot be attributed to a successful claim versus an interrupted one. Other deployments or backups may hold more. Check [World's migration guidance](https://docs.world.org/world-id/4-0-migration) before assuming legacy and current proof nullifiers are interchangeable.

## Remaining Arkiv demo work

Event-end-based expiry, crash-safe check-in, live verification of the check-in flow, and the Arkiv track submission files remain unfinished. Meeting the requirements above alone does not finish Arkiv.
