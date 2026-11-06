# Resona feature checklist

`[ ]` not started · `[~]` partly implemented or in progress · `[x]` completed and verified for the stated scope. A simulated screen or a passing unit test does not mean an end-to-end feature is complete.

The current code is the source for implementation status; planned behavior and security rules are in [arkiv/schema.md](arkiv/schema.md) and [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md). Reconcile discrepancies before implementing dependent features.

## Project and app

- [x] React/Vite app, web manifest, and Node server that serves the built app exist.
- [~] Browser wallet and wallet-signature sign-in are implemented; verify the full flow on the demo phones and clarify the security and recovery limits.
- [~] Landing, sign-in, wallet, claim, door and organizer screens exist. The door, wallet check-in and door history screens now call the real check-in API and Arkiv in code, unverified on phones; the claim's phone-lock step is still simulated; `/privacy`, `/terms` and `/u/:name` are stubs.
- [~] The organizer page calls the real issue and lookup APIs, and wallet tickets, events and purchases read Arkiv in code; `data/mock.ts` no longer simulates tickets or check-ins. Not yet verified end to end against live Arkiv in the app.
- [ ] Require organizer authorization on `POST /issue`; any caller can currently make the server's signer write a ticket.
- [ ] Deploy a single public HTTPS URL and verify installation and microphone access on both Android phones.
- [ ] Choose and add an open-source license, if approved by the repo owner. The GitHub repo is public and has no license yet, which the Arkiv track requires.

## Sonar and check-in

- [~] Sonar lab, audio processing and lab server routes exist; the build plan reports a two-phone pass, but full reliability and check-in integration are not established.
- [ ] Test near/far results, noise, dropped audio blocks, and the Google Meet relay on the actual demo devices; record results.
- [~] Check-in sessions, polling, fresh seeds, a door PIN and token, and holder-signed reports verified against the ticket wallet exist in `server/src/services/checkin.service.ts`, with unit tests on a fake store. Sessions live in server memory. Not verified on live Arkiv or the demo phones.
- [~] The door and wallet screens use real sonar and check-in results in code; the server rejects repeat check-ins and applies the claim and skip policy to issued tickets. Bought tickets are not held to the World policy at the door. Not run on the demo phones.
- [~] An issued ticket's check-in and `checked_in` status land in one Arkiv batch, and a bought ticket gets the check-in record only. Ordinals and duplicate checks are a query then a write in one process, so a restart during indexing lag can repeat them, and a failed write is not reconciled.
- [ ] Rehearse the complete issue-to-door journey and document the browser demo's security limits.

## Arkiv

- [x] Testnet setup and lifecycle spike exist; a ticket write/read/patch and read-only spike record were previously tested on Rabdi.
- [~] The server stores accounts, tickets and claims only on Arkiv, with no SQLite left in `server/src`; event and payment schemas and an `arkiv:event` script also exist. The removal is confirmed: no SQL code or dependency remains in the server or app, and all 54 server tests pass on the current working tree. The live API and `npm run arkiv:spike` have not been re-run against Arkiv after this migration.
- [~] `resona.account` storage and owner/creator-filtered account lookups are implemented; verify signup, uniqueness, write recovery and expiration against the data contract. Its query-then-create flow and in-process queue do not establish multi-instance uniqueness.
- [x] Reconcile `arkiv/schema.md`, `arkiv/world-claim-design.md` and `docs/ARCHITECTURE.md` with the Arkiv-only implementation: all six entities are documented from the code, and SQLite is no longer described as active.
- [ ] Decide what to do with the leftover gitignored `server/resona.db` (7 tickets, 1 nullifier for a retired action). No code reads it. Check other deployments or backups before discarding anything.
- [ ] Add `createdBy(organizer)` to trusted ticket reads, in the server and `myTickets`. They use `ownedBy` alone, and an Arkiv ownership transfer needs no recipient consent, so a forged ticket transferred to the organizer would read as issued and skip the payment check. Not yet tested live.
- [ ] Implement event-end-plus-retention expiry and a plan for extending records; tickets, claims, payments and accounts currently use the maximum Arkiv lifetime, and check-ins and events do too; the contract now records this. Protect public data and filter trusted reads appropriately.
- [ ] Add Arkiv track files: friction, reach, why Arkiv, and how Arkiv is used; complete schema details as implemented.
- [ ] Add writer addresses and a runnable query to the README.
- [~] Show an actual Arkiv read in the app: the wallet ticket, event and purchase screens read through the `/api/arkiv` read proxy in code, but this has not been confirmed on a running app with live data.
- [ ] Restore the app build: `@arkiv-network/sdk` is declared in `app/package.json` and its lockfile, but `npm run build` cannot resolve it from the current app install.

