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
- Gets an event ENS name that points to the purchase page and has its own registry for passes, for example `devcon8-demo.eth` on Sepolia.

### 2. Tickets are issued

There are three routes, and all of them end in the same ticket record.

| Route | Who starts it | Result |
|---|---|---|
| **Allocation** | Organizer gives a partner a set of passes at a discount | Passes are assigned to ENS names |
| **Public purchase** | Attendee uses the event's purchase link | Ticket is added to the attendee's wallet |
| **Company checkout** | Company enters employee ENS names while buying | Each employee receives a ticket immediately |

Example: pass `7`, held by `skes.eth`, wallet `0x7…`. The pass is an ENSv2 subname, `7.devcon8-demo.eth`, owned by that wallet, and its details are stored in Arkiv.

### 3. Attendee claims the ticket (proposed detail)

The brief says tickets are tied to a holder and bots should be blocked. Claiming is where that takes effect:

1. The attendee opens the Resona wallet, which holds a wallet address and a key locked to that phone.
2. They prove they are a unique human with World ID's Proof of Human, once per event. A second claim by the same person is rejected.
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

- Each ENS holder has a profile listing the events they attended, as Resona's own badges read from Arkiv. POAP minting can follow after the hackathon.
- A trophy combines the holder's ENS avatar, a short hash and an ordinal, such as "11th person to buy" or "11th person through the door".
- A shareable link opens the profile.

### 7. Lost or replaced phone (proposed)

Because a ticket is locked to one phone, a lost phone would otherwise lose the ticket. The holder asks the organizer to re-bind it, proves they are the same human with World ID on the new phone, and the old key is revoked.

## Scope for ETHGlobal Mumbai (proposed)

The target tracks are World ID, ENS and Arkiv, the demo is a PWA on two Android phones, and the build has 9 hours. [TRACKS.md](TRACKS.md) has each track's checklist.

| Priority | Feature | Needed for |
|---|---|---|
| **Must** | Sound-based distance check between two Android phones | The core claim |
| **Must** | Live demo of rejected attacks: a QR code alone, and a relay over Google Meet | The core claim |
| **Must** | Pass issued as an ENSv2 subname, with non-transferable tiers enforced by the contract | ENS |
| **Must** | Tickets and check-ins in Arkiv, read by the wallet, door and profile | Arkiv |
| **Must** | World ID at claim, with duplicate claims rejected | World |
| **Must** | Deployed PWA as the live demo | ENS, Arkiv |
| **Should** | Browser device key that signs the check-in report | Forwarded tickets fail |
| **Should** | Trophy page with ENS avatar, hash and ordinal | Team's feature; another Arkiv read |
| **Should** | Organizer-approved transfer | ENS |
| **Could** | Company checkout with employee ENS names | Team's feature; a list of names on the issuing form |
| **Could** | Event purchase pages linked from the event's ENS name | ENS |
| **After** | Native app with attestation and hardware keys, sound challenge with a deadline, iOS, and real POAP minting | Stopping modified clients in a real product |

## Demo script (proposed)

1. Organizer issues a pass, which appears on-chain as `7.devcon8-demo.eth` and in the attendee's wallet.
2. The attendee claims it with World ID, and a second claim by the same person is **rejected**.
3. The attendee checks in with the phones about 30 cm apart: **pass**, with the distance shown.
4. The attendee stands across the room: **fail**.
5. Someone streams the QR code over Google Meet: **fail**.
6. Someone relays the sound over Google Meet: **fail**, with a huge apparent distance on screen.
7. The attendee tries to send the ticket to a friend: **the transaction reverts**, and it can only move through organizer approval.
8. The attendee's profile shows the new trophy, read from Arkiv.

## Limits to be honest about

- Resona proves that the **holder's phone** is at the door. It doesn't prove who is carrying that phone. Someone can still lend their unlocked phone, though the ENS avatar on the staff screen and an optional ID check make that harder.
- World ID makes bulk buying harder but can't stop someone from renting another person's World ID.
- ENS names and Arkiv records are public, so a ticket can reveal that a person is attending an event unless the record is encrypted. See [the privacy question in DECISIONS.md](DECISIONS.md#open-questions).
