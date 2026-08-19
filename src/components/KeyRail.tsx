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
/* The first hook is inset so the leftmost key's glow does not spill outside
 * the panel that contains the rail — the svg is overflow:visible by design. */
const EDGE = 11

/** One key: bow, shaft, bit. Drawn hanging from the hook at `cx`. */
function KeyBody({ cx, lit, uid }: { cx: number; lit: boolean; uid: string }) {
  const g = (n: string) => `${n}-${uid}`
  const bowCy = KEY_TOP + 5
  return (
    <g>
      {/* light thrown onto the rail and the metal behind — only when emitting */}
      {lit && (
        <g>
          <circle cx={cx} cy={bowCy + 5} r={10} fill="var(--color-key)" opacity="0.11" />
          <circle cx={cx} cy={bowCy + 2} r={6.6} fill="var(--color-key)" opacity="0.16" />
          <circle cx={cx} cy={bowCy} r={4.8} fill="var(--color-key-hot)" opacity="0.2" />
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
  const vbW = (slots - 1) * PITCH + EDGE * 2 + (overflow > 0 ? 22 : 0)
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
        const cx = EDGE + i * PITCH
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
          x={(slots - 1) * PITCH + EDGE + 8}
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

/* ---- The team sheet's wall rail ----------------------------------------- */

/**
 * The full-width brass bar at the bottom of the team sheet: hooks along it,
 * awarded keys hanging from them, and a chamfered `+ KEY` tab at its right end.
 *
 * It hangs on the **wall**, not on a plate. That matters: a lit key's bloom has
 * to land on something dark to read as emission at all, and on brass it just
 * looks like brighter brass. Nothing labels this rail — a bar with keys on it
 * does not need a caption saying so.
 */
const BAR_W = 358
const BAR_H = 29
const TAB_W = 85
const TAB_X = BAR_W - TAB_W
const HOOK_X0 = 34
const HOOK_PITCH = 41
/*
 * Where the peg starts inside the bar and where its stub ends beneath it.
 * Traced off the reference at 5x and scaled to this bar's height: the milled
 * slot runs from 6.2 to 24.5 and the peg sits in its lower two thirds, from
 * 20.7 down to 36.8 — a stub about as wide as the slot it stands in. The build
 * had a 6.2-wide pin starting at 15, which put a long thin needle in a short
 * hole; the reference's peg is nearly the slot's width and reads as a machined
 * part seated in it.
 */
const TONGUE_TOP = 20.5
const TONGUE_BOT = BAR_H + 8
const TONGUE_W = 8
/* the drawing runs past the bar so a hanging key is not clipped */
const RAIL_VB_H = 84

/** A slotted brass screw driven into the rail, drawn in the rail's own space. */
function RailScrew({ cx, slot }: { cx: number; slot: number }) {
  const cy = BAR_H / 2
  return (
    <g>
      <circle cx={cx} cy={cy} r="5.6" fill="#1a1005" opacity="0.85" />
      <circle cx={cx} cy={cy} r="4.6" fill="#a8834a" />
      <path
        d={`M${cx - 4.4} ${cy - 1.6} A4.6 4.6 0 0 1 ${cx - 1.2} ${cy - 4.4}`}
        fill="none"
        stroke="rgba(255,244,214,0.8)"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <rect
        x={cx - 3.4}
        y={cy - 0.55}
        width="6.8"
        height="1.1"
        fill="rgba(24,14,5,0.85)"
        transform={`rotate(${slot} ${cx} ${cy})`}
      />
    </g>
  )
}

/**
 * One key hanging by its bow from a hook. Bigger and hotter than the board's:
 * on the reference the bow is ~20 CSS across and the key runs ~62 long, with the
 * bow riding up INSIDE the bar rather than dangling clear beneath it — a key
 * that hangs entirely below the rail reads as stuck to the wall, not hung.
 */
function HungKey({ cx, top, lit, uid }: { cx: number; top: number; lit: boolean; uid: string }) {
  const g = (n: string) => `${n}-${uid}`
  /*
   * Traced off the reference at 5x: the bow is 64 image px across against a
   * 72px-tall bar — a quarter wider than the bar is deep — its centre sits a
   * little below the bar's middle, and the shoulder collar is directly under
   * the bow rather than halfway down the shaft. The build had a 19-unit bow at
   * centre 20 with the collar at 45, which read as a small key with a
   * crossguard bolted across it.
   */
  const bowCy = top + 12.5
  const bowR = 12.5
  const body = lit ? `url(#${g('hot')})` : `url(#${g('dark')})`
  return (
    <g>
      {/*
       * Emission: a hot core hugging the bow and a short warm wash down the
       * shaft, gone within a key height. Drawn as **many-stop radial gradients**
       * rather than a stack of four discs — four discs put a hard boundary at
       * every stop, and at 2x those boundaries read as concentric rings around
       * the key instead of light falling off it.
       */}
      {lit && (
        <>
          <radialGradient id={g(`bloom${Math.round(cx)}`)} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="var(--color-key-hot)" stopOpacity="0.62" />
            <stop offset="10%" stopColor="var(--color-key-hot)" stopOpacity="0.56" />
            <stop offset="20%" stopColor="var(--color-key)" stopOpacity="0.46" />
            <stop offset="30%" stopColor="var(--color-key)" stopOpacity="0.37" />
            <stop offset="40%" stopColor="var(--color-key)" stopOpacity="0.29" />
            <stop offset="50%" stopColor="var(--color-key)" stopOpacity="0.22" />
            <stop offset="60%" stopColor="var(--color-key)" stopOpacity="0.155" />
            <stop offset="70%" stopColor="var(--color-key)" stopOpacity="0.1" />
            <stop offset="80%" stopColor="var(--color-key)" stopOpacity="0.055" />
            <stop offset="90%" stopColor="var(--color-key)" stopOpacity="0.021" />
            <stop offset="100%" stopColor="var(--color-key)" stopOpacity="0" />
          </radialGradient>
          {/*
           * The key is the most important object in the app, so it has to light
           * the wall it hangs on. Scanned across the reference the wall beside a
           * hung key sits at L 56–96 for ~43 CSS px either side against a bare
           * wall of L 32; a bloom that decays to nothing inside 15px reads as a
           * gold sticker. Radius is set from that measurement, not by eye.
           */}
          <g>
            <circle cx={cx} cy={bowCy + 10} r={78} fill={`url(#${g(`bloom${Math.round(cx)}`)})`} opacity="0.5" />
            <circle cx={cx} cy={bowCy + 2} r={34} fill={`url(#${g(`bloom${Math.round(cx)}`)})`} />
            <ellipse
              cx={cx}
              cy={bowCy + 26}
              rx={22}
              ry={38}
              fill={`url(#${g(`bloom${Math.round(cx)}`)})`}
              opacity="0.7"
            />
          </g>
        </>
      )}
      {/* contact shadow, cast down-right by the one top-left key light */}
      <g opacity={lit ? 0.45 : 0.65} transform="translate(1.6 2)">
        <circle cx={cx} cy={bowCy} r={bowR} fill="rgba(0,0,0,0.7)" />
        <rect x={cx - 2.7} y={bowCy + 10} width="5.4" height="36" fill="rgba(0,0,0,0.7)" />
      </g>
      <g fill={body} stroke={lit ? 'rgba(90,54,6,0.55)' : '#0c0803'} strokeWidth="1">
        <circle cx={cx} cy={bowCy} r={bowR} />
        <rect x={cx - 2.7} y={bowCy + 10} width="5.4" height="36" rx="1.4" />
        {/* the shoulder collar, immediately under the bow */}
        <rect x={cx - 4.8} y={bowCy + 11.5} width="9.6" height="4" rx="1.2" />
        <rect x={cx + 2.4} y={bowCy + 34} width="8" height="4.4" rx="1" />
        <rect x={cx + 2.4} y={bowCy + 41} width="5.8" height="4.4" rx="1" />
      </g>
      {/* the bore: a real key has a hole, and the hook shows through it */}
      <circle cx={cx} cy={bowCy} r="4.3" fill={lit ? '#5a3806' : '#080502'} />
      <path
        d={`M${cx - 9.9} ${bowCy - 4.2} A${bowR} ${bowR} 0 0 1 ${cx - 3.1} ${bowCy - 12.1}`}
        fill="none"
        stroke={lit ? 'rgba(255,250,230,0.95)' : 'rgba(255,236,205,0.26)'}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </g>
  )
}

export function KeyHookRail({
  keys,
  hooks = 6,
  width = BAR_W,
  onAdd,
  disabled = false,
  justAdded = false,
}: {
  keys: number
  hooks?: number
  width?: number
  onAdd?: () => void
  disabled?: boolean
  /** Plays the hot-to-cool settle on the most recently hung key. */
  justAdded?: boolean
}) {
  const uid = useId()
  const g = (n: string) => `${n}-${uid}`
  const scale = width / BAR_W
  const lit = Math.min(keys, hooks)
  const overflow = keys - lit

  return (
    <div className="relative" style={{ width, height: BAR_H * scale }}>
      <svg
        width={width}
        height={RAIL_VB_H * scale}
        viewBox={`0 0 ${BAR_W} ${RAIL_VB_H}`}
        style={{ display: 'block', overflow: 'visible', pointerEvents: 'none' }}
        role="img"
        aria-label={`${keys} golden key${keys === 1 ? '' : 's'}`}
      >
        <defs>
          {/*
           * The reference bar is a double band, not one sweep: bright top edge,
           * an engraved groove just under it, then the brass face falling into
           * shadow. The groove is what makes it read as a milled rail rather
           * than a painted stripe.
           */}
          {/*
           * Scanned down the reference bar the face runs L≈160 under the top
           * chamfer to L≈100 just above the bottom edge — a shallow fall across
           * a plate seen flat on, not a tube. The old ramp bottomed out at
           * L≈24, which read as a cylinder, and its R−B of 100–118 made it
           * oranger than the reference's 75–95.
           */}
          <linearGradient id={g('bar')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f2ddaa" />
            <stop offset="6%" stopColor="#bb9c62" />
            <stop offset="30%" stopColor="#b0955e" />
            <stop offset="58%" stopColor="#96793f" />
            <stop offset="80%" stopColor="#7c6236" />
            <stop offset="92%" stopColor="#5f4a29" />
            <stop offset="100%" stopColor="#33240f" />
          </linearGradient>
          {/*
           * The bar's specular decays away from the top-left corner instead of
           * running at one value the whole width — a highlight of constant
           * intensity along an edge encodes no light direction at all.
           */}
          <linearGradient id={g('spec')} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#fff8e4" stopOpacity="0.9" />
            <stop offset="18%" stopColor="#fff4d8" stopOpacity="0.62" />
            <stop offset="46%" stopColor="#ffeeca" stopOpacity="0.36" />
            <stop offset="74%" stopColor="#ffeeca" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#ffeeca" stopOpacity="0.12" />
          </linearGradient>
          {/*
           * The tab is the same brass as the bar it is welded to, gated or not.
           * Awarding a key is director-only, which is correct — but a gated
           * control has to read as hardware that is not currently powered, not
           * as a dead grey slab at half the bar's luminance. So the material
           * stays continuous and the legend changes state instead: struck into
           * the brass when gated, lit cream when live.
           */}
          <linearGradient id={g('tab')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={disabled ? '#e2cd9c' : '#f2ddaa'} />
            <stop offset="16%" stopColor={disabled ? '#b59a63' : '#c6a76c'} />
            <stop offset="52%" stopColor={disabled ? '#8e7644' : '#a3874f'} />
            <stop offset="100%" stopColor="#3a2a14" />
          </linearGradient>
          {/*
           * Horizontal brushing on the bar — one consistent grain direction.
           * Pitch and amplitude both matter: at a 3.4 pitch with a 0.12 dark
           * band this printed a visible rule every 6.8 device px and the face
           * came out non-monotonic, oscillating ±8 luma with eight reversals
           * down a 29px bar. Scanned down the reference the same run falls
           * 149 → 100 without a single reversal. Halving the pitch and cutting
           * the contrast to about a fifth leaves brushing you can only see as
           * texture, which is what brushing is.
           */}
          <pattern id={g('brush')} width="1" height="1.7" patternUnits="userSpaceOnUse">
            <rect width="1" height="0.85" fill="rgba(255,244,214,0.022)" />
            <rect y="1.05" width="1" height="0.5" fill="rgba(40,24,8,0.045)" />
          </pattern>
          {/*
           * A lit key's own body reads at L≈200 on the reference; the old ramp
           * bottomed out at #a86b12 (L≈120) and the shaft came out dull. The
           * darkest stop now stays inside the gold family so the key is the
           * brightest object on the wall, which is the point of it.
           */}
          <linearGradient id={g('hot')} x1="0.2" y1="0" x2="0.8" y2="1">
            <stop offset="0%" stopColor="#fffdf2" />
            <stop offset="32%" stopColor="var(--color-key-hot)" />
            <stop offset="70%" stopColor="var(--color-key)" />
            <stop offset="100%" stopColor="#d19420" />
          </linearGradient>
          <linearGradient id={g('dark')} x1="0.2" y1="0" x2="0.8" y2="1">
            <stop offset="0%" stopColor="#4a3b2e" />
            <stop offset="45%" stopColor="#2a2018" />
            <stop offset="100%" stopColor="#140d07" />
          </linearGradient>
          {/* the milled slot's floor: a true recess in the bar's face */}
          <linearGradient id={g('slot')} x1="0" y1="0" x2="0.7" y2="1">
            <stop offset="0%" stopColor="#0a0704" />
            <stop offset="52%" stopColor="#18110a" />
            <stop offset="100%" stopColor="#3a2a1a" />
          </linearGradient>
          {/*
           * The peg is one part crossing two lighting conditions, so its ramp
           * runs down its LENGTH rather than across its width: brass catching
           * the key light where it stands on the bar's face (the reference
           * reads L≈153 spec, L≈92 body there) and dropping to L 33–60 for the
           * stub that protrudes past the bar's bottom edge, where nothing is
           * lighting it. One flat dark fill made it a long pin hanging off the
           * front instead of a peg seated in a slot.
           */}
          <linearGradient
            id={g('tongueOn')}
            x1="0"
            y1={TONGUE_TOP}
            x2="0"
            y2={TONGUE_BOT}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#c9a96d" />
            <stop offset="16%" stopColor="#b8974f" />
            <stop offset="52%" stopColor="#94773d" />
            <stop offset="77%" stopColor="#4e3819" />
            <stop offset="100%" stopColor="#241809" />
          </linearGradient>
          <linearGradient
            id={g('tongueOff')}
            x1="0"
            y1={TONGUE_TOP}
            x2="0"
            y2={TONGUE_BOT}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#a98f5d" />
            <stop offset="16%" stopColor="#9b8043" />
            <stop offset="52%" stopColor="#7b6333" />
            <stop offset="77%" stopColor="#412f15" />
            <stop offset="100%" stopColor="#1c1307" />
          </linearGradient>
          {/* oxide freckling the bar's face, the way the reference's is pitted */}
          <filter id={g('rust')} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.42 0.7" numOctaves="4" seed="23" stitchTiles="stitch" />
            <feColorMatrix values="0 0 0 0 0.55 0 0 0 0 0.26 0 0 0 0 0.1 0 0 0 2.2 -1.05" />
          </filter>
        </defs>

        {/* contact shadow the bar throws on the wall */}
        <rect x="2" y={BAR_H - 2} width={BAR_W - 4} height="5" rx="2" fill="rgba(0,0,0,0.55)" />

        {/* the bar: chamfered ends, key light along the top edge */}
        <path
          d={`M4 0 H${BAR_W - 4} L${BAR_W} 4 V${BAR_H - 4} L${BAR_W - 4} ${BAR_H} H4 L0 ${BAR_H - 4} V4 Z`}
          fill={`url(#${g('bar')})`}
        />
        <path
          d={`M4 0 H${BAR_W - 4} L${BAR_W} 4 V${BAR_H - 4} L${BAR_W - 4} ${BAR_H} H4 L0 ${BAR_H - 4} V4 Z`}
          fill={`url(#${g('brush')})`}
        />
        {/* oxide creeping along the bar's lower edge, in the crevice only */}
        <rect x="4" y={BAR_H - 7} width={BAR_W - 8} height="7" fill="#8a5230" opacity="0.16" />
        <path d={`M4 0.7 H${BAR_W - 4}`} stroke={`url(#${g('spec')})`} strokeWidth="1.4" />
        {/*
         * The groove that splits the bar into a lit top lip and a face below.
         * Drawn as hard edges rather than gradient stops: over 29px a stop
         * smears across three pixels and the double-band read is lost.
         */}
        <rect x="3" y="3.2" width={BAR_W - 6} height="1.9" fill="rgba(38,22,8,0.6)" />
        <path
          d={`M3 ${5.5} H${BAR_W - 3}`}
          stroke="rgba(255,242,210,0.4)"
          strokeWidth="0.9"
        />
        <path
          d={`M4 ${BAR_H - 0.7} H${BAR_W - 4}`}
          stroke="rgba(26,15,5,0.75)"
          strokeWidth="1.4"
        />
        {/*
         * The engraved inner line that runs the whole perimeter, 3.5 in from
         * the edge — the reference bar is a nameplate with a bevel band all
         * round, not a strip with one rule across it. Dark cut with a lit lower
         * lip, so the band reads as raised under the same top-left light.
         */}
        <path
          d={`M9 ${BAR_H - 5.4} H${BAR_W - 9} M5.4 9 V${BAR_H - 9} M${BAR_W - 5.4} 9 V${BAR_H - 9}`}
          fill="none"
          stroke="rgba(38,24,10,0.3)"
          strokeWidth="0.9"
        />
        <path
          d={`M9 ${BAR_H - 4.4} H${BAR_W - 9}`}
          fill="none"
          stroke="rgba(255,240,206,0.16)"
          strokeWidth="0.8"
        />
        {/* oxide freckling the bar's face, heavier toward its lower edge */}
        <rect
          x="4"
          y="0"
          width={BAR_W - 8}
          height={BAR_H}
          filter={`url(#${g('rust')})`}
          opacity="0.34"
        />

        {/* the near screw; its twin is driven into the end tab, further down */}
        <RailScrew cx={10} slot={24} />

        {/*
         * Hooks, as the reference builds them: a **milled slot cut into the
         * bar's own face** with a **brass tongue seated in it**, the tongue
         * standing only a few millimetres proud of the bar's lower edge. The
         * previous J-hooks dangled 35px below the bar against the bare wall as
         * flat silhouettes — no bevel, no specular, no contact shadow — which
         * made them the flattest objects on the screen and put hardware
         * somewhere the reference has nothing at all.
         */}
        {Array.from({ length: hooks }, (_, i) => {
          const cx = HOOK_X0 + i * HOOK_PITCH
          const on = i < lit
          /*
           * The slot only occupies the bar's upper half — on the reference the
           * brass reappears below it, because that is where the peg standing in
           * the slot catches the light. A slot cut the full height reads as a
           * hole the peg falls through.
           */
          const slotTop = 6.2
          const slotBot = 24.5
          const tongueTop = TONGUE_TOP
          const tongueBot = TONGUE_BOT
          const tw = TONGUE_W / 2
          return (
            <g key={i}>
              {/*
               * The milled slot: a true recess. Its dark rim is a stroke on the
               * rect rather than a hand-drawn arc — an arc whose chord exceeds
               * its diameter gets its radius silently scaled up by the renderer
               * and comes out as a loop hanging off the side of the part.
               */}
              <rect
                x={cx - 5.1}
                y={slotTop}
                width="10.2"
                height={slotBot - slotTop}
                rx="5.1"
                fill={`url(#${g('slot')})`}
                stroke="rgba(0,0,0,0.7)"
                strokeWidth="0.9"
              />
              <path
                d={`M${cx + 4.5} ${slotTop + 4} V${slotBot - 3.4}`}
                stroke="rgba(255,240,206,0.3)"
                strokeWidth="0.8"
                strokeLinecap="round"
              />
              {/* the peg seated in the slot, its stub proud of the bar's edge */}
              <rect
                x={cx - tw}
                y={tongueTop + 1.1}
                width={TONGUE_W}
                height={tongueBot - tongueTop}
                rx={tw}
                fill="rgba(0,0,0,0.6)"
              />
              <rect
                x={cx - tw + 0.1}
                y={tongueTop}
                width={TONGUE_W - 0.2}
                height={tongueBot - tongueTop}
                rx={tw - 0.1}
                fill={`url(#${g(on ? 'tongueOn' : 'tongueOff')})`}
              />
              {/*
               * The peg's rounded cap catches the key light square on: on the
               * reference it is the brightest thing on the empty half of the
               * bar. A pin lit only down one flank reads as a wire.
               */}
              <path
                d={`M${cx - tw + 0.7} ${tongueTop + 2.6} A${tw - 0.7} ${tw - 0.7} 0 0 1 ${cx + 0.6} ${tongueTop + 0.7}`}
                fill="none"
                stroke={on ? 'rgba(255,248,226,0.75)' : 'rgba(255,242,212,0.5)'}
                strokeWidth="1"
                strokeLinecap="round"
              />
              {/* the peg's lit edge, top-left, under the one key light */}
              <path
                d={`M${cx - tw + 1.1} ${BAR_H - 1} V${tongueTop + 2.6}`}
                stroke={on ? 'rgba(255,246,222,0.5)' : 'rgba(255,240,206,0.26)'}
                strokeWidth="0.9"
                strokeLinecap="round"
              />
              <path
                d={`M${cx + tw - 1} ${tongueBot - 2.6} V${tongueTop + 3.4}`}
                stroke="rgba(20,12,4,0.5)"
                strokeWidth="0.9"
                strokeLinecap="round"
              />
              {on && (
                <>
                  {/* bow center at 20 — up inside the bar, as the reference has it */}
                  <HungKey cx={cx} top={10} lit uid={uid} />
                  {/* the tongue seen through the bore — this is what sells "hung" */}
                  {/*
                   * The peg stops just below the bore. Run down the whole stub
                   * it paints a dull stripe over the key's shaft, and the key —
                   * the brightest object on the wall by design — comes out with
                   * a grey seam down the middle of it.
                   */}
                  <path
                    d={`M${cx} ${tongueTop + 1} V27.6`}
                    stroke="#a07a35"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />
                  <path
                    d={`M${cx - 1.7} ${tongueTop + 1.4} V26.4`}
                    stroke="rgba(255,246,222,0.5)"
                    strokeWidth="0.8"
                    strokeLinecap="round"
                  />
                  {/* one-shot white-hot settle over the newest key */}
                  {justAdded && i === lit - 1 && (
                    <circle
                      className="key-cool"
                      cx={cx}
                      cy={22.5}
                      r={30}
                      fill="var(--color-key-hot)"
                      opacity="0.55"
                    />
                  )}
                </>
              )}
            </g>
          )
        })}

        {/* keys past the hooks are a plain count. Never a multiplier. */}
        {overflow > 0 && (
          <text
            x={TAB_X - 12}
            y={BAR_H + 26}
            textAnchor="end"
            fontFamily="var(--font-display)"
            fontSize="17"
            fontWeight="600"
            fill="var(--color-key)"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            +{overflow}
          </text>
        )}

        {/*
         * The end tab. The reference does not butt it against the bar with a
         * straight seam — it cuts a broken diagonal notch clean through, with
         * rust bleeding across the joint, so the tab reads as a separate piece
         * welded on. `NOTCH` is that edge, used for both the tab's fill and the
         * dark seam struck along it.
         */}
        <g>
          <path
            d={`M${TAB_X + 9} 0 H${BAR_W - 4} L${BAR_W} 4 V${BAR_H - 4} L${BAR_W - 4} ${BAR_H} H${TAB_X + 6} L${TAB_X} ${BAR_H - 7} L${TAB_X + 2.6} ${BAR_H / 2} L${TAB_X + 1} 6 Z`}
            fill={`url(#${g('tab')})`}
          />
          <path
            d={`M${TAB_X + 9} 0.8 H${BAR_W - 4}`}
            stroke={disabled ? 'rgba(255,246,222,0.66)' : 'rgba(255,246,222,0.8)'}
            strokeWidth="1.4"
          />
          <path
            d={`M${TAB_X + 9} 0 L${TAB_X + 1} 6 L${TAB_X + 2.6} ${BAR_H / 2} L${TAB_X} ${BAR_H - 7} L${TAB_X + 6} ${BAR_H}`}
            fill="none"
            stroke="rgba(22,12,4,0.75)"
            strokeWidth="1.5"
          />
          <path
            d={`M${TAB_X + 10} 1.2 L${TAB_X + 2.4} 6.8 L${TAB_X + 4} ${BAR_H / 2} L${TAB_X + 1.5} ${BAR_H - 7.4}`}
            fill="none"
            stroke="rgba(255,240,206,0.3)"
            strokeWidth="0.9"
          />
          {/* oxide bleeding across the joint — a crevice stain, not a wash */}
          <rect
            x={TAB_X - 5}
            y="3"
            width="17"
            height={BAR_H - 6}
            fill="#8a5230"
            opacity="0.3"
            style={{ mixBlendMode: 'multiply' }}
          />
          <RailScrew cx={BAR_W - 14} slot={-37} />
          {/*
           * The legend stays cream in both states — the reference reads it as
           * bright type on brass, and a gated control should look unpowered,
           * not unlabelled. Gated it loses the highlight and sits back a step;
           * live it is full cream over a struck shadow.
           */}
          <text
            x={TAB_X + 38}
            y={BAR_H / 2 + 7}
            textAnchor="middle"
            fontFamily="var(--font-display)"
            fontSize="20"
            fontWeight="600"
            letterSpacing="1.4"
            fill={disabled ? 'rgba(242,231,211,0.88)' : 'var(--color-text)'}
            style={{ paintOrder: 'stroke' }}
            stroke="rgba(40,24,8,0.62)"
            strokeWidth="0.9"
          >
            + KEY
          </text>
        </g>
      </svg>

      {/* the tab is the control; the svg above is only its face */}
      <button
        onClick={onAdd}
        disabled={disabled}
        aria-label="Award a golden key"
        aria-disabled={disabled}
        className="absolute"
        style={{
          right: 0,
          top: 0,
          width: TAB_W * scale,
          height: BAR_H * scale,
          background: 'transparent',
          borderRadius: 4,
        }}
      />
    </div>
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
