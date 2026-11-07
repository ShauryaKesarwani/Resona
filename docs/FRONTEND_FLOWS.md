# Frontend flows and button map

Every screen, where its buttons sit, and where each one goes. This is the contract for building and reviewing screens. The routes are in `app/src/App.tsx`.

Last updated on 7 November 2026, after moving the role switch to Account.

## Rules for every screen

- **Top left:** Back, a 48px square, on any screen with a parent. It goes to the parent, never to browser history, so deep links still work. Home screens have no parent, so they show the Resona wordmark, which goes to `/`.
- **Top right:** the wallet chip on every screen: avatar and short wallet address. It opens `/account`. Signed out, it reads "Sign in". Hidden during a running check and on sign in.
- **Bottom:** three tabs on every home screen. The primary action, full width and at least 64px tall, sits just above them, or at the very bottom of a detail screen. A secondary action sits under it at 48px.
- **Names:** a button keeps one name for the whole flow, and says what it does. Sentence case.
- **Demo only buttons** start with "Demo control:" and sit below the real actions.
- **Every screen has one `h1`** and an obvious way back or out.
- **Loading:** the next screen appears at once with a skeleton of its own shape.

## Roles and tabs

There are three ways to use the app, and Account is the third tab in all of them.

**Organizers and attendees are separate flows, decided by the wallet.** A wallet in `ORGANIZER_WALLETS`, or one an admin promoted, is an organizer. An organizer cannot reach Events, Tickets, Purchases or Buy: those routes send them to `/organizer`, and an event page shows "Manage your events" instead of "Buy a ticket". Anyone else cannot reach the organizer screens: those routes send them to `/wallet`. Door staff is open to both, because the door PIN is what protects it. Account only lists the roles this wallet can use. To test both flows, use two wallets.

| Role | Home | Tabs |
|---|---|---|
| Attendee | `/wallet` | Events `/events`, Tickets `/wallet`, Account `/account` |
| Door staff | `/door` | Door `/door`, Check ins `/door/recent`, Account |
| Organizer | `/organizer` | Manage `/organizer`, Attendees `/organizer/attendees`, Account |

The route decides the tabs, and the wallet overrides it where needed. Account keeps the tabs of the role you came from. `/enter` redirects to `/account`.

## Access

| Who | Routes |
|---|---|
| Anyone | `/`, `/signin`, `/lab`, `/privacy`, `/terms`, `/u/:name`, `/events` and `/e/:id`. Browsing events needs no account |
| Signed in, or a guest | Everything else. Anyone else goes to `/signin?next=<where they were going>` and returns there afterwards. With no `next`, sign in lands on `/wallet` |

Signing in means a World ID check each time (the first creates a World session, later ones prove it again), plus the wallet signature. A reload stays signed in until "Sign out" on Account. A guest skipped the check, for the demo only.

## The map

```
 / Landing ── "Open your wallet" ──► /signin if needed ──► /wallet
   footer: Events · Door staff and organizers (/account) · Privacy · Terms

 Any screen ── top right chip ──► /account
   /account ── Attendee ──► /wallet        (attendee wallets only)
            ── Organizer ──► /organizer    (organizer wallets only)
            ── Door staff ──► /door        (both)
            ── On chain: explorer, purchases, trophies

 ATTENDEE  [ Events | Tickets | Account ]
   /events ──► /e/:id ── Buy a ticket ──► /e/:id/buy ── done ──► /wallet/ticket/:id
   /wallet ──► /wallet/ticket/:id
                 Ready to claim ──► /wallet/claim/:id ──► back to ticket
                 Claimed ─────────► /wallet/checkin/:id ── pass ──► /u/:name (trophy)
                 Claimed ─────────► /wallet/transfer/:id ──► back to ticket
                 Not verified ────► /signin?next=this ticket
                 Checked in ──────► /u/:name
                 Payment row ─────► /wallet/receipt/:txn ──► back to ticket
   /wallet ── Purchases ──► /wallet/purchases ──► /wallet/receipt/:txn

 DOOR  [ Door | Check ins | Account ]
   /door: ready ► scan or type the code ► checking ► pass or fail ► Next person ► ready
   Tabs hide while checking and on the result.

 ORGANIZER  [ Manage | Attendees | Account ]
   /organizer: Issue · Look up · New event · Live door · Add an organizer
   /organizer/attendees ── Select for check in ──► /door?passId=
```

## Screen by screen

### Public

| Route | Left | Primary | Other | Notes |
|---|---|---|---|---|
| `/` Landing | Wordmark | "Open your wallet" goes to `/wallet`, after the image pushes in and fades to black | Nav: How it works, What it stops, Questions. The sound section has a three way switch. FAQ opens one answer at a time | The final button matches the hero button |
| `/signin` | Back to `/` | The World ID action | "Skip for now" (demo) | No chip |
| `/privacy`, `/terms` | Back to `/` | "Go back" | None | Placeholder pages |
| `/u/:name` Profile | Back to `/account` for your own, `/` for anyone else's | "Share" copies the link | None | Avatar, address, one trophy per event attended, read from Arkiv |
| `/e/:id` Event | Back to `/events`, or `/organizer` for an organizer | "Buy a ticket". An organizer gets "Manage your events". Past events say "This event has ended." | None | Picture, date, price, network |
| `/account-transfer` | Back to `/account`, or `/signin` when signed out | "Save encrypted account file", "Import account and sign in" | None | Moves a wallet and World session between browsers with a password. Linked from sign in and Account |
| `/lab` | Back to `/` | Sonar test controls | None | A teammate's page, outside the design system |

### Attendee

