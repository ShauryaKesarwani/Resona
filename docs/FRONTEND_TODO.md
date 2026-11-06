# Frontend to do

What is left to build and verify in `app/`. Ordered by what the demo needs first. Status as of 7 November 2026, after the profile page. Screens and buttons are in [FRONTEND_FLOWS.md](FRONTEND_FLOWS.md), the design rules in [FRONTEND_HANDOFF.md](FRONTEND_HANDOFF.md), and the team-wide checklist in [../TODO.md](../TODO.md).

## 1. Must verify before the demo

Nothing here needs new screens. It needs two real phones and a public HTTPS URL.

- [ ] **Run the full journey on two phones:** sign in, buy, claim, holder check in, door check in, profile. Record what breaks.
- [ ] **Press Pay once.** The buy screen, its progress labels, error messages and success screen have never been run against the real test network by the frontend owner.
- [ ] **Check the new door and holder screens on a real phone:** pass, fail, running, QR code and camera scan. Only their code and the ready screens have been seen.
- [ ] **Camera scan fallback.** The QR scanner needs `BarcodeDetector`, which Safari on iOS lacks. Typing the 6 digit code is the only path there. Confirm the message is clear, or add a JavaScript decoder.
- [ ] **Install as an app and microphone access** over HTTPS on both Android phones. Dev mode must never be tunnelled to phones. Build, then tunnel to the server.
- [ ] **Sweep 390, 430, tablet and landscape.** Only 360 has been measured on the newest screens.

## 2. Build next

| Item | Why | Notes |
|---|---|---|
| ENS names across the screens | The ENS track needs names visible where people see them | Show the pass name and the event name on the event page, the buy success screen and the door pass screen. Profile link by name once names resolve: `/u/sam.eth` |
| Show the payment on a bought ticket | A purchase has a payment record, but the ticket does not link to it | Add a Row on the ticket with the explorer link, read from `myPurchases` |
| Claim screen: real phone lock | The claim's phone lock step is still simulated, and shows as such | Depends on the server's claim route |
| Transfer: organizer approval | The request and the organizer's answer are simulated | Needs a server route and an organizer view of pending requests |
| Organizer page: pending requests and an event list | The organizer can issue and look up a wallet, nothing else | Wait for the server list routes |
| Event page: more than name, date and price | Judges see a thin page | Needs description and venue fields on the Arkiv event first |

## 3. Policy gaps that show up on screens

These are server decisions, listed so the screens can follow.

- [ ] **Bought tickets skip the World check at the door.** Either the server enforces it, or the buy screen should tell people a World sign in is needed.
- [ ] **One ticket per human per event** is enforced in the browser only. The buy screen's error message exists, but the server does not back it.
- [ ] **Organizer authorization** is missing on issue. The organizer page should say so until it is added.

## 4. Polish

- [ ] **Accessibility audit.** Keyboard order, focus rings, contrast of muted text on the dark surfaces, screen reader labels on the QR code and the event tickets. The `accessibility-testing` skill has not been run.
- [ ] **Large text and dynamic type.** Check at 200 percent text.
- [ ] **Reduced motion.** The hero push in and the screen fade replace movement with a fade. Confirm on a real phone.
- [ ] **Loading speed of Arkiv reads.** Profile and recent check ins take 5 to 10 seconds, with occasional 502 errors from the read relay. Add a retry, and cache the events list between screens.
- [ ] **`/lab` page** is outside the design system, and its Back button points to a guarded route. Restyle it or hide it from the demo.
- [ ] **`/privacy` and `/terms`** are stubs. Write one honest paragraph each: a hackathon demo on a test network.
- [ ] **Empty and offline states** for the wallet, the door and the organizer when the server is unreachable.
- [ ] **Landing page copy** after the features settle: the "How it works" steps and the limits section should match what is real by then.

## 5. For the submission

- [ ] **Demo video** of the full journey, with a screen recording of both phones.
- [ ] **Screenshots** of the landing, events, ticket, door and profile for the write-up. Take them from a build, with the browser fade finished.
- [ ] **Friction notes for the Arkiv and World tracks:** what was slow, what failed, what the frontend had to work around. These come from the testing in section 1.
- [ ] **Remove simulated tags** only where a feature has been run for real. Keep them on anything else.

## Not planned

- Manual admit at the door. Out of demo scope.
- POAPs and company distribution. Only after the core journey is verified.
