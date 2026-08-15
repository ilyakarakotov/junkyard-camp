import { useId, type CSSProperties, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * Shared hardware vocabulary. Every screen is assembled from these parts, so
 * one light direction (top left) and one material story hold across the whole
 * app. See design/REFERENCE-SPEC.md for what each part is copying.
 */

/** Stable per-instance texture offset so no two plates share a weathering crop. */
export function textureOffset(key: string): CSSProperties {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0
  h = h >>> 0
  return { ['--tx' as string]: `${h % 512}px`, ['--ty' as string]: `${(h * 7) % 512}px` }
}

/* ---- Fasteners --------------------------------------------------------- */

/** One slotted brass screw. Absolute-positioned via `className`. */
export function Screw({
  className = '',
  slot = 38,
  size,
}: {
  className?: string
  slot?: number
  /** Head diameter in px. ~12 on a heavy header frame, ~8 on a list row. */
  size?: number
}) {
  return (
    <span
      className={`screw ${className}`}
      style={{ ['--slot' as string]: `${slot}deg`, ...(size ? { ['--sw' as string]: `${size}px` } : null) }}
    />
  )
}

/**
 * Four corner screws on a plate. Slot angles differ per screw — identical slots
 * are the tell that they were drawn rather than driven.
 */
export function CornerScrews({ inset = 9, size }: { inset?: number; size?: number }) {
  const angles = [38, -24, 71, 12]
  const spots: CSSProperties[] = [
    { left: inset, top: inset },
    { right: inset, top: inset },
    { left: inset, bottom: inset },
    { right: inset, bottom: inset },
  ]
  return (
    <>
      {spots.map((pos, i) => (
        <span
          key={i}
          className="screw"
          style={{
            ...pos,
            ['--slot' as string]: `${angles[i]}deg`,
            ...(size ? { ['--sw' as string]: `${size}px` } : null),
            position: 'absolute',
          }}
        />
      ))}
    </>
  )
}

/**
 * A glass tube with turned brass end collars. One object, three uses: the
 * lever's discharge tube, a standings meter, a big-screen channel. Keeping them
 * literally the same part is what makes the app read as one machine.
 *
 * The collars are the arc's two contact posts when a bolt runs inside the tube,
 * so `collarWidth` is also the inset a caller should use to place endpoints.
 */
export function GlassTube({
  height = 20,
  collarWidth = 14,
  className = '',
  style,
  children,
}: {
  height?: number
  collarWidth?: number
  className?: string
  style?: CSSProperties
  children?: ReactNode
}) {
  return (
    <div className={`relative ${className}`} style={{ height, ...style }}>
      {/* the dark glass capsule; whatever fills it is clipped to the bore */}
      <div
        className="absolute overflow-hidden"
        style={{
          left: collarWidth / 2,
          right: collarWidth / 2,
          top: 0,
          bottom: 0,
          borderRadius: 9999,
          background:
            'linear-gradient(180deg, rgba(10,8,6,0.92) 0%, rgba(30,26,22,0.85) 45%, rgba(8,6,5,0.95) 100%)',
          boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.8), inset 0 -1px 0 rgba(255,236,205,0.07)',
        }}
      >
        {children}
      </div>
      {/* a highlight running the length of the glass, so it reads as a cylinder */}
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          left: collarWidth / 2 + 2,
          right: collarWidth / 2 + 2,
          top: height * 0.16,
          height: Math.max(1, height * 0.14),
          borderRadius: 9999,
          background: 'linear-gradient(90deg, transparent, rgba(255,244,220,0.22) 22%, rgba(255,244,220,0.1) 70%, transparent)',
        }}
      />
      {/* turned brass collars, ribbed, lit top-left */}
      {(['left', 'right'] as const).map((side) => (
        <div
          key={side}
          aria-hidden
          className="absolute"
          style={{
            [side]: -collarWidth / 2,
            top: -4,
            width: collarWidth,
            height: height + 8,
            borderRadius: 3,
            background:
              'repeating-linear-gradient(90deg, rgba(0,0,0,0.4) 0 1px, transparent 1px 4px), linear-gradient(180deg,#8a6428 0%,#d9b06a 18%,#7a5622 55%,#2c1d0a 100%)',
            boxShadow:
              'inset 1px 1px 0 rgba(255,220,160,0.4), inset -1px -1px 1px rgba(0,0,0,0.5), 0 3px 4px rgba(0,0,0,0.6)',
          }}
        />
      ))}
    </div>
  )
}

/** Four corner rivets — the lighter-weight fastener, for small parts. */
export function CornerRivets() {
  return (
    <>
      <div className="rivet absolute left-2 top-2" />
      <div className="rivet absolute right-2 top-2" />
      <div className="rivet absolute bottom-2 left-2" />
      <div className="rivet absolute bottom-2 right-2" />
    </>
  )
}

/* ---- Plates and frames -------------------------------------------------- */

