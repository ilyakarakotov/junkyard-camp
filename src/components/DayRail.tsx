import type { Day } from '../data/types'

/**
 * The five days as engraved selector tabs. Arrival carries no score, so it is
 * visibly inert rather than merely unselected — a leader must not open it
 * expecting to award points.
 */
export default function DayRail({
  days,
  activeId,
  onSelect,
}: {
  days: Day[]
  activeId: string
  onSelect: (id: string) => void
}) {
  return (
    <div className="px-5">
      <div
        className="recess flex items-stretch gap-[3px] rounded p-[3px]"
        role="tablist"
        aria-label="Camp day"
      >
        {days.map((d) => {
          const active = d.id === activeId
          const label = d.name === 'Arrival' ? 'ARR' : `D${d.index}`
          return (
            <button
              key={d.id}
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(d.id)}
              className="relative flex-1 rounded-[2px] py-[7px]"
              style={{
                background: active
                  ? 'linear-gradient(180deg, #4a3a26 0%, #2f2519 55%, #221a10 100%)'
                  : 'linear-gradient(180deg, #241c15 0%, #1a130c 100%)',
                boxShadow: active
                  ? 'inset 0 1px 0 rgba(255,236,205,0.3), inset 0 -1px 0 rgba(0,0,0,0.6), 0 1px 2px rgba(0,0,0,0.5)'
                  : 'inset 0 1px 0 rgba(255,236,205,0.06), inset 0 -1px 2px rgba(0,0,0,0.5)',
                opacity: d.scored ? 1 : 0.62,
              }}
            >
              <span
                className="font-display block text-[13px] font-semibold uppercase leading-none"
                style={{
                  letterSpacing: '0.1em',
                  color: active ? 'var(--color-text)' : 'var(--color-text-dim)',
                  textShadow: '0 1px 0 rgba(0,0,0,0.7)',
                }}
              >
                {label}
              </span>
              {/* the selected tab is backlit from a brass filament beneath it */}
              {active && (
                <span
                  aria-hidden
                  className="absolute inset-x-2 bottom-[3px] h-[2px] rounded-full"
                  style={{
                    background: 'var(--color-brass)',
                    boxShadow: '0 0 5px rgba(192,138,62,0.9), 0 0 10px rgba(192,138,62,0.45)',
                  }}
                />
              )}
              {/* a day that cannot be scored says so, quietly */}
              {!d.scored && (
                <span
                  aria-hidden
                  className="absolute inset-x-[6px] top-1/2 h-px"
                  style={{ background: 'rgba(237,227,210,0.22)' }}
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
