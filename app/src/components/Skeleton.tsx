const Bone = ({ className = '' }: { className?: string }) => <div className={`animate-pulse rounded-sm bg-surface-raised ${className}`} />

/** Hairline rows with two lines of text and an arrow, the shape of most lists in the app. */
export function RowsSkeleton({ label, rows = 3 }: { label: string; rows?: number }) {
  return (
    <ul aria-busy="true" aria-label={label} className="flex flex-col">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-center justify-between gap-4 border-b border-line py-4">
          <div className="flex flex-1 flex-col gap-2">
            <Bone className="h-5 w-2/3" />
            <Bone className="h-4 w-1/2" />
          </div>
          <Bone className="size-6" />
        </li>
      ))}
    </ul>
  )
}

/** The events list while it loads. */
export function EventCardsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading events" className="flex flex-col gap-8">
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col gap-4 border-b border-line pb-4">
          <Bone className={i === 0 ? 'aspect-[4/3] w-full' : 'aspect-video w-full'} />
          <Bone className="h-4 w-1/4" />
          <Bone className="h-8 w-3/4" />
          <Bone className="h-4 w-1/3" />
        </div>
      ))}
    </div>
  )
}

/** A detail screen while it loads: picture, title, facts, and the button at the bottom. */
export function DetailSkeleton({ label, picture = true, button = true }: { label: string; picture?: boolean; button?: boolean }) {
  return (
    <div aria-busy="true" aria-label={label} className="flex flex-1 flex-col gap-4">
      {picture && <Bone className="aspect-[4/3] w-full" />}
      <Bone className="h-10 w-3/4" />
      <div className="flex flex-col border-y border-line">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex min-h-12 items-center justify-between gap-4 py-3 not-first:border-t not-first:border-line">
            <Bone className="h-4 w-1/4" />
            <Bone className="h-4 w-1/3" />
          </div>
        ))}
      </div>
      <div className="flex-1" />
      {button && <Bone className="h-16 w-full" />}
    </div>
  )
}