export interface PlateProps {
  children?: ReactNode
  className?: string
  /** Corner chamfer in px. References run 6px on rows, 12px on header panels. */
  chamfer?: number
  /** Draw four corner screws, inset by `screwInset`. */
  screws?: boolean
  screwInset?: number
  /** Oxide staining along the lower edge and corners. */
  rust?: boolean
  onClick?: () => void
  style?: CSSProperties
  as?: 'div' | 'button'
  ariaLabel?: string
  ariaPressed?: boolean
  disabled?: boolean
  /** Forwarded to the plate element so DoD checks can find parts by name. */
  dataPart?: string
}

/**
 * A machined brass plate: chamfered corners, brushed face, bevel lit top-left,
 * contact shadow beneath. Content sits directly on the face — a plate is a
 * solid piece of metal, not a frame around a dark window. Cut a `Well` into it
 * when you want a dark recess.
 *
 * The drop shadow lives on the wrapper because `clip-path` would eat it.
 */
export function Plate({
  children,
  className = '',
  chamfer = 10,
  screws = false,
  screwInset = 9,
  rust = true,
  onClick,
  style,
  as = 'div',
  ariaLabel,
  ariaPressed,
  disabled,
  dataPart,
}: PlateProps) {
  const uid = useId()
  const Inner = as
  return (
    <div className={`plate-shadow ${className}`} style={{ ...textureOffset(uid), ...style }}>
      <Inner
        data-part={dataPart}
        className={`plate grain ${rust ? 'rust-creep' : ''} relative block h-full w-full text-left`}
        style={{ ['--ch' as string]: `${chamfer}px` }}
        onClick={onClick}
        aria-label={ariaLabel}
        aria-pressed={ariaPressed}
        disabled={as === 'button' ? disabled : undefined}
        role={as === 'div' && onClick ? 'button' : undefined}
        tabIndex={as === 'div' && onClick ? 0 : undefined}
        onKeyDown={
          as === 'div' && onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && onClick() : undefined
        }
      >
        {screws && <CornerScrews inset={screwInset} />}
        {children}
      </Inner>
    </div>
  )
}

/**
 * A heavy brass frame band wrapping content: outer bevel, engraved inner line,
 * lit top-left. This is the team-sheet header treatment.
 */
export function BrassFrame({
  children,
  className = '',
  band = 9,
  radius = 4,
  screws = true,
}: {
  children: ReactNode
  className?: string
  /** Width of the brass band in px. */
  band?: number
  radius?: number
  screws?: boolean
}) {
  const uid = useId()
  return (
    <div
      className={`brass-band grain relative ${className}`}
      style={{ ...textureOffset(uid), padding: band, borderRadius: radius }}
    >
      {screws && <CornerScrews inset={Math.max(3, band - 6)} />}
      {/* engraved line just inside the band, the reference's double-frame read */}
      <div
        className="pointer-events-none absolute"
        style={{
          inset: band - 3,
          borderRadius: Math.max(1, radius - 2),
          boxShadow: 'inset 0 1px 0 rgba(255,244,214,0.35), 0 1px 0 rgba(40,26,12,0.6)',
          border: '1px solid rgba(58,38,16,0.5)',
        }}
      />
      <div className="relative" style={{ borderRadius: Math.max(1, radius - 2) }}>
        {children}
      </div>
    </div>
  )
}

/** A dark well cut into a plate: score readouts, LCD windows, meter channels. */
export function Well({
  children,
  className = '',
  radius = 3,
  style,
  dataPart,
}: {
  children?: ReactNode
  className?: string
  radius?: number
  style?: CSSProperties
  dataPart?: string
}) {
  return (
    <div
      data-part={dataPart}
      className={`well relative ${className}`}
      style={{ borderRadius: radius, ...style }}
    >
      {children}
    </div>
  )
}

/**
 * The outer bezel that makes a screen read as one machine rather than a stack
 * of cards. Roll call and the big screen both sit inside one.
 */
export function ScreenFrame({
  children,
  className = '',
  band = 10,
}: {
  children: ReactNode
  className?: string
  band?: number
}) {
  const uid = useId()
  return (
    <div
      className={`steel grain rust-creep relative min-h-full ${className}`}
      style={{
        ...textureOffset(uid),
        padding: band,
        boxShadow:
          'inset 2px 2px 0 rgba(255,244,220,0.26), inset -2px -2px 0 rgba(24,13,5,0.5), inset 0 0 40px rgba(0,0,0,0.5)',
      }}
    >
      <CornerScrews inset={Math.max(4, band - 6)} />
      <div className="relative">{children}</div>
    </div>
  )
}

/* ---- Brass rails and nameplates ---------------------------------------- */

/** A horizontal brass rail with a rivet at each end. Keys hang from these. */
export function BrassRail({
  className = '',
  height = 14,
  radius = 3,
  children,
  style,
}: {
  className?: string
  height?: number
  radius?: number
  children?: ReactNode
  style?: CSSProperties
}) {
  const uid = useId()
  return (
    <div
      className={`brass-band grain relative ${className}`}
      style={{ ...textureOffset(uid), height, borderRadius: radius, ...style }}
    >
      <span className="rivet absolute left-[5px] top-1/2 -translate-y-1/2" />
      <span className="rivet absolute right-[5px] top-1/2 -translate-y-1/2" />
      {children}
    </div>
  )
}

