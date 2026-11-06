# Product

Sections marked **(proposed)** were added while writing this up and were not in the team's brief. Everything else comes from the brief.

## Users

| User | What they want |
|---|---|
| **Organizer** (for example ETHGlobal or Devcon 8) | Tickets reach the intended people, resale is under their control, and door fraud stops |
| **Partner organization** | Discounted passes for its people |
| **Company buyer** | Buy tickets at checkout and assign them to employees by ENS name, instantly |
| **Individual attendee** | Buy from the event's site, hold the ticket in the Resona wallet, and walk in |
| **Door staff (proposed)** | A check-in that takes seconds and has a clear fallback when it fails |

## Flows

### 1. Organizer creates an event

- Sets up the event, its ticket tiers and its transfer policy.
- Gets an event ENS name that points to the purchase page and has its own registry for passes, for example `ethglobal-mumbai.eth` on Sepolia.

### 2. Tickets are issued

There are three routes, and all of them end in the same ticket record.

| Route | Who starts it | Result |
|---|---|---|
| **Allocation** | Organizer gives a partner a set of passes at a discount | Passes are assigned to ENS names |
| **Public purchase** | Attendee uses the event's purchase link | Ticket is added to the attendee's wallet |
| **Company checkout** | Company enters employee ENS names while buying | Each employee receives a ticket immediately |

Example: pass `7`, held by `skes.eth`, wallet `0x7…`. The pass is an ENSv2 subname, `7.ethglobal-mumbai.eth`, owned by that wallet, and its details are stored in Arkiv.

### 3. Attendee claims the ticket (proposed detail)

The brief says tickets are tied to a holder and bots should be blocked. Claiming is where that takes effect:

1. The attendee opens the Resona wallet, which holds a wallet address and a key locked to that phone.
2. They verify with World ID, at the level the ticket requires, once per event. A second claim by the same person is rejected.
3. Their ENS name is checked: it must resolve to their Resona wallet address.
4. The ticket is locked to that address and that phone's key.

For a company purchase, each employee completes this step themselves. The company can assign a ticket but can't hold a stack of them for later use.

### 4. Transfer

- Holders cannot move a non-transferable ticket on their own. The ENSv2 contract rejects the transfer because the holder was never given the transfer role.
- A holder requests a transfer, and the organizer approves or denies it. A request lapses after 24 hours.
- Once approved, the organizer burns the old pass and issues a new one. The new holder completes the claim flow, and the old phone's key stops working.

