# Decisions and open questions

The living record of what is settled and what isn't. Update it whenever the team shares something new.

## Decisions

| Topic | Decision | Status |
|---|---|---|
| Name | Resona | Decided by team |
| Hackathon | ETHGlobal Mumbai 2026 | Decided by team |
| Target tracks | World ID, ENS, Arkiv | Decided by team |
| Test phones | Two Android phones | Confirmed by team |
| Proximity method | Sound-based distance check between two phones | Decided by team |
| Distance threshold | About 60 cm | Team's figure; confirm in testing |
| Ticket records | Arkiv, on the current testnet | Decided by team; network required by the track |
| Identity | ENS name resolving to a Resona wallet address | Decided by team |
| Anti-bot | World ID | Decided by team |
| Transfers | Only the organizer can approve | Decided by team |
| Company purchases | Assign to employee ENS names at checkout | Decided by team |
| Trophies | ENS profile with badges, avatar, hash and ordinal | Decided by team |
| Team and deadline | 3.5 people, 9 hours as of 6 November 2026 | Confirmed by team |
| Demo platform | **PWA on Android Chrome** | Decided by team. Replaces React Native for the demo |
| Real product platform | Native app with attestation and hardware keys | Proposed |
| Build order | Sonar and Arkiv, then World ID, then ENS, then event pages, profiles and POAPs, then payments | Decided by team |
| Check-in record | A sonar pass updates the ticket on Arkiv | Decided by team |
| Database | Arkiv only, including hashed World ID nullifiers | Decided by team |
| Offline | Web manifest only for now, with no service worker | Decided by team |
| ENS naming | Separate names for the event and for people | Decided by team |
| Checkout | None for now; the organizer issues tickets directly | Decided by team |
| Future buying | Testnet only, from the event's ENS page, or companies distributing to employees' ENS names | Decided by team |
| Verification levels | The ticketing provider chooses camera, government ID, Orb, or all, and the level is shown | Decided by team, for a later stage |
| Holder proof at check-in | The wallet key signs the report, so a streamed QR code alone can't pass | **Proposed, needs team sign-off** |
| Tickets as ENSv2 subnames on Sepolia | Pass is a subname, and the contract blocks non-transferable tiers | **Proposed, needs team sign-off** |
| First World ID credential | Proof of Human, before levels are added | **Proposed, needs team sign-off** |
| Security additions | Sound challenge with a deadline, attestation, hardware device key | **Proposed for the real product;** not in the demo |
| Timing method | Matched filter for timing; spectrogram only for visuals and optional same-room check | **Proposed, needs team sign-off** |
| World ID skip | Demo-only Skip button on the claim page, in case verification is slow. The ticket is marked `skipped`, not verified, and can be verified later. Turn off with `ALLOW_WORLD_SKIP=false` | Decided by team, demo only |
| POAP | Stage 4, on attendee profiles | Decided by team |

## Open questions

### Needed now

