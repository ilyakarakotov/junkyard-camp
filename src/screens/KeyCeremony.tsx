import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import TeamCrest from '../components/TeamCrest'
import { KeyGlyph, Screw } from '../components/chrome'
import { ArcBolt, usePrefersReducedMotion } from '../fx/Arc'
import { keyCount } from '../data/derive'
import { useStore } from '../data/store'

/**
 * The golden key ceremony: a dark brushed vault door, a brass escutcheon whose
 * blown-out keyhole throws god-rays across the steel, two brass handle posts
 * that the discharge jumps from, and the key rail at the foot where every key
 * this team owns hangs by its bow.
 *
 * **This screen is the one deliberate exception to the colour rule: no teal at
 * all.** Its arcs are gold-white and its light is warm gold. Breaking your own
 * rule exactly once is what makes the rare thing feel rare — which is why the
 * rule holds absolutely everywhere else.
 */

const GOLD = 'var(--color-key)'
/**
 * The arc's core filament. `--color-key-hot` (#FFF4D0) is the *lamp* core; a
 * discharge core is hotter than that — in the reference the filament samples
 * #FFFFF4, effectively white with a gold cast. It is still the gold exception:
 * the bloom under it is `--color-key`, and nothing here is teal.
 */
const ARC_CORE = '#fffdf4'

/* ---- Geometry, in CSS px against the 390×844 design frame ---------------- */

const DESIGN_W = 390
const H = 844

/*
 * Every vertical station below lands on a multiple of 8. The horizontal pair
 * EX0/EX1 and POST_LX/POST_RX are held symmetric about the 195px centre line
 * instead, because a symmetric axis beats a gridded one on the screen whose
 * whole composition is a mirror.
 */
const DOOR_TOP = 24
const DOOR_SIDE = 20
const SEAM_Y = 120

const SEAL = 128

/**
 * Escutcheon bounds. Width 106, centred on 195; height 200.
 *
 * The proportion is measured, not chosen: on `04-golden-key.jpg` the plate runs
 * x 399→691 and y 561→1111 of a 1080×1935 render, which at that render's 2.769
 * px-per-CSS-px is 105.5 × 198.6 CSS — 1 : 1.88. It was 106 × 184 (1 : 1.74)
 * and read as a squat cartouche.
 */
const EX0 = 142
const EX1 = 248
const EY0 = 248
const EY1 = 448

/**
 * The escutcheon silhouette, measured off `04-golden-key.jpg`: straight sides,
 * a horizontal shoulder ledge stepping inward, then a dome to the apex — top
 * and bottom. It is emphatically **not** a capsule; the square shoulders are
 * what make it read as a machined keyhole plate rather than a pill.
 */
const ESC_SHOULDER = 15 // shoulder ledge on the outermost band
/**
 * Arch heights. Both arches **bow outward** — the foot is a dome, not a bite.
 *
 * This was the screen's one blocking bug: the bottom arc carried `sweep-flag 0`
 * while travelling right→left, and a right-to-left arc with sweep 0 curves
 * *up*, so the plate's foot was scalloped concavely into itself. The bottom
 * screw then sat on bare door with no plate behind it and the keyhole slot was
 * chopped by a hard horizontal edge. Travelling right→left the clockwise
 * (sweep 1) arc is the one that passes under the bottom, which is why the flag
 * is 1 on both arches even though they run in opposite directions.
 *
 * Measured off the reference: the top arch rises 26px above its shoulder and
 * the bottom dome falls 24px below its own — near-symmetric, the head only
 * marginally the taller of the two.
 */
const ESC_ARCH = 26
const ESC_ARCH_BOT = 24
/** Concentric bands: engraved frame line pair, then the recessed field. */
const ESC_FRAME = 8
const ESC_FIELD = 20

function escPath(l: number, r: number, t: number, b: number): string {
  const w = r - l
  /*
   * Measured off the reference: every band keeps the same arch heights, and the
   * shoulder ledge shrinks about twice as fast as the band inset — 15px on the
   * outer plate, ~6px on the recessed field. So each inner arch is *wider*
   * relative to its band than the one outside it, which is what keeps the
   * profile reading as one turned piece. Scaling the shoulder with the width
   * instead gives nested onion domes.
   */
  const sh = Math.max(3, ESC_SHOULDER - ((EX1 - EX0 - w) / 2) * 0.42)
  const ah = ESC_ARCH
  const ab = ESC_ARCH_BOT
  const rx = w / 2 - sh
  const rr = 3 // the machined corner where the ledge meets the straight side
  const f = (n: number) => n.toFixed(1)
  return (
    `M${f(l)} ${f(t + ah + rr)} Q${f(l)} ${f(t + ah)} ${f(l + rr)} ${f(t + ah)}` +
    ` L${f(l + sh)} ${f(t + ah)} A${f(rx)} ${f(ah)} 0 0 1 ${f(r - sh)} ${f(t + ah)}` +
    ` L${f(r - rr)} ${f(t + ah)} Q${f(r)} ${f(t + ah)} ${f(r)} ${f(t + ah + rr)}` +
    ` L${f(r)} ${f(b - ab - rr)} Q${f(r)} ${f(b - ab)} ${f(r - rr)} ${f(b - ab)}` +
    // sweep 1, travelling right→left: the clockwise arc is the one that bows
    // DOWN past the shoulder line into a dome. Sweep 0 here bites upward.
    ` L${f(r - sh)} ${f(b - ab)} A${f(rx)} ${f(ab)} 0 0 1 ${f(l + sh)} ${f(b - ab)}` +
    ` L${f(l + rr)} ${f(b - ab)} Q${f(l)} ${f(b - ab)} ${f(l)} ${f(b - ab - rr)} Z`
  )
}

/** Keyhole: circle centre, then the flared slot beneath it. */
const KH_CY = 328
/**
 * Where the slot's light stops. It has to clear the recessed field's own bottom
 * arch — run it past the field's shoulder line and the hard bottom edge of the
 * light collides with the arch and reads as a broken cut rather than a hole.
 */
const SLOT_BOTTOM = 400
const KH_R = 31
/**
 * The slot **flares**. Measured on the reference the white pinches to ±14 CSS
 * just under the circle and opens to ±22 at its foot; the build had it running
 * the other way (±21 → ±17), which is a wedge, not a keyway — a key's bit is
 * wider than its shank and the plate is cut to clear it.
 */
const SLOT_TOP_W = 15
const SLOT_TOP_Y = KH_CY + 16
const SLOT_BOT_W = 22

/**
 * The keyhole as ONE outline — circle unioned with the flaring slot — so the
 * plate's cut edge can be stroked around the whole aperture. Drawing the two
 * primitives separately and stroking each leaves the join line painted across
 * the middle of the hole, which reads as a crack in the light.
 *
 * The slot's straight sides cross the circle somewhere between the slot's own
 * top and bottom; that crossing is found by bisection rather than by algebra
 * because the sides are not tangents and the closed form is uglier than the
 * loop.
 */
function keyholePath(cx: number, R: number, wt: number, yt: number, wb: number, yb: number): string {
  const xAt = (y: number) => wt + ((y - yt) * (wb - wt)) / (yb - yt)
  let lo = yt
  let hi = yb
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2
    const x = xAt(mid)
    // inside the circle → the junction is further down
    if (x * x + (mid - KH_CY) * (mid - KH_CY) < R * R) lo = mid
    else hi = mid
  }
  const yj = (lo + hi) / 2
  const xj = xAt(yj)
  const f = (n: number) => n.toFixed(1)
  return (
    `M${f(cx + xj)} ${f(yj)} L${f(cx + wb)} ${f(yb)} L${f(cx - wb)} ${f(yb)} L${f(cx - xj)} ${f(yj)}` +
    ` A${f(R)} ${f(R)} 0 1 1 ${f(cx + xj)} ${f(yj)} Z`
  )
}

/**
 * The bow: an elongated brass torus standing in the aperture.
 *
 * Re-measured on `04-golden-key.jpg` with a horizontal scanline: at the
 * keyhole's own height the bow's silhouette runs x 518→563 of 1080 — 45 render
 * px, i.e. **16.3 CSS** at that render's 2.769 px per CSS px — and the dark
 * bore inside it is a slit, not a window. The build had 21 CSS across with a
 * 10.8 CSS bore: over half the ring's width was hole, which is why it read as
 * a stroked paperclip with a pale slab down the middle rather than turned
 * brass. Walls of 6.6 CSS either side of a 3.6 CSS bore is the reference's own
 * proportion.
 */