Transfer rules are set **per ticket tier** (proposed). Devcon 8 already works this way: its [FAQ and ticket pages](https://devcon.org/en/tickets/faq/) describe General Admission as transferable and discounted tickets as non-transferable. Resona makes that kind of rule enforceable.

### 5. Check-in at the door

1. The attendee opens the ticket and holds their phone close to the staff phone.
2. The phones exchange sound for a few seconds at most, and the distance is calculated.
3. The staff phone shows a pass or fail with the holder's ENS name and avatar. A pass is recorded in Arkiv.

The details and security reasoning are in [SONAR.md](SONAR.md).

**Fallback (proposed):** a broken speaker, a dead phone or a very loud room can't mean being turned away. Staff can admit someone manually after an ID check, and the override is logged against that staff member so organizers can audit it.

### 6. Attendance trophy

- Each ENS holder has a profile listing the events they attended, read from Arkiv, with POAPs. This comes in [stage 4](#later-stages).
- A trophy combines the holder's ENS avatar, a short hash and an ordinal, such as "11th person to buy" or "11th person through the door".
- A shareable link opens the profile.

### 7. Lost or replaced phone (proposed)

Because a ticket is locked to one phone, a lost phone would otherwise lose the ticket. The holder asks the organizer to re-bind it, proves they are the same human with World ID on the new phone, and the old key is revoked.

## Scope for ETHGlobal Mumbai

The demo is a PWA on two Android phones. Sonar check-in comes first, and nothing else starts until it works. [BUILD_PLAN.md](BUILD_PLAN.md) has the phases, and [TRACKS.md](TRACKS.md) has each track's checklist.

| Stage | Feature | Why |
|---|---|---|
| **1** | Sound-based distance check between two Android phones | The core product |
| **1** | Tickets issued directly by the organizer, and stored on Arkiv | Tickets exist without any checkout |
| **1** | A sonar pass updates Arkiv, and a repeat check-in is rejected | The check-in record, and the Arkiv track |
| **1** | Live demo of rejected attacks: a QR code alone, and a relay over Google Meet | Proves the core claim |
| **1** | Deployed PWA as the live demo | Judges can try it |
| **2** | World ID at claim, with a repeat claim rejected | One ticket per person, and the World track |
| **3** | Names replace wallet addresses, and passes are ENSv2 subnames the holder can't transfer | Simpler names, and the ENS track |
| **After** | Native app with attestation and hardware keys, sound challenge with a deadline, iOS | Stopping modified clients in a real product |

## Later stages

These come only after sonar check-in, World ID and ENS are working.

### Stage 4: Event pages and profiles

- **Event page:** the event's ENS name is its home page and ticket page, for example `ethglobal-mumbai.eth`. The `ethglobal.mumbai.eth` style also works, but needs control of `mumbai.eth`. On Sepolia, the simplest approach is a page on our site, `/e/<name>`, that reads the event's ENS records.
- **Attendee profile:** `/u/<name>` shows which events a person attended and checked in to, read from Arkiv, with their ENS avatar and arrival number, such as "11th through the door".
- **POAPs:** each check-in earns a POAP on the attendee's profile. [POAP's mint links go through a review](https://documentation.poap.tech/docs/popular-flow), so request them well before an event. Resona's own badge can show until they arrive.

### Stage 5: Buying tickets on testnet

Testnet tokens only, with no real money. Tickets reach people in one of two ways, and each ticket records which one was used:

| Route | How it works | Verification |
|---|---|---|
| **Company distribution** | A company buys passes and enters its employees' ENS names at checkout. Each name resolves to the wallet attached to it, and the ticket arrives in that wallet | Each employee verifies for themselves when claiming, so a company can't hoard passes |
| **Individual purchase** | A person opens the event's ENS page, buys a ticket with testnet tokens, and it goes to their own wallet | The buyer verifies when buying |

### Verification levels

The ticketing provider chooses what each ticket tier requires. It can be one level, or all of them, and the ticket and door screen show what was verified. This is also what the World track rewards: picking the credential that's proportionate to the ticket.

| Shown as | [World ID credential](https://docs.world.org/world-id/idkit/credentials) | What it proves |
|---|---|---|
| **Camera verified** | Selfie Check | Liveness and facial similarity. Medium assurance, available to anyone with the World app, with no Orb or document needed |
| **Government ID** | Passport | Holds a verified NFC passport. The docs don't say whether this ensures uniqueness across users, so check before relying on it for one-per-person |
| **Orb verified** | Proof of Human | A unique human, verified by the Orb. The highest assurance |

## Demo script

**Stage 1, the main demo:**

1. The organizer issues a ticket, and it appears in the attendee's wallet and on Arkiv.
2. The attendee checks in with the phones about 30 cm apart: **pass**, with the distance shown and a link to the Arkiv record.
3. The same ticket tries again: **rejected**, because Arkiv shows it's already checked in.
4. The attendee stands across the room: **fail**.
5. Someone streams the QR code over Google Meet, and another phone tries to use it: **fail**, because that phone doesn't have the holder's wallet key.
6. Someone relays the sound over Google Meet: **fail**, with a large apparent distance or no sound found.

**If stages 2 and 3 are built:**

7. A second claim by the same person is **rejected** by World ID.
8. The attendee tries to send the pass to a friend: **the transaction reverts**.

## Limits to be honest about

- Resona proves that the **holder's phone** is at the door. It doesn't prove who is carrying that phone. Someone can still lend their unlocked phone, though the ENS avatar on the staff screen and an optional ID check make that harder.
- World ID makes bulk buying harder but can't stop someone from renting another person's World ID.
- ENS names and Arkiv records are public, so a ticket can reveal that a person is attending an event unless the record is encrypted. See [the privacy question in DECISIONS.md](DECISIONS.md#open-questions).