## World ID

- [~] IDKit sign-in, server-side proof verification, wallet signal binding, signed wallet login and demo guest path exist; a successful real simulator flow is not yet confirmed here.
- [ ] Verify action, RP and environment match; test successful verification and repeat-human rejection end to end with the simulator.
- [ ] Resolve durable uniqueness, claim recovery, concurrency and crash gaps without relying on a query-then-create check as an atomic constraint. With SQLite gone, sign-up and claims rely on Arkiv queries plus in-process queues, and a verified World proof can be spent before an Arkiv account write fails, with no recovery path; see [arkiv/world-claim-design.md](arkiv/world-claim-design.md).
- [ ] Confirm the demo skip policy is clearly labelled and enforced at the door; record the World integration debrief.

## ENSv2

- [~] Standalone CLI supports deploying and linking a Sepolia event UserRegistry with the documented restricted root roles; configure real names and verify a live deployment and roles.
- [~] Standalone CLI issues non-transferable pass subnames and inspects owners; ASCII label and expiry checks have offline tests. It does not yet populate public metadata or store ENS references on Arkiv tickets.
- [x] Add an optional server-side ENSv2 read path: check the event registry link, pass owner, expiry and ticket-holder match; simulate a direct transfer and accept only the expected `TransferDisallowed` revert. The wallet shows the result, and the transfer screen no longer invents a transaction hash. The API-to-RPC integration test passes against a local Sepolia RPC fixture.
- [ ] Enforce the ENS pass owner check at the door: `/api/checkin/start` does not call it yet. Reconcile failed ENS/Arkiv writes.
- [~] The wallet transfer demo now runs a real read-only transfer simulation when ENS is configured. Still verify the result on a live Sepolia pass and implement organizer-approved reassignment.
- [ ] Resolve and display names and profiles in the organizer, wallet and door flows.

## Later stages and submission

- [~] Add event pages, attendee profiles, attendance trophies and POAPs when the core journey is working. `/wallet/events` lists events; public `/e/:name` pages, `/u/:name` profiles, trophies and POAPs are not built.
- [~] Testnet purchases exist in code: `/wallet/events` pays the organizer and `/wallet/purchases` shows history, with resume handling for interrupted payments. A live purchase has not been verified here.
- [~] Make purchased tickets trustworthy before any door relies on them. The door now reads bought tickets and confirms the payment on chain, with unit tests on a fake store and no live check. It does not require a World account or claim, so a wallet with no World ID can pay and be admitted, and the one-ticket-per-human check still runs only in the browser.
- [ ] Add company distribution only after the earlier stages.
- [ ] Complete the [track checklists](docs/TRACKS.md), including the World debrief, AI-use statement, prior-work credit, public repo and demo video.
- [ ] Confirm the public demo works from a fresh device, contains no committed secrets, and is rehearsed in a noisy room.

## Agent tooling

- [x] Keep shared skills in `.agents/skills` for Codex and OpenCode, with `.claude/skills` symlinks for Claude; Arkiv's 16 skills are added at a pinned commit alongside the World and ENS skills, and Codex and OpenCode discovery was checked.
- [x] Configure `arkiv`, `world-docs` and `context7` MCP for OpenCode; all three connected in `opencode mcp list`.
- [x] Configure the same MCP servers for Codex (`.codex/config.toml`). Each teammate must trust their own clone's exact folder; on this machine a read-only `codex exec` called Arkiv `server_status` and got `mumbai`.
- [~] Configure the same MCP servers for Claude (`.mcp.json`). Claude lists them as pending approval, and a new approved session has not been checked.
- [x] Trim the World skill's copied docs from 32 to 11 `.mdx` pages for the React and Node IDKit flow; the `world-docs` MCP still serves the rest, and the setup script applies the same trim on a fresh install.
- [ ] Add the World Developer Portal MCP for the one person managing the World app; it needs their team API key and stays out of shared config. See [docs/AI_TOOLS_SETUP.md](docs/AI_TOOLS_SETUP.md).
- [ ] After 10 November 2026, decide whether to move the Arkiv MCP from the Mumbai profile to the General one in all three MCP files.

## Checklist maintenance

- [x] Add `AGENTS.md` instructions to maintain this checklist when work or requests change.
