# Build plan

Nine hours, 3.5 people, one simple PWA. Hours count from when you start. If you have less than 9 hours, take time from the submission buffer first, then use the cut list.

## Build order

**Sonar check-in is the product, so nothing else starts until it works.**

| Stage | What it adds | Why | When |
|---|---|---|---|
| **1. Sonar + Arkiv** | Tickets are checked in only through sonar, and the result is stored on Arkiv | The core of the product | Now, 0:00–5:00 |
| **2. World ID** | One ticket per person | Stops bots collecting tickets | 5:00–6:00 |
| **3. ENS** | Names replace wallet addresses, and passes become names the holder can't transfer | Simpler domains and addresses | 5:30–7:00 |
| **4. Event pages and profiles** | Event's ENS page, attendee profiles, POAPs | Attendance history | After stage 3, likely after the hackathon |
| **5. Testnet ticket buying** | Company distribution and individual purchase from the event's page | Completes the ticket journey | Last, testnet only |

Stages 4 and 5 are described in [PRODUCT.md](PRODUCT.md#later-stages).

## Keep it simple

**The whole product is one React app and one Node server, on one URL.**

```
Phones (Android Chrome)  ──HTTPS──>  Node server  ──>  Arkiv testnet
                                     serves the app ─>  World ID (stage 2)
                                                    ─>  ENSv2 on Sepolia (stage 3)
```

Each choice below trades something a real product would need for time in the demo. "Use" is what we build now, and "Instead of" is what we're deliberately skipping.

| Use | Instead of | Why | What we give up |
|---|---|---|---|
| **Vite + React + TypeScript** | Next.js or a monorepo | The app is a few pages that talk to our API, so it needs no server rendering. Vite takes minutes to set up, and one app in one folder means no shared-package setup to debug | Nothing the demo needs |
| **A web manifest only** (team decision) | A service worker or offline mode | The manifest gives an icon and a full-screen app. Check-in needs the server anyway, and a stale service worker cache can leave phones on old code during testing | The app won't open without internet, so bring mobile data or a hotspot to the door |
| **Node server that also serves the built app** | Separate hosting for the app and server | With one URL, the browser treats the app and API as the same site, so there's no CORS setup. There's also only one thing to deploy, and one HTTPS address for the microphone | Can't scale the two separately, which doesn't matter here |
| **Polling every 250 ms during check-in** | WebSockets | Phones only need to learn "start recording" and "here's the result". Timing doesn't have to be exact, because each recording is searched for both sounds. Polling is ordinary API routes, with no reconnect handling | A few extra requests during a check-in that lasts seconds |
| **Arkiv as the only database** (team decision) | SQLite or a hosted database | Tickets, check-ins and hashed World ID nullifiers all live in one place, so there's no database to run and nothing is lost on redeploy | Records are public, so store only hashed nullifiers and no personal details. The server must handle one claim at a time so two quick claims can't both pass |
| **ENS's deployed contracts** | Writing our own contracts | ENSv2 already provides registries, roles and transfer blocking, and using them is what the ENS track asks for | Rules are limited to what ENSv2's roles offer, which covers the demo |
| **Separate event and people names** (team decision) | One shared name | The event's name holds its passes, and later becomes its ticket page. People's profiles live under another name, so they outlast the event. It's one extra registration using the same code, and avoids migrating later | Slightly more ENS setup |
| **One event** | Multi-event support | The demo only ever shows one event | Extra events come later |
| **A browser wallet key created on first open** | Seed phrases or wallet connectors | Attendees get a wallet with no extra steps, and the server pays all gas. A connector would require another wallet app and test ETH on the demo phones | Clearing browser data loses the wallet. This isn't safe for real value, but test tickets carry none |
| **An open organizer page** | Login and roles | Login adds no value to the story being judged, and the page is only used during the demo | Anyone with the link can issue test tickets. Don't reuse this setup outside testnets |
| **Organizer issues tickets directly** (team decision) | Any checkout | Nothing fake needs explaining, and all effort goes to sonar | Buying arrives in stage 5 |

**Not in this build:** iOS, native app, attestation, response deadlines, clock sync, ZK proofs, per-phone calibration, encrypted records.

## Team

Write a name next to each role before starting.

| Role | Name | Owns |
|---|---|---|
| **Person 1: Sonar** | | Audio, distance calculation, check-in screens |
| **Person 2: Chain** | | Node server, Arkiv, then ENS |
| **Person 3: App** | | PWA pages, wallet, then World ID |
| **Half person: Submission** | | Second phone tester, track files, video, submission |

## Stage 1: Sonar + Arkiv (0:00–5:00)

The stage 1 flow:

1. **Issue:** the organizer pastes a wallet address, and the server writes a ticket to Arkiv.
2. **See it:** the attendee's wallet lists the ticket from Arkiv and shows a QR code.
3. **Check in:** the door scans the QR code, and the phones exchange sound. The holder's wallet key signs its report, and the server checks that it matches the ticket. Without this, anyone with a streamed QR code could act as the holder.
4. **Record:** a pass updates the ticket on Arkiv to checked in, with its distance and arrival number. If the same ticket tries again, the door rejects it after reading Arkiv.

### Phase 0: Simple PWA online (0:00–0:30)

**Goal:** an installable, empty app on a public HTTPS URL, opening on both phones. The microphone only works over HTTPS, so do this first.

| Who | Task |
|---|---|
| **Person 3** | Create the Vite React TS app with a manifest, and empty pages: `/organizer`, `/wallet`, `/door` |
| **Person 2** | Create the Node server that serves the app and has one test API route. Deploy it to a long-running host such as Railway or Render |
| **Person 1** | Add an empty `/lab` page, and check the mic permission prompt on both phones |
| **Half person** | Add a license, get Arkiv testnet tokens and an access key, and start `arkiv/friction.md` |

For local testing on phones, use a tunnel:

```bash
npx cloudflared tunnel --url http://localhost:5173
```

**Done when:** both phones open the deployed URL and can add the app to the home screen.

### Phase 1: Prove sonar and Arkiv separately (0:30–2:30)

| Who | Task | Done when |
|---|---|---|
| **Person 1** | Build the sonar on `/lab`, following the steps below | 30 cm passes and 200 cm fails, 9 times out of 10 |
| **Person 2** | Write a ticket to Arkiv, read it back with `.ownedBy(organizer)`, patch its status, and create a read-only check-in record | All four work in a script, and can be seen in the Arkiv explorer |
| **Person 3** | Create the browser wallet, and build the organizer form and wallet ticket list on sample data | Pages work on a phone |
| **Half person** | Be the second phone tester, and record problems in `friction.md` | Notes are being kept |

**Sonar steps, in order:**

1. Tap Start: one 48 kHz `AudioContext`, with the mic's echo cancellation, noise suppression and auto gain off. Show the actual settings on screen.
2. Capture samples with an AudioWorklet, and count blocks to detect gaps.
3. Generate two 250 ms noise codes (2–18 kHz) from a fixed seed, one per role.
4. Pick a role on each phone and tap Start on both. Record for 6 seconds, with the door playing at 1.5 s and the holder at 3 s.
5. Find both sounds with a matched filter. Use an FFT library rather than writing one, and take the first strong peak.
6. Plot the correlation on a canvas. It's the best debugging tool, and also a good demo visual.
7. Each phone sends its elapsed time to the server, which returns the distance: `17150 × (doorSeconds − holderSeconds)` cm.

[SONAR.md](SONAR.md#demo-protocol-ethglobal-build) has the audio rules.

#### Go/no-go at 2:30

| If this fails | Do this |
|---|---|
| Two phones don't give stable distances | Use a laptop as the door device |
| Signal is too quiet or unclear | Turn the volume up, hold phones closer, and lengthen the code |
| Arkiv writes are stuck | Person 3 helps for 30 minutes, and report the problem in `friction.md` |

### Phase 2: Real check-in (2:30–5:00)

Agree on these routes at the start of the phase, so Person 3 can build against them right away:

| Route | Purpose |
|---|---|
| `POST /api/issue` | Issue a ticket to a wallet address |
| `GET /api/tickets?holder=` | List a wallet's tickets from Arkiv |
| `POST /api/checkin/start` | Door starts a session from the scanned pass, and gets a fresh seed |
| `GET /api/checkin/active?passId=` | The holder's wallet polls this to find and join the session |
| `GET /api/checkin/:id` | Both phones poll for state: waiting, recording, or result |
| `POST /api/checkin/:id/report` | Each phone sends its elapsed time, and the holder's report is signed by its wallet key |

| Who | Task | Done when |
|---|---|---|
| **Person 1** | Turn `/lab` into the check-in: session seed, polling, a large pass or fail, and the distance. **Then run the sound over Google Meet and record what happens** | A real pass, a real fail, and a failed relay |
| **Person 2** | Build the routes. Verify the holder's signature against the ticket. A pass patches the ticket and creates a read-only `resona.checkin` with its arrival number. Reject tickets already checked in | Routes work from `curl`, and records appear in the explorer |
| **Person 3** | Connect the organizer and wallet pages. Build the door scanner using `BarcodeDetector`, with a typed pass number as backup. Show a link to the Arkiv record after a pass | Clicking through works without developer help |
| **Half person** | Test after each merge, in noise as well. Draft `arkiv/schema.md`, and add wallet addresses and a sample query to the README | A written list of what's broken |

### Stage 1 checkpoint at 5:00

Someone who didn't build it can issue a ticket and check in on the deployed URL, a second attempt is rejected, and the record shows on Arkiv.

**If this isn't true, everyone stays on stage 1.** World ID and ENS wait, because they're worth little without a working check-in. Stage 1 alone keeps the Arkiv track possible.

## Stage 2: World ID, one ticket per person (5:00–6:00)

| Who | Task | Done when |
|---|---|---|
| **Person 3** | Add the IDKit widget to a Claim button in the wallet, using the [simulator](https://simulator.worldcoin.org/) to test | A verified proof reaches the server |
| **Person 2** | Add `POST /api/world/sign` and `POST /api/claim`. Verify the proof, then write a `resona.claim` holding the hashed nullifier. Process one claim at a time, and reject repeats | The same person's second claim is rejected |
| **Person 1** | Keep improving sonar reliability, and require the door to accept only claimed tickets | An unclaimed ticket can't check in |
| **Half person** | Time the first successful verification, and write the World debrief | Debrief drafted |

Start with one credential, set on the event as its required level, and show that level on the ticket. [Organizer-selected levels](PRODUCT.md#verification-levels) come later.

## Stage 3: ENS, simpler names (5:30–7:00)

Person 2 starts this once the claim route is done.

| Who | Task | Done when |
|---|---|---|
| **Person 2** | Register two Sepolia names, one for the event and one for people, and set up their registries. Issue passes such as `7.ethglobal-mumbai.eth` without the transfer role, and give people names such as `skes.resona-id.eth` | A pass exists, and trying to transfer it reverts |
| **Person 3** | Enter names instead of addresses on the organizer page, and show names on the wallet and door. Add a page for the reverted transfer, with a link to the transaction | No wallet address is needed in the normal flow |
| **Person 1** | Show the holder's name on the door's pass screen. Sonar reliability | Name shows on a real check-in |
| **Half person** | Check the [ENS track list](TRACKS.md#ens), and draft the demo script | Checklist reviewed |

**Keep the transfer block in this stage.** The ENS track requires ENSv2 features to be central, not cosmetic, and names replacing addresses alone might not qualify. If time runs short, build the pass and reverted transfer first, and use simple names on screen after.

**Feature freeze at 7:00.**

## Finish: Rehearse and submit (7:00–9:00)

| Time | Who | Task |
|---|---|---|
| **7:00–8:00** | **Everyone** | Run the [demo script](PRODUCT.md#demo-script) on the real phones, in a noisy room, at least three times. Fix only what breaks the demo |
| | **Person 1** | Choose the phone distance and volume, and keep the phones charged |
| | **Person 2** | Fund wallets, and keep the server awake |
| | **Half person** | Record the video while the demo works, and keep a backup recording |
| **8:00–9:00** | **Half person** | Go through [TRACKS.md](TRACKS.md) line by line. Submit early, then update if time remains |
| | **Person 2** | Confirm the repo is public, the live link works from a new device, and no keys are committed |
| | **Person 3** | Finalize the README: what it does, how to run it, and the honest limits |

The README must also include the AI-use statement and credit [enconomy](https://github.com/tawago/enconomy) for ideas. Don't copy its code.

## Cut list

If behind schedule, cut from the top:

1. Screen polish
2. ENS people's names (keep passes and the reverted transfer)
3. All of stage 3
4. All of stage 2

**Never cut:** sonar check-in, the holder's signature, the Google Meet relay test, Arkiv reads and writes on screen, the track files for anything you're entering, and the video.

## Working rules

- **Commit small and often to `main`,** since the history shows the work was done at the event. Pull before pushing, and don't spend time on pull request reviews.
- **Keep to your own folder:** Person 1 in `app/src/sonar`, Person 2 in `server`, Person 3 in `app/src/pages`.
- **Keep secrets in environment variables,** and never commit keys.
- **Check in together at 2:30, 5:00 and 7:00.** If something has been stuck for 30 minutes, say so at once.
- **Test on the real phones,** not a desktop browser.
