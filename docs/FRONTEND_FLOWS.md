# Frontend flows and button map

Every screen, where its buttons sit, and where each one goes. This is the contract for building and reviewing screens. The routes are in `app/src/App.tsx`.

Last updated on 7 November 2026.

## Rules for every screen

- **Top left:** the Back button, a 48px square. It goes to the screen's parent, never to browser history, so deep links still work.
- **Top right:** context only: the wallet chip (name, short address, network) on wallet screens, the staff chip on the door. Never an action.
- **Attendee tab bar:** `/events` and `/wallet` share a fixed bottom bar with two tabs, Events and Tickets. Detail screens drop the bar and put the primary action at the bottom instead.
- **Bottom:** the one primary action, full width and at least 64px tall, in the thumb zone. A secondary action sits under it at 48px.
- **Names:** a button keeps one name for the whole flow, and says what it does. Sentence case.
- **Demo only buttons** start with "Demo control:" and sit below the real actions.
- **Every screen has one `h1`** and an obvious way back or out.

## Access

| Who | Routes |
|---|---|
| Anyone | `/`, `/signin`, `/lab`, `/privacy`, `/terms`, `/u/:name`, `/events` and `/e/:id`. Browsing events needs no account |
| Signed in, or a guest | `/enter`, `/wallet`, `/door`, `/organizer`, `/e/:id/buy` and everything under them |

Signing in means a World ID check each time (the first creates a World session, later ones prove it again), plus the wallet signature. A reload stays signed in until "Sign out" on the Tickets screen. A guest skipped the check, for the demo only. Anyone else on a guarded route goes to `/signin?next=<where they were going>` and returns there afterwards.

## The map

The attendee's world is two tabs, Events and Tickets, joined by the buy flow.

```
                          / Landing   hero and final button: "Open your wallet"
                          │           footer: Events · Door staff and organizers · Privacy · Terms
          ┌───────────────┼──────────────────────────────┐
          ▼               ▼                              ▼
   /signin?next=/wallet   /events (public)        /signin?next=/enter
   World ID, or skip         │                            │
          │                  │                            ▼
          ▼                  ▼                         /enter  (pick a role)
   ┌── /wallet ◄── tab ──► /events ──────────┐          ├─► /wallet
   │   Tickets    bar      Events            │          ├─► /door
   │      │                  │ tap an event   │          └─► /organizer
   │      │ tap a ticket     ▼                │
   │      │            /e/:id  (public)       │  "Host your own event" ─► /organizer
   │      │                  │ Buy a ticket   │
   │      │                  ▼ (needs sign in) │
   │      │            /e/:id/buy             │
   │      │            review ► pay ► done    │
   │      │                                  │ Open your ticket
   │      ▼◄─────────────────────────────────┘
   │  /wallet/ticket/:id            Purchases: /wallet/purchases (from the Tickets screen)
   │   Ready to claim ─► /wallet/claim/:id ─► back to ticket
   │   Claimed ────────► /wallet/checkin/:id ─► back to ticket
   │                └──► /wallet/transfer/:id ─► back to ticket
   │   Not verified ───► /signin?next=/wallet/ticket/:id
   │   Checked in ─────► /u/:name
   └─ "Buy tickets" ─► /events        (/wallet/events redirects to /events)

   /door  (one page: ready ─► scan or type the holder's code ─► checking ─► pass or fail ─► ready)
     └─► /door/recent
```

## Screen by screen

"Back" is the top left button. "Primary" is the bottom full width button.

### Public

| Route | Back | Primary | Other buttons | Notes |
|---|---|---|---|---|
| `/` Landing | none | "Open your wallet" goes to `/wallet`, after the image pushes in and fades to black | Nav: How it works, What it stops, Questions (scroll). Footer: Events to `/events`, Door staff and organizers to `/enter`, Privacy, Terms. Final section repeats the same primary | The final button must match the hero button |
| `/signin` | `/` | The World ID action | "Skip for now" (demo). After success go to `next`, else `/enter` | If World says this person already has an account, show "You already have an account" with no way forward except Back |
| `/privacy`, `/terms` | `/` | "Go back" | None | Placeholder pages |
| `/u/:name` Profile | `/` | "Share" copies the link | None | Public. The name is a wallet address for now. Avatar, short address, one trophy per event attended with place through the door, distance and date, read from Arkiv |
| `/events` Events | `/` | None. Each event card goes to its event. The last card, "Host your own event", goes to `/organizer` | Tab bar: Events, Tickets. Right: wallet chip | Read from Arkiv, so it shows loading, failed and empty states. Each event is drawn as a ticket with a perforation, and the price on the stub. Only events that have not happened yet |
| `/e/:id` Event | `/events` | "Buy a ticket" goes to `/e/:id/buy`. Past events show "This event has ended." instead | Right: wallet chip | Public. Picture, date, ticket price, network |
| `/e/:id/buy` Buy | `/e/:id` | "Pay and get your ticket". The label follows the real steps: Adding test tokens, Sending payment, Saving your ticket. Done: "Open your ticket" | Done: "Back to events" | Guarded. A real payment on the test network. Errors name the cause and link to the payment when there is one |
| `/lab` | `/` | Sonar test controls | None | Person 1's page. Its Back currently points to a guarded route |

