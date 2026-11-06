# Prize tracks: ETHGlobal Mumbai 2026

Resona is being built from scratch at the event, so the Continuity Track prizes don't apply. Requirements are taken from ETHGlobal's prize pages on 6 November 2026. Check those pages again before submitting, because they can change.

**Timing:** on 6 November 2026 the team reported the deadline as 9 hours away. Check the exact time on the ETHGlobal dashboard.

**Prior work:** [enconomy](https://github.com/tawago/enconomy) has no license and the Arkiv track requires building from scratch, so use it for ideas only, and credit it in the README.

**Order:** the team is building sonar and Arkiv first, then World ID, then ENS, as set out in [BUILD_PLAN.md](BUILD_PLAN.md#build-order). Finishing stage 1 keeps only the Arkiv track possible, and each later stage adds one more.

## Summary

| Sponsor | Track | Prize pool | Fit |
|---|---|---|---|
| ENS | Best Use of ENSv2 | $7,000 ($3,000, $2,000, $1,000, $1,000) | Stage 3. Strong if passes are subnames with blocked transfers; simpler names alone may be judged cosmetic |
| Arkiv | Build on Arkiv (from scratch) | $4,000 ($3,000, $1,000) | Stage 1. Strong: the wallet and door read tickets from Arkiv, and a sonar pass updates it |
| World | Best Use of IDKit | $2,500 (up to 2 teams, $1,250 each) | Stage 2. Strong |
| World | World ID Agent Pass | $5,000 | **Skip.** It's built around the Agent Pass product, and Resona has no use for it |
| Arkiv | Arkiv + Swarm bonus | $500 | **Skip,** since it adds another integration for little |

## Resona's demo priority

The implementation order is **Arkiv, ENS, then World ID**, while the attendee-facing story still demonstrates all three. Arkiv should hold ticket and check-in records that the purchase, attendee and door views actually read. ENS supplies the event domain page and holder profile. IDKit / World ID verifies the attendee before a testnet purchase. At the door, sonar checks proximity first, followed by verification of the ticket's assigned wallet.

The demo's central claim is the sonar check-in. If time runs short, preserve that check-in and at least one visible Arkiv read, then the ENS event page, then IDKit verification and testnet purchase. The full purchase-to-door journey remains the intended demo when the core path is stable.

The first startup prospects are Web3 conferences and hackathons. Pitch from both ETHGlobal's and Devcon's perspectives. The commercial model is a per-event organizer charge based on ticket volume, with the per-ticket rate negotiated.

## ENS

[Prize page](https://ethglobal.com/events/mumbai/prizes/ens). Our design is in [ARCHITECTURE.md](ARCHITECTURE.md#ensv2-tickets-as-subnames).

- [ ] Built on ENSv2 on Ethereum mainnet or Sepolia (we use Sepolia)
- [ ] ENSv2 features are central to the product, not cosmetic
- [ ] Demo works and isn't hard-coded
- [ ] Live demo link
- [ ] Open-source code on GitHub or similar

Bonus points are mentioned for AI agents, which we aren't pursuing.

## Arkiv

[Prize page](https://ethglobal.com/events/mumbai/prizes/arkiv). Each team can win one Arkiv track prize. The four judging criteria carry 25% each, one file per criterion.

- [ ] Built from scratch at ETHGlobal Mumbai
- [x] App writes to Arkiv's current testnet with `@arkiv-network/sdk` or JSON-RPC
- [x] At least one feature users see reads its data from Arkiv
- [ ] README lists the wallet addresses that wrote the entities, and one query judges can run
- [x] `/arkiv/schema.md`: entities, queried fields, owners and expiry
- [ ] `/arkiv/friction.md`: feedback, including what broke, what was expected and how to reproduce it
- [ ] `/arkiv/reach.md`: who it's for, whether they can try it today, and whether we'll keep building after Mumbai
- [ ] `/arkiv/why-arkiv.md`: what users would lose with Postgres, and what we kept off Arkiv and why
- [ ] `/arkiv/how-you-use-arkiv.md`: whether filters, editing rights and expiry fit the app, and whether each feature changes something users see
- [ ] Public repo with an open-source license
- [ ] State how AI was used

Answer these files with links, numbers or a runnable query. Keep notes in `friction.md` from the first hour, since it can't be reconstructed well at the end.

Not counted: the SDK installed but never read from, or Arkiv used only as a log that nothing reads.

## World

[Prize page](https://ethglobal.com/events/mumbai/prizes/world). The page says it isn't rewarding the most credentials used, but the best decision about which credential is needed and why.

- [ ] IDKit integrated in a functioning application
- [ ] At least one credential, verified on the server
- [ ] Explain the product event that requires trust, and why the credential is the minimum sufficient assurance
- [ ] Show a successful verification and one meaningful alternative path (ours: a duplicate claim is rejected)
- [ ] Integration debrief: time to first success, friction, missing capability or docs, and the single most useful improvement

Time the first successful verification when it happens, since the debrief asks for it.

## General

- [ ] Add a license (MIT is the usual choice, and the repo owner should decide)
- [ ] Keep committing during the event, so the history shows the work happened there
- [ ] Add an AI-use statement to the README, including that Claude helped write these docs
- [ ] Deploy the PWA so judges can try it
- [ ] Record a demo using the two Android phones