1. **Who takes which role?** Fill in the names in the [build plan](BUILD_PLAN.md#team).
2. **Which long-running host will the server use?** It needs HTTPS, and must stay awake during the demo.

### Product

3. **Which testnet token pays for tickets in stage 5,** and who pays the gas? MockUSDC and Sepolia ETH are both options. Decide this when stage 5 starts.
4. **Which verification level should the first event use?** Proof of Human is the proposed start, but it needs an Orb-verified World ID. For the demo, the simulator avoids this.
5. **How much of the attendee list should be public?** Arkiv and ENS are public, so a pass reveals its holder's wallet. Encrypting holder fields protects privacy but limits queries.
6. **Can a company reassign a ticket** if an employee leaves before the event?
7. **Does the trophy ordinal count purchases or check-ins?** The brief mentions both. We've assumed check-ins, since that better proves attendance.
8. **Who keeps the organizer's key?** The hackathon backend can hold it, but a real product would need something stronger.

### Technical

9. **What does a Meet or Discord relay do to the signal?** It might add delay, or remove the signal entirely. Answered by the relay test.
10. **How well does ranging hold up in noise?** Answered by the noise test.
11. **How does the organizer get registrar and unregister roles on a new ENSv2 registry?** Answered by the ENS test and the unread `/ensv2/subnames` docs.
12. **Does ranging work between two Android phones in Chrome?** enconomy's published browser result used a laptop and a phone. Answered by 2:30 in the build plan.

## Interpretation of the brief

The brief was dictated, so a few terms were interpreted.

| As written | Meaning | Status |
|---|---|---|
| ARC IV | **Arkiv** | Confirmed by team |
| DEF CON 8 | **Devcon 8**, the Ethereum conference | Confirmed by team |
| Voice feature | Speaker and microphone used as sonar, with no speech involved | From context |
| Ping on GitHub | Delay on Google Meet | Corrected in the brief itself |
| Distributing this project | Distilling the project into docs | From context |

## Changes to ideas in the brief

Each of these keeps the team's goal but changes how it's reached.

| In the brief | What these docs say instead | Reason |
|---|---|---|
| Relayed sound adds delay, which reveals the attack | True with our genuine app, but a modified client can forge the numbers. Added a deadline and attestation | [SONAR.md](SONAR.md#the-gap-a-modified-app-can-lie) |
| Match sounds using histograms | Use a matched filter for timing | A histogram frame is about 7 m of sound travel. [SONAR.md](SONAR.md#timing-comes-from-matched-filtering-not-histograms) |
| Most phones don't have NFC | Dropped as an argument. As far as we know, many phones do have NFC hardware, including iPhones, though budget models may not (not verified for this doc). The stronger reasons are limited browser and iOS access, plus NFC relays | [SONAR.md](SONAR.md#why-not-other-radios) |
| PWA choice depends on latency | Latency mostly cancels out. A PWA is fine for the demo, but a real product needs attestation and key protection | [ARCHITECTURE.md](ARCHITECTURE.md#platform-decision) |
| Ticket belongs to a person's ENS name | The pass is its own subname, owned by the wallet, with the personal name used for display | Personal names can be sold or re-pointed. [ARCHITECTURE.md](ARCHITECTURE.md#ensv2-tickets-as-subnames) |
| Our own wallet secures the tickets | Also needs a hardware device key, because Ethereum's curve isn't supported by phones' secure hardware | [ARCHITECTURE.md](ARCHITECTURE.md#keys) |

## Changes after reading the track pages

| Earlier in these docs | Now | Reason |
|---|---|---|
| Free offchain ENS subnames | Onchain ENSv2 subnames on Sepolia | The ENS track requires ENSv2, central to the product |
| POAP on the trophy page | Own badges first, POAP later | Not a target track, and mint links need review |
| React Native for the demo | PWA for the demo, native for a real product | Only 9 hours left, and browser ranging has been shown to work |
| 17–20 kHz chirps | Audible 2–18 kHz noise-like codes for the demo | Sharper timing; enconomy's approach |
| Arkiv facts from a third-party FAQ | Official Arkiv docs | Official docs are now read |
| ENS, World ID and sonar in parallel | Sonar and Arkiv first, then World ID, then ENS | Team decision |
| SQLite for nullifiers | Hashed nullifiers on Arkiv | Team decision. An earlier claim here that nullifiers must stay private was too strong |
| One shared Sepolia name | Separate event and people names | Team decision |
| A mocked Pay button | No checkout until stage 5 | Team decision |
| Device key signing, listed as optional | The wallet key signs check-in reports, and this can't be cut | Without it, anyone with a streamed QR code could act as the holder |

## Sources

Sponsor docs and track pages were read directly on 6 November 2026, though not every linked sub-page. The other sources came from web search summaries and weren't all read in full. Claims with no link are from general knowledge or our own calculations.

**Tracks**
- ETHGlobal Mumbai prizes: [overview](https://ethglobal.com/events/mumbai/prizes), [World](https://ethglobal.com/events/mumbai/prizes/world), [ENS](https://ethglobal.com/events/mumbai/prizes/ens), [Arkiv](https://ethglobal.com/events/mumbai/prizes/arkiv)
- [ETHGlobal events list](https://ethglobal.com/events) and [Bleap listing](https://www.bleap.finance/en-us/events/eth-global-mumbai), which disagree on dates

**ENS**
- [ENSv2 overview](https://docs.ens.domains/ensv2/overview/), [permissioned registry](https://docs.ens.domains/ensv2/permissioned-registry), [permissioned resolver](https://docs.ens.domains/ensv2/permissioned-resolver/), [access control](https://docs.ens.domains/ensv2/enhanced-access-control/), [app developer tutorial](https://docs.ens.domains/ensv2/tutorial-app-developers/) and [deployments](https://docs.ens.domains/learn/deployments)

**Arkiv**
- [Docs](https://docs.arkiv.network), [first entity](https://docs.arkiv.network/start-here/first-entity/), [changing entities](https://docs.arkiv.network/writing/change/) and [expiration](https://docs.arkiv.network/writing/expiration/)

**World**
- [IDKit integration](https://docs.world.org/world-id/idkit/integrate), [credentials](https://docs.world.org/world-id/idkit/credentials), [overview](https://docs.world.org/world-id/overview) and [simulator](https://simulator.worldcoin.org/)

**Sonar**
- [tawago/enconomy](https://github.com/tawago/enconomy): README, app docs, constants and [latest commit](https://github.com/tawago/enconomy/commit/9db149011e5fd77d67e16d8b5bc2c2dfca40119e) read. No license, so ideas only
- [michaelneri/audio-distance-estimation](https://github.com/michaelneri/audio-distance-estimation): README and file list read
- [BeepBeep paper](https://www.microsoft.com/en-us/research/?p=155459) and [demo abstract](https://microsoft.com/en-us/research/wp-content/uploads/2007/11/demo_sensys07_beepbeep.pdf)
- [Sample-counting ranging (ACM TECS 2012)](https://www.cs.purdue.edu/homes/chunyi/pubs/peng-tecs12.pdf)
- [SonicPACT, ultrasonic ranging on phones](https://arxiv.org/pdf/2012.04770)
- [DoubleEcho, room-acoustics co-presence](https://arxiv.org/pdf/1803.07211.pdf)
- [So Near and Yet So Far, distance-bounding attacks](https://www.rfidblog.org.uk/esas2006-distance.pdf)
- [imec on Bluetooth Channel Sounding](https://www.imec-int.com/en/articles/discover-bluetooth-channel-sounding-leap-forward-ranging-accuracy)

**Platform**
- WebKit reports on audio while the microphone is open: [326286](https://bugs.webkit.org/show_bug.cgi?id=326286), [311451](https://bugs.webkit.org/show_bug.cgi?id=311451), [294623](https://bugs.webkit.org/show_bug.cgi?id=294623), [262759](https://bugs.webkit.org/show_bug.cgi?id=262759)
- [Web NFC support on caniuse](https://caniuse.com/webnfc)
- [Transmit Security on passkey attestation](https://developer.transmitsecurity.com/guides/user/passkey_attestation)
- [Secfense on device-bound passkeys and app attestation](https://secfense.com/blog/mobile-bound-passkeys-enterprise-security). We found no source stating outright that PWAs can't use App Attest or Play Integrity; we infer it because both are native app APIs.
- [Android audio latency guidance](https://source.android.com/docs/core/audio/latency/app) and [OboeTester docs](https://android.googlesource.com/platform/external/oboe/+/ba2fb95054ea5cea728f1ec320e882b471e7ba15/apps/OboeTester/docs/AutomatedTesting.md)
- [react-native-audio-api](https://docs.swmansion.com/react-native-audio-api/docs) and [expo-audio-stream](https://cdn.jsdelivr.net/npm/@cjblack/expo-audio-stream@0.2.26/README.md)

**Context**
- [POAP common flows](https://documentation.poap.tech/docs/popular-flow)
- [Devcon 8 tickets announcement](https://blog.ethereum.org/2026/07/14/devcon8-tickets) and [Devcon ticket FAQ](https://devcon.org/en/tickets/faq/)
