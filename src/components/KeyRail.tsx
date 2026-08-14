import { useId } from 'react'

/**
 * Key rail — golden keys.
 *
 * **Earned keys emit.** A dull brass outline reads as decoration; a key that
 * spills warm gold onto the rail and the metal around it reads as a point,
 * which is what it is. Unearned capacity shows as dark empty hooks so there is
 * visible room for more.
 *
 * Keys are whole numbers and are **never** rendered as a multiplier. A team
 * holds one key, or two, or three. Above three, three keys are drawn and the
 * remainder shown as `+2` in tabular numerals. There is no `×` in this app.
 */

export interface KeyRailProps {
  keys: number
  /** Hooks drawn on the rail — earned keys first, then empty capacity. */
  capacity?: number
  /** Width in px. */
  width?: number
  /** Plays the hot-to-cool settle on the most recently hung key. */
  justAdded?: boolean
}

const MAX_DRAWN = 3
const PITCH = 15
const VB_H = 36
const RAIL_Y = 4
const KEY_TOP = 9

/** One key: bow, shaft, bit. Drawn hanging from the hook at `cx`. */
function KeyBody({ cx, lit, uid }: { cx: number; lit: boolean; uid: string }) {
  const g = (n: string) => `${n}-${uid}`
  const bowCy = KEY_TOP + 5
  return (
    <g>
      {/* light thrown onto the rail and the metal behind — only when emitting */}
      {lit && (
        <g>
          <circle cx={cx} cy={bowCy + 6} r={13} fill="var(--color-key)" opacity="0.1" />
          <circle cx={cx} cy={bowCy + 3} r={8} fill="var(--color-key)" opacity="0.16" />
          <circle cx={cx} cy={bowCy} r={5.4} fill="var(--color-key-hot)" opacity="0.22" />
        </g>
      )}
      {/* contact shadow, consistent with the top-left key light */}
      <g opacity={lit ? 0.5 : 0.7} transform="translate(0.7 0.9)">
        <circle cx={cx} cy={bowCy} r="4.1" fill="rgba(0,0,0,0.7)" />
        <rect x={cx - 1.1} y={bowCy + 2.6} width="2.2" height="13" fill="rgba(0,0,0,0.7)" />
      </g>
      <g fill={lit ? `url(#${g('lit')})` : `url(#${g('dark')})`} stroke={lit ? 'rgba(90,54,6,0.6)' : '#0c0803'} strokeWidth="0.5">
        {/* bow */}
        <circle cx={cx} cy={bowCy} r="4.1" />
        {/* shaft */}
        <rect x={cx - 1.1} y={bowCy + 2.6} width="2.2" height="13.2" rx="0.6" />
        {/* bit teeth */}
        <rect x={cx + 0.9} y={bowCy + 9.4} width="3.2" height="2" rx="0.4" />
        <rect x={cx + 0.9} y={bowCy + 13} width="4.2" height="2.1" rx="0.4" />
      </g>
      {/* bore through the bow — a real key has a hole, and it proves the shape */}
      <circle cx={cx} cy={bowCy} r="1.7" fill={lit ? '#4a2f04' : '#080502'} />
      {/* specular on the upper-left of the bow */}
      <path
        d={`M${cx - 3.2} ${bowCy - 1.4} A4.1 4.1 0 0 1 ${cx - 1} ${bowCy - 3.9}`}
        fill="none"
        stroke={lit ? 'rgba(255,250,230,0.95)' : 'rgba(255,236,205,0.28)'}
        strokeWidth="0.7"
        strokeLinecap="round"
      />
    </g>
  )
}

