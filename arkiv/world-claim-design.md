# Arkiv World ID claim migration: verification gate

Status: **hybrid implementation in progress; SQLite remains authoritative for duplicate protection**. Do not deploy an Arkiv-only replacement until the requirements below are demonstrated. This document does not claim that World ID or the full check-in is complete.

## Verified facts

- Arkiv [`executeBatch`](https://docs.arkiv.network/writing/batches/) applies all operations in one transaction or none. A claim create and a ticket patch can therefore be committed together on Arkiv; this does not make the preceding World ID verification part of that transaction.
- Arkiv [entity keys](https://docs.arkiv.network/json-rpc/mutating-entities/#entity-keys) include the owner's entity nonce. Using a fixed salt derived from a nullifier does not by itself create a unique key for that nullifier. The documented create operation does not accept a caller-selected key.
- The [documented write operations](https://docs.arkiv.network/json-rpc/mutating-entities/#operations) expose no indexed-field unique constraint, conditional create, or compare-and-swap. This is a finding about the documented API, not a proof about undocumented or future capabilities. Indexed attributes enable queries, not a documented uniqueness guarantee.
- World ID's [integration guide](https://docs.world.org/world-id/idkit/integrate) requires the backend to check and store the action-scoped nullifier with a uniqueness constraint after verification. The Portal verifies the proof; its guide does not make a successful verification a substitute for application-side uniqueness.
- Arkiv [entities expire](https://docs.arkiv.network/writing/expiration/), so a claim used for replay protection must remain live for the entire period in which the corresponding action can be claimed. A deleted, expired, or transferred claim cannot be treated as proof that no earlier claim occurred.

## Migration acceptance criteria

1. An enforceable uniqueness or coordination mechanism prevents duplicate claims even for concurrent requests, overlapping server instances, restarts, and delayed or ambiguous transaction responses. A process-local queue or Arkiv query followed by create is insufficient.
2. A successful claim record and ticket status update commit atomically, with a tested way to reconcile an unknown transaction outcome. Arkiv's atomic batch is a candidate for this part only.
3. Verify what happens when World verification succeeds but the server crashes before Arkiv commits; demonstrate a safe retry/recovery path with real staging proofs. Do not assume that a `nullifier_replayed` response proves an earlier successful claim for a particular ticket.
4. Canonicalize nullifiers before deriving any replay key. Keep raw proofs and nullifiers off public Arkiv; define secret management and rotation if using a keyed digest. Protect records from expiring during the active action.
5. Migrate all existing SQLite nullifiers without exposing them and without creating a replay window. Local inspection on 2026-11-06 found zero rows in this workspace's configured database; that says nothing about other deployments or backups. Never discard a database based on that local observation.
6. Test concurrency across independent processes, restart/crash points, RPC/indexing delays, duplicate proofs and recovery with the World simulator, plus the actual Arkiv network. Preserve owner filtering. Update `arkiv/schema.md` and deployment instructions only after the guarantees are implemented.

The current implementation reserves a pending operation and nullifier together in SQLite, then atomically creates the Arkiv claim and patches the ticket. A failed or uncertain batch remains pending and blocks claim/skip. The record is not automatically reconciled, and the World-verification-to-reservation crash gap remains. This is a single-server demo implementation, not completion of the criteria above.

The existing SQLite table stores only a nullifier and action, not the ticket or operation. Existing consumed entries cannot be automatically attributed to a successful claim versus an interrupted one; retain them and resolve exceptions explicitly. Check [World's migration guidance](https://docs.world.org/world-id/4-0-migration) before assuming legacy and current proof nullifiers are interchangeable.

## Remaining Arkiv demo work

Check-in and its signed wallet/sonar gate, duplicate check-in prevention, event-end-based expiry, and the Arkiv track submission files remain unfinished. Completing the World claim migration alone does not finish Arkiv.
