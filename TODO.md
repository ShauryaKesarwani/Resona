# Resona feature checklist

`[ ]` not started · `[~]` partly implemented or in progress · `[x]` completed and verified for the stated scope. A simulated screen or a passing unit test does not mean an end-to-end feature is complete.

The current code is the source for implementation status; planned behavior and security rules are in [arkiv/schema.md](arkiv/schema.md) and [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md). Reconcile discrepancies before implementing dependent features.

## Project and app

- [x] React/Vite app, web manifest, and Node server that serves the built app exist.
- [~] Browser wallet and wallet-signature sign-in are implemented; verify the full flow on the demo phones and clarify the security and recovery limits.
- [~] Wallet, claim, door, sign-in and landing screens exist; wallet/door flows still use simulated data, and organizer pages are stubs.
- [ ] Connect organizer issuance and wallet ticket views to real records; remove implicit mock-ticket creation from normal flows.
- [ ] Deploy a single public HTTPS URL and verify installation and microphone access on both Android phones.
- [ ] Choose and add an open-source license, if approved by the repo owner.

## Sonar and check-in

- [~] Sonar lab, audio processing and lab server routes exist; the build plan reports a two-phone pass, but full reliability and check-in integration are not established.
- [ ] Test near/far results, noise, dropped audio blocks, and the Google Meet relay on the actual demo devices; record results.
- [ ] Implement check-in sessions and polling, fresh challenges, and holder-signed reports verified against the ticket wallet.
- [ ] Connect the door and wallet screens to real sonar and check-in results; reject repeat check-ins and require the configured claim policy.
- [ ] Atomically and safely record successful check-ins and ticket status in Arkiv; determine arrival ordinals and handle retries or interrupted writes.
- [ ] Rehearse the complete issue-to-door journey and document the browser demo's security limits.

## Arkiv

- [x] Testnet setup and lifecycle spike exist; a ticket write/read/patch and read-only spike record were previously tested on Rabdi.
- [~] Arkiv ticket repository and demo schema exist, and `server/src` no longer references SQLite after the pulled migration commits; the 24 server tests pass, but the live API has not been verified against Arkiv.
- [~] `resona.account` storage and owner/creator-filtered account lookups are implemented; verify signup, uniqueness, write recovery and expiration against the data contract. Its query-then-create flow and in-process queue do not establish multi-instance uniqueness.
- [ ] Reconcile `arkiv/schema.md` and `arkiv/world-claim-design.md` with the current account and ticket implementation before changing it; both still describe SQLite as the durable World ID coordinator, which no longer matches `server/src`. Do not claim an earlier implementation is still active.
- [ ] Implement event-end-plus-retention expiry and a plan for extending records; protect public data and filter trusted reads appropriately.
- [ ] Add Arkiv track files: friction, reach, why Arkiv, and how Arkiv is used; complete schema details as implemented.
- [ ] Add writer addresses and a runnable query to the README, and show an actual Arkiv read in the app.

## World ID

- [~] IDKit sign-in, server-side proof verification, wallet signal binding, signed wallet login and demo guest path exist; a successful real simulator flow is not yet confirmed here.
- [ ] Verify action, RP and environment match; test successful verification and repeat-human rejection end to end with the simulator.
- [ ] Resolve durable uniqueness, claim recovery, concurrency and crash gaps without relying on a query-then-create check as an atomic constraint; see [arkiv/world-claim-design.md](arkiv/world-claim-design.md).
- [ ] Confirm the demo skip policy is clearly labelled and enforced at the door; record the World integration debrief.

## ENSv2

- [ ] Register and configure Sepolia event and people names and their registries; verify deployed contract roles and setup.
- [ ] Issue each pass as an ENSv2 subname, populate safe public metadata, and store its reference on the ticket.
- [ ] Verify the actual ENS pass owner matches the assigned ticket wallet before check-in; reconcile failed ENS/Arkiv writes.
- [ ] Demonstrate blocked transfers for a non-transferable pass and implement organizer-approved reassignment if in scope.
- [ ] Resolve and display names and profiles in the organizer, wallet and door flows.

## Later stages and submission

- [ ] Add event pages, attendee profiles, attendance trophies and POAPs when the core journey is working.
- [ ] Add testnet ticket purchases and company distribution only after the earlier stages.
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