/** Engraved brass nameplate. Type is cut into the brass, so it is dark. */
export function BrassPlate({
  children,
  className,
  screws = false,
  size = 11,
  tracking = '0.24em',
}: {
  children: ReactNode
  className?: string
  screws?: boolean
  size?: number
  tracking?: string
}) {
  const uid = useId()
  return (
    <div
      className={`brass-band grain relative inline-block px-3 py-0.5 ${className ?? ''}`}
      style={{ ...textureOffset(uid), borderRadius: 3 }}
    >
      {screws && (
        <>
          <Screw className="left-[3px] top-1/2 -translate-y-1/2" slot={22} />
          <Screw className="right-[3px] top-1/2 -translate-y-1/2" slot={-51} />
        </>
      )}
      <span
        className="engraved font-display font-semibold uppercase"
        style={{ fontSize: size, letterSpacing: tracking }}
      >
        {children}
      </span>
    </div>
  )
}

/* ---- Emitters ----------------------------------------------------------- */

/**
 * A lamp: a socket that either sits dark in its well or emits. Lit lamps are
 * amber unless a caller overrides `color` (a binary cell burns in its team
 * colour; the day rail's pilot lamp is teal).
 */
export function Lamp({
  on,
  color = 'var(--color-lamp)',
  size = 16,
  square = false,
  className = '',
  intensity = 1,
  style,
  dataPart,
}: {
  on: boolean
  color?: string
  size?: number
  square?: boolean
  className?: string
  /** 0..1 scales the spill, for a lamp idling versus a lamp at full. */
  intensity?: number
  style?: CSSProperties
  dataPart?: string
}) {
  return (
    <span
      data-part={dataPart}
      data-on={on ? 'true' : 'false'}
      className={`relative inline-block ${on ? 'lamp-on' : ''} ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: square ? Math.max(2, size * 0.14) : 9999,
        ['--emit' as string]: color,
        opacity: on ? 1 : undefined,
        background: on
          ? `radial-gradient(circle at 40% 34%, var(--color-lamp-hot) 0%, ${color} 42%, color-mix(in oklab, ${color} 70%, #2a1206) 100%)`
          : 'radial-gradient(circle at 40% 34%, #2b211b 0%, var(--color-well) 62%, #0d0805 100%)',
        boxShadow: on
          ? undefined
          : 'inset 1px 1px 2px rgba(0,0,0,0.9), inset -1px -1px 0 rgba(84,71,64,0.55), 0 1px 0 rgba(255,244,220,0.14)',
        filter: on && intensity < 1 ? `saturate(${0.6 + intensity * 0.4})` : undefined,
        ...style,
      }}
    />
  )
}

/* ---- The cog knob ------------------------------------------------------- */

/**
 * A point on a circle about the knob's centre, in its own 64-unit box. Screen y
 * grows downward, so the key light's corner — top left — is θ ≈ 225°.
 */
const cogPt = (r: number, deg: number) => {
  const a = (deg * Math.PI) / 180
  return `${(32 + Math.cos(a) * r).toFixed(2)} ${(32 + Math.sin(a) * r).toFixed(2)}`
}
/** An arc of `r` from `a0` to `a1`, swept clockwise on screen. */
const cogArc = (r: number, a0: number, a1: number) =>
  `M${cogPt(r, a0)} A${r} ${r} 0 ${Math.abs(a1 - a0) > 180 ? 1 : 0} 1 ${cogPt(r, a1)}`

/**
 * The outer band's grip.
 *
 * Measured off `02-rollcall-rest.jpg` (scan across the knob at y=305, centre
 * x=929, outer r=49): the silhouette is **two concentric brass bands** — a
 * bright inner ring at r 32–40 peaking L≈203, a dark groove at r≈43, and a
 * dimmer outer collar at r 44–49 peaking L≈96 — and the collar's edge is
 * *scalloped*, shallow rounded bumps, not sawtooth. The build drew 22 sharp
 * teeth over a near-black seat, which at 21px on a board row rendered as a
 * black halo and made the knob the darkest object on an otherwise brass plate.
 *
 * So the bumps bulge only 1.5 units past a 29.5 root and the valleys land on
 * brass, not on the seat: at row scale that resolves to a smooth second band,
 * and at roll-call scale it resolves to a grip.
 */
const COG_TEETH = 18
const COG_ROOT = 29.8
const COG_TIP = 31
/** Radius of the scallop arc that bulges `COG_TIP - COG_ROOT` past the root. */
const SCALLOP_R = (() => {
  const chord = 2 * COG_ROOT * Math.sin(Math.PI / COG_TEETH)
  const sag = COG_TIP - COG_ROOT
  return ((chord * chord) / 4 / sag + sag) / 2
})()
const COG_COLLAR =
  `M${cogPt(COG_ROOT, 0)} ` +
  Array.from(
    { length: COG_TEETH },
    (_, i) =>
      `A${SCALLOP_R.toFixed(2)} ${SCALLOP_R.toFixed(2)} 0 0 1 ${cogPt(COG_ROOT, ((i + 1) * 360) / COG_TEETH)}`,
  ).join(' ') +
  ' Z'
/**
 * The face's starburst is a **solid eight-point star**, raised out of the
 * pocket — on the reference it is a cast rosette catching the key light, not an
 * engraving cut into the face. Eight spokes is what a wireframe of it looks
 * like, and at 22px that is the difference between a part and a drawing.
 */
const COG_STAR = Array.from({ length: 16 }, (_, i) => {
  const r = i % 2 === 0 ? 14.4 : 5.6
  const a = ((i * 22.5 - 90) * Math.PI) / 180
  return `${(32 + Math.cos(a) * r).toFixed(2)},${(32 + Math.sin(a) * r).toFixed(2)}`
}).join(' ')

/**
 * A brass cog knob: two concentric brass bands — a polished inner ring and a
 * scallop-edged outer collar — around a **sunk** face carrying a lit starburst.
 * When `readout` is set the face becomes a numeric display instead; that is the
 * roll-call selected state.
 *
 * The face is a recess, so it is *darker* than the bands around it and the star
 * on it is *lit*. The build had that relationship inverted — a face brighter
 * than its own ring with the star engraved into it dark — which is why the part
 * read as a printed icon rather than as machined hardware.
 *
 * `glow` seats a lamp ring **down in the pocket**, where an emitter can spill
 * onto the floor and the band it sits against. It used to hang on the knob's
 * outer rim, which is a halo around a lump of brass with nothing emitting
 * inside it.
 */
export function CogKnob({
  size = 44,
  readout,
  glow = false,
  className = '',
}: {
  size?: number
  readout?: string
  glow?: boolean
  className?: string
}) {
  const uid = useId()
  const g = (n: string) => `${n}-${uid}`
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden style={{ display: 'block' }}>
      <defs>
        {/* the outer collar: brass, but a stop dimmer than the ring it frames */}
        <radialGradient id={g('collar')} cx="0.33" cy="0.28" r="0.86">
          <stop offset="0%" stopColor="#b6975f" />
          <stop offset="40%" stopColor="#8d7040" />
          <stop offset="76%" stopColor="#5c4322" />
          <stop offset="100%" stopColor="#33220f" />
        </radialGradient>
        {/* the polished inner ring — the brightest thing on the part */}
        <linearGradient id={g('ring')} x1="0.14" y1="0.04" x2="0.86" y2="0.96">
          <stop offset="0%" stopColor="#fbe7bd" />
          <stop offset="34%" stopColor="#f2d49e" />
          <stop offset="72%" stopColor="#c9a15a" />
          <stop offset="100%" stopColor="#7d5c2d" />
        </linearGradient>
        {/* Light bounced up off the pocket's lower-right wall — so the floor is
            darkest where the key light cannot reach it, at the top left. */}
        <radialGradient id={g('pocket')} cx="0.64" cy="0.7" r="0.8">
          <stop offset="0%" stopColor="#5c4327" />
          <stop offset="44%" stopColor="#382513" />
          <stop offset="100%" stopColor="#160d05" />
        </radialGradient>
        <linearGradient id={g('star')} x1="0.14" y1="0" x2="0.86" y2="1">
          <stop offset="0%" stopColor="#f2dcaa" />
          <stop offset="42%" stopColor="#cba767" />
          <stop offset="100%" stopColor="#7d5c2c" />
        </linearGradient>
      </defs>
      {/* the contact shadow the knob casts into the plate, down and right */}
      <circle cx="32.8" cy="33.4" r="31.1" fill="rgba(14,7,1,0.5)" />
      {/* outer band */}
      <path d={COG_COLLAR} fill={`url(#${g('collar')})`} />
      <path d={COG_COLLAR} fill="none" stroke="rgba(26,14,4,0.5)" strokeWidth="0.7" />
      <path
        d={cogArc(30.1, 196, 292)}
        fill="none"
        stroke="rgba(255,240,206,0.2)"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      {/* the groove that separates the two bands */}
      <circle cx="32" cy="32" r="27.4" fill="none" stroke="rgba(24,13,4,0.85)" strokeWidth="1.6" />
      {/* inner band, and the crown of its torus: lit top left, shadowed bottom
          right, with one bounce along the underside */}
      <circle cx="32" cy="32" r="24.7" fill="none" stroke={`url(#${g('ring')})`} strokeWidth="4.6" />
      <path
        d={cogArc(24.7, 186, 300)}
        fill="none"
        stroke="rgba(255,244,214,0.6)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d={cogArc(24.7, 8, 118)} fill="none" stroke="rgba(28,15,4,0.38)" strokeWidth="1.6" strokeLinecap="round" />
      <path
        d={cogArc(24.3, 64, 112)}
        fill="none"
        stroke="rgba(255,236,196,0.28)"
        strokeWidth="1"
        strokeLinecap="round"
      />
      {/* the pocket: floor, the shadow its top-left wall casts, its lit lip */}
      <circle cx="32" cy="32" r="22.5" fill={`url(#${g('pocket')})`} />
      <path d={cogArc(21.4, 163, 313)} fill="none" stroke="rgba(12,6,2,0.85)" strokeWidth="3" strokeLinecap="round" />
      <path
        d={cogArc(21.6, 343, 133)}
        fill="none"
        stroke="rgba(255,238,205,0.2)"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      {readout === undefined ? (
        // the rosette, raised out of the floor: its cast shadow, then its lit face
        <>
          <polygon points={COG_STAR} fill="rgba(9,5,2,0.7)" transform="translate(1.2 1.2)" />
          <polygon points={COG_STAR} fill={`url(#${g('star')})`} />
          <polygon
            points={COG_STAR}
            fill="none"
            stroke="rgba(255,242,212,0.3)"
            strokeWidth="0.7"
            transform="translate(-0.4 -0.4)"
          />
          <circle cx="33" cy="33" r="4.2" fill="rgba(9,5,2,0.55)" />
          <circle cx="32" cy="32" r="4.2" fill={`url(#${g('star')})`} />
        </>
      ) : (
        <text
          x="32"
          y="32"
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="Oswald, sans-serif"
          fontWeight="600"
          fontSize="19"
          fill="var(--color-text)"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {readout}
        </text>
      )}
      {glow && (
        <>
          <circle
            cx="32"
            cy="32"
            r="19.6"
            fill="none"
            stroke="var(--color-lamp)"
            strokeWidth="2.6"
            style={{ filter: 'drop-shadow(0 0 2px var(--color-lamp))' }}
          />
          <circle cx="32" cy="32" r="19.6" fill="none" stroke="var(--color-lamp-hot)" strokeWidth="0.9" />
        </>
      )}
    </svg>
  )
}

