# Frontend handoff

Where the Resona frontend stands, what the designer likes, and the rules the work follows. Read this before touching `app/`.

Last updated on 7 November 2026. The app is a Vite, React and TypeScript PWA with Tailwind v4, in `app/`. This file is written for any coding agent or person picking the work up, whatever tool they use.

## Start here

1. Read `AGENTS.md`, then `TODO.md`. The checklist in `TODO.md` is the source of truth for what is done. Update it in the same change as any feature, as `AGENTS.md` requires.
2. Read `arkiv/schema.md` before touching tickets, check ins, accounts or anything stored on Arkiv.
3. Read [FRONTEND_FLOWS.md](FRONTEND_FLOWS.md) for every screen's buttons and routes, and [FRONTEND_TODO.md](FRONTEND_TODO.md) for what is left in `app/`.
4. Read the sections below for the designer's taste and the design system. They are written out in full here, so nothing depends on any tool's installed skills.
5. Run `git pull` before starting, and read the new commits. Teammates change the same screens.

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

**The app screens follow direction C.** Full bleed art at the top of a home screen (`SceneHeading`), a short accent bar, a large title, then plain rows divided by hairlines, each ending in a thin accent arrow. Thin line icons everywhere. Not a pile of cards. The landing page keeps its own panels, which the designer likes.

**Seamless over flashy.** Small transitions matter: a tap should show the next screen's skeleton at once, accordions close the previous item, markers slide. Fixing how screens lead to each other comes first.

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

## Design guidelines behind the work

The design followed these public guideline sets. The rules that matter are copied into this file, so an agent without them installed loses nothing. To load them anyway, install them with the skills CLI (`npx skills add <repo>`) or place them in `.agents/skills/`, which Codex and OpenCode read.

| Guideline set | Source | Governs |
|---|---|---|
| Landing page design | `elayadesign/ai-design-skills` | Page structure and copy, plus the strict visual system: Geist only, Tailwind type scale and named text styles, spacing tokens, nested radius, flat dark surfaces, Phosphor icons, motion curve, scroll reveal |
| Better typography | `jakubkrehel/skills` | Line height, tracking, measure, tabular numbers, wrapping, non breaking spaces, heading structure, caption floor |
| Distinctive UI process | general practice | Plan, review against the brief, build, critique. Pick distinctive choices over defaults, remove one decoration, avoid generic fonts, purple gradients and cookie cutter components |
| Design critique | supplied checklist | Review each screen for first impression, usability, hierarchy, consistency and accessibility before calling it done |

Not run yet: a keyboard order check, a contrast audit and screenshot comparison.

**Where they disagree:** the typography rules win on typography. The landing page rules win on everything else, such as the type scale steps, the font and the flat backgrounds.

## The design system as built

Tokens are in `app/src/index.css`.

- **Surfaces, flat only:** `#000000`, `#181818`, `#1F1F1F`, `#272727`, `#313131`, `#131209`. No background gradients. The one gradient is white to grey on hero heading text.
- **Accent:** aqua `#7ED6CF`. One accent only, under 80% saturation. Success `#6FC79A` and danger `#E5736B` are for status.
- **Type:** Geist, with Geist Mono for addresses, passes and distances. No italics. Nothing heavier than semibold. Named styles: `heading-1` to `heading-6`, `title-1` to `title-5`, `body-1` to `body-6`, `button-lg` to `button-xsm`, `caption-1` to `caption-5`. Captions are 13px.
- **Spacing:** only 0, 2, 4, 8, 12, 16, 24, 32, 40, 48, 64, 80 and 96px.
- **App screens, flat:** no raised cards or inner panels. Group with hairlines (`border-y border-line`, or `border-b` per row). The one framed object is the ticket pass, in an accent outline with perforation notches.
- **Radius:** `rounded-md` for every control (buttons, inputs, Back, chip), `rounded-full` for avatars and pills, none for art and panels. Landing panels still use the nested radius rule: a shape inside another with a gap under 32px takes the outer radius minus the gap.
- **Inputs:** use the `field` utility from `index.css`. Never restyle an input by hand.
- **Motion:** `cubic-bezier(0.22, 1, 0.36, 1)`. Animate `transform` and `opacity`. The one exception is `Collapse`, which animates height through grid rows. Use `stagger` for lists, `animate-rise` and `animate-pop` for things that appear. Alerts and status messages rise by themselves. Reduced motion is handled in `index.css`.
- **Icons:** Phosphor in `light` weight, set once in `main.tsx`, which is the look from direction C. Import them through `app/src/components/icons.ts`, never from the package root. The root import makes dev mode send a 6 MB bundle.

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

