import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../data/store'
import { isReversed, teamTotals } from '../data/derive'
import TeamCrest from '../components/TeamCrest'
import { ArcBolt, ContactPost, usePrefersReducedMotion } from '../fx/Arc'

const UNDO_WINDOW_MS = 60_000

/** Big riveted medallion with a neon ring, four contact posts and crackle. */
function Medallion({ points }: { points: number }) {
  const reduced = usePrefersReducedMotion()
  const S = 290
  const c = S / 2
  const ringR = 104
  const posts = [
    { x: c, y: c - ringR },
    { x: c + ringR, y: c },
    { x: c, y: c + ringR },
    { x: c - ringR, y: c },
  ]
  return (
    <div className="relative mx-auto" style={{ width: S, height: S }}>
      {/* teal light spill onto the plate behind */}
      <div
        aria-hidden
        className="absolute -inset-6"
        style={{ background: 'radial-gradient(50% 50% at 50% 50%, rgba(47,217,208,0.15) 0%, rgba(47,217,208,0.04) 55%, transparent 75%)' }}
      />
      <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} aria-hidden className="relative">
        <defs>
          <linearGradient id="med-rim" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#e8c887" />
            <stop offset="30%" stopColor="#a97e3c" />
            <stop offset="65%" stopColor="#6d4e20" />
            <stop offset="100%" stopColor="#33230d" />
          </linearGradient>
          <radialGradient id="med-face" cx="0.4" cy="0.34" r="1">
            <stop offset="0%" stopColor="#332a20" />
            <stop offset="55%" stopColor="#241c16" />
            <stop offset="100%" stopColor="#140e08" />
          </radialGradient>
        </defs>

        {/* recessed well behind the medallion */}
        <circle cx={c} cy={c} r={142} fill="rgba(0,0,0,0.35)" />
        {/* seat shadow + brass rim */}
        <circle cx={c} cy={c + 3} r={132} fill="rgba(0,0,0,0.55)" />
        <circle cx={c} cy={c} r={132} fill="url(#med-rim)" />
        {/* bottom-right occlusion on the rim */}
        <path d={`M ${c + 95} ${c + 60} A 112 112 0 0 1 ${c + 58} ${c + 96}`} fill="none" stroke="rgba(20,12,4,0.55)" strokeWidth="7" strokeLinecap="round" />
        {/* rim tick engravings */}
        {Array.from({ length: 24 }, (_, i) => {
          const a = (i * Math.PI) / 12
          return (
            <line
              key={i}
              x1={c + Math.cos(a) * 124}
              y1={c + Math.sin(a) * 124}
              x2={c + Math.cos(a) * (i % 2 ? 118 : 114)}
              y2={c + Math.sin(a) * (i % 2 ? 118 : 114)}
              stroke="rgba(30,18,6,0.55)"
              strokeWidth={i % 2 ? 1 : 2}
            />
          )
        })}
        <circle cx={c} cy={c} r={112} fill="#171008" />
        {/* dark metal face, recessed: inner shadow heaviest at the top-left lip */}
        <circle cx={c} cy={c} r={109} fill="url(#med-face)" />
        <path d={`M ${c - 90} ${c - 58} A 107 107 0 0 1 ${c - 55} ${c - 91}`} fill="none" stroke="rgba(0,0,0,0.55)" strokeWidth="6" strokeLinecap="round" opacity="0.8" />
        {/* rim specular top-left */}
        <path d={`M ${c - 93} ${c - 62} A 112 112 0 0 1 ${c - 60} ${c - 94}`} fill="none" stroke="rgba(255,244,214,0.4)" strokeWidth="2.5" strokeLinecap="round" />

        {/* recessed channel the neon tube sits in */}
        <circle cx={c} cy={c} r={ringR} fill="none" stroke="rgba(0,0,0,0.6)" strokeWidth="12" />
        {/* teal wash the tube throws onto its housing */}
        <circle cx={c} cy={c} r={ringR} fill="none" stroke="rgba(47,217,208,0.14)" strokeWidth="22" />
        {/* neon ring — the emitting source */}
        <circle cx={c} cy={c} r={ringR} fill="none" stroke="rgba(47,217,208,0.28)" strokeWidth="8" />
        <circle cx={c} cy={c} r={ringR} fill="none" stroke="var(--color-accent)" strokeWidth="2.6" style={{ filter: 'drop-shadow(0 0 5px rgba(47,217,208,0.9))' }} />
        <circle cx={c} cy={c} r={ringR} fill="none" stroke="#eafffd" strokeWidth="0.9" opacity="0.8" />

        {/* crackle between the four posts */}
        <ArcBolt x1={posts[0].x} y1={posts[0].y} x2={posts[1].x} y2={posts[1].y} seed={41} intensity={0.85} chaos={1.3} weight={1.4} active={!reduced} />
        <ArcBolt x1={posts[2].x} y1={posts[2].y} x2={posts[3].x} y2={posts[3].y} seed={43} intensity={0.85} chaos={1.3} weight={1.4} active={!reduced} />
        {reduced && (
          <ArcBolt x1={posts[0].x} y1={posts[0].y} x2={posts[3].x} y2={posts[3].y} seed={45} intensity={0.5} chaos={1} weight={1.2} active />
        )}

        {/* contact posts mounted on the ring, corona where current lands */}
        {posts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={17} fill="var(--color-accent)" opacity={0.12} />
            <circle cx={p.x} cy={p.y} r={10} fill="var(--color-accent)" opacity={0.2} />
            <ContactPost cx={p.x} cy={p.y} r={8.5} />
          </g>
        ))}
      </svg>

      {/* the +N slab numeral */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="numeral text-[118px] font-bold leading-none"
          style={{
            background: 'linear-gradient(160deg, #a7f5ef 0%, #2fd9d0 42%, #1ba39b 90%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
            filter:
              'drop-shadow(0 0 2px rgba(47,217,208,0.7)) drop-shadow(0 0 12px rgba(47,217,208,0.35)) drop-shadow(2px 4px 1px rgba(0,0,0,0.55))',
            letterSpacing: '0.02em',
          }}
        >
          +{points}
        </span>
      </div>
    </div>
  )
}

