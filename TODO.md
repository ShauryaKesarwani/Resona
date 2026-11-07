# Resona feature checklist

`[ ]` not started · `[~]` partly implemented or in progress · `[x]` completed and verified for the stated scope. A simulated screen or a passing unit test does not mean an end-to-end feature is complete.

The current code is the source for implementation status; planned behavior and security rules are in [arkiv/schema.md](arkiv/schema.md) and [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md). Reconcile discrepancies before implementing dependent features.

## Project and app

- [x] React/Vite app, web manifest, and Node server that serves the built app exist.
- [x] `GET /api/health` reports whether the server responds; it does not check Arkiv, World ID or ENS.
- [~] Browser wallet and wallet-signature sign-in are implemented; verify the full flow on the demo phones and clarify the security and recovery limits.
- [~] Landing, sign-in, wallet, claim, door and organizer screens exist. The door, wallet check-in and door history screens now call the real check-in API and Arkiv in code, unverified on phones; the claim's phone-lock step is still simulated; `/privacy` and `/terms` are stubs. `/u/:name` renders an Arkiv-backed attendance/trophy profile for wallet addresses and resolves ENS names through ENSNode; live mapping and phone verification remain pending.
- [~] The organizer page calls the real issue and lookup APIs, and wallet tickets, events and purchases read Arkiv in code; `data/mock.ts` no longer simulates tickets or check-ins. Not yet verified end to end against live Arkiv in the app.
- [~] Require organizer authorization for event creation and ticket issuance: each action needs a fresh signed wallet, a World-linked account, and either a bootstrap wallet or a trusted promotion. Ticket signatures cover the selected event, holder and tier. Route coverage was updated; run it when the local Node environment works, then verify against live Arkiv.
- [~] Multiple organizer admins are supported: `ORGANIZER_WALLETS` bootstraps admins, who can promote existing World-linked Arkiv accounts through a trusted `resona.organizer` grant. Admin actions require a World-linked account and fresh wallet signature; new events belong to the signed-in organizer, ticket issuance requires choosing one of their events, and event payments go to that organizer wallet. Code and route tests are written, but server tests could not start (`uv_os_get_passwd` returned `ENOMEM`) and the app build could not resolve its installed `@arkiv-network/sdk` dependency. Live Arkiv, admin sign-in, payment routing, VPS configuration and organizer isolation still need verification. Grant revocation is not implemented, and legacy events remain shared under the server wallet.
- [ ] Add organizer grant revocation and verify promotion/readback and per-organizer event/payment isolation against live Arkiv.
- [ ] Deploy a single public HTTPS URL on the team's VPS (one server process behind an HTTPS proxy) and verify installation and microphone access on both Android phones.
- [~] Investigate the Oracle VPS deployment: the reported server started on port 3050 and served the frontend, but public API routing and the full deployment have not been verified on the VPS.
- [~] `scripts/autodeploy.sh` keeps the VPS on the latest `origin/main`, tested on a throwaway repo with stubbed builds and with a real server restart locally. Not yet run on the VPS. Pause it before the demo, because a server restart drops check-in sessions.
- [ ] Choose and add an open-source license, if approved by the repo owner. The GitHub repo is public and has no license yet, which the Arkiv track requires.

## Sonar and check-in

- [~] Sonar measurement works in `/lab`, with a two-phone pass reported on 6 November, and the door and wallet screens now use it. Check-in has not been run with real sound on the demo phones after this integration, as far as this checklist can confirm, and repeat reliability is not established.
- [ ] Test near/far results, noise, dropped audio blocks, and the Google Meet relay on the actual demo devices; record results.
- [~] Check-in sessions, polling, fresh seeds, a door PIN and token, and holder-signed reports verified against the ticket wallet exist in `server/src/services/checkin.service.ts`. On 7 November a live server ran them on Rabdi using the real analyzer on synthesized recordings: 30 cm passed, 200 cm was refused, a retry with a new seed then passed, and wrong PINs, forged holder reports, old-attempt reports and repeats were rejected. Sessions live in server memory. `DOOR_PIN` is not set locally, so anyone can currently act as the door.
- [~] The door and wallet screens use real sonar and check-in results in code, and load with live data in a browser; the mic path needs phones. The server rejects repeat check-ins and applies the claim and skip policy to issued tickets. Bought tickets now require a trusted World account and an unused human/event claim at session start and admission, even when skip is on; fake-store regression tests pass, but the updated policy has not been verified live. The door accepts tickets for any of the organizer's events, and its recent list mixes them.
- [~] The door's ready screen offers QR scanning for the holder's six-digit check-in code, with typed entry as a fallback; verify camera, microphone and scan-to-check-in on the demo phones.
- [~] Organizer attendee page reads organizer-issued tickets and check-ins from Arkiv per event, offers search and counts, and can select an active holder-started check-in with a configured door PIN. It now lists the signed-in organizer's events and legacy shared-server events; bought tickets are excluded. Verify live data and phone flow, then add a safely verified purchase list if needed.
- [~] An issued ticket's check-in and `checked_in` status land in one Arkiv batch, verified live with a skipped ticket; a claimed ticket has not been run live. A bought ticket's human claim and check-in now land in one batch, not yet verified live. Ordinals and duplicate checks are a query then a write in one process, so a restart during indexing lag can repeat them, and a failed write is not reconciled.
- [~] The README now lists practical door-demo precautions and browser security limits. Rehearse the complete issue-to-door journey on the demo phones and record the results.