### Role picker

| Route | Back | Rows | Notes |
|---|---|---|---|
| `/enter` | `/` | Attendee to `/wallet`, Door staff to `/door`, Organizer to `/organizer` | No primary button. Three equal rows is right here, because the roles are equal choices |

### Wallet (attendee)

| Route | Back | Primary | Secondary and other | Notes |
|---|---|---|---|---|
| `/wallet` Tickets | `/` | "Buy tickets" goes to `/events` | Tab bar: Events, Tickets. "Purchases" link to `/wallet/purchases`. Right: wallet chip | Tickets are read from Arkiv. Empty state: "No tickets yet" |
| `/wallet/ticket/:id` | `/wallet` | Depends on status, below | See below | Shows pass, tier, holder, verification, transfer policy |
| `/wallet/claim/:id` | the ticket | Step 1 "Confirm name", then "Lock ticket to this phone" | Failure: "Try again" and "Back to ticket". Success: "Back to ticket" | Two steps. World ID already happened at sign in |
| `/wallet/checkin/:id` | the ticket | Ready: "Start check in". Pass: "Back to ticket". Fail: "Try again" | Shows a QR code and a 6 digit code for the door | Real sound, signed by the wallet. Unclaimed ticket shows "Claim ticket" instead |
| `/wallet/transfer/:id` | the ticket | "Ask the organizer to approve" | "Demo control: check the ENS transfer rule". Pending: "Cancel request" and "Back to ticket" | With ENS configured, the demo runs a read-only transfer simulation and labels that no transaction was sent. The organizer request is still simulated |

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
| `/door` | `/enter` | Ready: "Check in" with the holder's 6 digit code and the door PIN. Pass: "Next person". Fail: "Try again", or "Next person" when the check could not be saved | "Scan ticket" opens the camera where the browser can read QR codes. "Recent" to `/door/recent` | One page, four states: ready, checking, pass, fail. Real sound exchange and a real Arkiv record. The mic stays open between tries |
| `/door/recent` | `/door` | "Back to the door" | None | Real, read from Arkiv |

Manual admit was removed as out of scope.

### Organizer

| Route | Back | Primary | Other | Notes |
|---|---|---|---|---|
| `/organizer` | `/enter` | Issue view: "Issue ticket". Look up view: "Look up" | A switch at the top changes between Issue and Look up. "Use this phone's wallet" fills the address. The Look up view also lists what was issued in this session | The only organizer screen for now. The old sub routes are dropped: transfers arrive with ENS, and manual entries are out of scope |

## Journeys

**Attendee, first time.** Landing, "Open your wallet", sign in with World ID, land on `/wallet`, tap a ticket, "Claim ticket", confirm name, lock to this phone, back on the ticket, "Check in".

**Attendee, returning.** Landing, "Open your wallet", straight to `/wallet`, because the device wallet is the login.

**Check in, two phones.** The holder opens the ticket and taps "Start check in", which shows a QR code and a 6 digit code. The door scans or types it and enters the PIN. Both phones listen and measure. The door shows the result and "Next person". The holder sees the result and "Back to ticket".

**Organizer.** Landing footer or `/enter`, Organizer, paste an address or tap "Use this phone's wallet", pick a tier, "Issue ticket". The ticket shows in that wallet.

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

## Fixed in this pass

- The attendee flow is organized around an events hub with a two tab bar. Utkarsh's wallet events screen is replaced by it, and the old `/wallet/events` link redirects. His purchase logic in `services/arkiv.ts` is unchanged.

- The landing page's final button went to the role picker while the hero button went to the wallet. Both now go to `/wallet`.
- "Page not found" sent people to the guarded role picker. It now goes to `/`.
- The ticket screen's sign in button is named "Sign in with World ID" (Person A had already renamed it).
- The wallet's Back button went to the role picker, which a first time attendee never saw. It now goes to `/`.

## Open

- Events have no description, venue or tiers on Arkiv yet. The page shows only name, date and price. A purchase always makes a General admission ticket.
- Whether the door scans a QR code or the camera reads a signed session hint.
- The server has no list all tickets route, so the organizer page shows what it issued in this session and lets you look up one wallet.
- The door runs on one page, `/door`, so `/door/checking`, `/door/result` and `/door/manual` no longer exist. The tables above still need updating.
