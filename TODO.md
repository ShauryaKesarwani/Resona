# Resona feature checklist

`[ ]` not started · `[~]` partly implemented or in progress · `[x]` completed and verified for the stated scope. A simulated screen or a passing unit test does not mean an end-to-end feature is complete.

The current code is the source for implementation status; planned behavior and security rules are in [arkiv/schema.md](arkiv/schema.md) and [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md). Reconcile discrepancies before implementing dependent features.

## Project and app

- [x] React/Vite app, web manifest, and Node server that serves the built app exist.
- [x] `GET /api/health` reports whether the server responds; it does not check Arkiv, World ID or ENS.
- [~] Browser wallet and wallet-signature sign-in are implemented; verify the full flow on the demo phones and clarify the security and recovery limits.
- [~] Landing, sign-in, wallet, claim, door and organizer screens exist. The door, wallet check-in and door history screens call the check-in API and Arkiv in code, unverified on phones; the claim's phone-lock step is still simulated. `/privacy` and `/terms` are stubs; the public profile page exists but accepts wallet addresses, not ENS names.
- [~] The organizer page calls the real issue and lookup APIs, and wallet tickets, events and purchases read Arkiv in code; `data/mock.ts` no longer simulates tickets or check-ins. Not yet verified end to end against live Arkiv in the app.
- [x] Require organizer authorization on `POST /issue`: a fresh signature covering the holder and tier, from a wallet in `ORGANIZER_WALLETS`, failing closed when none is listed. Route tests pass, and a live server rejected unsigned and unlisted requests without writing.
- [~] `ORGANIZER_WALLETS` is set in the local `server/.env`, and the organizer page refuses an unlisted wallet with the address to add. Still set it on the VPS, and confirm a listed wallet issues from the page.
- [ ] Deploy a single public HTTPS URL on the team's VPS (one server process behind an HTTPS proxy) and verify installation and microphone access on both Android phones.
- [~] `scripts/autodeploy.sh` keeps the VPS on the latest `origin/main`, tested on a throwaway repo with stubbed builds and with a real server restart locally. Not yet run on the VPS. Pause it before the demo, because a server restart drops check-in sessions.
- [ ] Choose and add an open-source license, if approved by the repo owner. The GitHub repo is public and has no license yet, which the Arkiv track requires.

## Sonar and check-in

- [~] Sonar measurement works in `/lab`, with a two-phone pass reported on 6 November, and the door and wallet screens now use it. Check-in has not been run with real sound on the demo phones after this integration, as far as this checklist can confirm, and repeat reliability is not established.
- [ ] Test near/far results, noise, dropped audio blocks, and the Google Meet relay on the actual demo devices; record results.
- [~] Check-in sessions, polling, fresh seeds, a door PIN and token, and holder-signed reports verified against the ticket wallet exist in `server/src/services/checkin.service.ts`. On 7 November a live server ran them on Rabdi using the real analyzer on synthesized recordings: 30 cm passed, 200 cm was refused, a retry with a new seed then passed, and wrong PINs, forged holder reports, old-attempt reports and repeats were rejected. Sessions live in server memory. `DOOR_PIN` is not set locally, so anyone can currently act as the door.
- [~] The door and wallet screens use real sonar and check-in results in code, and load with live data in a browser; the mic path needs phones. The server rejects repeat check-ins and applies the claim and skip policy to issued tickets, and to bought tickets when skip is off. The door accepts tickets for any of the organizer's events, and its recent list mixes them.
- [~] An issued ticket's check-in and `checked_in` status land in one Arkiv batch, verified live with a skipped ticket; a claimed ticket has not been run live. A bought ticket gets the check-in record only. Ordinals and duplicate checks are a query then a write in one process, so a restart during indexing lag can repeat them, and a failed write is not reconciled.
- [ ] Rehearse the complete issue-to-door journey and document the browser demo's security limits.

## Arkiv

- [x] Testnet setup and lifecycle spike exist; a ticket write/read/patch and read-only spike record were previously tested on Rabdi.
- [~] The server stores accounts, tickets and claims only on Arkiv, with no SQLite left in `server/src`; event and payment schemas and an `arkiv:event` script also exist. All 68 server tests pass on the current working tree. The live API and `npm run arkiv:spike` have not been re-run against Arkiv after this migration.
- [~] `resona.account` storage and owner/creator-filtered account lookups are implemented; verify signup, uniqueness, write recovery and expiration against the data contract. Its query-then-create flow and in-process queue do not establish multi-instance uniqueness.
- [x] Reconcile `arkiv/schema.md`, `arkiv/world-claim-design.md` and `docs/ARCHITECTURE.md` with the Arkiv-only implementation: all six entities are documented from the code, and SQLite is no longer described as active.
- [ ] Decide what to do with the leftover gitignored `server/resona.db` (7 tickets, 1 nullifier for a retired action). No code reads it. Check other deployments or backups before discarding anything.
- [x] Require `createdBy(organizer)` as well as `ownedBy(organizer)` on trusted ticket reads, in the server and `myTickets`, so a forged ticket transferred to the organizer doesn't read as issued. The combined filter was confirmed on a live read; a forged-transfer attempt has not been tried.
- [ ] Implement event-end-plus-retention expiry and a plan for extending records; tickets, claims, payments and accounts currently use the maximum Arkiv lifetime, and check-ins and events do too; the contract now records this. Protect public data and filter trusted reads appropriately.
- [ ] Add the Arkiv track files; checked on 7 November: `arkiv/friction.md`, `reach.md`, `why-arkiv.md` and `how-you-use-arkiv.md` do not exist. `friction.md` needs the team's real notes on what broke.
- [ ] Add writer addresses and a runnable query to the README.
- [~] Show an actual Arkiv read in the app: the wallet ticket, event and purchase screens read through the `/api/arkiv` read proxy in code, but this has not been confirmed on a running app with live data.
- [x] Restore the app build: `npm run build` and all 20 app tests pass on the current working tree. The build warns that the main JavaScript bundle is large.

