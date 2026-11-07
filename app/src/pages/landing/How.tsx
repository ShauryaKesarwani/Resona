import { SealCheckIcon, WarningCircleIcon } from '../../components/icons'
import { Avatar } from '../../components/Bits'
import { Section } from './Section'

/** Small stand ins for the real screens. Simulated names, decorative only. */
function IssueVisual() {
  const rows = [
    ['skes.eth', 'General admission'],
    ['mira.eth', 'Partner discount'],
    ['devansh.eth', 'Builder'],
  ]
  return (
    <div className="mx-auto w-full max-w-sm rounded-2xl border border-line bg-surface-raised p-2">
      <div className="rounded-lg bg-surface-inset">
        <p className="caption-1 px-4 pt-3 text-text-muted">Issue passes</p>
        <ul>
          {rows.map(([name, tier]) => (
            <li key={name} className="flex items-center gap-3 px-4 py-3 not-first:border-t not-first:border-line">
              <Avatar name={name} size={32} />
              <span className="min-w-0 flex-1">
                <span className="body-5 block font-mono">{name}</span>
                <span className="caption-5 block text-text-muted">{tier}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="p-4">
          <div className="button-sm rounded-md bg-accent px-3 py-2 text-center text-on-accent">Issue 3 passes</div>
        </div>
      </div>
    </div>
  )
}

function ClaimVisual() {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-3">
      <div className="flex items-center gap-3 rounded-xl border border-accent p-4">
        <SealCheckIcon size={24} className="shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <p className="body-5">First claim</p>
          <p className="caption-5 text-text-muted">Verified with World ID</p>
        </div>
        <span className="caption-4 whitespace-nowrap text-accent">Claimed</span>
      </div>
      <div className="flex items-center gap-3 rounded-xl border border-line p-4">
        <WarningCircleIcon size={24} className="shrink-0 text-danger" />
        <div className="min-w-0 flex-1">
          <p className="body-5">Second claim, same person</p>
          <p className="caption-5 text-text-muted">Rejected by World ID</p>
        </div>
        <span className="caption-4 whitespace-nowrap text-danger">Rejected</span>
      </div>
    </div>
  )
}

/** Two phones with sound arcs between them and the measured distance. */
function CheckInVisual() {
  return (
    <svg viewBox="0 0 320 170" className="mx-auto w-full max-w-sm" role="presentation">
      <rect x="20" y="30" width="64" height="112" rx="12" className="fill-surface-raised stroke-surface-high" strokeWidth="2" />
      <rect x="236" y="30" width="64" height="112" rx="12" className="fill-surface-raised stroke-surface-high" strokeWidth="2" />
      <circle cx="52" cy="128" r="3" className="fill-surface-high" />
      <circle cx="268" cy="128" r="3" className="fill-surface-high" />
      {[0, 1, 2].map((i) => (
        <g key={i} className="stroke-accent" fill="none" strokeWidth="2" strokeLinecap="round" opacity={1 - i * 0.28}>
          <path d={`M ${100 + i * 14} ${68 - i * 6} A ${26 + i * 10} ${26 + i * 10} 0 0 1 ${100 + i * 14} ${108 + i * 6}`} />
          <path d={`M ${220 - i * 14} ${68 - i * 6} A ${26 + i * 10} ${26 + i * 10} 0 0 0 ${220 - i * 14} ${108 + i * 6}`} />
        </g>
      ))}
      <line x1="92" y1="152" x2="228" y2="152" className="stroke-surface-high" strokeWidth="2" strokeDasharray="4 6" />
      <text x="160" y="166" textAnchor="middle" className="fill-text font-mono" fontSize="14">
        28 cm
      </text>
    </svg>
  )
}

const steps = [
  {
    title: 'Issue',
    body: 'The organizer enters ENS names and picks a tier. Each person gets a pass in their wallet.',
    visual: <IssueVisual />,
  },
  {
    title: 'Claim',
    body: 'Open the wallet and prove you are human with World ID. A second claim by the same person is rejected.',
    visual: <ClaimVisual />,
  },
  {
    title: 'Check in',
    body: 'Hold your phone close to the door phone. The distance is measured and a pass is recorded.',
    visual: <CheckInVisual />,
  },
]

/** A centered timeline. Text and illustration swap sides on each step, and a line through the middle joins them. */
export function How() {
  const last = steps.length - 1
  return (
    <Section id="how">
      <h2 className="heading-4 lg:heading-3 mx-auto max-w-[680px] text-center">From invite to inside</h2>
      <ol className="mt-16 flex flex-col gap-16 lg:mt-24 lg:gap-24">
        {steps.map((s, i) => (
          <li key={s.title} className="relative grid items-center gap-8 lg:grid-cols-2 lg:gap-24">
            {/* The line runs from the first number to the last, through the gaps between steps. */}
            <span
              aria-hidden="true"
              className={`absolute left-1/2 hidden w-px -translate-x-1/2 bg-line lg:block ${i === 0 ? 'top-1/2' : 'top-[-6rem]'} ${
                i === last ? 'bottom-1/2' : 'bottom-[-6rem]'
              }`}
            />
            <div className={`flex flex-col items-center gap-3 text-center lg:items-start lg:text-left ${i % 2 ? 'lg:order-2' : ''}`}>
              <span
                aria-hidden="true"
                className="title-3 grid size-10 place-items-center rounded-full border border-line bg-surface-raised font-mono lg:hidden"
              >
                {i + 1}
              </span>
              <h3 className="heading-5">{s.title}</h3>
              <p className="body-3 max-w-prose text-text-muted">{s.body}</p>
            </div>
            <div aria-hidden="true" className={i % 2 ? 'lg:order-1' : ''}>
              {s.visual}
            </div>
            <span
              aria-hidden="true"
              className="title-2 absolute top-1/2 left-1/2 hidden size-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-line bg-surface font-mono lg:grid"
            >
              {i + 1}
            </span>
          </li>
        ))}
      </ol>
    </Section>
  )
}
