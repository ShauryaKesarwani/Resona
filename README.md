# Resona

An experimental event-ticket demo that checks the assigned wallet and uses sound to estimate proximity at the door.

Resona is a ticket wallet and check-in demo. Tickets and purchases are read from Arkiv; the ENSv2 CLI can issue non-transferable pass names, and an optional server read path checks their owner and transfer policy. The door and wallet screens use the check-in API and sonar in code, and successful check-ins are written to Arkiv. The complete phone journey has not yet been verified. See [TODO.md](TODO.md), the [data contract](arkiv/schema.md), and the [ENSv2 runbook](docs/ENSV2.md) for implementation status and limits.

> **Status:** early build, testnet only. Sonar worked between the team's two Android phones on `/lab`; the integrated check-in was tested with synthesized recordings, not yet with real sound on those phones. Noise and Google Meet relay tests remain. A browser cannot prove that its timing reports are genuine, and phone lending is out of scope.

## Run it

Requires Node 22.18 or later. Set up the server first: copy `server/.env.example` to `server/.env` and fill it in. The server won't start with empty World ID values, though any placeholder text is enough for testing sonar.

Install and start the server:

```bash
cd server
npm install
npm run dev
```

In a second terminal, build the app. The server serves this build on port 3050:

```bash
cd app
npm install
npm run build
```

Phones need HTTPS for the microphone, so open a tunnel in a third terminal, and use its URL on both phones:

```bash
npx cloudflared tunnel --url http://localhost:3050
```

Rebuild the app after changing it, then reload the page. Avoid tunnelling `npm run dev` to phones, because dev mode sends a 6.4 MB icon file and the page can hang. Use dev mode on a laptop, at `http://localhost:5173`.

To test sonar, open `/lab` on both phones, use the same room, pick different roles, and tap Start on both within a second. Run tests with `npm test` in `app` or `server`.

### Before a door demo

- Run exactly one server process. Check-in sessions are held in memory and disappear on restart; duplicate protection is not safe across multiple processes or every restart.
- Set `DOOR_PIN` and keep it private. If it is unset, anyone can act as the door. Set `ORGANIZER_WALLETS` to the authorized issuing wallets; an empty list prevents issuing.
- Check `ALLOW_WORLD_SKIP`: when enabled, an unverified guest with an organizer-issued skipped ticket may be admitted. Bought tickets still require a trusted World account and an unused event claim. The door is not restricted to a single event, so run one event at a time.
- Test the real phones, microphone permissions and network before admitting anyone. If an Arkiv write fails, do not automatically repeat it: it may already have landed. Check the record before deciding what to do.
- Arkiv data is public and expires; do not put identity details, raw proofs, keys or audio there. See [the data contract](arkiv/schema.md) for the full limitations and recovery gaps.

## The problem

| Today's approach | How it gets beaten |
|---|---|
| QR code at the door | The holder streams the code over Google Meet or Discord, and someone else scans in with it |
| Bluetooth proximity | A relay forwards the radio traffic, so a distant phone looks nearby |
| Cheap or allocated tickets | Bots collect them and resell at a markup when supply runs out |

## How Resona answers it

1. **Sound for proximity.** The demo estimates distance between phones; it does not identify the person holding the phone or resist a modified browser client.
2. **Wallet-bound tickets.** Issued tickets are assigned to a wallet and recorded in Arkiv. ENS pass names are a separate, optional path and are not enforced at the door.
3. **Transfer policy.** The ENS CLI can issue non-transferable passes; organizer-approved reassignment is not implemented.
4. **Verified claims.** World ID helps prevent duplicate claims, subject to the recovery and concurrency gaps in the data contract. The optional demo skip is not a verified claim.
5. **Event and holder profiles.** Arkiv powers event and attendance views in code; public profiles currently use wallet addresses, not ENS names. Live verification and POAPs remain to do.

## Hackathon and startup focus

The demo centers on sonar check-in. Track priority is Arkiv, then ENS, then World ID, while showing the complete attendee journey: discover an event through ENS, verify and purchase on testnet, then check in with sonar and wallet verification. The first customers to approach are Web3 conferences and hackathons, pitching from both ETHGlobal and Devcon perspectives. Organizers pay per event based on ticket volume; the per-ticket rate is negotiated.

## Platform

The **demo is a PWA on Android Chrome**, which lets judges try it from a link. Relay resistance has not yet been verified on the demo phones. A **real product needs stronger device protections**, because a browser can't prove it's the real app or hold a provably hardware-backed key, so a modified client could fake the timing. [The full reasoning is in ARCHITECTURE.md](docs/ARCHITECTURE.md#platform-decision).

## ETHGlobal Mumbai 2026

Resona is being built from scratch for ETHGlobal Mumbai, targeting the World ID, ENS and Arkiv tracks. Each has a clear job:

| Sponsor | Role in Resona |
|---|---|
| **ENSv2** | The CLI issues non-transferable pass subnames; the optional API checks live registry ownership and transfer policy. Door enforcement and live deployment are not verified |
| **Arkiv** | Stores events, tickets, check-ins and trophies, which the app and website read from |
| **World ID** | Verify sign-in and support one claim per human per event, with known uniqueness and recovery gaps |

[TRACKS.md](docs/TRACKS.md) has the submission checklists.

## Roadmap

1. **Sonar + Arkiv:** tickets are checked in only through sonar, and the result is stored on Arkiv.
2. **World ID:** one ticket per person, at the verification level the ticketing provider chooses.
3. **ENS:** names replace wallet addresses, and passes can't be transferred without the organizer.
4. **Event pages and profiles:** the event's ENS page, and attendee profiles with POAPs.
5. **Testnet ticket buying:** companies distribute to employees' ENS names, or individuals buy from the event's page.

## Documents

| File | What it covers |
|---|---|
| [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md) | **Start here to build:** phases, roles and cut list |
| [docs/PRODUCT.md](docs/PRODUCT.md) | Users, flows, ticket rules, trophies and hackathon scope |
| [docs/SONAR.md](docs/SONAR.md) | Distance measurement, the check-in protocol, threat model and test plan |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Platform decision, components, keys, sponsor designs and build order |
| [docs/TRACKS.md](docs/TRACKS.md) | Prize track requirements and submission checklists |
| [docs/DECISIONS.md](docs/DECISIONS.md) | What is decided, open questions, corrections to the brief and sources |
| [docs/AI_TOOLS_SETUP.md](docs/AI_TOOLS_SETUP.md) | Setting up Claude Code with the Arkiv, World and ENS tools |

New information from the team goes into the matching document, and anything undecided goes into `DECISIONS.md`.

## Prior work

The sonar design drew ideas from [enconomy](https://github.com/tawago/enconomy). Its repository has no license; see [the track notes](docs/TRACKS.md) for the team's prior-work guidance.
