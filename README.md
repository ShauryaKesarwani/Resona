# Resona

Event tickets that only work when the ticket holder's phone is physically at the door.

Resona is a ticket wallet and check-in system. Organizers issue tickets to specific people through their ENS names and decide whether each ticket can be transferred. At the door, the staff phone and the attendee's phone exchange sound and measure the distance between them. A ticket streamed over a video call or relayed over the internet arrives too late, so it fails.

> **Status:** concept and design only. No code exists yet, and every threshold in these docs is untested until the [sonar test](docs/SONAR.md#test-plan-and-gono-go) has run on real phones.

## The problem

| Today's approach | How it gets beaten |
|---|---|
| QR code at the door | The holder streams the code over Google Meet or Discord, and someone else scans in with it |
| Bluetooth proximity | A relay forwards the radio traffic, so a distant phone looks nearby |
| Cheap or allocated tickets | Bots collect them and resell at a markup when supply runs out |

## How Resona answers it

1. **Sound for proximity.** Sound moves about a million times slower than radio. Sixty centimetres is only about 3.5 ms of round-trip travel, far less than any audio relay over the internet can add.
2. **Named holders.** Each ticket is issued to a person's ENS name and wallet address, and recorded in Arkiv.
3. **Organizer-controlled transfers.** Only the organizer can approve moving a ticket to someone else, which targets the resale market directly.
4. **One ticket per human.** World ID makes it harder for bots to collect tickets in bulk.
5. **Attendance trophies.** Attendees get a profile on their ENS name showing the events they attended, such as "11th person through the door".

## Platform

The **demo is a PWA on Android Chrome**, which keeps the build achievable in the hackathon's time and lets judges try it from a link. It stops relays through the real app. A **real product needs a native app**, because a browser can't prove it's the real app or hold a provably hardware-backed key, so a modified client could still fake the timing. [The full reasoning is in ARCHITECTURE.md](docs/ARCHITECTURE.md#platform-decision).

## ETHGlobal Mumbai 2026

Resona is being built from scratch for ETHGlobal Mumbai, targeting the World ID, ENS and Arkiv tracks. Each has a clear job:

| Sponsor | Role in Resona |
|---|---|
| **ENSv2** | Each pass is a subname owned by the holder, and the contract blocks transfers on non-transferable tiers |
| **Arkiv** | Stores events, tickets, check-ins and trophies, which the app and website read from |
| **World ID** | One claim per human per event |

[TRACKS.md](docs/TRACKS.md) has the submission checklists.

## Documents

| File | What it covers |
|---|---|
| [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md) | **Start here to build:** phases, roles and cut list |
| [docs/PRODUCT.md](docs/PRODUCT.md) | Users, flows, ticket rules, trophies and hackathon scope |
| [docs/SONAR.md](docs/SONAR.md) | Distance measurement, the check-in protocol, threat model and test plan |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Platform decision, components, keys, sponsor designs and build order |
| [docs/TRACKS.md](docs/TRACKS.md) | Prize track requirements and submission checklists |
| [docs/DECISIONS.md](docs/DECISIONS.md) | What is decided, open questions, corrections to the brief and sources |

New information from the team goes into the matching document, and anything undecided goes into `DECISIONS.md`.