export default function KeyRail({ keys, capacity = 4, width = 68, justAdded = false }: KeyRailProps) {
  const uid = useId()
  const g = (n: string) => `${n}-${uid}`

  const drawn = Math.min(keys, MAX_DRAWN)
  const overflow = keys - drawn
  // Hooks shown: earned keys, then empty capacity, but never past `capacity`.
  const hooks = Math.max(capacity, drawn)
  const slots = overflow > 0 ? drawn : hooks
  const vbW = slots * PITCH + (overflow > 0 ? 22 : 0) + 6
  const height = (width * VB_H) / vbW

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${vbW} ${VB_H}`}
      style={{ display: 'block', overflow: 'visible' }}
      role="img"
      aria-label={`${keys} golden key${keys === 1 ? '' : 's'}`}
    >
      <defs>
        {/* emitting key: gold, hottest toward the key light */}
        <linearGradient id={g('lit')} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#fffbe8" />
          <stop offset="26%" stopColor="var(--color-key-hot)" />
          <stop offset="60%" stopColor="var(--color-key)" />
          <stop offset="100%" stopColor="#a86b12" />
        </linearGradient>
        {/* the rail: brass bar, lit along its top edge */}
        <linearGradient id={g('rail')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e2c383" />
          <stop offset="24%" stopColor="#b3823c" />
          <stop offset="70%" stopColor="#6b4a1d" />
          <stop offset="100%" stopColor="#2a1c0a" />
        </linearGradient>
        {/* an empty hook and its (absent) key are machined metal, not a void */}
        <linearGradient id={g('dark')} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#4a3b2e" />
          <stop offset="45%" stopColor="#2a2018" />
          <stop offset="100%" stopColor="#140d07" />
        </linearGradient>
      </defs>

      {/* ---- the rail itself ---- */}
      <rect x="0" y={RAIL_Y + 3.4} width={vbW} height="1.6" fill="rgba(0,0,0,0.6)" />
      <rect x="0" y={RAIL_Y} width={vbW} height="3.6" rx="1.2" fill={`url(#${g('rail')})`} />
      <rect x="0" y={RAIL_Y} width={vbW} height="0.8" fill="rgba(255,244,214,0.55)" />
      {/* rail mounting lugs at each end */}
      {[1.8, vbW - 1.8].map((x) => (
        <circle key={x} cx={x} cy={RAIL_Y + 1.8} r="1.5" fill="#3a2a12" stroke="#1a1005" strokeWidth="0.4" />
      ))}

      {/* ---- hooks and keys ---- */}
      {Array.from({ length: slots }, (_, i) => {
        const cx = 6 + i * PITCH
        const lit = i < drawn
        return (
          <g key={i}>
            {/*
             * The hook is a J that hangs off the rail and passes through the
             * key's bore. It is drawn behind the key, then the short segment
             * crossing the bore is redrawn on top — without that the key looks
             * pasted on rather than hung.
             */}
            <path
              d={`M${cx} ${RAIL_Y + 3.6} L${cx} ${KEY_TOP + 6.5} A2.6 2.6 0 0 0 ${cx + 4.4} ${KEY_TOP + 5.4}`}
              stroke="rgba(0,0,0,0.65)"
              strokeWidth="2.2"
              strokeLinecap="round"
              fill="none"
              transform="translate(0.6 0.8)"
            />
            <path
              d={`M${cx} ${RAIL_Y + 3.6} L${cx} ${KEY_TOP + 6.5} A2.6 2.6 0 0 0 ${cx + 4.4} ${KEY_TOP + 5.4}`}
              stroke={lit ? '#c9a15a' : '#54432f'}
              strokeWidth="1.7"
              strokeLinecap="round"
              fill="none"
            />
            {/* specular down the hook's lit edge */}
            <path
              d={`M${cx - 0.55} ${RAIL_Y + 3.8} L${cx - 0.55} ${KEY_TOP + 5.4}`}
              stroke={lit ? 'rgba(255,244,214,0.6)' : 'rgba(255,236,205,0.26)'}
              strokeWidth="0.55"
              strokeLinecap="round"
              fill="none"
            />
            {lit && (
              <>
                <KeyBody cx={cx} lit uid={uid} />
                {/* the hook, seen through the bore — this is what sells "hung" */}
                <path
                  d={`M${cx} ${KEY_TOP + 3.3} L${cx} ${KEY_TOP + 6.5}`}
                  stroke="#8a6428"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  fill="none"
                />
                {justAdded && i === drawn - 1 && (
                  <circle className="key-cool" cx={cx} cy={KEY_TOP + 8} r="11" fill="var(--color-key-hot)" opacity="0.55" />
                )}
              </>
            )}
          </g>
        )
      })}

      {/* ---- overflow beyond three, as a plain count. Never a multiplier. ---- */}
      {overflow > 0 && (
        <text
          x={slots * PITCH + 4}
          y={KEY_TOP + 15}
          fontFamily="var(--font-display)"
          fontSize="13"
          fontWeight="600"
          fill="var(--color-key)"
          style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em' }}
        >
          +{overflow}
        </text>
      )}
    </svg>
  )
}

/**
 * Compact board-row form: one key glyph and a plain count. The board has 22px
 * for this, which is not enough for hanging keys — but it is still a count,
 * never a multiplier, so no `×` appears here either.
 */
export function KeyCount({ keys, size = 22 }: { keys: number; size?: number }) {
  const uid = useId()
  const lit = keys > 0
  return (
    <span className="inline-flex items-center gap-[3px]" aria-label={`${keys} golden keys`}>
      <svg width={size * 0.46} height={size * 0.68} viewBox="0 0 11 17" style={{ display: 'block', overflow: 'visible' }} aria-hidden>
        <defs>
          <linearGradient id={`kc-${uid}`} x1="0.2" y1="0" x2="0.8" y2="1">
            <stop offset="0%" stopColor="#fffbe8" />
            <stop offset="30%" stopColor="var(--color-key-hot)" />
            <stop offset="65%" stopColor="var(--color-key)" />
            <stop offset="100%" stopColor="#a86b12" />
          </linearGradient>
        </defs>
        {lit && <circle cx="4.3" cy="4.6" r="6.4" fill="var(--color-key)" opacity="0.18" />}
        <g fill={lit ? `url(#kc-${uid})` : '#3b2f24'} stroke={lit ? 'rgba(90,54,6,0.55)' : '#0c0803'} strokeWidth="0.45">
          <circle cx="4.3" cy="4.6" r="3.6" />
          <rect x="3.35" y="6.9" width="1.9" height="9.2" rx="0.5" />
          <rect x="5" y="10.6" width="2.7" height="1.7" rx="0.35" />
          <rect x="5" y="13.6" width="3.5" height="1.8" rx="0.35" />
        </g>
        <circle cx="4.3" cy="4.6" r="1.45" fill={lit ? '#4a2f04' : '#080502'} />
      </svg>
      <span
        className="numeral tabular-nums"
        style={{
          fontSize: size * 0.62,
          color: lit ? 'var(--color-key)' : 'var(--color-text-dim)',
          opacity: lit ? 1 : 0.5,
          lineHeight: 1,
        }}
      >
        {keys}
      </span>
    </span>
  )
}
