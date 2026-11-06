# Frontend handoff

Where the Resona frontend stands, what the designer likes, and the rules the work follows. Read this before touching `app/`.

Last updated on 6 November 2026. The app is a Vite, React and TypeScript PWA with Tailwind v4, in `app/`.

## What the designer likes

These come from repeated feedback during the build, so treat them as the brief.

**Premium and web3, not templated.** Dark, flat, confident. The earlier attempts were rejected as "tacky", "vibecoded" and "looks ass". The things that triggered that:

- Rows of identical rounded cards with the same soft shadow.
- Grids with an empty cell, or a layout pushed off center.
- Serif or marble "classical" styling, and a gold accent.
- Text that says little, or says it in too many words.

**Image led.** One image carries the brand: a lone figure on a dark plain under a huge spiral of light lines. It is used as a full bleed, dimmed backdrop. Text sits in the dark negative space, never over the bright streak. Grayscale with one colour bleeding through (aqua) was chosen over full colour.

**The gateway flow.** `components/GatewayFlow.tsx` is a canvas of dotted streams that curve in from both edges and pinch at the middle, like two phones meeting, with a tap ripple. Blue at the edges, aqua at the pinch. It draws one still frame under reduced motion. Used as the landing sound band, the door's ready screen, the holder's code screen, the empty wallet and behind the profile avatar. It replaced a recoloured waveform GIF that looked low quality. Keep it to moments about two things meeting.

**Story through motion.** The designer likes one memorable, meaningful moment over scattered effects. The hero pushes in toward the figure and fades to black before opening the wallet. An earlier idea was two figures colliding. Motion must respect reduced motion.

**Layouts that think outside the box.** Centered, symmetrical, and balanced:

- A timeline that alternates left and right around a middle line.
- A before and after table with arrows.
- One large block beside a plain list of equal height.
- A two sided ledger with equal halves.

Cards are used sparingly, and never as a stack of look alikes.

**Direct copy.** Short, plain and specific, written for someone on a bus. Benefit first. Say what happens and who it affects. A longer blurb is not better copy. "A stream or screenshot fails" was rejected because it never says what fails.

**Honest labelling.** Simulated data is tagged Simulated. Demo only buttons start with "Demo control". A claim stays out of the copy until the team can show it. Thresholds are design targets until tested on real phones.

**Typography is a strength.** The typography pass was praised ("looks fire"). Keep it.

**Seeing beats telling.** Show visual samples on localhost instead of describing them. Several options with a recommendation beat one.

## Skills used, and what each governs

| Skill | Source | Governs | Used |
|---|---|---|---|
| `frontend-design` | built in | Process: plan, review against the brief, build, critique. Distinctive choices over defaults. Remove one decoration | Yes |
| `aesthetics-prompt` | built in | Anti "AI slop" rules: avoid generic fonts, purple gradients and cookie cutter components | Yes |
| `landing-page-design` | `elayadesign/ai-design-skills`, installed globally | Page structure and copy, plus the strict visual system: Geist only, Tailwind type scale and named text styles, spacing tokens, nested radius, flat dark surfaces, Phosphor icons, motion curve, scroll reveal, tagline reveal | Yes |
| `better-typography` | `jakubkrehel/skills`, installed globally | Line height, tracking, measure, tabular numbers, wrapping, non breaking spaces, heading structure, caption floor | Yes |

The original brief also named `accessibility-testing`, `visual-testing` and `dataviz`. These were not run. Keyboard order, a contrast audit and screenshot comparison are still open.

**Where the skills disagree:** `better-typography` wins on typography. The landing page skill still wins on everything else, such as the type scale steps, the font and the flat backgrounds.

## The design system as built

Tokens are in `app/src/index.css`.

- **Surfaces, flat only:** `#000000`, `#181818`, `#1F1F1F`, `#272727`, `#313131`, `#131209`. No background gradients. The one gradient is white to grey on hero heading text.
- **Accent:** aqua `#7ED6CF`. One accent only, under 80% saturation. Success `#6FC79A` and danger `#E5736B` are for status.
- **Type:** Geist, with Geist Mono for addresses, passes and distances. No italics. Nothing heavier than semibold. Named styles: `heading-1` to `heading-6`, `title-1` to `title-5`, `body-1` to `body-6`, `button-lg` to `button-xsm`, `caption-1` to `caption-5`. Captions are 13px.
- **Spacing:** only 0, 2, 4, 8, 12, 16, 24, 32, 40, 48, 64, 80 and 96px.
- **Radius:** Tailwind values only. A shape inside another with a gap under 32px takes the outer radius minus the gap.
- **Borders:** all the way around or not at all. Hairline row dividers are fine.
- **Motion:** `cubic-bezier(0.22, 1, 0.36, 1)`, animate only `transform` and `opacity`, reveal each section once with an `IntersectionObserver`, and replace movement with a fade under reduced motion.
- **Icons:** Phosphor only. Import them through `app/src/components/icons.ts`, never from the package root. The root import makes dev mode send a 6 MB bundle.