## Arkiv

- [x] Testnet setup and lifecycle spike exist; a ticket write/read/patch and read-only spike record were previously tested on Rabdi.
- [~] The server stores accounts, tickets and claims only on Arkiv, with no SQLite left in `server/src`; event and payment schemas and an `arkiv:event` script also exist. No SQL code or dependency remains in the server or app. The live API and `npm run arkiv:spike` have not been re-run against Arkiv after this migration.
- [~] `resona.account` storage and owner/creator-filtered account lookups are implemented; verify signup, uniqueness, write recovery and expiration against the data contract. Its query-then-create flow and in-process queue do not establish multi-instance uniqueness.
- [x] Reconcile `arkiv/schema.md`, `arkiv/world-claim-design.md` and `docs/ARCHITECTURE.md` with the Arkiv-only implementation: the current Arkiv entities are documented from the code, and SQLite is no longer described as active.
- [ ] Decide what to do with the leftover gitignored `server/resona.db` (7 tickets, 1 nullifier for a retired action). No code reads it. Check other deployments or backups before discarding anything.
- [x] Require `createdBy(organizer)` as well as `ownedBy(organizer)` on trusted ticket reads, in the server and `myTickets`, so a forged ticket transferred to the organizer doesn't read as issued. The combined filter was confirmed on a live read; a forged-transfer attempt has not been tried.
- [ ] Implement event-end-plus-retention expiry and a plan for extending records; tickets, claims, payments and accounts currently use the maximum Arkiv lifetime, and check-ins and events do too; the contract now records this. Protect public data and filter trusted reads appropriately.
- [ ] Add the Arkiv track files; checked on 7 November: `arkiv/friction.md`, `reach.md`, `why-arkiv.md` and `how-you-use-arkiv.md` do not exist. `friction.md` needs the team's real notes on what broke.
- [ ] Add writer addresses and a runnable query to the README.
- [~] Show an actual Arkiv read in the app: the wallet ticket, event and purchase screens read through the `/api/arkiv` read proxy in code, but this has not been confirmed on a running app with live data.
- [x] Restore the app build: a clean `npm ci` in `app/` resolves `@arkiv-network/sdk`; the production build and app tests passed before this merge.
- [ ] Reduce the frontend bundle if needed for demo-phone loading: the production build warns about a roughly 1.19 MB minified main JavaScript chunk (362 KB gzip); measure on phones and consider route-level code splitting.

## World ID

- [~] IDKit sign-in, server-side proof verification, wallet signal binding, session sign-in and demo guest path exist. The team reports a World sign-in worked once from a phone through a Cloudflare tunnel to the backend; it has not been repeated or recorded, and it still needs a repeatable run on the demo setup.
- [ ] Confirm action, RP and environment match on the deployed setup, and test repeat-human rejection end to end.
- [ ] Diagnose the VPS World ID `integrity_verification_failed` response using the actual test environment and World configuration; a successful verification has not been confirmed.
- [ ] Resolve durable uniqueness, claim recovery, concurrency and crash gaps without relying on a query-then-create check as an atomic constraint. With SQLite gone, sign-up and claims rely on Arkiv queries plus in-process queues, and a verified World proof can be spent before an Arkiv account write fails, with no recovery path; see [arkiv/world-claim-design.md](arkiv/world-claim-design.md).
- [ ] Confirm the demo skip policy is clearly labelled and enforced at the door; record the World integration debrief.

## ENSv2

Lower priority than sonar integration, Arkiv and World ID: the team wants it if possible, for the track, without letting it delay the core demo.

- [~] Standalone CLI supports deploying and linking a Sepolia event UserRegistry with the documented restricted root roles; configure real names and verify a live deployment and roles.
- [~] Standalone CLI issues non-transferable pass subnames and inspects owners; ASCII label and expiry checks have offline tests. It does not yet populate public metadata or store ENS references on Arkiv tickets.
- [x] Add an optional server-side ENSv2 read path: check the event registry link, pass owner, expiry and ticket-holder match; simulate a direct transfer and accept only the expected `TransferDisallowed` revert. The wallet shows the result, and the transfer screen no longer invents a transaction hash. The API-to-RPC integration test passes against a local Sepolia RPC fixture.
- [~] Enforce configured ENS pass ownership at the door: the check-in path now checks the event-registry link, active expiry and Arkiv-holder match at session start and rechecks immediately before the Arkiv write; failures stop admission. Tests were updated but not run, and live Sepolia pass verification and write reconciliation remain pending.
- [~] Organizer-approved transfer is implemented in code: a holder can request reassignment to an ENS-resolved Rabdi wallet, cancel while pending, and an event organizer can approve/decline. Approval reassigns the Sepolia pass then patches the Arkiv ticket; check-in is blocked during pending or needs-review requests. Tests/build and live ENS signer roles, write, reconciliation and phone flow remain unverified.
  - [~] Add forward ENS name lookup through ENSNode for organizer ticket issue/lookup, attendee search and public `/u/:name` profiles. Event, purchase-success, ticket and door screens now show ENS event/pass names when configured. The lookup normalizes names and reads the Rabdi-specific wallet address record; tests are written but not run. Verify the name mappings against the configured ENSNode and live Sepolia setup.

