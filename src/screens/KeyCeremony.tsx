import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import TeamCrest from '../components/TeamCrest'
import { ArcBolt, ContactPost, usePrefersReducedMotion } from '../fx/Arc'
import { keyCount } from '../data/derive'
import { useStore } from '../data/store'

/**
 * The golden key ceremony. Full screen, deliberately slow, gated behind
 * director mode so it cannot be fat-fingered.
 *
 * **This screen is the one deliberate exception to the colour rule: no teal at
 * all.** Its arcs are gold-white and its light is warm gold. Breaking your own
 * rule exactly once is what makes the rare thing feel rare — which is why the
 * rule holds absolutely everywhere else.
 */

const GOLD = 'var(--color-key)'
const GOLD_HOT = 'var(--color-key-hot)'

type Phase = 'offer' | 'awarded'

export default function KeyCeremony() {
  const { teamId } = useParams<{ teamId: string }>()
  const navigate = useNavigate()
  const { teams, activeDay, events, awardKey, directorMode, ready } = useStore()
  const reduced = usePrefersReducedMotion()

  const team = teams.find((t) => t.id === teamId)
  const [phase, setPhase] = useState<Phase>('offer')
  const [width, setWidth] = useState(390)

  useEffect(() => {
    const on = () => setWidth(Math.min(window.innerWidth, 520))
    on()
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])

  // Which key this is for the team, counted across the whole camp.
  const existing = useMemo(() => (team ? keyCount(events, team.id) : 0), [events, team])
  const number = phase === 'awarded' ? existing : existing + 1

  useEffect(() => {
    if (!ready) return
    if (!directorMode) navigate(`/team/${teamId}`, { replace: true })
  }, [ready, directorMode, navigate, teamId])

  if (!ready || !team) return <div className="min-h-dvh" />

  const onAward = async () => {
    await awardKey(activeDay.id, team.id, 'Golden key')
    setPhase('awarded')
    navigator.vibrate?.([18, 60, 40])
  }

  const cx = width / 2
  const postY = 322
  const postL = width * 0.16
  const postR = width - width * 0.16
  const live = phase === 'awarded'

  return (
    <div
      className="relative flex min-h-dvh flex-col items-center overflow-hidden"
      style={{
        // Warm gold ground. No cool tone anywhere on this screen.
        background:
          'radial-gradient(120% 80% at 50% 34%, rgba(255,198,61,0.16) 0%, rgba(120,70,10,0.1) 38%, transparent 66%),' +
          'radial-gradient(100% 70% at 50% 100%, rgba(138,82,48,0.18) 0%, transparent 60%),' +
          'linear-gradient(180deg, #1c1409 0%, #16110d 55%, #0f0b07 100%)',
      }}
    >
      <div className="w-full px-5 pt-4">
        <button className="tech-label text-[9px]" onClick={() => navigate(`/team/${team.id}`)}>
          ← BACK
        </button>
      </div>

      <div className="mt-6 text-center">
        <div className="tech-label text-[9px]" style={{ color: 'rgba(255,198,61,0.75)' }}>
          {activeDay.name} · Golden Key
        </div>
        <h1
          className="display-title mt-2 text-[30px] leading-none"
          style={{ letterSpacing: '0.1em', color: 'var(--color-text)' }}
        >
          Key №{number}
        </h1>
        <div className="mt-2 flex items-center justify-center gap-2">
          <TeamCrest teamId={team.id} size={26} />
          <span
            className="font-display text-[15px] font-semibold uppercase"
            style={{ letterSpacing: '0.08em', color: `var(--color-team-${team.colorToken})` }}
          >
            {team.name}
          </span>
        </div>
      </div>

      {/* ---- the key, hung between two brass posts ---- */}
      <svg
        className="pointer-events-none absolute inset-x-0"
        style={{ top: 0, height: 620, overflow: 'visible' }}
        width={width}
        height={620}
        aria-hidden
      >
        <defs>
          <linearGradient id="kc-key" x1="0.2" y1="0" x2="0.8" y2="1">
            <stop offset="0%" stopColor="#fffdf2" />
            <stop offset="22%" stopColor={GOLD_HOT} />
            <stop offset="58%" stopColor={GOLD} />
            <stop offset="100%" stopColor="#8a5606" />
          </linearGradient>
        </defs>

        {/* gold light thrown onto the surrounding metal, tight falloff */}
        <g opacity={live ? 1 : 0.45}>
          <circle cx={cx} cy={postY + 78} r={168} fill={GOLD} opacity="0.07" />
          <circle cx={cx} cy={postY + 78} r={112} fill={GOLD} opacity="0.09" />
          <circle cx={cx} cy={postY + 78} r={62} fill={GOLD_HOT} opacity="0.12" />
        </g>

        {/* the discharge: always between two visible brass posts, never gold-on-nothing */}
        <ArcBolt
          x1={postL}
          y1={postY}
          x2={postR}
          y2={postY}
          seed={7}
          color={GOLD}
          coreColor={GOLD_HOT}
          intensity={live ? 1 : 0.7}
          chaos={live ? 1.5 : 0.9}
          weight={live ? 1.3 : 0.9}
          strands={live ? 3 : 1}
          active={!reduced || live}
        />
        {live && !reduced && (
          <>
            <ArcBolt x1={postL} y1={postY} x2={cx} y2={postY + 150} seed={19} color={GOLD} coreColor={GOLD_HOT} intensity={0.85} chaos={1.7} strands={2} />
            <ArcBolt x1={postR} y1={postY} x2={cx} y2={postY + 150} seed={29} color={GOLD} coreColor={GOLD_HOT} intensity={0.85} chaos={1.7} strands={2} />
          </>
        )}
        {[postL, postR].map((x) => (
          <g key={x}>
            <circle cx={x} cy={postY} r={16} fill={GOLD} opacity={live ? 0.2 : 0.1} />
            <circle cx={x} cy={postY} r={8} fill={GOLD} opacity={live ? 0.32 : 0.16} />
            <ContactPost cx={x} cy={postY} r={7} />
          </g>
        ))}

        {/* the key itself — big, emitting, unmistakably the object of the screen */}
        <g transform={`translate(${cx} ${postY + 78}) scale(3.5)`}>
          <g opacity={live ? 0.85 : 0.35}>
            <circle cx="0" cy="0" r="26" fill={GOLD} opacity="0.1" />
            <circle cx="0" cy="0" r="15" fill={GOLD} opacity="0.14" />
          </g>
          <g transform="translate(0.8 1)" opacity="0.65">
            <circle cx="0" cy="0" r="9" fill="rgba(0,0,0,0.7)" />
            <rect x="-2.4" y="6" width="4.8" height="30" fill="rgba(0,0,0,0.7)" />
          </g>
          <g fill="url(#kc-key)" stroke="rgba(90,54,6,0.65)" strokeWidth="0.7">
            <circle cx="0" cy="0" r="9" />
            <rect x="-2.4" y="6" width="4.8" height="30" rx="1.2" />
            <rect x="2" y="21" width="7" height="4.4" rx="0.8" />
            <rect x="2" y="29" width="9.4" height="4.6" rx="0.8" />
          </g>
          <circle cx="0" cy="0" r="3.8" fill="#5a3703" />
          <path d="M-7 -3 A9 9 0 0 1 -2.2 -8.7" fill="none" stroke="rgba(255,252,238,0.95)" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      </svg>

      {/* ---- action ---- */}
      <div className="mt-auto w-full px-6 pb-8" style={{ position: 'relative', zIndex: 2 }}>
        {phase === 'offer' ? (
          <>
            <p className="mb-3 text-center text-[13px]" style={{ color: 'var(--color-text-dim)' }}>
              One golden key is worth a full point. Keys are uncapped — this is
              what decides the camp.
            </p>
            <button
              onClick={onAward}
              className="font-display h-14 w-full rounded text-[15px] font-semibold uppercase"
              style={{
                letterSpacing: '0.2em',
                color: '#2a1a03',
                background: 'linear-gradient(180deg, #ffe9a8 0%, #ffc63d 42%, #c98a12 78%, #8a5606 100%)',
                boxShadow:
                  'inset 0 2px 0 rgba(255,252,238,0.8), inset 0 -3px 5px rgba(90,54,6,0.6), 0 3px 6px rgba(0,0,0,0.65), 0 0 22px rgba(255,198,61,0.35)',
              }}
            >
              Award the key
            </button>
          </>
        ) : (
          <>
            <p className="mb-3 text-center text-[13px]" style={{ color: 'var(--color-key)' }}>
              {/* No trailing full stop: "Rust Revival Co." already ends in one. */}
              Key №{number} awarded to {team.name}
            </p>
            <button
              onClick={() => navigate(`/team/${team.id}`)}
              className="font-display h-14 w-full rounded text-[14px] font-semibold uppercase"
              style={{
                letterSpacing: '0.2em',
                color: 'var(--color-text)',
                background: 'linear-gradient(180deg, #3a2d1e 0%, #241c14 55%, #1a130c 100%)',
                boxShadow: 'inset 0 1px 0 rgba(255,236,205,0.24), 0 3px 6px rgba(0,0,0,0.6)',
              }}
            >
              Done
            </button>
          </>
        )}
      </div>
    </div>
  )
}