- **Components:** `Button`, `Screen` and `TopBar`, `SceneHeading`, `Bits` (status pill, simulated tag, wallet chip, row, avatar), `Segmented` (sliding switch), `Collapse`, `Skeleton`, `GatewayFlow`, `Sonar`, `Waveform`, and `Reveal`. Landing sections are in `app/src/pages/landing/`.
- **Navigation:** `components/roles.ts` lists the three roles and their tabs. `TabLayout` in `components/AppTabs.tsx` wraps every tab screen. Never render tabs from a page. A screen in the middle of a task calls `useHideTabs`.
- **Top right chip:** `TopBar` shows `WalletChip` by default. Pass `right={null}` during a task or before sign in. Its name comes from `displayName()` in `data/mock.ts`. When ENS names for people arrive, set `wallet.ens` and every screen picks it up.
- **Loading:** a screen that reads data shows a `Skeleton` shaped like its content, never a spinner or a "not found" flash. `useEvents` keeps the last result, so opening an event is instant.
- **Ticket data:** `app/src/data/mock.ts` holds the ticket state read through `app/src/services/arkiv.ts`, plus the simulated check ins, which reset on reload.
- **Real data so far:** sign in, the signed claim, the organizer page, wallet tickets, buying and purchases. The door and check ins are still simulated.
- **Tags:** show `SimTag` on anything simulated. Prefix demo only buttons with "Demo control:".

## Screens and status

| Route | Screen | Status |
|---|---|---|
| `/` | Landing | Built. The sound band uses the converging streams canvas |
| `/signin` | Sign in with World ID, or skip for the demo | Real, built by a teammate |
| `/events`, `/e/:id`, `/e/:id/buy` | Events list, event page, buy | Real Arkiv data and a real test network payment. The Pay button has not been run by the frontend owner |
| `/wallet` | Tickets, upcoming then past | Real, read from Arkiv |
| `/account` | Role switch, on chain details, move the account, sign out | Built. The third tab in every role, and where the top right chip goes |
| `/wallet/purchases`, `/wallet/receipt/:txn` | Purchase history, receipt | Real, read from Arkiv |
| `/wallet/ticket/:id` | Ticket as a physical pass | Real. Shows the ENS pass check and a link to the receipt |
| `/wallet/claim/:id` | Claim | Two steps with a real signed claim. The phone lock step is simulated |
| `/wallet/checkin/:id` | Holder check in | Real sound, wallet signed. "Before you check in", then QR and 6 digit code, sonar rings, live mic waveform, result with the sound trace |
| `/wallet/transfer/:id` | Send ticket | Real signed request to an ENS name. The organizer decides on `/organizer/transfers`. Not verified live |
| `/door` | Door check in | Real sound. Scan or type the holder's code, with a door PIN |
| `/door/recent` | Recent check ins | Real, read from Arkiv. A tab beside the door |
| `/organizer`, `/organizer/attendees` | Issue, Look up, New event, Live door, add an organizer; attendee list | Real. Issue and New event need a listed organizer wallet's signature |
| `/u/:name` | Public trophy page | Real, read from Arkiv. Takes a wallet address |
| `/privacy`, `/terms` | Legal | Stubs that say "Not built yet" |
| `/lab` | Sonar test page | A teammate's, outside the design system |
| `/canvas`, `/preview` | Every screen in phone frames, check in visuals | Dev mode only |

**Branches.** `main` is the working branch and is pushed. Experiments go on short branches and stay local until approved.

## Flows and buttons

Every screen's buttons and where they lead are in [FRONTEND_FLOWS.md](FRONTEND_FLOWS.md). Read it before adding or moving a button.

## What is next

The full list, with the demo blockers first, is in [FRONTEND_TODO.md](FRONTEND_TODO.md). In short: run the whole journey on two real phones, show ENS names on the event page and at the door, and match the screens to whatever server policy changes.

## How to run and verify

`/canvas` (dev mode only) shows every screen in phone frames on one page, with zoom and a 360, 390 or 430 width switch.

```bash
cd app
npm install
npm run dev     # laptop only
npm test        # sonar tests
npm run lint    # oxlint
npm run build   # then tunnel to the server on port 3050 for phones
```

- Never tunnel dev mode to phones. Build, then tunnel to `http://localhost:3050`.
- Check each screen at 390, 360 and 430 wide, and on a desktop width, with no horizontal overflow.
- A headless or embedded browser may report reduced motion as on. Animation timing has to be checked with that preference off.
- Open `/canvas` in dev mode to look at every screen at once.
- A real phone has not been tested yet.

## Working rules

- Use short branches for experiments. Do not push an experiment until it is approved.
- Pull often. Read what teammates changed before merging, and keep their behaviour. Rebase local commits onto `origin/main` so history stays linear.
- Squash a feature into one commit when it goes to `main`. Push only when the owner says so.
- Commits and pull requests carry no co-author or tool attribution lines. Keep local editor and assistant configuration out of the repo.
- Never write instructions aimed at one specific tool into tracked files. Say "agent" or "assistant". Name a model vendor only when it is the technical subject.
- Ask before choosing between design options, and show the options on screen.
- Secrets stay in gitignored env files. Never paste them into docs, commits or chat.
