# Frontend flows and button map

Every screen, where its buttons sit, and where each one goes. This is the contract for building and reviewing screens. The routes are in `app/src/App.tsx`.

Last updated on 7 November 2026.

## Rules for every screen

- **Top left:** the Back button, a 48px square. It goes to the screen's parent, never to browser history, so deep links still work.
- **Top right:** context only: the wallet chip (name, short address, network) on wallet screens, the staff chip on the door. Never an action.
- **Bottom:** the one primary action, full width and at least 64px tall, in the thumb zone. A secondary action sits under it at 48px.
- **Names:** a button keeps one name for the whole flow, and says what it does. Sentence case.
- **Demo only buttons** start with "Demo control:" and sit below the real actions.
- **Every screen has one `h1`** and an obvious way back or out.

## Access

| Who | Routes |
|---|---|
| Anyone | `/`, `/signin`, `/lab`, `/privacy`, `/terms`, `/u/:name`, and `/e/:name` once built |
| Signed in, or a guest | `/enter`, `/wallet`, `/door`, `/organizer` and everything under them |

Signing in means a World ID check once, after which the wallet on the phone is the login. A guest skipped the check, for the demo only. Anyone else on a guarded route goes to `/signin?next=<where they were going>` and returns there afterwards.

## The map

```
                                  ┌───────────────────────── /  Landing ─────────────────────────┐
                                  │ hero button and final button: "Open your wallet"             │
                                  │ footer: "Door staff and organizers"        Privacy   Terms   │
                                  └──────┬───────────────────────────────────────┬──────────────┘
                                         │                                       │
                                         ▼                                       ▼
                    (not signed in) /signin?next=/wallet                    /signin?next=/enter
                       "Sign in with World ID" or "Skip for now"                  │
                                         │ done                                    │ done
                                         ▼                                         ▼
                                      /wallet  ◄──── Back ────────────────────  /enter  (pick a role)
                                         │                                    ┌─────┼───────────┐
                                         │                                    ▼     ▼           ▼
                                         │                                 /wallet /door    /organizer
                                         ▼
                                 /wallet/ticket/:id
          Ready to claim ─► /wallet/claim/:id ─► back to ticket
          Claimed ────────► /wallet/checkin/:id ─► back to ticket
                       └──► /wallet/transfer/:id ─► back to ticket
          Not verified ───► /signin?next=/wallet/ticket/:id
          Checked in ─────► /u/:name

   /door ─► /door/checking?pass= ─► /door/result?pass=&r= ─► /door
     │                                   └─ Try again ─► /door/checking
     ├─► /door/recent
     └─► /door/manual

   /e/:name ─ Buy a ticket ─► /e/:name/buy ─► /wallet/ticket/:id       (planned)
```

## Screen by screen

"Back" is the top left button. "Primary" is the bottom full width button.

### Public

| Route | Back | Primary | Other buttons | Notes |
|---|---|---|---|---|
| `/` Landing | none | "Open your wallet" goes to `/wallet`, after the image pushes in and fades to black | Nav: How it works, What it stops, Questions (scroll). Footer: Door staff and organizers to `/enter`, Privacy, Terms. Final section repeats the same primary | The final button must match the hero button |
| `/signin` | `/` | The World ID action | "Skip for now" (demo). After success go to `next`, else `/enter` | If World says this person already has an account, show "You already have an account" with no way forward except Back |
| `/privacy`, `/terms` | `/` | "Go back" | None | Placeholder pages |
| `/u/:name` Profile (later) | `/` | "Share" copies the link | None | Public: avatar, hash, arrival number, events attended |
| `/e/:name` Event (planned) | `/` | "Buy a ticket" goes to `/e/:name/buy` | None | Public: event name, date, tiers |
| `/lab` | `/` | Sonar test controls | None | Person 1's page. Its Back currently points to a guarded route |

### Role picker

| Route | Back | Rows | Notes |
|---|---|---|---|
| `/enter` | `/` | Attendee to `/wallet`, Door staff to `/door`, Organizer to `/organizer` | No primary button. Three equal rows is right here, because the roles are equal choices |

### Wallet (attendee)