## Later stages and submission

- [~] Public `/events`, `/e/:id`, signed-in `/e/:id/buy`, and `/u/:name` profiles with Arkiv-backed attendance trophies now exist; ENS names forward-resolve to wallet profiles through ENSNode. `/wallet/events` redirects to `/events`. Build and ENS lookup tests have not been run for this change; live data and phone flows remain unverified. POAP issuance is not implemented.
- [~] Testnet purchases exist in code: `/wallet/events` pays the organizer and `/wallet/purchases` shows history, with resume handling for interrupted payments. A live purchase has not been verified here.
- [~] Make purchased tickets trustworthy before any door relies on them. The door now reads bought tickets and confirms the payment on chain, with unit tests on a fake store and no live purchase check. Server admission now requires the holder's trusted World account regardless of demo skip and no prior human/event claim, and atomically writes a claim with the check-in under the shared in-process claim/check-in queue. Purchase-time uniqueness still runs only in the browser, so bypassed clients can pay for tickets they cannot use. Live batch verification and durable uniqueness/recovery remain pending; trusted-creator filtering is implemented as recorded above.
- [ ] Add company distribution only after the earlier stages.
- [~] Complete the [track checklists](docs/TRACKS.md). The README credits enconomy as prior inspiration; the World debrief, AI-use statement, license, demo video and other submission items remain.
- [x] Update the README's implementation status: it describes the check-in API and Arkiv records as implemented, while noting that real-phone integration testing remains.
- [ ] Confirm the public demo works from a fresh device, contains no committed secrets, and is rehearsed in a noisy room.

## Agent tooling

- [x] Keep shared skills in `.agents/skills` for Codex and OpenCode, with `.claude/skills` symlinks for Claude; Arkiv's 16 skills are added at a pinned commit alongside the World and ENS skills, and Codex and OpenCode discovery was checked.
- [x] Configure `arkiv`, `world-docs` and `context7` MCP for OpenCode; all three connected in `opencode mcp list`.
- [x] Configure the same MCP servers for Codex (`.codex/config.toml`). Each teammate must trust their own clone's exact folder; on this machine a read-only `codex exec` called Arkiv `server_status` and got `mumbai`.
- [~] Configure the same MCP servers for Claude (`.mcp.json`). Claude lists them as pending approval, and a new approved session has not been checked.
- [x] Trim the World skill's copied docs from 32 to 11 `.mdx` pages for the React and Node IDKit flow; the `world-docs` MCP still serves the rest, and the setup script applies the same trim on a fresh install.
- [x] Add the World Developer Portal MCP for this machine's Codex and Claude, in user-level config only; the Portal accepted the key and Claude reports it connected. Other teammates and OpenCode are not set up. Rotate this key after the event, since it was pasted into a chat.
- [ ] After 10 November 2026, decide whether to move the Arkiv MCP from the Mumbai profile to the General one in all three MCP files.

## Latest readiness review

- [x] Recheck updated source and local baseline: 61 server tests, 20 synthetic sonar tests and the frontend production build pass. Check-in sessions/retries, public event pages and wallet-address trophy profiles now exist; live Arkiv, World simulator, Sepolia and two-phone verification remain pending.
- [x] Revalidate ticket eligibility inside the serialized admission/signer queues immediately before the write: holder, status, event end, prior wallet admission, ticket identity and bought-ticket World account, human claim and payment. Add fake-store tests for changes during a session, delayed admission, concurrent same-human admissions and fail-closed reads. All 83 server tests and the frontend production build pass. These reads are not an atomic on-chain condition; live Arkiv verification remains pending.
- [x] Enforce bought-ticket World policy at admission: require a trusted account even when demo skip is on, reject existing human/event claims, and atomically write the purchased pass's claim with its check-in. Existing schemas remain readable; prior check-ins are not backfilled. Verified by fake-store service tests, not a live Arkiv batch.
- [~] Enforce configured ENS ownership at the door; implementation now fails closed at session start and before write, but tests and live Sepolia verification remain pending.

## Checklist maintenance

- [x] Resolve the rebase conflicts while preserving the attendee and QR flows alongside purchased-ticket eligibility checks. The combined tree passes 92 server tests, 22 app tests and the frontend production build; phone and live Arkiv verification remain outstanding.
- [x] Add `AGENTS.md` instructions to maintain this checklist when work or requests change.
- [x] Resolve upstream/stashed conflicts while preserving organizer authorization, trusted-creator filters, live-test notes, purchased-ticket World policy and admission rechecks. Verification after resolution: 89 server tests, 20 app tests and the frontend production build pass; real-phone and purchased-ticket live batch verification remain pending.