## World ID

- [~] IDKit sign-in, server-side proof verification, wallet signal binding, session sign-in and demo guest path exist. The team reports a World sign-in worked once from a phone through a Cloudflare tunnel to the backend; it has not been repeated or recorded, and it still needs a repeatable run on the demo setup.
- [ ] Confirm action, RP and environment match on the deployed setup, and test repeat-human rejection end to end.
- [ ] Resolve durable uniqueness, claim recovery, concurrency and crash gaps without relying on a query-then-create check as an atomic constraint. With SQLite gone, sign-up and claims rely on Arkiv queries plus in-process queues, and a verified World proof can be spent before an Arkiv account write fails, with no recovery path; see [arkiv/world-claim-design.md](arkiv/world-claim-design.md).
- [ ] Confirm the demo skip policy is clearly labelled and enforced at the door; record the World integration debrief.

## ENSv2

Lower priority than sonar integration, Arkiv and World ID: the team wants it if possible, for the track, without letting it delay the core demo.

- [~] Standalone CLI supports deploying and linking a Sepolia event UserRegistry with the documented restricted root roles; configure real names and verify a live deployment and roles.
- [~] Standalone CLI issues non-transferable pass subnames and inspects owners; ASCII label and expiry checks have offline tests. It does not yet populate public metadata or store ENS references on Arkiv tickets.
- [x] Add an optional server-side ENSv2 read path: check the event registry link, pass owner, expiry and ticket-holder match; simulate a direct transfer and accept only the expected `TransferDisallowed` revert. The wallet shows the result, and the transfer screen no longer invents a transaction hash. The API-to-RPC integration test passes against a local Sepolia RPC fixture.
- [ ] Enforce the ENS pass owner check at the door: `/api/checkin/start` does not call it yet. Reconcile failed ENS/Arkiv writes.
- [~] The wallet transfer demo now runs a real read-only transfer simulation when ENS is configured. Still verify the result on a live Sepolia pass and implement organizer-approved reassignment.
- [ ] Resolve and display names and profiles in the organizer, wallet and door flows.

## Later stages and submission

- [~] Event listing and public `/e/:id` event pages read Arkiv in code. The public `/u/:name` profile displays attendance trophies from Arkiv but currently accepts a wallet address rather than an ENS name. Verify these pages with live data; ENS-based pages and profiles and POAPs remain to do.
- [~] Testnet purchases exist in code: `/wallet/events` pays the organizer and `/wallet/purchases` shows history, with resume handling for interrupted payments. A live purchase has not been verified here.
- [~] Make purchased tickets trustworthy before any door relies on them. The door reads bought tickets, confirms the payment on chain and, with skip off, requires an account; these have unit tests on a fake store and no live purchase check. The one-ticket-per-human check when buying still runs only in the browser.
- [ ] Add company distribution only after the earlier stages.
- [ ] Complete the [track checklists](docs/TRACKS.md), including the World debrief, AI-use statement, prior-work credit, public repo and demo video.
- [ ] Update the README's implementation status: it still says ticket check-in and Arkiv check-in records do not exist, although both are implemented in code and need phone testing.
- [ ] Confirm the public demo works from a fresh device, contains no committed secrets, and is rehearsed in a noisy room.

## Agent tooling

- [x] Keep shared skills in `.agents/skills` for Codex and OpenCode, with `.claude/skills` symlinks for Claude; Arkiv's 16 skills are added at a pinned commit alongside the World and ENS skills, and Codex and OpenCode discovery was checked.
- [x] Configure `arkiv`, `world-docs` and `context7` MCP for OpenCode; all three connected in `opencode mcp list`.
- [x] Configure the same MCP servers for Codex (`.codex/config.toml`). Each teammate must trust their own clone's exact folder; on this machine a read-only `codex exec` called Arkiv `server_status` and got `mumbai`.
- [~] Configure the same MCP servers for Claude (`.mcp.json`). Claude lists them as pending approval, and a new approved session has not been checked.
- [x] Trim the World skill's copied docs from 32 to 11 `.mdx` pages for the React and Node IDKit flow; the `world-docs` MCP still serves the rest, and the setup script applies the same trim on a fresh install.
- [x] Add the World Developer Portal MCP for this machine's Codex and Claude, in user-level config only; the Portal accepted the key and Claude reports it connected. Other teammates and OpenCode are not set up. Rotate this key after the event, since it was pasted into a chat.
- [ ] After 10 November 2026, decide whether to move the Arkiv MCP from the Mumbai profile to the General one in all three MCP files.

## Checklist maintenance

- [x] Add `AGENTS.md` instructions to maintain this checklist when work or requests change.
- [x] Add `AGENTS.md` guidance to explain responses in clear, everyday language and explain necessary technical terms.