/* ---- The key ------------------------------------------------------------ */

/**
 * Key geometry in the glyph's own 20×46 box, `d` shifting it down when hanging.
 *
 * Every number here is a proportion measured off the reference keys —
 * `04-golden-key.jpg` (the two keys on the ceremony rail, ~98px across the bow)
 * and `01-board.jpg` (a row's key rail, ~28px across). Both draw the same
 * machined antique, and the build was drawing a wire outline of it: a
 * constant-width annulus, a straight rectangular shank, two rounded rects for a
 * bit. On the app's most important object that is not a nit.
 *
 * What the references actually have, outside in:
 *
 * - a bow that is **wider than it is tall** (h/w 0.70–0.82) and **pierced**,
 *   with a thick top wall and a thin bottom one (26:9 on the ceremony key) so
 *   the bore sits low, and a rounded **peak rising into the bore from below**
 *   that splits it into two lobes and roots the shank;
 * - an **ogee shoulder** widening out of the bow into a **turned collar band**;
 * - a shank that **tapers** to a rounded tip, not a bar with square ends;
 * - a **bit welded to the shank's side with two ward cuts** in its outer edge —
 *   three teeth, unequal, an E in silhouette;
 * - rust down the lower shank of a cold key.
 *
 * Proportions held: whole key 2.5× the bow's width, shank 0.10 of the key's
 * height, bore 0.60 of the bow's width.
 */
