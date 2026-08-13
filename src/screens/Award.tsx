import { useCallback, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../data/store'
import { teamTotals } from '../data/derive'
import type { TeamId } from '../data/types'
import TeamCrest, { teamColor } from '../components/TeamCrest'
import { Plate, ScreenHeader } from '../components/chrome'
import Lever from '../components/Lever'
import { usePrefersReducedMotion } from '../fx/Arc'

const POINTS_PER_PULL = 1

export default function Award() {
  const { teamId = 'turquoise' } = useParams<{ teamId: TeamId }>()
  const { teams, campers, events, ready, award } = useStore()
  const navigate = useNavigate()
  const reduced = usePrefersReducedMotion()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [fired, setFired] = useState(false)
  const [armed, setArmed] = useState(false)
  const navTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const team = teams.find((t) => t.id === teamId)
  const roster = campers.filter((c) => c.teamId === teamId)

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const onFire = useCallback(() => {
    if (selected.size === 0 || fired) return
    setFired(true)
    void award(teamId as TeamId, [...selected], POINTS_PER_PULL).then((event) => {
      // Let the discharge + token flight play before the interstitial.
      navTimer.current = setTimeout(() => navigate(`/confirm/${event.id}`), reduced ? 250 : 900)
    })
  }, [selected, fired, award, teamId, navigate, reduced])

  if (!ready || !team) return null

  const totals = teamTotals(events, teams.map((t) => t.id))
  const points = totals.find((t) => t.teamId === team.id)?.points ?? 0
  const fmt = new Intl.NumberFormat('en-US')
  const color = teamColor(team.id)

  return (
    <div className="mx-auto flex min-h-dvh max-w-[440px] flex-col px-4 pb-3 pt-1">
      <ScreenHeader title="Award Points" back />
      <div className="hairline mx-1 mb-3" />

      {/* team panel */}
      <Plate innerClassName="flex items-center gap-3 px-3 py-2.5">
        <TeamCrest teamId={team.id} size={64} glow={0.25} />
        <div className="display-title flex-1 text-[24px] font-bold leading-none" style={{ letterSpacing: '0.05em' }}>
          {team.name}
        </div>
        {/* recessed score plate */}
        <div
          className="rounded-[3px] px-3 py-1.5"
          style={{ background: 'rgba(0,0,0,0.4)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.8), inset -1px -1px 0 rgba(255,236,205,0.05)' }}
        >
          <span
            className="numeral text-[28px] font-bold leading-none"
            style={{ color, textShadow: `0 0 2px currentColor, 0 0 9px color-mix(in srgb, ${color} 40%, transparent)` }}
          >
            {fmt.format(points)}
          </span>
        </div>
      </Plate>

      {/* camper chips 3×4 */}
      <div className="mt-3 grid flex-1 auto-rows-fr grid-cols-3 gap-2.5">
        {roster.map((camper) => {
          const on = selected.has(camper.id)
          return (
            <button
              key={camper.id}
              onClick={() => toggle(camper.id)}
              aria-pressed={on}
              className="plate-shadow relative min-h-[46px]"
            >
              <span
                className="plate grain flex h-full items-center justify-center px-1"
                style={{
                  clipPath:
                    'polygon(7px 0, calc(100% - 7px) 0, 100% 7px, 100% calc(100% - 7px), calc(100% - 7px) 100%, 7px 100%, 0 calc(100% - 7px), 0 7px)',
                  ...(on
                    ? {
                        boxShadow:
                          'inset 0 0 0 1.5px var(--color-accent), inset 0 0 10px rgba(47,217,208,0.35), inset 2px 3px 6px rgba(0,0,0,0.6)',
                        background: 'linear-gradient(180deg, #17211f 0%, #131a18 100%)',
                      }
                    : undefined),
                }}
              >
                <span
                  className="font-display text-[17px] font-semibold uppercase leading-none"
                  style={
                    on
                      ? { color: 'var(--color-accent)', letterSpacing: '0.08em', textShadow: '0 0 2px currentColor, 0 0 6px rgba(47,217,208,0.45)' }
                      : { color: 'var(--color-text-dim)', letterSpacing: '0.08em', textShadow: '0 1px 0 rgba(0,0,0,0.7), 0 -1px 0 rgba(255,230,180,0.06)' }
                  }
                >
                  {camper.firstName}
                </span>
              </span>
              {/* halo when selected — the chip itself is the emitter */}
              {on && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute -inset-1.5"
                  style={{ background: 'radial-gradient(60% 70% at 50% 50%, rgba(47,217,208,0.14) 0%, transparent 70%)' }}
                />
              )}
              {/* armed: a +1 tab rises from behind the chip's top edge */}
              {on && (
                <span
                  aria-hidden
                  className="numeral absolute right-2 top-0 rounded-t-[3px] px-1.5 text-[12px] font-bold"
                  style={{
                    color: 'var(--color-accent)',
                    background: '#141a18',
                    boxShadow: 'inset 0 0 0 1px rgba(47,217,208,0.4), 0 -1px 2px rgba(0,0,0,0.5)',
                    transform: armed || fired ? 'translateY(-15px)' : 'translateY(0)',
                    opacity: armed || fired ? 1 : 0,
                    transition: 'transform 180ms ease-out, opacity 140ms ease-out',
                    zIndex: -1,
                  }}
                >
                  +{POINTS_PER_PULL}
                </span>
              )}
              {/* +1 token flight on fire */}
              {fired && on && !reduced && (
                <span
                  aria-hidden
                  className="token-rise numeral absolute -top-1 right-1 text-[16px] font-bold"
                  style={{ color: 'var(--color-accent)', animationDelay: `${[...selected].indexOf(camper.id) * 40}ms`, textShadow: '0 0 6px rgba(47,217,208,0.8)' }}
                >
                  +{POINTS_PER_PULL}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* lever */}
      <div className="mt-3">
        <Lever
          label={`Pull down to award +${POINTS_PER_PULL}`}
          armedLabel="Release to confirm"
          disabled={selected.size === 0}
          onFire={onFire}
          onArmedChange={setArmed}
        />
      </div>
    </div>
  )
}