const BOW_HW = 8.4
const BOW_BORE = 1.8
const BOW_T = KH_CY - 42
const BOW_B = KH_CY + 41
/** How far the bore is inset from the ring's own ends. */
const BOW_BORE_INSET = 10

/** A vertical capsule, drawn clockwise so nested rings alternate under evenodd. */
function capsule(cx: number, t: number, b: number, hw: number): string {
  const f = (n: number) => n.toFixed(1)
  return (
    `M${f(cx - hw)} ${f(t + hw)} A${f(hw)} ${f(hw)} 0 0 1 ${f(cx + hw)} ${f(t + hw)}` +
    ` L${f(cx + hw)} ${f(b - hw)} A${f(hw)} ${f(hw)} 0 0 1 ${f(cx - hw)} ${f(b - hw)} Z`
  )
}

/** Outer capsule + bore, one path, even-odd — a filled band with a real hole. */
function bowRing(cx: number, grow: number): string {
  const outer = capsule(cx, BOW_T - grow / 2, BOW_B + grow / 2, BOW_HW + grow / 2)
  return grow > 0 ? outer : `${outer} ${bowBore(cx)}`
}
function bowBore(cx: number): string {
  return capsule(cx, BOW_T + BOW_BORE_INSET, BOW_B - BOW_BORE_INSET, BOW_BORE)
}

/**
 * Handle posts. On the reference each is two rounded-square LUGS, screwed to
 * the door, joined by a narrower cylindrical bar standing proud of them — the
 * shaft measures 18 CSS against the lug's 26, and the shoulder where they meet
 * is what makes it read as an assembled handle rather than one extruded pill.
 * They straddle the middle 130px of the escutcheon's 200, symmetrically.
 */
const POST_W = 30
const POST_SHAFT = 19
const POST_Y0 = 280
const POST_H = 136
const POST_LX = 69
const POST_RX = 291

/** The arcs jump at the keyhole's neck, half-way up each post. */
const ARC_Y = 344

const RAIL_TOP = 704
const RAIL_H = 32
const KEY_SIZE = 56

/**
 * The title block and the award nameplate.
 *
 * The stations are the reference's own, read as a fraction of frame height so
 * they survive our taller viewport: `GOLDEN KEY` sets at 61%, the team name at
 * 71%, `KEY 02` at 77%, the rail at 81%. The block used to start at 496 and run
 * 25px tighter, which packed all three lines into one tenth of the frame — the
 * reference spreads them across two, and that spread is most of the screen's
 * cream.
 */
const TITLE_Y = 512
const ACTION_Y = 640
const ACTION_W = 208

/**
 * The ray fan: [centre angle°, half-width°, length]. Deliberately irregular —
 * an even fan reads as a starburst sticker rather than light through a hole.
 * Every wedge is drawn through a soft blur and a distance gradient: light
 * through a hole has no edge, and a hard-edged wedge reads as printed ink.
 */
const RAYS: [number, number, number][] = [
  [-176, 6, 250],
  [-158, 3.5, 175],
  [-141, 8.5, 305],
  [-127, 3, 155],
  [-112, 5, 215],
  [-97, 2.5, 145],
  [-80, 7, 270],
  [-64, 4, 190],
  [-47, 9, 315],
  [-31, 3.5, 170],
  [-15, 5.5, 235],
  [2, 4, 200],
  [18, 7.5, 290],
  [34, 3, 160],
  [49, 5, 215],
  [66, 8.5, 300],
  [82, 3.5, 170],
  [99, 5, 230],
  [117, 4, 185],
  [133, 7, 285],
  [150, 3.5, 165],
  [166, 6, 245],
]

/**
 * Sparks thrown off the newly struck key: `[ox, oy, dx, dy, delay ms, length]`
 * in the key wrapper's own px, where the glyph silhouette occupies roughly
 * x 12–47 (bow ring 12–44 at y 6–38, shank 24–32, bit teeth out to x 47).
 *
 * Every origin sits **outside** that silhouette — bow rim, collar, bit — and
 * every travel vector points away from it. A spark that starts on the shank
 * reads as a smear on the key rather than metal thrown off it.
 */
const SPARKS: [number, number, number, number, number, number][] = [
  [8, 16, -13, -15, 0, 7],
  [46, 13, 15, -18, 120, 8],
  [27, 1, 5, -19, 240, 6],
  [50, 58, 18, -13, 60, 7],
  [6, 66, -15, -8, 320, 6],
  [50, 88, 19, -5, 180, 6],
  [52, 104, 18, 9, 420, 7],
  [46, 118, 12, 17, 500, 6],
]

/**
 * The plume off the struck key: `[dx, size, rise, drift, duration, delay, peak,
 * tint]` in the key wrapper's own px.
 *
 * Two things were wrong with the previous plume and both are measurable.
 *
 * 1. **It never survived a capture.** Freezing every animation and toggling
 *    `.kc-smoke { display:none }` on the same frame, the plume's contribution
 *    was confined to y 1300–1400 device px — it never rose above the key's own
 *    bow. On the reference the plume clears the bow by ~120 ref px (≈52 CSS)
 *    and crosses the `KEY 02` line. The rise is now 62–104px.
 * 2. **The delays were positive**, so at mount every puff after the first sat
 *    at its base style — un-animated, untransformed — and the shot lands inside
 *    the first second. The delays are now **negative**, spread across the
 *    cycle, so all five puffs are mid-flight on the very first painted frame
 *    and the plume is whole at any instant, capture or not.
 *
 * The tint follows the reference: the smoke is lit from below by the key, so
 * the low puffs are orange and the high ones cool to a warm brown-grey. A
 * uniform grey plume reads as an overlay; a graded one reads as lit vapour.
 */
const PLUME: [number, number, number, number, number, number, number, string][] = [
  // two short, bright, orange licks off the bow itself — the lit root of the
  // plume, which is where the reference's peak (#fff8e3) comes from
  [-4, 18, -30, -6, 1500, -240, 0.78, '255,214,140'],
  [5, 15, -26, 7, 1700, -980, 0.7, '255,198,110'],
  // then the body: bigger, cooling, drifting apart as it climbs
  [-10, 30, -62, -13, 2600, -170, 0.72, '236,168,86'],
  [4, 27, -78, 10, 2900, -710, 0.66, '240,190,124'],
  [-5, 35, -96, -7, 3200, -1250, 0.58, '224,198,168'],
  [9, 29, -70, 15, 2750, -1790, 0.62, '238,180,104'],
  [-2, 38, -104, 5, 3400, -2330, 0.5, '210,190,166'],
]

type Phase = 'offer' | 'awarded'

/** A brass slotted screw drawn in SVG, so it shares the hardware's space. */
function BrassScrew({ cx, cy, r = 6, slot = 32 }: { cx: number; cy: number; r?: number; slot?: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r + 1.6} fill="rgba(16,9,3,0.85)" />
      <circle cx={cx} cy={cy} r={r} fill="url(#kc-screw)" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,240,206,0.4)" strokeWidth="0.7" />
      <g transform={`rotate(${slot} ${cx} ${cy})`}>
        <rect x={cx - r * 0.72} y={cy - r * 0.14} width={r * 1.44} height={r * 0.28} fill="rgba(22,13,5,0.85)" />
        <rect x={cx - r * 0.72} y={cy + r * 0.14} width={r * 1.44} height={r * 0.12} fill="rgba(255,240,206,0.3)" />
      </g>
    </g>
  )
}

/**
 * A door rivet: a bronze slotted head sunk in a dark washer seat.
 *
 * In `04-golden-key.jpg` these are the *quietest* hardware on the door —
 * muted bronze turned faces around `#5A473A` that recede into the slab. A
 * pale steel dome would be the brightest, coolest thing in frame and would
 * out-shout the gold seal, which is the only thing here allowed to be bright.
 */
function DoorBolt({ left, top, slot = 24 }: { left: number; top: number; slot?: number }) {
  return (
    <span
      aria-hidden
      style={{
        position: 'absolute',
        left,
        top,
        width: 10,
        height: 10,
        borderRadius: 9999,
        // key light from the top left, falling off to a dark lower-right lip
        background: 'radial-gradient(circle at 34% 30%, #9c8259 0%, #7a6342 34%, #55412c 68%, #2b2013 100%)',
        boxShadow:
          'inset 0 0 0 0.6px rgba(255,238,205,0.16), 0 0 0 1.4px rgba(14,8,3,0.85),' +
          '0 0 0 2.2px rgba(120,98,72,0.22), 1px 2px 2px rgba(0,0,0,0.55)',
      }}
    >
      {/* the engraved cross slot: this is a fastener, not a ball bearing */}
      <span
        style={{
          position: 'absolute',
          left: 1,
          right: 1,
          top: 4.3,
          height: 1.4,
          borderRadius: 1,
          background: 'linear-gradient(180deg, rgba(16,9,3,0.85), rgba(255,238,205,0.18))',
          transform: `rotate(${slot}deg)`,
        }}
      />
    </span>
  )
}