function keyGeometry(d: number) {
  const cy = 8 + d // bow centre
  const RX = 8.2 // bow outer semi-axes: 16.4 x 12.4, so h/w = 0.76
  const RY = 6.2
  const bx = 5.2 // bore semi-axes: 0.63 of the bow's width, 0.53 of its height
  const byr = 3.3
  const bc = cy + 1.35 // the bore sits low in the bow: top wall 0.34, bottom 0.13
  /* The bore is not a plain ellipse: a narrow rounded divider rises into it
     from the floor, 0.31 of the bore's width across and 32% of its height tall,
     splitting it into two big lobes. Measured off 04-golden-key.jpg — that hump
     is what makes the bow read as two lobes and roots the shank. */
  const px = bx * 0.31 // half-width of the divider where it leaves the bore edge
  const py = byr * Math.sqrt(1 - 0.31 ** 2) // and the bore's own floor there
  const peak = bc + byr * (1 - 0.64) // apex of the divider
  const nt = cy + 4.55 // shoulder starts inside the bow's bottom wall
  const nb = cy + 9.6
  const ct = cy + 9.3 // collar band
  const st = cy + 10.8 // shank
  const tip = 41.2
  const bb = tip - 1.9 // the bit stops short of the tip
  const bt = bb - 6.8

  /* The bore, wound counter-clockwise so that under the default nonzero fill it
     punches a hole in the clockwise outer ellipse. (evenodd would have punched a
     second hole wherever the shoulder crosses the bow's bottom wall.) */
  const bore =
      `M${10 - bx} ${bc}A${bx} ${byr} 0 0 0 ${(10 - px).toFixed(2)} ${(bc + py).toFixed(2)}` +
      `C${(10 - px * 0.9).toFixed(2)} ${(bc + py - byr * 0.18).toFixed(2)} ${(10 - px * 0.44).toFixed(2)} ${(peak + 0.06).toFixed(2)} 10 ${peak.toFixed(2)}` +
      `C${(10 + px * 0.44).toFixed(2)} ${(peak + 0.06).toFixed(2)} ${(10 + px * 0.9).toFixed(2)} ${(bc + py - byr * 0.18).toFixed(2)} ${(10 + px).toFixed(2)} ${(bc + py).toFixed(2)}` +
      `A${bx} ${byr} 0 0 0 ${10 + bx} ${bc}A${bx} ${byr} 0 0 0 ${10 - bx} ${bc}Z`

  return {
    bore,
    bow: `M${10 - RX} ${cy}A${RX} ${RY} 0 1 1 ${10 + RX} ${cy}A${RX} ${RY} 0 1 1 ${10 - RX} ${cy}Z` + bore,
    /* the ogee shoulder between bow and collar */
    neck:
      `M8.55 ${nt}L11.45 ${nt}` +
      `C12.1 ${cy + 5.6} 13 ${cy + 7} 12.85 ${nb}` +
      `L7.15 ${nb}` +
      `C7 ${cy + 7} 7.9 ${cy + 5.6} 8.55 ${nt}Z`,
    collar: { x: 6.75, y: ct, w: 6.5, h: 1.9 },
    /* tapered, with a turned tip */
    shank: `M7.95 ${st}L12.05 ${st}L11.82 ${tip - 1}Q11.7 ${tip} 10 ${tip}Q8.3 ${tip} 8.18 ${tip - 1}Z`,
    /* the bit: a plate off the shank with two ward cuts in its outer edge */
    bit:
      `M11.5 ${bt}L17.6 ${bt}L17.6 ${bt + 1.09}L15.9 ${bt + 1.09}` +
      `L15.9 ${bt + 2.31}L17.6 ${bt + 2.31}L17.6 ${bt + 3.4}L15.9 ${bt + 3.4}` +
      `L15.9 ${bt + 4.96}L17.6 ${bt + 4.96}L17.6 ${bb}L11.5 ${bb}Z`,
    /* lighting paths, all struck from the one top-left key */
    bowLit: `M${10 - RX * 0.996} ${(cy + RY * 0.087).toFixed(2)}A${RX} ${RY} 0 0 1 ${(10 + RX * 0.342).toFixed(2)} ${(cy - RY * 0.94).toFixed(2)}`,
    bowShade: `M${(10 + RX * 0.985).toFixed(2)} ${(cy + RY * 0.174).toFixed(2)}A${RX} ${RY} 0 0 1 ${(10 - RX * 0.766).toFixed(2)} ${(cy + RY * 0.643).toFixed(2)}`,
    boreShade: `M${(10 - bx * 0.966).toFixed(2)} ${(bc - byr * 0.259).toFixed(2)}A${bx} ${byr} 0 0 1 ${(10 + bx * 0.966).toFixed(2)} ${(bc - byr * 0.259).toFixed(2)}`,
    /* the ring's inner wall below the bore faces up-left, so it catches the
       key light — that opposition is what gives the bow a round section */
    boreLit:
      `M${(10 + bx * 0.951).toFixed(2)} ${(bc + byr * 0.309).toFixed(2)}A${bx} ${byr} 0 0 1 ${(10 + bx * 0.469).toFixed(2)} ${(bc + byr * 0.883).toFixed(2)}` +
      `M${(10 - bx * 0.469).toFixed(2)} ${(bc + byr * 0.883).toFixed(2)}A${bx} ${byr} 0 0 1 ${(10 - bx * 0.951).toFixed(2)} ${(bc + byr * 0.309).toFixed(2)}`,
    sheen: { cx: 10 - RX * 0.4, cy: cy - RY * 0.52, rx: RX * 0.66, ry: RY * 0.6 },
    collarLip: { y: ct + 0.35 },
    bitTop: bt,
    rust: [
      [10.4, st + 10, 1.7, 3.6],
      [9.2, st + 16.5, 1.3, 2.4],
      [11.2, st + 4.5, 1, 1.9],
      [14.2, bt + 4.4, 1.9, 1.6],
    ] as const,
  }
}

