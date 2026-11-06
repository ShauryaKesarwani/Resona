# Build plan

Nine hours, 3.5 people, one simple PWA. Hours count from when you start. If you have less than 9 hours, take time from Phase 5 first, then use the cut list.

## Keep it simple

**The whole product is one React app and one Node server, on one URL.**

```
Phones (Android Chrome)  ──HTTPS──>  Node server  ──>  ENSv2 on Sepolia
                                     serves the app ─>  Arkiv testnet
                                                    ─>  World ID
```

| Use | Instead of |
|---|---|
| Vite + React + TypeScript | Next.js or a monorepo |
| A web manifest, so it can be installed | A service worker or offline mode |
| Node server that also serves the built app | Separate hosting, which brings CORS problems |
| Polling every 250 ms during check-in | WebSockets |
| A SQLite file for World ID nullifiers | A hosted database |
| ENS's deployed contracts | Writing our own contracts |
| One event and one Sepolia name | Multi-event support |
| A browser wallet key created on first open | Seed phrases or wallet connectors |
| An open organizer page | Login and roles |
| A "Pay" button that does nothing | Real payments |

**Not in this build:** iOS, native app, attestation, response deadlines, clock sync, ZK proofs, POAP minting, encrypted records, per-phone calibration.

## Team

Write a name next to each role before starting.

| Role | Name | Owns |
|---|---|---|
| **Person 1: Sonar** | | Audio, distance calculation, check-in screens |
| **Person 2: Chain** | | Node server, ENS, Arkiv |
| **Person 3: App** | | PWA pages, wallet, World ID |
| **Half person: Submission** | | Testing, track files, video, submission |

## The product in three steps

These three steps are the core flow, and everything in the plan serves them.

1. **Issue:** the organizer enters ENS names. The server resolves each name to a wallet, registers a pass such as `7.devcon8-demo.eth` without the transfer role, and writes a ticket to Arkiv.
2. **Claim:** the attendee opens the wallet, sees the ticket, and proves they're human with World ID. The server rejects a repeat claim and marks the ticket as claimed.
3. **Check in:** the door scans the attendee's QR code, the phones exchange sound, and the server computes the distance. A pass writes a check-in to Arkiv.

## Phase 0: Simple PWA online (0:00–0:30)

**Goal:** an installable, empty app on a public HTTPS URL, opening on both phones. The microphone only works over HTTPS, so do this first.

| Who | Task |
|---|---|
| **Person 3** | Create the Vite React TS app with a manifest, and four empty pages: `/organizer`, `/wallet`, `/door`, `/u/:name` |
| **Person 2** | Create the Node server that serves the app and has one test API route. Deploy it to a long-running host such as Railway or Render |
| **Person 1** | Add an empty `/lab` page, and check the mic permission prompt on both phones |
| **Half person** | Commit the docs, add a license, and set up accounts: Sepolia ETH, Arkiv testnet tokens and access key, World Developer Portal app. Start `arkiv/friction.md` |

For local testing on phones, use a tunnel:

```bash
npx cloudflared tunnel --url http://localhost:5173
```

**Done when:** both phones open the deployed URL and can add the app to the home screen.

## Phase 1: Prove the risky parts separately (0:30–2:30)

**Goal:** each risky part works on its own, with no integration yet.

| Who | Task | Done when |
|---|---|---|
| **Person 1** | Build the sonar on `/lab`, following the steps below | 30 cm passes and 200 cm fails, 9 times out of 10 |
| **Person 2** | Script: register the Sepolia name, deploy its registry, issue a pass without the transfer role, and try to transfer it. Script: write a ticket to Arkiv and read it back | The transfer reverts, and the ticket reads back |
| **Person 3** | Create the browser wallet. Add the IDKit widget, and verify a proof on the server using the simulator | A verified proof in the server logs, and a repeat rejected |
| **Half person** | Be the second phone tester. Record any problems in `friction.md`, and time World ID's first success for the debrief | Notes are being kept |

**Sonar steps, in order:**

1. Tap Start: one 48 kHz `AudioContext`, with the mic's echo cancellation, noise suppression and auto gain off. Show the actual settings on screen.
2. Capture samples with an AudioWorklet, and count blocks to detect gaps.
3. Generate two 250 ms noise codes (2–18 kHz) from a fixed seed, one per role.
4. Pick a role on each phone and tap Start on both. Record for 6 seconds, with the door playing at 1.5 s and the holder at 3 s.
5. Find both sounds with a matched filter. Use an FFT library rather than writing one, and take the first strong peak.
6. Plot the correlation on a canvas. It's the best debugging tool, and also a good demo visual.
7. Each phone sends its elapsed time to the server, which returns the distance: `17150 × (doorSeconds − holderSeconds)` cm.