export default function KeyCeremony() {
  const { teamId } = useParams<{ teamId: string }>()
  const navigate = useNavigate()
  const { teams, activeDay, events, awardKey, isDirector, ready } = useStore()
  const reduced = usePrefersReducedMotion()

  const team = teams.find((t) => t.id === teamId)
  const [phase, setPhase] = useState<Phase>('offer')
  const [width, setWidth] = useState(DESIGN_W)

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
    if (!isDirector) navigate(`/team/${teamId}`, { replace: true })
  }, [ready, isDirector, navigate, teamId])

  if (!ready || !team) return <div className="min-h-dvh" />

  const onAward = async () => {
    await awardKey(activeDay.id, team.id, 'Golden key')
    setPhase('awarded')
    navigator.vibrate?.([18, 60, 40])
  }

  const live = phase === 'awarded'
  const dx = width / 2 - DESIGN_W / 2
  const X = (v: number) => v + dx
  const doorW = width - DOOR_SIDE * 2

  /**
   * Hanging keys: one per key this team already holds, plus the one being
   * struck. The last hook always carries the hot key — before the award it is
   * the offer made physical, after it the key that was just struck, cooling.
   */
  const slots = live ? Math.max(existing, 1) : existing + 1
  const keyX = (i: number) => ((i + 1) * width) / (slots + 1)

  const nameSize = team.name.length > 16 ? 32 : team.name.length > 12 ? 39 : 46
  // Just the name on the arc. Anything longer collides with itself at this
  // diameter, and a legend that runs into its own emblem reads as a misprint.
  const legend = team.name

  return (
    <div
      className="relative min-h-dvh overflow-hidden"
      style={{
        // The wall behind the door: near-black, warm, with the vault's own
        // pool of light bleeding around its edges.
        background:
          'radial-gradient(90% 50% at 50% 40%, rgba(150,96,24,0.16) 0%, transparent 70%),' +
          'linear-gradient(180deg, #191108 0%, #150f0a 60%, #100b07 100%)',
      }}
    >
      <style>{`
        @keyframes kc-spark {
          0% { opacity: 0; transform: translate(0, 0); }
          12% { opacity: 1; }
          100% { opacity: 0; transform: translate(var(--sx), var(--sy)); }
        }
        @keyframes kc-smoke {
          0% { opacity: 0; transform: translate(0, 4px) scale(0.44); }
          14% { opacity: var(--peak); }
          56% { opacity: calc(var(--peak) * 0.62); }
          100% { opacity: 0; transform: translate(var(--drift), var(--rise)) scale(1.75); }
        }
        @media (prefers-reduced-motion: reduce) {
          .kc-spark, .kc-smoke { animation: none; opacity: 0; }
        }
        /*
         * The UA focus ring is blue. There is no cool colour on this screen, so
         * the keyboard ring is struck in gold like everything else here.
         */
        .kc-focus:focus-visible {
          outline: 2px solid var(--color-key);
          outline-offset: 3px;
          border-radius: 4px;
        }
      `}</style>

      {/* ---- the vault door ------------------------------------------------ */}
      <div
        className="grain rust-creep absolute"
        data-part="vault-door"
        style={{
          left: DOOR_SIDE,
          right: DOOR_SIDE,
          top: DOOR_TOP,
          bottom: 0,
          background:
            // the door face darkens toward both side edges: it is a heavy slab
            // catching one light from the top left, not a flat fill
            // sampled: the reference door reads #35241B above the seam and
            // #422916 out at the sides mid-height — deeper than this was
            'linear-gradient(90deg, rgba(10,6,3,0.5) 0%, transparent 16%, transparent 82%, rgba(10,6,3,0.62) 100%),' +
            'linear-gradient(180deg, #3a2a1e 0%, #31241a 16%, #291f17 40%, #221a13 62%, #1a140f 82%, #14100c 100%)',
          boxShadow:
            'inset 1px 1px 0 rgba(255,240,216,0.26), inset 2px 2px 0 rgba(255,240,216,0.09),' +
            'inset -1px -1px 0 rgba(26,14,6,0.62), inset -2px -2px 0 rgba(26,14,6,0.28),' +
            '0 4px 18px rgba(0,0,0,0.72)',
        }}
      >
        {/*
         * No engraved inset panel line. The reference door has none — just its
         * own lit top-left chamfer, the seam, and the rivets — and any hairline
         * drawn here runs straight through the rivet heads and the back
         * control, which reads as an un-occluded construction guide.
         */}
      </div>

      {/* the horizontal seam: dark groove, lit chamfer on the proud lower panel */}
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{ left: DOOR_SIDE, width: doorW, top: SEAM_Y - 2, height: 2, background: 'rgba(0,0,0,0.8)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          left: DOOR_SIDE,
          width: doorW,
          top: SEAM_Y,
          height: 1.5,
          background: 'rgba(255,240,216,0.22)',
        }}
      />

      {/*
       * Bronze rivets, two per row: one row near the door head, a pair
       * straddling the seam 16px either side of it, and one row at the foot —
       * the reference's own spacing.
       */}
      {[40, 104, 136, 800].map((t, i) => (
        <div key={t} aria-hidden>
          <DoorBolt left={DOOR_SIDE + 13} top={t} slot={18 + i * 27} />
          <DoorBolt left={width - DOOR_SIDE - 23} top={t} slot={-34 + i * 19} />
        </div>
      ))}

      {/* ---- team seal, mounted proud of the seam -------------------------- */}
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          // tight falloff: the coin lights the plate it is bolted to, not the
          // whole upper door — the reference reads #35241B six rivets away
          left: width / 2 - 94,
          top: SEAM_Y - 94,
          width: 188,
          height: 188,
          background:
            'radial-gradient(circle at 50% 50%, rgba(255,224,150,0.46) 0%, rgba(255,192,52,0.18) 42%, transparent 74%)',
        }}
      />
      <div
        className="absolute"
        style={{
          left: width / 2 - SEAL / 2,
          top: SEAM_Y - SEAL / 2,
          width: SEAL,
          height: SEAL,
          filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.7))',
        }}
      >
        {/*
         * No `glow` here: its rim is struck in the team colour, and a red ring
         * on the one gold-only screen is exactly the tell we are avoiding. The
         * coin's light comes from its own interior instead.
         */}
        <TeamCrest teamId={team.id} size={SEAL} label={legend} gold />
        {/*
         * The ceremony's colour grade. This is the one screen with a single
         * light temperature — gold — and an untreated crest puts a saturated
         * team-red emitter and a red halo at the top of the frame, the loudest
         * thing on a door whose whole point is that nothing here is cool.
         *
         * `mix-blend-mode: color` takes hue and saturation from this layer and
         * luminosity from the crest beneath, so the emblem keeps every bit of
         * its modelling and bloom and only its hue is pulled to amber. It is
         * idempotent: if TeamCrest later grades its own gold emblem (see
         * shared_needs) this layer is a no-op rather than a double grade.
         */}
        <div
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            left: SEAL * 0.155,
            top: SEAL * 0.155,
            width: SEAL * 0.69,
            height: SEAL * 0.69,
            borderRadius: 9999,
            mixBlendMode: 'color',
            background: '#d9a855',
          }}
        />
        {/*
         * Light from the coin's own interior spilling up onto the inner bezel
         * step — the emitter has to lift the metal beside it or it is paint.
         */}
        <div
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            left: 0,
            top: 0,
            width: SEAL,
            height: SEAL,
            borderRadius: 9999,
            mixBlendMode: 'screen',
            /*
             * `closest-side` on purpose: with the default farthest-corner the
             * stop percentages are measured against the half-DIAGONAL, so every
             * ramp lands ~40% further out than written and the light misses the
             * band it was aimed at. The reference bezel samples #B88437; the
             * band itself sits between 73% and 91% of the coin's radius.
             */
            background:
              'radial-gradient(closest-side circle at 50% 50%, transparent 60%, rgba(255,236,186,0.5) 73%,' +
              'rgba(250,206,104,0.52) 86%, rgba(214,152,44,0.2) 96%, transparent 100%)',
          }}
        />
        {/*
         * The coin's FIELD, and this is the correction: the reference interior
         * is a **dark** brown-gold ground carrying a bright inner halo ring at
         * its rim, with the emblem legible as a bright shape against the dark.
         * The previous pass screened light across the whole interior, which
         * lifted the ground to the emblem's own luminance — measured 0.338
         * against 0.167, a 1.8:1 separation — and the crest went from a struck
         * emblem to a featureless pale dome.
         *
         * So: darken the field OUTSIDE the emblem's footprint (it starts at
         * ~52% of the interior's radius, where the struck emblem ends), and put
         * the light where the reference puts it — a halo arc just inside the
         * bezel, which is a real emitter lighting the bezel step above it.
         */}
        <div
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            left: SEAL * 0.211,
            top: SEAL * 0.211,
            width: SEAL * 0.578,
            height: SEAL * 0.578,
            borderRadius: 9999,
            background:
              'radial-gradient(closest-side circle at 44% 40%, transparent 56%, rgba(38,19,4,0.44) 70%,' +
              'rgba(30,15,3,0.52) 84%, rgba(44,22,4,0.3) 94%, transparent 100%)',
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            left: SEAL * 0.211,
            top: SEAL * 0.211,
            width: SEAL * 0.578,
            height: SEAL * 0.578,
            borderRadius: 9999,
            mixBlendMode: 'screen',
            background:
              'radial-gradient(closest-side circle at 50% 50%, transparent 82%, rgba(255,248,222,0.95) 93%,' +
              'rgba(255,208,92,0.62) 99%, transparent 100%)',
          }}
        />
      </div>

      {/* ---- door hardware: rays, escutcheon, posts, discharge ------------- */}
      <svg
        className="pointer-events-none absolute inset-x-0 top-0"
        width={width}
        height={H}
        aria-hidden
        style={{ overflow: 'hidden' }}
      >
        <defs>
          <clipPath id="kc-door">
            <rect x={DOOR_SIDE} y={DOOR_TOP} width={doorW} height={H - DOOR_TOP} rx={2} />
          </clipPath>
          {/* light from the keyhole: one emitter, distance falloff for every ray */}
          <radialGradient id="kc-ray" gradientUnits="userSpaceOnUse" cx={X(195)} cy={KH_CY + 20} r={250}>
            <stop offset="0%" stopColor="#fff6d8" stopOpacity="0.98" />
            <stop offset="14%" stopColor="#ffd884" stopOpacity="0.82" />
            <stop offset="40%" stopColor="#f2a53a" stopOpacity="0.44" />
            <stop offset="70%" stopColor="#c97418" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#c97418" stopOpacity="0" />
          </radialGradient>
          {/*
           * How far the keyhole's light actually reaches. Sampled either side:
           * on the reference the door 80 CSS to the right of the escutcheon at
           * the keyhole's own height reads **#CB984A** — a brightly lit slab —
           * while the same patch here read #744E1E. The previous pass tuned
           * this against a sample taken out at the door's edge, where both
           * agree, and so pulled the whole pool down; the falloff was too
           * steep, not too strong. Wider radius, more in the near field, and it
           * still dies to nothing before the door's own vignette.
           */}
          <radialGradient id="kc-wash" gradientUnits="userSpaceOnUse" cx={X(195)} cy={KH_CY + 24} r={380}>
            <stop offset="0%" stopColor="#ffd47a" stopOpacity="0.62" />
            <stop offset="18%" stopColor="#ffb43c" stopOpacity="0.4" />
            <stop offset="38%" stopColor="#f08c18" stopOpacity="0.21" />
            <stop offset="62%" stopColor="#c06c08" stopOpacity="0.08" />
            <stop offset="84%" stopColor="#9a5304" stopOpacity="0.02" />
            <stop offset="100%" stopColor="#8a5209" stopOpacity="0" />
          </radialGradient>
          {/*
           * The keyhole's own light landing on the plate it is cut into. This
           * is the motivation for every other bright thing on the screen, so it
           * has to be the strongest: on the reference the brass within 40px of
           * the aperture is blown to near-cream and the plate's corners fall
           * away to #7A5316. A timid core makes the escutcheon read as flat
           * paint with a lamp sticker on it.
           */}
          <radialGradient id="kc-core" gradientUnits="userSpaceOnUse" cx={X(195)} cy={KH_CY + 18} r={98}>
            <stop offset="0%" stopColor="#fffdf4" stopOpacity="1" />
            <stop offset="30%" stopColor="#fff6d8" stopOpacity="0.92" />
            <stop offset="55%" stopColor="#ffd873" stopOpacity="0.56" />
            <stop offset="80%" stopColor="#f2a01c" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#ffc63d" stopOpacity="0" />
          </radialGradient>
          {/* the softener: a ray of light has no edge */}
          <filter id="kc-soft" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="7" />
          </filter>
          <filter id="kc-seat" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.4" />
          </filter>

          {/*
           * Escutcheon brass, lit from the top left like everything else. The
           * values are sampled off 04-golden-key.jpg, not chosen: the plate
           * band there averages #AB732E and its recessed field #A57130 —
           * saturated bronze, not the cream these gradients used to render.
           * A pale escutcheon is what dragged the whole screen's median
           * luminance 5 points above the reference.
           */}
          <linearGradient id="kc-esc" x1="0.12" y1="0" x2="0.88" y2="1">
            <stop offset="0%" stopColor="#ffeec2" />
            <stop offset="16%" stopColor="#d9a648" />
            <stop offset="44%" stopColor="#a87a2c" />
            <stop offset="72%" stopColor="#7d571c" />
            <stop offset="100%" stopColor="#4a3110" />
          </linearGradient>
          <linearGradient id="kc-field" x1="0.15" y1="0" x2="0.85" y2="1">
            <stop offset="0%" stopColor="#c08c3c" />
            <stop offset="34%" stopColor="#946822" />
            <stop offset="74%" stopColor="#6a4818" />
            <stop offset="100%" stopColor="#412b0d" />
          </linearGradient>
          <linearGradient id="kc-post" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#6b4a1c" />
            <stop offset="14%" stopColor="#c49c53" />
            <stop offset="32%" stopColor="#f2d597" />
            <stop offset="58%" stopColor="#8a6527" />
            <stop offset="82%" stopColor="#553b13" />
            <stop offset="100%" stopColor="#2b1d08" />
          </linearGradient>
          {/* the proud bar: one broad cylinder gradient, no hairlines */}
          <linearGradient id="kc-shaft" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#4e3510" />
            <stop offset="14%" stopColor="#a8823c" />
            <stop offset="32%" stopColor="#f4dca2" />
            <stop offset="52%" stopColor="#c39a4c" />
            <stop offset="76%" stopColor="#79561f" />
            <stop offset="100%" stopColor="#33220a" />
          </linearGradient>
          {/* oxide creep: crevices and lower edges only, never a texture wash */}
          <linearGradient id="kc-patina" x1="0" y1="0" x2="0.3" y2="1">
            <stop offset="0%" stopColor="#6b3a16" stopOpacity="0" />
            <stop offset="55%" stopColor="#6b3a16" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#43200a" stopOpacity="0.6" />
          </linearGradient>
          {/*
           * The bow's bore. A hole through a brass band is darkest where the
           * band's own top-left lip overhangs it and warms toward the foot; a
           * flat wash made the ring read as a solid bar with no hole in it.
           */}
          <linearGradient id="kc-bore" x1="0.15" y1="0" x2="0.9" y2="0.5">
            <stop offset="0%" stopColor="#4a2c05" stopOpacity="0.82" />
            <stop offset="45%" stopColor="#9c6410" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#d99a2a" stopOpacity="0.42" />
          </linearGradient>
          {/* cast-brass mottle: the reference plate is turned metal, not paint */}
          <filter id="kc-mottle">
            <feTurbulence type="fractalNoise" baseFrequency="0.035 0.12" numOctaves="3" seed="23" stitchTiles="stitch" />
            <feColorMatrix values="0 0 0 0 0.42  0 0 0 0 0.30  0 0 0 0 0.12  0 0 0 0.5 0" />
            <feComposite operator="in" in2="SourceGraphic" />
          </filter>
          {/* where the current lands: a falloff, never a disc with an edge */}
          <radialGradient id="kc-land">
            <stop offset="0%" stopColor="#fff6da" stopOpacity="0.75" />
            <stop offset="24%" stopColor="#ffd571" stopOpacity="0.42" />
            <stop offset="58%" stopColor="#ffb327" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#ff9c10" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="kc-screw" cx="0.32" cy="0.28" r="0.9">
            <stop offset="0%" stopColor="#f6dfaa" />
            <stop offset="34%" stopColor="#c39a55" />
            <stop offset="72%" stopColor="#7b5a2c" />
            <stop offset="100%" stopColor="#33240f" />
          </radialGradient>
          {/*
           * The aperture's cut lip. The plate is 3mm of brass and the hole goes
           * through it, so the lip is lit where the key light reaches it and
           * dark where the plate's own thickness shadows it — top-left bright,
           * bottom-right gone. A flat pale stroke all round (what this was)
           * reads as a drawn outline and kills the sense of thickness.
           */}
          <linearGradient id="kc-lip" x1="0.1" y1="0" x2="0.9" y2="1">
            <stop offset="0%" stopColor="#fff3d0" />
            <stop offset="26%" stopColor="#e6b559" />
            <stop offset="62%" stopColor="#8e5f14" />
            <stop offset="100%" stopColor="#4a2f06" />
          </linearGradient>
          {/*
           * The blown field. It was nominally a falloff but was sized r=66 to
           * reach the bottom of the SLOT, which left the round part of the
           * aperture inside the first 47% of the ramp — flat near-white all the
           * way to the lip. Sampled across a radius, the build read #fefced at
           * 0.4r, #fefce7 at 0.8r and #feefc2 at 0.92r; the reference reads
           * #fefcc5, #f9e487, #e9b245. Two faults: 40 points too cool (r−b 17
           * against 57), and no falloff at all inside the hole.
           *
           * Fixed by making the gradient ELLIPTICAL — r=34 for the circle,
           * stretched 2.1× in y so it still reaches the slot's foot — so the
           * ramp is spent across the aperture rather than a fifth of the way
           * into it. Stops are placed against the sampled radii above (the
           * circle's own rim lands at 31/34 = 0.91 of the ramp).
           */}
          <radialGradient
            id="kc-blow"
            gradientUnits="userSpaceOnUse"
            cx={X(195)}
            cy={KH_CY + 4}
            r={34}
            gradientTransform={`translate(0 ${(-1.1 * (KH_CY + 4)).toFixed(1)}) scale(1 2.1)`}
          >
            <stop offset="0%" stopColor="#fffee2" />
            <stop offset="36%" stopColor="#fefcc5" />
            <stop offset="55%" stopColor="#fefbc0" />
            <stop offset="73%" stopColor="#f8e186" />
            <stop offset="84%" stopColor="#e9b245" />
            <stop offset="100%" stopColor="#c8871f" />
          </radialGradient>
          {/*
           * The bow is a turned brass torus, so it is modelled ACROSS its own
           * width — a cylinder seen side-on: dark at the left silhouette edge,
           * white-hot on the top-left shoulder, rolling to a dark underside on
           * the right. Horizontal, not diagonal: a diagonal ramp on a tall thin
           * shape gives a light top and a dark bottom, which is a bar, not a bow.
           */}
          <linearGradient id="kc-bow" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#7d5210" />
            <stop offset="10%" stopColor="#d8a844" />
            {/*
             * The crown of the cross-section stops at #f8dd93 (r−b 101), not at
             * near-white. Sampled, the reference bow's lit flank is #d9aa47 and
             * its peak #ffefa5 — saturated gold. A cream apex on the one gold
             * object of a gold-only screen is the thing that made it read chalk.
             */}
            <stop offset="24%" stopColor="#f8dd93" />
            <stop offset="42%" stopColor="#e8b859" />
            <stop offset="64%" stopColor="#b9812c" />
            <stop offset="84%" stopColor="#7d5310" />
            <stop offset="100%" stopColor="#4e3105" />
          </linearGradient>
          {/*
           * The bow's shoulder specular and its flank continuation. Both fade to
           * zero opacity at both ends so the highlight has no visible start or
           * stop — a capped stroke on a curved body is the tell that it was
           * drawn on rather than lit.
           */}
          <linearGradient
            id="kc-bowspec"
            gradientUnits="userSpaceOnUse"
            x1={X(195) - BOW_HW}
            y1={BOW_T + BOW_HW * 2}
            x2={X(195) + BOW_HW}
            y2={BOW_T - BOW_HW * 0.4}
          >
            <stop offset="0%" stopColor="#ffeec0" stopOpacity="0" />
            <stop offset="30%" stopColor="#fff2cc" stopOpacity="0.9" />
            <stop offset="62%" stopColor="#ffe7a8" stopOpacity="0.62" />
            <stop offset="100%" stopColor="#ffdf95" stopOpacity="0" />
          </linearGradient>
          <linearGradient
            id="kc-bowflank"
            gradientUnits="userSpaceOnUse"
            x1={X(195)}
            y1={BOW_T + BOW_HW}
            x2={X(195)}
            y2={KH_CY + 6}
          >
            <stop offset="0%" stopColor="#ffeec0" stopOpacity="0.72" />
            <stop offset="48%" stopColor="#f6d287" stopOpacity="0.34" />
            <stop offset="100%" stopColor="#e0b25e" stopOpacity="0" />
          </linearGradient>
          {/*
           * The 2px chamfer. Stroked with a gradient that decays away from the
           * plate's TOP-LEFT corner, so the specular has one origin instead of
           * alternating along the edges — the single loudest tell of a machine-
           * made panel versus a designed one.
           */}
          <linearGradient id="kc-chamfer" x1="0.08" y1="0" x2="0.8" y2="1">
            <stop offset="0%" stopColor="#fff6de" stopOpacity="0.95" />
            <stop offset="22%" stopColor="#ffe8b4" stopOpacity="0.52" />
            <stop offset="52%" stopColor="#c99a44" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#c99a44" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* the god-rays, clipped to the door so the wall stays black */}
        <g
          clipPath="url(#kc-door)"
          style={{ opacity: live ? 1 : 0.88, transition: reduced ? undefined : 'opacity 900ms ease-out' }}
        >
          <ellipse cx={X(195)} cy={KH_CY + 24} rx={370} ry={380} fill="url(#kc-wash)" />
          <g fill="url(#kc-ray)" filter="url(#kc-soft)">
            {RAYS.map(([a, half, len], i) => {
              const rad = (d: number) => (d * Math.PI) / 180
              // shorter than the wash: the spokes die out well before the glow
              const L = len * 0.94
              const p = (d: number, r: number) =>
                `${(X(195) + Math.cos(rad(d)) * r).toFixed(1)} ${(KH_CY + 20 + Math.sin(rad(d)) * r).toFixed(1)}`
              return (
                <path
                  key={i}
                  d={`M${X(195)} ${KH_CY + 20} L${p(a - half, L)} L${p(a, L * 1.06)} L${p(a + half, L)} Z`}
                />
              )
            })}
          </g>
        </g>

        {/* ---- handle posts: the two visible brass endpoints ---------------- */}
        {[POST_LX, POST_RX].map((px, i) => {
          const cx = X(px) + POST_W / 2
          const lugH = 30
          const yTop = POST_Y0 + lugH / 2
          const yBot = POST_Y0 + POST_H - lugH / 2
          /*
           * The shaft is modelled by ONE gradient across its width, not by two
           * hairline stripes. Stripes have ends, and their ends landed mid-form
           * where the shaft met the lugs, so each read as a pasted line rather
           * than the edge of a cylinder. `kc-shaft` runs dark → highlight at
           * 30% → dark, which is what a bar lit from the top left actually does
           * and has no terminals to stub out.
           */
          return (
            <g key={px}>
              {/* contact shadow, cast down-right by the one key light */}
              <rect
                x={X(px) + 2.5}
                y={POST_Y0 + 4}
                width={POST_W}
                height={POST_H}
                rx={8}
                fill="rgba(0,0,0,0.62)"
              />
              {/* the two mounting lugs: rounded squares, screwed to the door */}
              {[yTop, yBot].map((cy) => (
                <rect
                  key={cy}
                  x={X(px)}
                  y={cy - lugH / 2}
                  width={POST_W}
                  height={lugH}
                  rx={9}
                  fill="url(#kc-post)"
                />
              ))}
              {/* the shaft, standing proud between them */}
              <rect
                x={cx - POST_SHAFT / 2}
                y={yTop - 4}
                width={POST_SHAFT}
                height={yBot - yTop + 8}
                rx={POST_SHAFT / 2}
                fill="url(#kc-shaft)"
              />
              {/* the shoulder shadow where the proud bar meets each flat lug */}
              {[yTop + 5, yBot - 5].map((cy, k) => (
                <ellipse
                  key={cy}
                  cx={cx}
                  cy={cy}
                  rx={POST_SHAFT / 2 + 1.5}
                  ry={4}
                  fill="rgba(38,22,6,0.4)"
                  transform={`translate(1 ${k === 0 ? 1.5 : -1.5})`}
                />
              ))}
              {/* aged patina, lower third only, per the material rule */}
              <rect
                x={X(px)}
                y={POST_Y0 + POST_H * 0.55}
                width={POST_W}
                height={POST_H * 0.45}
                rx={9}
                fill="url(#kc-patina)"
                opacity="0.55"
              />
              <BrassScrew cx={cx} cy={yTop} r={6.2} slot={i === 0 ? 28 : -41} />
              <BrassScrew cx={cx} cy={yBot} r={6.2} slot={i === 0 ? -18 : 63} />
            </g>
          )
        })}

        {/* ---- escutcheon --------------------------------------------------- */}
        <g>
          {/* seat shadow, blurred: a hard-edged offset copy reads as a double line */}
          <path
            d={escPath(X(EX0) + 2, X(EX1) + 2, EY0 + 3, EY1 + 3)}
            fill="rgba(0,0,0,0.62)"
            filter="url(#kc-seat)"
          />
          {/* outer chamfered band */}
          <path
            d={escPath(X(EX0), X(EX1), EY0, EY1)}
            fill="url(#kc-esc)"
            stroke="rgba(24,14,5,0.5)"
            strokeWidth="1"
          />
          <path
            d={escPath(X(EX0), X(EX1), EY0, EY1)}
            filter="url(#kc-mottle)"
            opacity="0.5"
          />
          {/* the chamfer itself: bright at the top-left, gone by the bottom-right */}
          <path
            d={escPath(X(EX0) + 1.4, X(EX1) - 1.4, EY0 + 1.4, EY1 - 1.4)}
            fill="none"
            stroke="url(#kc-chamfer)"
            strokeWidth="2.2"
          />
          {/*
           * Engraved frame line. Struck with the same decaying gradient as the
           * chamfer rather than a flat cream: a constant-brightness line runs
           * all the way round the plate including its bottom-right, which draws
           * the silhouette as an outline and contradicts the one light
           * direction every other edge on this screen obeys.
           */}
          <path
            d={escPath(X(EX0) + ESC_FRAME, X(EX1) - ESC_FRAME, EY0 + ESC_FRAME, EY1 - ESC_FRAME)}
            fill="none"
            stroke="url(#kc-chamfer)"
            strokeWidth="1.6"
            opacity="0.8"
          />
          <path
            d={escPath(X(EX0) + ESC_FRAME + 2, X(EX1) - ESC_FRAME - 2, EY0 + ESC_FRAME + 2, EY1 - ESC_FRAME - 2)}
            fill="none"
            stroke="rgba(24,14,5,0.4)"
            strokeWidth="1"
          />
          {/* recessed field the keyhole is cut into */}
          <path
            d={escPath(X(EX0) + ESC_FIELD, X(EX1) - ESC_FIELD, EY0 + ESC_FIELD, EY1 - ESC_FIELD)}
            fill="url(#kc-field)"
            stroke="rgba(20,12,4,0.55)"
            strokeWidth="1"
          />

          {/* the keyhole's own light, pooling on the plate it is cut into */}
          <ellipse
            cx={X(195)}
            cy={KH_CY + 22}
            rx={96}
            ry={110}
            fill="url(#kc-core)"
            style={{ opacity: live ? 1 : 0.9, transition: reduced ? undefined : 'opacity 900ms ease-out' }}
          />

          {/*
           * Blown-out keyhole: one outline, circle unioned with the flaring
           * slot, drawn three deep — the plate's warm cut edge, a gold ramp,
           * and the blown field itself, which is a radial falloff rather than a
           * flat cream fill. Flat fills are why it was reading as a sticker.
           */}
          <g style={{ opacity: live ? 1 : 0.94, transition: reduced ? undefined : 'opacity 900ms ease-out' }}>
            {/* the plate's cut edge: lit lip top-left, dark under-cut bottom-right */}
            <path
              d={keyholePath(X(195), KH_R + 3.4, SLOT_TOP_W + 3.4, SLOT_TOP_Y - 2, SLOT_BOT_W + 3.4, SLOT_BOTTOM + 3)}
              fill="none"
              stroke="url(#kc-lip)"
              strokeWidth="3.4"
              strokeLinejoin="round"
            />
            <path
              d={keyholePath(X(195), KH_R + 1.4, SLOT_TOP_W + 1.4, SLOT_TOP_Y - 1, SLOT_BOT_W + 1.4, SLOT_BOTTOM + 1)}
              fill="none"
              stroke="rgba(58,32,4,0.55)"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            {/* gold ramp, then the blown field */}
            <path
              d={keyholePath(X(195), KH_R, SLOT_TOP_W, SLOT_TOP_Y, SLOT_BOT_W, SLOT_BOTTOM)}
              fill="#ffd882"
            />
            <path
              d={keyholePath(X(195), KH_R - 2.6, SLOT_TOP_W - 2.2, SLOT_TOP_Y + 1, SLOT_BOT_W - 2.4, SLOT_BOTTOM - 2)}
              fill="url(#kc-blow)"
            />
          </g>

          {/*
           * The emitter overwhelms its own rim: a soft blown highlight laid over
           * the brass surround, so the light reads as coming THROUGH the plate
           * rather than being painted inside a socket.
           *
           * It has to paint BEHIND the bow. Over it, this 20% white wash was
           * desaturating the one object at the centre of a gold-only screen:
           * sampled across the bow's lit flank the build read #f8e7bf (r−b 57)
           * against the reference's #d9aa47 (r−b 146) — the bow was chalk where
           * the reference is gold. Light spilling round a body does not bleach
           * the body.
           */}
          <ellipse
            cx={X(195)}
            cy={KH_CY + 14}
            rx={22}
            ry={38}
            fill="#ffeaba"
            filter="url(#kc-soft)"
            style={{ opacity: live ? 0.2 : 0.15, transition: reduced ? undefined : 'opacity 900ms ease-out' }}
          />

          {/*
           * The bow. In the reference this is not a concentric ring but a
           * vertically elongated brass **torus** — a filled band about 21 CSS
           * across with a visible bore — standing in the aperture and casting
           * onto the lit field behind it. It was drawn as a stroked capsule,
           * which has no cross-section: a cream line down its left and a dark
           * line down its right with a hollow white middle, i.e. a paperclip.
           * A filled ring with a gradient ACROSS its width is what gives it a
           * lit top-left shoulder rolling into a dark underside.
           */}
          <path
            d={bowRing(X(195), 4)}
            fill="rgba(72,40,4,0.42)"
            filter="url(#kc-seat)"
            transform="translate(2.5 3.5)"
          />
          <path d={bowRing(X(195), 0)} fill="url(#kc-bow)" fillRule="evenodd" />
          {/* the bore: a hole through the ring, dimmed by the ring's own body */}
          <path d={bowBore(X(195))} fill="url(#kc-bore)" />
          {/*
           * The ring's top-left shoulder catching the key light.
           *
           * This was a 2px ROUND-CAPPED stroke on an r=8.4 arc whose centre was
           * not the bow's cap centre — measured, its endpoints sat 11.3 from
           * that centre against the silhouette's own 8.4 — so it floated clear
           * of the metal and its two caps read as a stray white hook hanging
           * off the bow. It now runs on the true silhouette (r = BOW_HW − 1.5,
           * centred on the cap), is butt-capped, and is stroked with a gradient
           * that reaches zero at both ends, so it dies into the surface instead
           * of stopping on it.
           */}
          <path
            d={(() => {
              const cx = X(195)
              const cy = BOW_T + BOW_HW
              const r = BOW_HW - 1.5
              const at = (deg: number) => {
                const a = (deg * Math.PI) / 180
                return `${(cx + Math.cos(a) * r).toFixed(2)} ${(cy + Math.sin(a) * r).toFixed(2)}`
              }
              // 158° (low on the left flank) up over the crown to 292°
              return `M${at(158)} A${r} ${r} 0 0 1 ${at(292)}`
            })()}
            fill="none"
            stroke="url(#kc-bowspec)"
            strokeWidth="2.2"
            strokeLinecap="butt"
          />
          {/* the flank highlight continues down the left of the shank */}
          <path
            d={`M${(X(195) - BOW_HW + 1.6).toFixed(2)} ${BOW_T + BOW_HW} L${(X(195) - BOW_HW + 1.6).toFixed(2)} ${KH_CY + 6}`}
            fill="none"
            stroke="url(#kc-bowflank)"
            strokeWidth="2"
            strokeLinecap="butt"
          />

          {/* the two screws sit in the arch centres, above the recessed field */}
          <BrassScrew cx={X(195)} cy={EY0 + 24} r={6.4} slot={44} />
          <BrassScrew cx={X(195)} cy={EY1 - 22} r={6.4} slot={-33} />
        </g>

        {/*
         * ---- the discharge: post inner face → escutcheon edge -------------
         *
         * `weight` is the whole finding here. At 0.55 the white core filament
         * was 1.1 CSS px — at DPR 2 that antialiases into the gold glow under
         * it and the bolt reads as a drawn amber squiggle. The reference bolt
         * is unmistakably a **white lightning fork with the gold bloom sitting
         * under it**, so the core has to survive resampling: at weight 1 it is
         * 2 CSS px of near-white over a 5.4px gold body and a 10/18px bloom.
         */}
        {/*
         * The landing wash comes FIRST, under the filament: on the reference
         * the brass around the strike point is lifted by a soft directional
         * bloom with no edge anywhere. The build had two flat-opacity discs
         * whose circular rims were plainly visible against the door and across
         * the post face — a decal, not light. `kc-land` fades to zero.
         */}
        {[X(POST_LX + POST_W), X(EX0) + 2, X(EX1) - 2, X(POST_RX)].map((px) => (
          <ellipse
            key={px}
            cx={px}
            cy={ARC_Y}
            rx={22}
            ry={26}
            fill="url(#kc-land)"
            opacity={live ? 1 : 0.78}
          />
        ))}

        {/*
         * Two bolts a side, rooted on one point of the post and landing on the
         * escutcheon 14px apart, so the discharge FORKS the way the reference's
         * does instead of running as a single squiggle. Measured off
         * `04-golden-key.jpg` the fan occupies ~43 CSS of vertical spread over
         * a 36 CSS gap; a single bolt at chaos 1.3 covered 20.
         *
         * `weight` is the other half. At 1 the white core filament is 2 CSS px,
         * which at DPR 2 is still thin enough to sit inside the gold body's
         * antialiasing; the reference filament is unambiguously white across
         * its whole width. 1.7 puts the core at 3.4px over a 9px gold body.
         */}
        {[
          { root: X(POST_LX + POST_W), tip: X(EX0) + 2, seed: 7 },
          { root: X(POST_RX), tip: X(EX1) - 2, seed: 41 },
        ].map(({ root, tip, seed }) => (
          <g key={seed}>
            <ArcBolt
              x1={root}
              y1={ARC_Y}
              x2={tip}
              y2={ARC_Y}
              seed={seed}
              color={GOLD}
              coreColor={ARC_CORE}
              intensity={1}
              chaos={live ? 1.7 : 1.5}
              weight={live ? 1.7 : 1.45}
              strands={2}
              active={!reduced || live}
            />
            <ArcBolt
              x1={root}
              y1={ARC_Y}
              x2={tip}
              y2={ARC_Y + 15}
              seed={seed + 313}
              color={GOLD}
              coreColor={ARC_CORE}
              intensity={0.9}
              chaos={live ? 1.9 : 1.6}
              weight={live ? 0.95 : 0.8}
              strands={1}
              active={!reduced || live}
            />
            <ArcBolt
              x1={root}
              y1={ARC_Y}
              x2={tip}
              y2={ARC_Y - 13}
              seed={seed + 971}
              color={GOLD}
              coreColor={ARC_CORE}
              intensity={0.85}
              chaos={live ? 1.9 : 1.6}
              weight={live ? 0.85 : 0.7}
              strands={1}
              active={!reduced || live}
            />
          </g>
        ))}
        {/*
         * No bead on the terminals. The arc rule wants two VISIBLE BRASS
         * CONTACT POSTS and it has them — the handle posts are the endpoints,
         * 30 × 136 of screwed brass either side. A `ContactPost` dome stuck on
         * top of one is a second, redundant post read as a push-pin; the
         * reference has the filament strike the post's own edge and the brass
         * around it take the wash.
         */}
      </svg>

      {/* ---- title block --------------------------------------------------- */}
      <div
        className="pointer-events-none absolute text-center"
        style={{ left: 0, width, top: TITLE_Y, textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}
      >
        <div
          className="font-display font-semibold uppercase"
          style={{
            fontSize: 61,
            lineHeight: 0.92,
            letterSpacing: '0.01em',
            color: 'var(--color-text)',
          }}
        >
          Golden Key
        </div>
        <div
          className="font-display font-semibold uppercase"
          style={{
            fontSize: nameSize,
            lineHeight: 1.02,
            letterSpacing: '0.01em',
            color: 'var(--color-text)',
            whiteSpace: 'nowrap',
          }}
        >
          {team.name}
        </div>
        <div
          className="font-mono uppercase"
          style={{
            marginTop: 8,
            fontSize: 16,
            letterSpacing: '0.22em',
            color: 'var(--color-text)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {`Key ${String(number).padStart(2, '0')}`}
        </div>
      </div>

      {/* ---- key rail: full bleed, keys hanging by their bows -------------- */}
      <div
        className="brass-band grain rust-creep absolute"
        data-part="key-rail"
        data-keys={live ? existing : existing}
        style={{
          left: 0,
          right: 0,
          top: RAIL_TOP,
          height: RAIL_H,
          boxShadow:
            'inset 0 1px 0 rgba(255,244,214,0.45), inset 0 -1px 0 rgba(40,26,12,0.8), 0 3px 8px rgba(0,0,0,0.65)',
        }}
      >
        {/* raised end blocks with a screw each */}
        <div
          aria-hidden
          className="absolute inset-y-0 left-0"
          style={{ width: 26, background: 'linear-gradient(180deg, rgba(255,244,214,0.2), rgba(0,0,0,0.28))' }}
        />
        <div
          aria-hidden
          className="absolute inset-y-0 right-0"
          style={{ width: 26, background: 'linear-gradient(180deg, rgba(255,244,214,0.2), rgba(0,0,0,0.28))' }}
        />
        {/*
         * `absolute` is not decoration here: .grain > * sets position:relative,
         * which beats .screw's own position, and a relatively-positioned screw
         * collapses to a 0×0 inline box that paints as a dark square.
         */}
        {/*
         * The bar is aged brass, not nickel — and not the pale beige it was
         * rendering. The reference rail averages #81592D with a #FFFED7 peak
         * along its top edge: a dark saturated bronze band carrying one crisp
         * specular. So the wash darkens and saturates the body while leaving
         * the top 3px nearly untouched for the inset highlight to sit in.
         */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(112,58,14,0.34) 0%, rgba(255,238,186,0.26) 4%,' +
              'rgba(96,50,12,0.46) 12%, rgba(92,46,10,0.5) 60%, rgba(66,32,6,0.58) 100%)',
          }}
        />
        {/*
         * Oxide streaks along the bar's lower edge. The reference rail carries
         * them; without any the bar is a clean extrusion and, at #AD8758
         * against the reference's #76522A, was the brightest large object in
         * the lower third of the frame — outshouting the newly struck key,
         * which is the only thing down here allowed to be bright.
         */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0"
          style={{
            height: '58%',
            background:
              'radial-gradient(28px 7px at 22% 100%, rgba(122,52,16,0.5), transparent 70%),' +
              'radial-gradient(38px 6px at 61% 100%, rgba(108,44,12,0.45), transparent 70%),' +
              'radial-gradient(22px 5px at 84% 96%, rgba(126,56,18,0.4), transparent 70%)',
          }}
        />
        <Screw className="absolute left-[7px] top-1/2 -translate-y-1/2" slot={26} size={11} />
        <Screw className="absolute right-[7px] top-1/2 -translate-y-1/2" slot={-47} size={11} />
        {/*
         * Domed brass rivets, not flat dots: a radial with the glint at the
         * top left and a dark seat under the lower-right lip, so they take the
         * same key light as every other fastener on the door.
         */}
        {[0.25, 0.5, 0.75].map((f) => (
          <span
            key={f}
            aria-hidden
            className="absolute top-1/2 -translate-y-1/2"
            style={{
              left: `calc(${f * 100}% - 4px)`,
              width: 8,
              height: 8,
              borderRadius: 9999,
              background: 'radial-gradient(circle at 33% 29%, #f4dba4 0%, #c39a52 32%, #7d5721 68%, #2f1f0a 100%)',
              boxShadow: 'inset 0 0 0 0.5px rgba(255,240,206,0.2), 0 1px 2px rgba(0,0,0,0.6)',
            }}
          />
        ))}
      </div>

      {Array.from({ length: slots }, (_, i) => {
        // The last hook is always the live one: the key on the anvil.
        const hot = i === slots - 1
        // Once struck, the hot layer cools off the cold key beneath over 2s.
        const cool = hot && live ? ' key-cool' : ''
        const cx = keyX(i)
        return (
          <div
            key={i}
            className="pointer-events-none absolute"
            data-part="hanging-key"
            data-lit={hot ? 'true' : 'false'}
            style={{
              // The bow straddles the bar's top edge: a key hangs ON the rail.
              left: cx - KEY_SIZE / 2,
              top: RAIL_TOP - 18,
              width: KEY_SIZE,
              /*
               * The plume rises past the award nameplate, so it has to paint
               * ABOVE it: smoke occluded by a plate nearer the camera than the
               * smoke's own source reads as a smudge on the door. The wrapper
               * is pointer-events-none so raising it never eats the button.
               */
              zIndex: hot ? 3 : undefined,
            }}
          >
            {/* every key hangs cold; the new one has a hot layer that cools off it */}
            <KeyGlyph lit={false} size={KEY_SIZE} hanging />
            {hot && (
              <>
                <div
                  aria-hidden
                  className={`pointer-events-none absolute${cool}`}
                  style={{
                    left: -KEY_SIZE * 0.7,
                    top: -KEY_SIZE * 0.3,
                    width: KEY_SIZE * 2.4,
                    height: KEY_SIZE * 2.9,
                    background:
                      'radial-gradient(closest-side, rgba(255,246,214,0.42) 0%, rgba(255,198,61,0.20) 34%, rgba(255,160,30,0.07) 58%, transparent 78%)',
                  }}
                />
                <div className={`pointer-events-none absolute inset-0${cool}`}>
                  <KeyGlyph lit size={KEY_SIZE} hanging />
                </div>
                {!reduced && (
                  <>
                    {/*
                     * The plume. Five puffs on negative delays (see PLUME):
                     * the stagger is what makes it read as one continuous
                     * column of vapour rather than a repeating blob, and the
                     * negative sign is what makes it exist in a screenshot.
                     * `opacity: 0` is the base so that if a puff ever is not
                     * animating — reduced motion, or the frame before the
                     * animation is attached — it shows nothing at all rather
                     * than a hard disc at full strength.
                     */}
                    {PLUME.map(([dx, size, rise, drift, dur, delay, peak, tint], s) => (
                      <span
                        key={s}
                        aria-hidden
                        className="kc-smoke pointer-events-none absolute"
                        style={{
                          left: KEY_SIZE / 2 - size / 2 + dx,
                          top: 6 - s * 2,
                          width: size,
                          // Taller than wide, and an ELLIPSE rather than a
                          // circle: a round puff reads as a ball of fog, a
                          // vertical one as vapour still moving upward.
                          height: size * 1.7,
                          borderRadius: 9999,
                          opacity: 0,
                          background:
                            `radial-gradient(ellipse at 50% 62%, rgba(${tint},0.74) 0%,` +
                            ` rgba(${tint},0.34) 42%, rgba(${tint},0) 74%)`,
                          ['--rise' as string]: `${rise}px`,
                          ['--drift' as string]: `${drift}px`,
                          ['--peak' as string]: `${peak}`,
                          animation: `kc-smoke ${dur}ms ease-out ${delay}ms infinite`,
                        }}
                      />
                    ))}
                    {SPARKS.map(([ox, oy, sx, sy, delay, len], s) => (
                      <span
                        key={s}
                        aria-hidden
                        className="kc-spark pointer-events-none absolute"
                        style={{
                          left: ox,
                          top: oy,
                          width: 2,
                          height: len,
                          borderRadius: 9999,
                          background: 'linear-gradient(180deg, #fffaea, #ffb43c 46%, rgba(255,120,12,0))',
                          ['--sx' as string]: `${sx}px`,
                          ['--sy' as string]: `${sy}px`,
                          animation: `kc-spark ${900 + s * 90}ms ease-out ${delay}ms infinite`,
                        }}
                      />
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        )
      })}

      {/* ---- controls: hardware only --------------------------------------- */}
      <button
        onClick={() => navigate(`/team/${team.id}`)}
        aria-label={`Back to ${team.name}`}
        className="kc-focus absolute flex items-center justify-center"
        style={{ left: DOOR_SIDE + 32, top: SEAM_Y - 88, width: 56, height: 44 }}
      >
        {/*
         * The same nameplate the award control is: bevel, contact shadow, one
         * slotted screw, engraved arrow. Two controls on one door have to be
         * built by the same shop — a flat unbevelled chip beside a screwed
         * plate reads as two different machines.
         */}
        <span
          className="brass-band grain flex items-center justify-center"
          style={{
            width: 54,
            height: 28,
            borderRadius: 3,
            paddingLeft: 10,
            boxShadow:
              'inset 0 1px 0 rgba(255,244,214,0.5), inset 0 -1px 0 rgba(40,26,12,0.8),' +
              'inset -1px 0 0 rgba(40,26,12,0.5), 0 2px 6px rgba(0,0,0,0.6)',
          }}
        >
          {/* the plate sits in shadow: nothing up here may outshine the seal */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              borderRadius: 3,
              background: 'linear-gradient(160deg, rgba(28,17,6,0.1) 0%, rgba(24,14,5,0.3) 100%)',
            }}
          />
          <Screw className="absolute left-[6px] top-1/2 -translate-y-1/2" slot={37} size={9} />
          <svg width="20" height="12" viewBox="0 0 20 12" aria-hidden style={{ position: 'relative' }}>
            <path
              d="M7 1.5 L2 6 L7 10.5 M2.6 6 H17"
              fill="none"
              stroke="#3a2812"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M7 2.6 L3.1 6 L7 9.4 M3.6 6.9 H17"
              fill="none"
              stroke="rgba(255,240,206,0.4)"
              strokeWidth="1"
              strokeLinecap="round"
            />
          </svg>
        </span>
      </button>

      {/*
       * The action is an engraved brass nameplate, screwed to the door below the
       * title block — never over the escutcheon, which is the focal object and
       * must be seen whole. No web CTA: everything operable here is hardware.
       */}
      <button
        onClick={live ? () => navigate(`/team/${team.id}`) : onAward}
        aria-label={
          live
            ? `Golden key ${number} awarded to ${team.name}. Return to team sheet`
            : `Award golden key ${number} to ${team.name}`
        }
        data-part="award-control"
        data-phase={phase}
        className="kc-focus absolute"
        style={{ left: width / 2 - ACTION_W / 2, top: ACTION_Y, width: ACTION_W, height: 44 }}
      >
        <span
          className="brass-band grain absolute block"
          style={{
            left: 0,
            right: 0,
            top: 4,
            height: 36,
            borderRadius: 3,
            boxShadow:
              'inset 0 1px 0 rgba(255,244,214,0.55), inset 0 -1px 0 rgba(40,26,12,0.8), 0 3px 7px rgba(0,0,0,0.6)',
          }}
        >
          {/*
           * Held back so the escutcheon stays the brightest hardware on the
           * door. A cream nameplate below the title outshone the focal object,
           * and hierarchy on this screen is the whole point of it.
           */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              borderRadius: 3,
              background: 'linear-gradient(160deg, rgba(30,18,6,0.06) 0%, rgba(26,15,5,0.3) 100%)',
            }}
          />
          <Screw className="absolute left-[9px] top-1/2 -translate-y-1/2" slot={22} size={9} />
          <Screw className="absolute right-[9px] top-1/2 -translate-y-1/2" slot={-51} size={9} />
          <span
            className="engraved font-display absolute inset-0 flex items-center justify-center font-semibold uppercase"
            style={{ fontSize: 12, letterSpacing: '0.24em', whiteSpace: 'nowrap', paddingLeft: '0.24em' }}
          >
            {live ? 'Key struck' : 'Turn to award'}
          </span>
        </span>
      </button>
    </div>
  )
}