/**
 * A skeleton key. `hanging` draws it suspended from a rail by its bow, which is
 * how both the team sheet and the ceremony show awarded keys.
 *
 * Sections are painted as separate elements over one **user-space** gradient,
 * so the light ramp runs across the whole key rather than restarting inside
 * each part, and each section then gets its own specular on top: the bow's
 * outer edge and bore, a cylinder wrap on shoulder/collar/shank, a lit top edge
 * on the bit.
 */
export function KeyGlyph({
  lit = true,
  size = 26,
  className = '',
  hanging = false,
}: {
  lit?: boolean
  size?: number
  className?: string
  hanging?: boolean
}) {
  const uid = useId()
  const g = (n: string) => `${n}-${uid}`
  const body = lit ? `url(#${g('hot')})` : `url(#${g('cold')})`
  const k = keyGeometry(hanging ? 0.6 : 0)
  const shaft = (
    <>
      <path d={k.neck} />
      <rect x={k.collar.x} y={k.collar.y} width={k.collar.w} height={k.collar.h} rx="0.75" />
      <path d={k.shank} />
    </>
  )
  return (
    <svg
      width={size}
      height={size * 2.3}
      viewBox="0 0 20 46"
      className={className}
      aria-hidden
      style={{
        display: 'block',
        filter: lit
          ? 'drop-shadow(0 0 2px var(--color-key)) drop-shadow(0 0 7px color-mix(in oklab, var(--color-key) 55%, transparent))'
          : 'drop-shadow(0 1px 1px rgba(0,0,0,0.6))',
      }}
    >
      <defs>
        <linearGradient id={g('hot')} gradientUnits="userSpaceOnUse" x1="2" y1="1" x2="18" y2="43">
          <stop offset="0%" stopColor="var(--color-key-hot)" />
          <stop offset="30%" stopColor="var(--color-key)" />
          <stop offset="70%" stopColor="#d99b1e" />
          <stop offset="100%" stopColor="#8e5c0d" />
        </linearGradient>
        <linearGradient id={g('cold')} gradientUnits="userSpaceOnUse" x1="2" y1="1" x2="18" y2="43">
          <stop offset="0%" stopColor="#8a7147" />
          <stop offset="42%" stopColor="#544326" />
          <stop offset="78%" stopColor="#392a15" />
          <stop offset="100%" stopColor="#251a0c" />
        </linearGradient>
        {/* the wrap that turns the shoulder, collar and shank into rod stock:
            a dark left lip, the specular a third of the way across, the far
            side falling away. Same key light as the bow's outer edge. */}
        <linearGradient id={g('cyl')} gradientUnits="userSpaceOnUse" x1="6.7" y1="0" x2="13.3" y2="0">
          <stop offset="0%" stopColor="rgba(26,12,0,0.55)" />
          <stop offset="16%" stopColor="rgba(255,246,214,0.05)" />
          <stop offset="30%" stopColor="rgba(255,246,214,0.55)" />
          <stop offset="46%" stopColor="rgba(255,246,214,0.04)" />
          <stop offset="72%" stopColor="rgba(0,0,0,0.13)" />
          <stop offset="100%" stopColor="rgba(22,10,0,0.5)" />
        </linearGradient>
        {/* oxide blooms out of a pit rather than stopping at an outline */}
        <radialGradient id={g('ox')}>
          <stop offset="0%" stopColor="#9c5420" stopOpacity="0.62" />
          <stop offset="55%" stopColor="#7d4318" stopOpacity="0.34" />
          <stop offset="100%" stopColor="#5c3312" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={g('ox2')}>
          <stop offset="0%" stopColor="#6a5c40" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#6a5c40" stopOpacity="0" />
        </radialGradient>
        {/* the ring is thick enough to shade its own bore: deepest under the
            top-left wall, opening out toward the bottom right */}
        <radialGradient id={g('bore')} cx="0.36" cy="0.26" r="0.86">
          <stop offset="0%" stopColor="rgba(14,7,0,0.62)" />
          <stop offset="60%" stopColor="rgba(14,7,0,0.34)" />
          <stop offset="100%" stopColor="rgba(14,7,0,0.12)" />
        </radialGradient>
        {/* polished stock: a broad sheen where the key light lands on the bow,
            falling off inside the bow's own outline rather than glowing past it */}
        <radialGradient id={g('sheen')}>
          <stop offset="0%" stopColor={lit ? 'rgba(255,252,238,0.5)' : 'rgba(236,222,190,0.24)'} />
          <stop offset="52%" stopColor={lit ? 'rgba(255,246,216,0.18)' : 'rgba(226,210,176,0.07)'} />
          <stop offset="100%" stopColor="rgba(255,246,216,0)" />
        </radialGradient>
        <clipPath id={g('bowclip')}>
          <path d={k.bow} />
        </clipPath>
        <clipPath id={g('shaft')}>
          <path d={k.shank} />
          <path d={k.bit} />
        </clipPath>
      </defs>
      {/* the shadow the ring casts into its own bore */}
      <path d={k.bore} fill={`url(#${g('bore')})`} />
      {/* the solid: bow with a pierced bore, shoulder, collar, shank, bit */}
      <g fill={body}>
        <path d={k.bow} />
        {shaft}
        <path d={k.bit} />
      </g>
      {/* turn the shaft */}
      <g fill={`url(#${g('cyl')})`} opacity={lit ? 1 : 0.6}>
        {shaft}
      </g>
      {/* and polish the bow */}
      <g clipPath={`url(#${g('bowclip')})`}>
        <ellipse cx={k.sheen.cx} cy={k.sheen.cy} rx={k.sheen.rx} ry={k.sheen.ry} fill={`url(#${g('sheen')})`} />
      </g>
      {/* oxide down the lower shank and in the bit's cuts — a cold key has hung
          on that rail since the day it was won */}
      {!lit && (
        <g clipPath={`url(#${g('shaft')})`}>
          {k.rust.map(([cx, cyR, rx, ry], i) => (
            <ellipse key={i} cx={cx} cy={cyR} rx={rx} ry={ry} fill={`url(#${g(i === 1 ? 'ox2' : 'ox')})`} />
          ))}
        </g>
      )}
      {/* speculars: the bow's outer edge, the bore's inner edge in shadow where
          the ring's own wall blocks the key, the collar's top lip, the bit's
          top face */}
      <g fill="none" strokeLinecap="round">
        <path d={k.bowLit} stroke={lit ? 'rgba(255,250,230,0.62)' : 'rgba(228,210,172,0.3)'} strokeWidth="1.3" />
        <path d={k.bowShade} stroke="rgba(30,14,0,0.34)" strokeWidth="0.8" />
        <path d={k.boreShade} stroke="rgba(30,14,0,0.3)" strokeWidth="0.6" />
        <path d={k.boreLit} stroke={lit ? 'rgba(255,248,222,0.42)' : 'rgba(228,210,172,0.18)'} strokeWidth="0.55" />
        <path
          d={`M${k.collar.x + 0.7} ${k.collarLip.y}H${k.collar.x + k.collar.w - 0.7}`}
          stroke={lit ? 'rgba(255,248,222,0.6)' : 'rgba(228,210,172,0.24)'}
          strokeWidth="0.6"
        />
        <path
          d={`M${k.collar.x + 0.9} ${k.collar.y + k.collar.h - 0.3}H${k.collar.x + k.collar.w - 0.9}`}
          stroke="rgba(30,14,0,0.4)"
          strokeWidth="0.5"
        />
        <path
          d={`M12 ${k.bitTop + 0.35}H17.2`}
          stroke={lit ? 'rgba(255,248,222,0.5)' : 'rgba(228,210,172,0.2)'}
          strokeWidth="0.5"
        />
      </g>
    </svg>
  )
}

