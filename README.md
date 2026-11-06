# Resona

Event tickets that require the ticket's specific wallet and phone to be present at the door.

Resona is a ticket wallet and check-in system. An event's ENS domain leads to its event page, where attendees verify with World ID and buy tickets using testnet funds. Tickets are assigned to a specific wallet and represented through ENS. At the door, the staff phone and attendee phone exchange sound to verify proximity; the system then checks that the ticket's assigned wallet is present. Ticket, purchase and check-in data is stored in Arkiv and surfaced in the app.

> **Status:** concept and design only. No code exists yet. Every threshold is untested until the [sonar test](docs/SONAR.md#test-plan-and-gono-go) has run on real phones. False sonar rejections and phone lending are out of scope for the hackathon demo.

## The problem

| Today's approach | How it gets beaten |
|---|---|
| QR code at the door | The holder streams the code over Google Meet or Discord, and someone else scans in with it |
| Bluetooth proximity | A relay forwards the radio traffic, so a distant phone looks nearby |
| Cheap or allocated tickets | Bots collect them and resell at a markup when supply runs out |

## How Resona answers it

1. **Sound for proximity.** The demo checks that the ticket's phone is physically near the door phone. It does not claim to identify the person holding the phone.
2. **Named holders.** Each ticket is issued to a person's ENS name and wallet address, and recorded in Arkiv.
3. **Organizer-controlled transfers.** Only the organizer can approve moving a ticket to someone else, which targets the resale market directly.
4. **One ticket per verified human.** IDKit with World ID helps prevent duplicate claims for an event.
5. **Event and holder profiles.** ENS provides the event page and holder identity; Arkiv data powers ticket and check-in views. Trophies are deferred from the demo.

## Hackathon and startup focus

The demo centers on sonar check-in. Track priority is Arkiv, then ENS, then World ID, while showing the complete attendee journey: discover an event through ENS, verify and purchase on testnet, then check in with sonar and wallet verification. The first customers to approach are Web3 conferences and hackathons, pitching from both ETHGlobal and Devcon perspectives. Organizers pay per event based on ticket volume; the per-ticket rate is negotiated.

## Platform

The **demo is a PWA on Android Chrome**, which keeps the build achievable in the hackathon's time and lets judges try it from a link. It stops relays through the real app. A **real product needs a native app**, because a browser can't prove it's the real app or hold a provably hardware-backed key, so a modified client could still fake the timing. [The full reasoning is in ARCHITECTURE.md](docs/ARCHITECTURE.md#platform-decision).

## ETHGlobal Mumbai 2026

Resona is being built from scratch for ETHGlobal Mumbai, targeting the World ID, ENS and Arkiv tracks. Each has a clear job:

| Sponsor | Role in Resona |
|---|---|
| **ENSv2** | Each pass is a subname owned by the holder, and the contract blocks transfers on non-transferable tiers |
| **Arkiv** | Stores events, tickets, check-ins and trophies, which the app and website read from |
| **World ID** | Verify one attendee per event before testnet purchase |

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