export default function Confirmation() {
  const { eventId = '' } = useParams()
  const { teams, campers, events, ready, undo } = useStore()
  const navigate = useNavigate()
  const [now, setNow] = useState(() => Date.now())

  const event = events.find((e) => e.id === eventId)

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const reversed = useMemo(() => (event ? isReversed(events, event.id) : false), [events, event])

  if (!ready) return null
  if (!event) {
    navigate('/', { replace: true })
    return null
  }

  const team = teams.find((t) => t.id === event.teamId)!
  const eventCampers = campers.filter((c) => event.camperIds.includes(c.id))
  const total = teamTotals(events, teams.map((t) => t.id)).find((t) => t.teamId === team.id)?.points ?? 0
  const totalPoints = event.points * event.camperIds.length
  const fmt = new Intl.NumberFormat('en-US')

  const elapsed = now - new Date(event.occurredAt).getTime()
  const undoLeft = Math.max(0, Math.ceil((UNDO_WINDOW_MS - elapsed) / 1000))
  const canUndo = !reversed && undoLeft > 0

  const onUndo = () => {
    void undo(event).then(() => navigate(`/award/${team.id}`))
  }

  return (
    <div className="grain relative mx-auto flex min-h-dvh max-w-[440px] flex-col px-5 pb-5 pt-4">
      {/* console panel frame */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-2 rounded-[5px]"
        style={{
          boxShadow:
            'inset 0 0 0 2px rgba(74,59,46,0.5), inset 0 0 0 3px rgba(0,0,0,0.5), inset 2px 2px 1px rgba(255,236,205,0.07), inset -2px -2px 1px rgba(0,0,0,0.4)',
        }}
      />
      {(['left-3 top-3', 'right-3 top-3 rotate-90', 'right-3 bottom-3 rotate-180', 'left-3 bottom-3 -rotate-90'] as const).map((pos) => (
        <svg key={pos} className={`absolute ${pos} opacity-60`} width="18" height="18" aria-hidden>
          <path d="M2 9 L2 2 L9 2" fill="none" stroke="rgba(192,138,62,0.6)" strokeWidth="2" />
        </svg>
      ))}

      {/* corner tech labels */}
      <div className="tech-label absolute left-6 top-5">
        SYS-7A
        <br />
        Award Protocol
        <br />
        v.12.4.07
      </div>
      <div className="tech-label absolute right-6 top-5 text-right">
        // Confirm
        <br />
        SEQ: {event.id.slice(0, 4).toUpperCase()}.{event.id.slice(4, 6).toUpperCase()}
      </div>

      <div className="mt-12">
        <Medallion points={totalPoints} />
      </div>

      <div className="mt-4 text-center">
        <span className="font-display text-[13px] font-medium uppercase" style={{ letterSpacing: '0.34em', color: 'var(--color-text-dim)' }}>
          [ Points Awarded ]
        </span>
        <div className="mx-auto mt-2 h-0 w-0 border-x-8 border-t-8 border-x-[transparent]" style={{ borderTopColor: 'rgba(192,138,62,0.5)' }} />
      </div>

      {/* team + campers */}
      <div className="mt-5 flex items-center gap-4">
        <TeamCrest teamId={team.id} size={86} glow={0.4} />
        <div className="min-w-0 flex-1">
          <div className="display-title text-[34px] font-bold leading-none" style={{ letterSpacing: '0.05em' }}>
            {team.name}
          </div>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {eventCampers.map((camper) => (
              <span
                key={camper.id}
                className="px-2.5 py-1 font-display text-[12px] font-semibold uppercase"
                style={{
                  letterSpacing: '0.12em',
                  color: 'var(--color-accent)',
                  background: 'linear-gradient(180deg, #221a13 0%, #1a130d 100%)',
                  borderRadius: 3,
                  border: '1px solid rgba(169,126,60,0.55)',
                  boxShadow:
                    'inset 0 0 0 2px rgba(0,0,0,0.5), inset 0 0 0 3px rgba(47,217,208,0.45), inset 0 0 9px rgba(47,217,208,0.22), inset 0 2px 3px rgba(0,0,0,0.5), 0 2px 3px rgba(0,0,0,0.55), 0 1px 0 rgba(255,236,205,0.08)',
                  textShadow: '0 0 6px rgba(47,217,208,0.5)',
                }}
              >
                {camper.firstName}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* team total in a drafted corner-bracket frame */}
      <div className="relative mx-4 mt-5 py-3.5" aria-hidden={false}>
        {(['top', 'bottom'] as const).map((edge) => (
          <div key={edge} className={`absolute inset-x-0 ${edge === 'top' ? 'top-0' : 'bottom-0'}`}>
            <div className="hairline" />
          </div>
        ))}
        {(['left', 'right'] as const).map((side) => (
          <div key={side}>
            <div className={`absolute ${side}-0 top-0 h-3 w-px bg-[rgba(192,138,62,0.5)]`} />
            <div className={`absolute ${side}-0 top-0 h-px w-3 bg-[rgba(192,138,62,0.5)]`} />
            <div className={`absolute ${side}-0 bottom-0 h-3 w-px bg-[rgba(192,138,62,0.5)]`} />
            <div className={`absolute ${side}-0 bottom-0 h-px w-3 bg-[rgba(192,138,62,0.5)]`} />
          </div>
        ))}
        <div className="flex items-baseline justify-center gap-5">
          <span className="display-title text-[19px] font-semibold" style={{ letterSpacing: '0.22em', color: 'var(--color-text)' }}>
            Team Total
          </span>
          <span className="numeral text-[26px] font-bold" style={{ color: 'var(--color-text)', textShadow: '0 1px 1px rgba(0,0,0,0.7)' }}>
            {fmt.format(total)}
          </span>
        </div>
      </div>

      {/* actions */}
      <div className="mb-14 mt-auto flex items-stretch gap-4 pt-7">
        <button onClick={onUndo} disabled={!canUndo} className="plate-shadow h-[62px] flex-1" style={{ opacity: canUndo ? 1 : 0.45 }}>
          <span className="plate flex h-full items-center justify-center" style={{ boxShadow: 'inset 0 0 0 1.5px rgba(192,138,62,0.5), inset 2px 2px 0 rgba(255,236,205,0.14), inset -2px -2px 0 rgba(0,0,0,0.6)' }}>
            <span className="display-title text-[20px] font-bold" style={{ letterSpacing: '0.18em' }}>
              Undo
            </span>
            {canUndo && (
              <span className="tech-label absolute bottom-[5px] right-2 text-[8px] opacity-70">[ T-{undoLeft}s ]</span>
            )}
          </span>
        </button>
        {/* DONE: brass-framed plate with an emissive backlit face */}
        <button onClick={() => navigate('/')} className="h-[62px] flex-1" style={{ filter: 'drop-shadow(0 3px 4px rgba(0,0,0,0.6)) drop-shadow(0 0 12px rgba(47,217,208,0.3))' }}>
          <span
            className="plate flex h-full items-center justify-center p-[4px]"
            style={{
              background: 'linear-gradient(135deg, #a97e3c 0%, #6d4e20 50%, #33230d 100%)',
              boxShadow: 'inset 1px 1px 0 rgba(255,232,190,0.5), inset -1px -1px 0 rgba(0,0,0,0.6)',
            }}
          >
            <span
              className="flex h-full w-full items-center justify-center rounded-[2px]"
              style={{
                background: 'radial-gradient(80% 90% at 45% 40%, #7ff0e8 0%, #2fd9d0 55%, #1a9c95 100%)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -3px 5px rgba(0,40,38,0.5)',
              }}
            >
              <span className="display-title text-[20px] font-bold" style={{ letterSpacing: '0.18em', color: '#08302d', textShadow: '0 1px 0 rgba(255,255,255,0.35)' }}>
                Done
              </span>
            </span>
          </span>
        </button>
      </div>

      {/* bottom corner labels */}
      <div className="tech-label absolute bottom-2 left-4">
        CR-12
        <br />
        PWR. Node
        <br />
        77-A
      </div>
      <div className="tech-label absolute bottom-2 right-4 text-right">
        MFG: Brassfall
        <br />
        Conduit Seal
        <br />
        ID: BF-3321
      </div>
    </div>
  )
}