/* ---- Decorative details ------------------------------------------------- */

/** Decorative micro barcode for the board footer. */
export function Barcode({
  width = 46,
  height = 10,
  className = '',
}: {
  width?: number
  height?: number
  className?: string
}) {
  const bars = [2, 1, 3, 1, 1, 2, 1, 4, 1, 2, 2, 1, 3, 1, 2]
  let x = 0
  return (
    <svg width={width} height={height} viewBox="0 0 40 10" className={className} aria-hidden preserveAspectRatio="none">
      {bars.map((b, i) => {
        const el = <rect key={i} x={x} y="0" width={b * 0.8} height="10" fill="#2a1c0c" opacity="0.85" />
        x += b * 0.8 + 1.1
        return el
      })}
    </svg>
  )
}

/**
 * An engraved tick gauge. The lever's side rails carry these, dark at rest and
 * ignited amber on discharge.
 */
export function TickGauge({
  count = 22,
  vertical = true,
  lit = false,
  className = '',
  length = 14,
}: {
  count?: number
  vertical?: boolean
  lit?: boolean
  className?: string
  /** Long-tick length in px; short ticks are 60% of it. */
  length?: number
}) {
  const color = lit ? 'var(--color-lamp-hot)' : '#3a2c22'
  return (
    <div
      className={`flex ${vertical ? 'flex-col' : 'flex-row'} items-start justify-between ${className}`}
      aria-hidden
      style={{
        filter: lit ? 'drop-shadow(0 0 3px var(--color-lamp))' : undefined,
      }}
    >
      {Array.from({ length: count }, (_, i) => {
        const major = i % 5 === 0
        const l = major ? length : length * 0.6
        return (
          <span
            key={i}
            style={{
              display: 'block',
              background: color,
              opacity: major ? 1 : 0.7,
              width: vertical ? l : major ? 2 : 1.5,
              height: vertical ? (major ? 2 : 1.5) : l,
              boxShadow: lit ? undefined : '0 1px 0 rgba(255,244,220,0.16)',
            }}
          />
        )
      })}
    </div>
  )
}