[SONAR.md](SONAR.md#demo-protocol-ethglobal-build) has the audio rules.

### Go/no-go at 2:30

| If this fails | Do this |
|---|---|
| Two phones don't give stable distances | Use a laptop as the door device |
| Signal is too quiet or unclear | Turn the volume up, hold phones closer, and lengthen the code |
| ENSv2 registry setup is stuck | Person 1 or 3 helps for 30 minutes. ENS is the largest prize, but sonar comes first |
| World ID doesn't work with the widget | Follow the [IDKit JS example](https://idkit-js-example.vercel.app/) directly |

## Phase 2: Connect the core flow (2:30–5:00)

**Goal:** issue, claim and check in work end to end with real data. This is the most important phase.

Agree on these routes at the start of the phase, so Person 3 can build against them right away:

| Route | Purpose |
|---|---|
| `POST /api/people` | Give a wallet a name such as `skes.devcon8-demo.eth` |
| `POST /api/issue` | Issue passes from a list of names and a tier |
| `GET /api/tickets?holder=` | List a wallet's tickets |
| `POST /api/world/sign` | Sign a World ID request |
| `POST /api/claim` | Verify the proof, reject repeats, and mark the ticket claimed |
| `POST /api/checkin/start` | Door starts a session and gets a seed |
| `GET /api/checkin/:id` | Both phones poll for state: waiting, recording, or result |
| `POST /api/checkin/:id/report` | Each phone sends its elapsed time |

| Who | Task | Done when |
|---|---|---|
| **Person 2** | Build the routes. Issue writes to ENS and Arkiv; check-in writes to Arkiv only, to keep it fast. The door checks that the ENS owner matches the Arkiv holder. Always read Arkiv with `.ownedBy(organizer)` | Routes work from `curl` |
| **Person 1** | Turn `/lab` into the check-in: session seed, polling, and a large pass or fail with the distance. Holder's phone joins from the session in its QR code | A real pass and a real fail on the door screen |
| **Person 3** | Organizer form. Wallet with name, ticket list, claim button and QR code. Door scanner using `BarcodeDetector`, with a typed pass number as backup | Clicking through works without developer help |
| **Half person** | Test the whole flow after each merge, and report bugs. Draft `arkiv/schema.md`, and add wallet addresses and a sample query to the README | A written list of what's broken |

**Done when:** someone who didn't build it can issue, claim and check in on the deployed URL.

## Phase 3: The attacks, and what's left (5:00–7:00)

**Goal:** the moments that make the demo memorable. **Feature freeze at 7:00.**

| Who | Task, in priority order |
|---|---|
| **Person 1** | Run the sound over Google Meet and record what happens. Test in crowd noise, and tune. Show the correlation plot on the door screen |
| **Person 2** | Blocked transfer shown in the app, with a link to the reverted transaction. Organizer-approved transfer: burn the pass and issue a new one. Check-in ordinal |
| **Person 3** | Rejected second claim on screen. Trophy page at `/u/:name`, reading Arkiv and ENS. Polish the door screen, since judges will look at it most |
| **Half person** | Write the remaining Arkiv files using real numbers and queries, plus the World ID debrief. Draft the demo script |

If time remains, add these in order: company checkout (several names on the issue form), then a browser device key signing check-in reports.

## Phase 4: Rehearse and record (7:00–8:00)

**No new features, only fixes for things that break the demo.**

| Who | Task |
|---|---|
| **Everyone** | Run the [demo script](PRODUCT.md#demo-script-proposed) on the real phones, in a noisy room, at least three times |
| **Person 1** | Choose the phone distance and volume, and keep the phones charged |
| **Person 2** | Fund wallets, restart the server, and keep it awake before the demo |
| **Person 3** | Fix anything confusing on screen |
| **Half person** | Record the video while the demo is working, and keep a backup recording |

## Phase 5: Submit (8:00–9:00)

| Who | Task |
|---|---|
| **Half person** | Go through [TRACKS.md](TRACKS.md) line by line. Submit early, then update if time remains |
| **Person 2** | Confirm the repo is public, the live link works from a new device, and no keys are committed |
| **Person 1** | Prepare a spare recording of a passing check-in, in case the venue is too loud |
| **Person 3** | Finalize the README: what it does, how to run it, and the honest limits |

The README must also include the AI-use statement and credit [enconomy](https://github.com/tawago/enconomy) for ideas. Don't copy its code.

## Cut list

If behind schedule, cut from the top:

1. Purchase page styling
2. Device key signing
3. Company checkout
4. Organizer-approved transfer (keep the blocked transfer)
5. Trophy page polish (keep a plain page reading Arkiv)

**Never cut:** the distance check, the reverted transfer, Arkiv reads on screen, the World ID claim with a rejected repeat, the track files, and the video.

## Working rules

- **Commit small and often to `main`,** since the history shows the work was done at the event. Pull before pushing, and don't spend time on pull request reviews.
- **Keep to your own folder:** Person 1 in `app/src/sonar`, Person 2 in `server`, Person 3 in `app/src/pages`.
- **Keep secrets in environment variables,** and never commit keys.
- **Check in together at 2:30, 5:00 and 7:00.** If something has been stuck for 30 minutes, say so at once.
- **Test on the real phones,** not a desktop browser.
