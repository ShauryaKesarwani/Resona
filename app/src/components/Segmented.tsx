/** A switch whose marker slides to the chosen option. */
export function Segmented<T extends string>({ label, options, value, onChange, cols }: {
  label: string
  options: { id: T; label: string }[]
  value: T
  onChange: (id: T) => void
  cols: number
}) {
  const rows = Math.ceil(options.length / cols)
  const index = options.findIndex((o) => o.id === value)
  return (
    <div className="rounded-md border border-line p-1">
      <div role="group" aria-label={label} className="relative grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        <span
          aria-hidden="true"
          className="absolute top-0 left-0 rounded-sm bg-surface-high transition-transform duration-300 ease-base"
          style={{ width: `${100 / cols}%`, height: `${100 / rows}%`, transform: `translate(${(index % cols) * 100}%, ${Math.floor(index / cols) * 100}%)` }}
        />
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={value === o.id}
            onClick={() => onChange(o.id)}
            className={`button-sm relative min-h-12 px-2 transition duration-300 ease-base active:scale-[0.98] ${value === o.id ? 'text-text' : 'text-text-muted'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