/** Screen header: optional back arrow, centered display title. */
export function ScreenHeader({ title, back }: { title: string; back?: boolean }) {
  const navigate = useNavigate()
  return (
    <header className="relative flex h-14 items-center justify-center">
      {back && (
        <button
          aria-label="Back"
          onClick={() => navigate(-1)}
          className="absolute left-1 flex h-11 w-11 items-center justify-center"
        >
          <svg width="26" height="20" viewBox="0 0 26 20" aria-hidden>
            <path
              d="M10 1 L2 10 L10 19 M2.5 10 H25"
              fill="none"
              stroke="var(--color-text)"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
      <h1 className="display-title on-metal text-[26px] leading-none" style={{ letterSpacing: '0.12em' }}>
        {title}
      </h1>
    </header>
  )
}

/** Bracketed hairline rule under titles: ┌──────┐ shape from the reference. */
export function BracketRule({ className }: { className?: string }) {
  return (
    <div className={`relative mx-6 ${className ?? ''}`} aria-hidden>
      <div className="hairline" />
      <div className="absolute -top-1 left-0 h-2 w-px bg-[rgba(192,138,62,0.5)]" />
      <div className="absolute -top-1 right-0 h-2 w-px bg-[rgba(192,138,62,0.5)]" />
    </div>
  )
}