| Route | Left | Primary | Other | Notes |
|---|---|---|---|---|
| `/events` | Wordmark | None. Each event row opens it | None | Upcoming only. Skeleton, failed and empty states |
| `/e/:id/buy` | Back to `/e/:id` | "Pay and get your ticket". Done: "Open your ticket" | Done: "Back to events" | A real payment on the test network. Label follows the steps |
| `/wallet` | Wordmark | Only when empty: "Buy tickets" goes to `/events` | "Purchases" goes to `/wallet/purchases`. Each row opens the ticket | Upcoming, then past |
| `/wallet/ticket/:id` | Back to `/wallet` | Depends on status, below | Payment row opens the receipt | The pass: art, event, tier, number, status, then the facts |
| `/wallet/claim/:id` | Back to the ticket | Step 1 "Confirm name", then "Lock ticket to this phone" | Failure: "Try again" and "Back to ticket" | Two steps |
| `/wallet/checkin/:id` | Back to the ticket | Ready: "Start check in". Pass: "View your trophy". Fail: "Try again" | Pass: "Back to ticket" | Before you check in, then QR and 6 digit code, then rings and live waveform, then the result with the sound trace |
| `/wallet/transfer/:id` | Back to the ticket | "Ask the organizer to approve", with a wallet address | Pending: "Cancel request", "Back to ticket" | Real signed request. The server still needs its ENS settings to accept one, so without them the screen says transfers are not available |
| `/wallet/purchases` | Back to where you came from, `/wallet` or `/account` | None | Each row: "See receipt" | Read from Arkiv |
| `/wallet/receipt/:txn` | Back to where you came from | "See it on the explorer" | Ticket row opens the pass | |

Ticket screen buttons by status:

| Status | Primary | Secondary |
|---|---|---|
| Ready to claim | "Claim ticket" | none |
| Claimed | "Check in" | "Send to someone" |
| Not verified | "Check in" | "Sign in with World ID" |
| Checked in | "View your trophy" | none |

### Account

| Route | Left | Rows | Notes |
|---|---|---|---|
| `/account` | Wordmark | Role rows for this wallet: Attendee and Door staff, or Organizer and Door staff. On chain: Network, See on the explorer, and for attendees See purchases and See your trophies. "Save or move this account" (`/account-transfer`), "Sign out". "Copy wallet address" under the name | No chip, because this is where the chip goes. |

### Door

| Route | Left | Primary | Other | Notes |
|---|---|---|---|---|
| `/door` | Wordmark | Ready: "Scan check-in QR code". Pass: "Next person". Fail: "Try again", or "Next person" when the check could not be saved | "Check in with code". With a selected ticket: "Check in selected ticket", "Clear selection" | One page with four states. Tabs hide while checking and on the result. Real sound and a real Arkiv record |
| `/door/recent` | Wordmark | None | Tab bar | Read from Arkiv |

### Organizer

| Route | Left | Primary | Other | Notes |
|---|---|---|---|---|
| `/organizer` | Wordmark | Issue: "Issue ticket". Look up: "Look up". New event: "Publish event". Live door: none, it refreshes itself | "Add an organizer" opens a form under the title. "Use this phone's wallet" fills the address | A sliding switch changes between the four |
| `/organizer/transfers` | Back to `/organizer` | "Refresh requests". Each request: "Approve", "Decline" | Reached from "Review ticket transfers" on Manage. Keeps the organizer tabs | Moves an issued ticket. Signed organizer routes |
| `/organizer/attendees` | Wordmark | "Refresh from Arkiv" | "Select for check in" goes to `/door?passId=` | Issued tickets only, not purchases |

## Journeys

**Attendee, first time.** Landing, "Open your wallet", sign in with World ID, land on `/wallet`, tap a ticket, "Claim ticket", confirm name, lock to this phone, back on the ticket, "Check in", "View your trophy".

**Attendee, returning.** Landing, "Open your wallet", straight to `/wallet`, because the device wallet is the login.

**Check in, two phones.** The holder opens the ticket and taps "Start check in", which shows a QR code and a 6 digit code. The door scans or types it and enters the PIN. Both phones listen and measure. The door shows the result and "Next person". The holder sees the result and "Back to ticket".

**Changing role.** Tap the top right chip, then Attendee, Door staff or Organizer. The tabs change with the role.

**Organizer.** Landing "Open your wallet", sign in, land on `/organizer`, because this wallet organizes. Paste an address or tap "Use this phone's wallet", pick a tier, "Issue ticket". The ticket shows in that wallet.

**Buying a ticket.** Events tab, tap an event, "Buy a ticket", sign in if needed, review, "Pay and get your ticket", "Open your ticket". The payment is real, on the Rabdi test network, and Resona adds test tokens first if the wallet is short. One human gets one ticket per event.

**Attendee with an empty wallet.** Landing, "Open your wallet", sign in, an empty Tickets tab, "Buy tickets", then the buying journey above.

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
| Buy tickets | Go to the events list | Tickets tab |
| Buy a ticket | Start buying | Event page |
| Pay and get your ticket | Pay, then receive the ticket | Buy |
| Open your ticket | See the ticket just bought | Buy, done |

## Open

- Events have no description, venue or tiers on Arkiv yet. The page shows only name, date and price. A purchase always makes a General admission ticket.
- Whether the door scans a QR code or the camera reads a signed session hint.
- The server has no list all tickets route, so the organizer page shows what it issued in this session and lets you look up one wallet.
- The door runs on one page, `/door`, so `/door/checking`, `/door/result` and `/door/manual` no longer exist. The tables above still need updating.