## Rules the work follows

**Copy**
- Sentence case. No hyphens inside words or sentences. Curly quotes.
- No filler words: revolutionize, supercharge, effortless, world class and the like.
- Buttons say what they do and keep that name through the flow.
- Errors say what happened and how to fix it, and never apologise.

**Phone first**
- Design 390 by 844 first. Check 360 and 430.
- The one primary action is at least 64px tall, full width and in the bottom third.
- Touch targets are at least 48px. Inputs are 16px so iOS does not zoom.

**Typography details**
- One `h1` per screen. The top bar title is a plain paragraph unless the screen has no other heading.
- A non breaking space (` `) glues numbers to units and to "Pass", as in `28 cm` and `Pass 7`.
- `tabular-nums` on values that change: counts, times, distances, countdowns.
- Long text is capped at 65 characters wide.

**Layout**
- No empty grid cells. Centered content stays centered.
- Left aligned reading text. Balanced headings.

## Code conventions

- **Components:** `Button`, `Screen` and `TopBar`, `Figure` and `HeroBackdrop`, `Bits` (status pill, simulated tag, wallet chip, avatar), and `Reveal`. Landing sections are in `app/src/pages/landing/`.
- **Ticket data:** `app/src/data/mock.ts` holds the ticket state read through `app/src/services/arkiv.ts`, plus the simulated check ins, which reset on reload.
- **Real data so far:** sign in, the signed claim, the organizer page, wallet tickets, buying and purchases. The door and check ins are still simulated.
- **Tags:** show `SimTag` on anything simulated. Prefix demo only buttons with "Demo control:".

## Screens and status

| Route | Screen | Status |
|---|---|---|
| `/` | Landing | Built, with the redesigned problem, benefits, how it works and limits sections |
| `/signin` | Sign in with World ID once, or skip for the demo | Real, built by Person A |
| `/events`, `/e/:id`, `/e/:id/buy` | Events list, event page, buy | Built, on real Arkiv data and a real test network payment |
| `/enter` | Role picker | Built |
| `/wallet` | Tickets, upcoming then past | Real, read from Arkiv |
| `/wallet/events` | Upcoming events and buying | Real testnet payment |
| `/wallet/purchases` | Purchase history | Real, read from Arkiv |
| `/wallet/ticket/:id` | Ticket | Real |
| `/wallet/claim/:id` | Claim | Two steps, with a real signed claim. World ID happens at sign in |
| `/wallet/checkin/:id` | Holder check in | Real sound, wallet signed. Shows a QR code and 6 digit code |
| `/wallet/transfer/:id` | Send ticket | Simulated |
| `/door` | Door check in | Real sound. Scan or type the holder's code, with a door PIN |
| `/door/recent` | Recent check ins | Real, read from Arkiv. Manual admit was removed: it is out of demo scope |
| `/organizer` | Issue tickets and look up a wallet | Built, real. It calls `/api/issue` and `/api/tickets` |
| `/u/:name` | Public trophy page | Real, read from Arkiv. Takes a wallet address |
| `/privacy`, `/terms` | Legal | Stubs that say "Not built yet" |
| `/lab` | Sonar test page | Person 1's, outside the design system |

**Branches.** `main` is the working branch. The redesigned landing sections, the organizer page and the flow docs are committed on local `main` and have not been pushed to GitHub yet.

## Flows and buttons

Every screen's buttons and where they lead are in [FRONTEND_FLOWS.md](FRONTEND_FLOWS.md). Read it before adding or moving a button.

## Plan for the next screens

Stage 1 first, as in `docs/BUILD_PLAN.md`:

1. Organizer: done. The server has no list all route yet, so the page shows this session's tickets and looks up one wallet.
2. Wallet on real data, with a QR code for the door.
3. Door camera scan, with the typed number as backup.
4. Wire check in on both phones and link the Arkiv record after a pass.
5. ENS names across the screens.
6. Event page and buy flow: built on real data. Next: the profile, and showing a bought ticket's payment record on the ticket.

## How to run and verify

`/canvas` (dev mode only) shows every screen in phone frames on one page, with zoom and a 360, 390 or 430 width switch.

```bash
cd app
npm install
npm run dev     # laptop only
npm test        # sonar tests
npm run build   # then tunnel to the server on port 3050 for phones
```

- Never tunnel dev mode to phones. Build, then tunnel to `http://localhost:3050`.
- Check each screen at 390, 360 and 430 wide, and on a desktop width, with no horizontal overflow.
- The in app browser pane reports reduced motion as on. Animation timing has to be checked with that preference off.
- A real phone has not been tested yet.

## Working rules

- Use short branches for experiments. Do not push an experiment until it is approved.
- Pull often. Read what teammates changed before merging, and keep their behaviour.
- Squash a feature into one commit when it goes to `main`.
- Commits and pull requests carry no co-author or tool attribution lines. Keep local editor and assistant configuration out of the repo.
- Ask before choosing between design options, and show the options on screen.