| Route | Back | Primary | Secondary and other | Notes |
|---|---|---|---|---|
| `/wallet` Tickets | `/` | None. Each ticket row goes to its ticket | Right: wallet chip | Empty state: "No tickets yet". Once events exist, offer "Find an event" |
| `/wallet/ticket/:id` | `/wallet` | Depends on status, below | See below | Shows pass, tier, holder, verification, transfer policy |
| `/wallet/claim/:id` | the ticket | Step 1 "Confirm name", then "Lock ticket to this phone" | Failure: "Try again" and "Back to ticket". Success: "Back to ticket" | Two steps. World ID already happened at sign in |
| `/wallet/checkin/:id` | the ticket | Ready: "Start check in". Pass: "Back to ticket". Fail: "Try again" | Running: demo controls | Unclaimed ticket shows "Claim ticket" instead |
| `/wallet/transfer/:id` | the ticket | "Ask the organizer to approve" | "Demo control: try a direct transfer". Pending: "Cancel request" and "Back to ticket" | Blocked transfer is the ENS moment, later |

Ticket screen buttons by status:

| Status | Primary | Secondary |
|---|---|---|
| Ready to claim | "Claim ticket" to the claim screen | none |
| Claimed | "Check in" | "Send to someone" |
| Not verified | "Check in" | "Sign in with World ID" to `/signin?next=` this ticket |
| Checked in | "View your trophy" to `/u/:name` | none |

### Door (staff)

| Route | Back | Primary | Secondary and other | Notes |
|---|---|---|---|---|
| `/door` | `/enter` | "Check in" with the typed pass number. To build: "Scan ticket" opens the camera, with a "Type the number instead" link | "Recent" to `/door/recent`. "Admit manually" to `/door/manual` | Staff chip top right. Manual admit is outside the demo scope |
| `/door/checking` | `/door` | None. It finishes by itself | Demo controls end the check with a chosen result | Live steps: waiting, listening, measuring |
| `/door/result` | `/door` | Pass: "Next person". Fail: "Try again" where it can help, otherwise "Next person" | "Admit manually" on a distance or sound fail | Pass shows name, distance, arrival number, and the Arkiv record link once real |
| `/door/manual` | `/door` | "Admit this person" | None | Needs the ID check box. Done: "Next person" |
| `/door/recent` | `/door` | "Back to the door" | None | Will read from Arkiv |

### Organizer

| Route | Back | Primary | Other | Notes |
|---|---|---|---|---|
| `/organizer` | `/enter` | Issue view: "Issue ticket". Look up view: "Look up" | A switch at the top changes between Issue and Look up. "Use this phone's wallet" fills the address. The Look up view also lists what was issued in this session | The only organizer screen for now. The old sub routes are dropped: transfers arrive with ENS, and manual entries are out of scope |

## Journeys

**Attendee, first time.** Landing, "Open your wallet", sign in with World ID, land on `/wallet`, tap a ticket, "Claim ticket", confirm name, lock to this phone, back on the ticket, "Check in".

**Attendee, returning.** Landing, "Open your wallet", straight to `/wallet`, because the device wallet is the login.

**Check in, two phones.** The door types or scans the pass and sees "Checking". The holder opens the ticket and taps "Start check in". Both phones show listening, then measuring. The door shows the result and "Next person". The holder shows "You are in" and "Back to ticket".

**Organizer.** Landing footer or `/enter`, Organizer, paste an address or tap "Use this phone's wallet", pick a tier, "Issue ticket". The ticket shows in that wallet.

**Buying a ticket, planned.** Event page, "Buy a ticket", sign in if needed, pick a tier, pay with testnet funds, "Open your ticket". The payment is recorded on Arkiv, and the open question is which token pays.

## Button names

| Name | Means | Where |
|---|---|---|
| Open your wallet | Go to the attendee's tickets | Landing, twice |
| Sign in with World ID | Prove once you are a person | Sign in, ticket screen |
| Skip for now | Demo only, continue as a guest | Sign in |
| Claim ticket | Start claiming | Ticket screen, check in screen |
| Lock ticket to this phone | Finish claiming | Claim, step 2 |
| Check in | Go to check in | Ticket screen, door |
| Start check in | Begin the sound exchange | Holder check in |
| Next person | Back to the door after a result | Door |
| Issue ticket | Write a ticket for an address | Organizer |

## Fixed in this pass

- The landing page's final button went to the role picker while the hero button went to the wallet. Both now go to `/wallet`.
- "Page not found" sent people to the guarded role picker. It now goes to `/`.
- The ticket screen's sign in button is named "Sign in with World ID" (Person A had already renamed it).
- The wallet's Back button went to the role picker, which a first time attendee never saw. It now goes to `/`.

## Open

- Which testnet token pays for tickets, and who pays gas.
- Whether the door scans a QR code or the camera reads a signed session hint.
- The server has no list all tickets route, so the organizer page shows what it issued in this session and lets you look up one wallet.
- There are no check in routes on `main` yet, so the door and holder check in stay simulated.
