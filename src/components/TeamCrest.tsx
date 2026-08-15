import { useId } from 'react'
import type { TeamId } from '../data/types'

export const teamColor = (id: TeamId) => `var(--color-team-${id})`

/** Team hexes mirror theme.css tokens (validated by scripts/validate-tokens.mjs). */
export const TEAM_HEX: Record<TeamId, string> = {
  warriors: '#ff5fb8',
  precious: '#b14dff',
  gems: '#3d9bff',
  pearls: '#96f5b4',
  knights: '#ff4438',
  innocent: '#ffd84d',
  forged: '#78d62e',
  rustco: '#ff9440',
}

function shade(hex: string, f: number): string {
  // f > 0 lightens toward white, f < 0 darkens toward black.
  const n = parseInt(hex.slice(1), 16)
  const ch = (shift: number) => {
    const c = (n >> shift) & 0xff
    const v = f >= 0 ? c + (255 - c) * f : c * (1 + f)
    return Math.round(Math.min(255, Math.max(0, v)))
  }
  return `rgb(${ch(16)} ${ch(8)} ${ch(0)})`
}

/* ------------------------------------------------------------------ *
 * Emblem primitives.
 *
 * Every emblem is ONE path string filled `evenodd` in a 48x48 box. Under
 * evenodd two overlapping sub-shapes CANCEL — that is what once turned the
 * RUST CO. gear into a fan of loose teeth — so every helper below produces
 * shapes that either sit disjoint from their neighbours or nest inside them
 * deliberately, to cut a hole.
 * ------------------------------------------------------------------ */

/** Circle as a path, so emblems stay one flat `d` string. */
const circle = (cx: number, cy: number, r: number) =>
  `M${cx} ${cy - r} A${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`

/**
 * A gear: root disc, a ring of teeth standing on the root circle, and a bore
 * nested inside so it reads through. Teeth start exactly AT the root radius —
 * a tooth that started inside it would cancel against the disc and notch its
 * own base.
 */
function gear(cx: number, cy: number, n: number, rRoot: number, rTip: number, bore: number): string {
  const halfIn = (Math.PI / n) * 0.5
  const halfOut = (Math.PI / n) * 0.31
  const teeth = Array.from({ length: n }, (_, i) => {
    const a = (i * 2 * Math.PI) / n - Math.PI / 2
    const p = (r: number, off: number) =>
      `${(cx + Math.cos(a + off) * r).toFixed(2)} ${(cy + Math.sin(a + off) * r).toFixed(2)}`
    return `M${p(rRoot, -halfIn)} L${p(rTip, -halfOut)} L${p(rTip, halfOut)} L${p(rRoot, halfIn)} Z`
  }).join(' ')
  return `${circle(cx, cy, rRoot)} ${teeth} ${circle(cx, cy, bore)}`
}

/**
 * A scallop-shell fan: a sector whose outer edge is a run of convex lobes,
 * apex at the hinge. `spanDeg` opens the fan; the notches between lobes are
 * what stops it reading as a plain half-disc.
 */
function scallop(
  cx: number,
  cy: number,
  r: number,
  notchF: number,
  lobes: number,
  spanDeg: number,
  ky: number,
): string {
  const half = (spanDeg * Math.PI) / 360
  const step = (2 * half) / lobes
  const rn = r * notchF
  // A quadratic's midpoint sits at (P0 + 2C + P1)/4, so a control this far out
  // puts each lobe's crest exactly on r while the boundaries stay at rn — deep
  // notches, which is what stops the fan reading as a plain half-disc.
  const rc = 2 * r - rn * Math.cos(step / 2)
  const at = (phi: number, rr: number) =>
    `${(cx + Math.sin(phi) * rr).toFixed(2)} ${(cy - Math.cos(phi) * rr * ky).toFixed(2)}`
  let d = `M${cx} ${cy} L${at(-half, rn)}`
  for (let i = 1; i <= lobes; i++) {
    const a0 = -half + (i - 1) * step
    d += ` Q${at(a0 + step / 2, rc)} ${at(a0 + step, rn)}`
  }
  return `${d} Z`
}

/**
 * The notches carried inward as engraved rib lines, stopping short of the
 * pearl — on the reference every rib converges on the pearl and dies there.
 * Each rib's inner end is walked outward until it clears `clearR` around
 * `(px, py)`, because a rib that ran into the pearl would cancel a bite out
 * of it under evenodd.
 */
function shellRibs(
  cx: number,
  cy: number,
  ky: number,
  lobes: number,
  spanDeg: number,
  rIn: number,
  rOut: number,
  w: number,
  px: number,
  py: number,
  clearR: number,
): string {
  const half = (spanDeg * Math.PI) / 360
  const step = (2 * half) / lobes
  const at = (phi: number, rr: number, off: number) => [
    cx + Math.sin(phi + off) * rr,
    cy - Math.cos(phi + off) * rr * ky,
  ]
  const out: string[] = []
  for (let i = 1; i < lobes; i++) {
    const phi = -half + i * step
    let r0 = rIn
    for (let k = 0; k < 40 && r0 < rOut - 1; k++) {
      const [x, y] = at(phi, r0, 0)
      if (Math.hypot(x - px, y - py) >= clearR) break
      r0 += 0.25
    }
    const p = (rr: number, s: number) => {
      const [x, y] = at(phi, rr, (s * w) / rr)
      return `${x.toFixed(2)} ${y.toFixed(2)}`
    }
    out.push(`M${p(r0, -1)} L${p(rOut, -1)} L${p(rOut, 1)} L${p(r0, 1)} Z`)
  }
  return out.join(' ')
}

/**
 * A laurel frond as ONE closed outline — stem and leaves in a single
 * sub-path. Leaves drawn as separate shapes would have to overlap the stem to
 * look attached, and an overlap cancels.
 */
function frond(ax: number, ay: number, bx: number, by: number, halfW: number, leaves: number): string {
  const dx = bx - ax
  const dy = by - ay
  const len = Math.hypot(dx, dy)
  const ux = dx / len
  const uy = dy / len
  const vx = -uy
  const vy = ux
  const P = (t: number, s: number) => `${(ax + ux * t + vx * s).toFixed(2)} ${(ay + uy * t + vy * s).toFixed(2)}`
  const pitch = (len - 4) / leaves
  // one leaf: base on the stem, a bulged outer edge, a point angled toward the
  // frond's tip, and a concave inner edge back to the stem
  const leaf = (t0: number, sign: number, k: number, fwd: boolean) => {
    const w = halfW
    const a = P(t0, sign * w)
    const c1 = P(t0 - 0.3, sign * (w + 2.9 * k))
    const tip = P(t0 + 3.7 * k, sign * (w + 4.3 * k))
    const c2 = P(t0 + 2.3 * k, sign * (w + 1.1 * k))
    const b = P(t0 + 4.3 * k, sign * w)
    return fwd ? `L${a} Q${c1} ${tip} Q${c2} ${b}` : `L${b} Q${c2} ${tip} Q${c1} ${a}`
  }
  const right: string[] = []
  const left: string[] = []
  for (let i = 0; i < leaves; i++) {
    const k = 1 - (i / leaves) * 0.3
    right.push(leaf(2 + i * pitch, 1, k, true))
    left.push(leaf(2 + i * pitch + pitch * 0.45, -1, k * 0.92, false))
  }
  return `M${P(0, halfW)} ${right.join(' ')} L${P(len, 0)} ${left.reverse().join(' ')} L${P(0, -halfW)} Z`
}

/**
 * Composed emblems, one per team, matching the marks the concept art strikes
 * on that same named team's coin (`design/reference/v2/01-board.jpg`,
 * `05-team-sheet.jpg`): gear + hammer, crystals + circuit, diamond + drill,
 * scallop + pearl, shield + sword, dove + olive branch, anvil + hammer,
 * gear + flame + wrench.
 *
 * Two hard constraints, learned the hard way:
 *  - each must read at 26px on a board row, so no element may depend on fine
 *    detail to be identifiable;
 *  - none may survive a 90-degree rotation unchanged, or it reads as an
 *    operator rather than an object (`scripts/check-dod.mjs` enforces it).
 */
const EMBLEMS: Record<TeamId, string> = {
  /*
   * Gear, hammer, pinion. The reference draws a gear with a con-rod laid
   * across it; a rod at 26px is a stick, a hammer is a hammer, so the second
   * element is the hammer the con-rod reads as. Placed clear of the gear's
   * tooth circle — a hammer crossing the gear would cancel a bite out of both.
   */
  warriors:
    gear(18.5, 28.5, 8, 9.9, 12.8, 4.2) +
    ' M26.87 17.57 L34.53 11.14 L31.89 8.00 L35.95 4.59 L43.93 14.09 L39.87 17.50 ' +
    'L37.23 14.36 L29.57 20.79 Z ' +
    gear(35.5, 37.5, 6, 4.2, 5.8, 1.7),

  /*
   * Two crystals with circuit traces running to them. The traces are drawn as
   * L-shaped single polygons rather than as pairs of bars, because two bars
   * meeting at a corner overlap there and would punch a hole out of the joint.
   */
  precious:
    'M28.8 6.5 L36.5 18 L36.5 33 L32 41.5 L25 41.5 L22.5 33 L22.5 18 Z ' +
    'M25.4 15.5 L27.2 16.8 L27.2 39.2 L25.4 39.2 Z ' +
    'M39 25 L43 30 L43 37.5 L40.5 41.5 L38 37.5 L38 29 Z ' +
    'M8.6 15.4 L17.1 15.4 L17.1 9.1 L18.9 9.1 L18.9 17.2 L8.6 17.2 Z ' +
    circle(18, 7.1, 2) +
    ' ' +
    circle(6.6, 16.3, 2) +
    ' M10.4 27.2 L17.1 27.2 L17.1 22 L18.9 22 L18.9 29 L10.4 29 Z ' +
    circle(18, 20, 2) +
    ' ' +
    circle(8.5, 28.1, 1.9) +
    ' M11 34.6 L15.4 34.6 L15.4 36.4 L11 36.4 Z ' +
    circle(17.4, 35.5, 2) +
    ' ' +
    circle(9, 35.5, 2),

  /*
   * Brilliant-cut crown over an auger bit. The crown is truncated flat where
   * the bit begins so the two abut on an edge instead of overlapping; the
   * girdle, crown and pavilion cuts are nested holes.
   */
  gems:
    'M7.5 12 L40.5 12 L27 30 L21 30 Z ' +
    'M12.6 17.2 L35.4 17.2 L35.4 18.4 L12.6 18.4 Z ' +
    'M18.4 12 L19.6 12 L19.6 17.2 L18.4 17.2 Z ' +
    'M28.4 12 L29.6 12 L29.6 17.2 L28.4 17.2 Z ' +
    'M17.6 18.4 L18.8 18.4 L22.4 29 L21.2 29 Z ' +
    'M29.2 18.4 L30.4 18.4 L26.8 29 L25.6 29 Z ' +
    'M20.2 30 L27.8 30 L27.8 33.4 L27 38.4 L24 43.4 L21 38.4 L20.2 33.4 Z ' +
    'M20.9 32.2 L27.1 31.2 L27.1 32.6 L20.9 33.6 Z ' +
    'M21.2 35.6 L26.8 34.6 L26.8 36 L21.2 37 Z ' +
    'M22.2 39.2 L25.8 38.4 L25.8 39.6 L22.2 40.4 Z',

  /*
   * A ribbed scallop with the pearl seated clear of the fan's outline.
   *
   * This shipped for a long time as circle(24,16,7.5) over a half-disc with a
   * trapezoid notched out of it, which renders head + body + notch: a generic
   * person icon on every board row. A fan needs the lobed edge and the ribs —
   * without them a sector of a circle is just a sector of a circle.
   */
  pearls:
    scallop(24, 41, 18.5, 0.8, 9, 190, 1.7) +
    ' ' +
    shellRibs(24, 41, 1.7, 9, 190, 5, 14.4, 0.5, 24, 34.5, 7.6) +
    ' ' +
    circle(24, 34.5, 6.2) +
    ' ' +
    circle(24, 34.5, 4.6) +
    ' ' +
    circle(22.1, 32.6, 1.15),

  /*
   * Sword over shield. The shield is drawn as two halves flanking a channel
   * the blade runs down, so the blade stays one continuous bright object: a
   * blade crossing a whole shield would cancel into a sword-shaped void.
   */
  knights:
    'M8.5 18.5 L20.9 18.5 L20.9 39.4 L11 31 Z ' +
    'M39.5 18.5 L27.1 18.5 L27.1 39.4 L37 31 Z ' +
    'M15.2 21.5 L16.4 21.5 L16.4 33 L15.2 33 Z ' +
    'M31.6 21.5 L32.8 21.5 L32.8 33 L31.6 33 Z ' +
    circle(24, 6.9, 2.4) +
    ' M22.4 9.3 L25.6 9.3 L25.6 12.9 L31.2 12.9 L31.2 15.3 L26.3 15.3 L26.3 39.6 ' +
    'L24 43.6 L21.7 39.6 L21.7 15.3 L16.8 15.3 L16.8 12.9 L22.4 12.9 Z ' +
    'M23.4 18 L24.6 18 L24.6 34 L23.4 34 Z',

  /*
   * Dove in flight with an olive branch. The wing sweeps up and back and the
   * tail forks down-left, so the mark differs on every axis — a symmetrical
   * bird would read as an ornament.
   */
  innocent:
    'M35.5 18.6 ' +
    'C34.6 16 31.6 14.8 29 16.2 ' +
    'C27.2 17.2 26.4 19.2 26.8 21 ' +
    'C22.6 17 15.6 12 8 9.4 ' +
    'C10 15.8 13.6 21 18.2 24.6 ' +
    'C14.4 25.4 10.4 27.6 7.2 30.6 ' +
    'C9.6 31.2 12.4 31.2 15 30.6 ' +
    'C13.6 33.4 12.8 36.4 12.6 39.4 ' +
    'C16.4 36.8 19.6 33.4 21.8 29.6 ' +
    'C24.6 30 27.6 29 29.6 26.8 ' +
    'C31.2 25 32 22.6 32.2 20.4 Z ' +
    circle(30.4, 18.4, 0.95) +
    ' ' +
    frond(29, 40, 41.5, 22.5, 0.72, 3),

  /* Anvil with the hammer resting above it, head to the upper right. */
  forged:
    'M7 26 L15.5 22 L42 22 L42 28.6 L31 28.6 L31 33.6 L34.6 33.6 L37 43 L11 43 ' +
    'L13.4 33.6 L17 33.6 L17 28.6 L7 28.6 Z ' +
    'M15.68 18.51 L29.80 11.00 L28.21 8.00 L33.95 4.95 L38.83 14.13 L33.09 17.18 ' +
    'L31.49 14.18 L17.37 21.69 Z',

  /*
   * Gear ring, flame, wrench — the composition on the reference's RUST REVIVAL
   * CO. coin. Every element is disjoint: the teeth stand on the ring, the ring
   * bore is a hole so the flame and wrench inside it fill back in, and the
   * flame's base sits exactly across the wrench's open jaw so the two touch on
   * an edge and never overlap.
   *
   * It used to be a symmetric teardrop over a notched rectangle, which read as
   * a water droplet inside a gear — a near-duplicate of the CLEANLINESS
   * category glyph two rows below it on the team sheet.
   */
  rustco:
    gear(24, 24, 10, 16.5, 20, 13.8) +
    ' M19.4 18 L21.6 18 L21.6 22.4 L26.4 22.4 L26.4 18 L28.6 18 L28.6 25.4 ' +
    'L26.1 26.2 L26.1 31.1 L21.9 31.1 L21.9 26.2 L19.4 25.4 Z ' +
    circle(24, 34, 2.9) +
    ' ' +
    circle(24, 34, 1.25) +
    ' M21.9 22.4 L21.9 17.4 ' +
    'C20.3 16.3 18.5 15.3 18.3 13.4 ' +
    'C19.6 14.2 20.6 14.8 21.5 15.7 ' +
    'C20.9 13.1 22.3 10.8 24.2 10.6 ' +
    'C25.2 12.4 26 13.3 26.1 14.9 ' +
    'C27 13.6 28 12.7 28.4 11.8 ' +
    'C29.3 13.8 28.3 16.3 26.1 17.4 L26.1 22.4 Z',
}

/**
 * The largest distance from the box centre (24,24) that each emblem's ink
 * reaches. The medallion scales every emblem against THIS rather than letting
 * each path's own silhouette drive its size — otherwise the broad marks
 * (anvil, gear, shield) swell until they swallow the dark team-tinted field
 * the reference medallions keep as a ring around theirs, and the narrow ones
 * float in the middle of an empty well.
 */
const EMBLEM_REACH: Record<TeamId, number> = {
  warriors: 19.93,
  precious: 19.4,
  gems: 19.4,
  pearls: 18.5,
  knights: 19.6,
  innocent: 18.05,
  forged: 19.05,
  rustco: 20,
}

export interface TeamCrestProps {
  teamId: TeamId
  size?: number
  /** 0..1 extra emissive rim on the bezel (leader / confirmation states). */
  glow?: number
  /**
   * Circular legend struck into the coin — the seal treatment used on the team
   * sheet and the ceremony. Only legible above ~96px.
   */
  label?: string
  /** Replace the brass bezel with gold. The ceremony has no teal and no brass. */
  gold?: boolean
}

/**
 * The team medallion, and its larger sibling the seal.
 *
 * These are TWO OBJECTS, not one object at two sizes, and the concept art is
 * explicit about the difference:
 *
 *   MEDALLION (no legend) — 01-board, 02-rollcall, 06-big-screen. Brass bezel,
 *   a DARK team-tinted well, and the emblem in bright luminous team colour
 *   sitting in it. The emblem is the emitter; the bezel above only reflects it.
 *
 *   BRASS SEAL (a legend, no `gold`) — 05-team-sheet. A brushed BRASS coin
 *   face with the emblem struck into it and the legend struck around the TOP
 *   arc, both dark on bright metal. Sampled off the reference coin: the field
 *   runs #A37A4B to #87431E and the emblem's rust is darker than the field
 *   beside it. A seal is a piece of metal, not a lamp — on that screen the
 *   brightest object is the total numeral, not the coin.
 *
 *   GOLD SEAL (`gold`) — 04-golden-key. The polarity flips: a DARK field
 *   (sampled #68421E / #5B3C20, L 66-83) carrying bright gold linework (L
 *   195-227) and the legend along the BOTTOM arc, leaving the top of the coin
 *   as unbroken polish. This is the coin that is supposed to glow.
 *
 * Collapsing the two seals into each other is what has made this component
 * read wrong on one screen or the other for three rounds.
 */
export default function TeamCrest({ teamId, size = 64, glow = 0, label, gold = false }: TeamCrestProps) {
  const uid = useId()
  const hex = TEAM_HEX[teamId]
  const g = (name: string) => `${name}-${uid}`
  const seal = !!label
  const goldSeal = seal && gold

  /*
   * Coin geometry, all measured off the references at their own scale and
   * expressed against the 29-unit coin radius of this 64 box.
   *
   *  - 05's brass seal is one continuous face inside a thin bezel band: the
   *    band is 0.89..1.0 of the radius, so the face runs out to 25.
   *  - 04's gold seal keeps a narrower field, and KeyCeremony's own field
   *    grading is calibrated to a 18.5-unit interior; moving it would put that
   *    screen's dark ring and halo across the emblem.
   *  - a medallion's well is 0.72 of its bezel.
   */
  const rDisc = goldSeal ? 18.5 : seal ? 25 : 21
  // the raised inner step, and the hairline seat outside it
  const stepR = seal && !goldSeal ? rDisc + 1.6 : rDisc + 3.4
  const stepW = seal && !goldSeal ? 1.6 : 2.6

  /*
   * Emblem size. Reference 01's medallion emblems span 0.755 of the well's
   * diameter — the remaining ring of dark team-tinted field is what stops the
   * coin reading as a flat solid disc. Reference 05's struck emblem spans 0.53
   * of the whole coin; 04's, 0.44, and its field grading eats anything past
   * 0.58 of the interior.
   */
  const reach = goldSeal ? 10.7 : seal ? 15.4 : 0.755 * rDisc
  const embScale = reach / EMBLEM_REACH[teamId]

  /*
   * The legend.
   *
   * It was set at fontSize 4 with textLength stretched across 200 degrees of
   * arc, which gave a cap height of 4.5% of the coin against the reference's
   * 9.6% and tracking wide enough that the name read as a ring of ticks. Size
   * is now driven by what the arc can hold at near-normal tracking, and the
   * stretch is clamped to 10%.
   *
   * Caps grow AWAY from the baseline arc — outward on the brass seal's top
   * arc, inward on the gold seal's bottom arc — so each radius is chosen to
   * leave the band clear of both the coin's edge and the emblem.
   */
  const legR = goldSeal ? 16.6 : 17.4
  const legSweep = goldSeal ? 200 : 240
  const legLen = (legR * legSweep * Math.PI) / 180
  const legN = Math.max(1, (label ?? '').length)
  const legSize = Math.min(goldSeal ? 5.6 : 7.8, (legLen * 0.94) / (legN * 0.56))
  const legNatural = legN * 0.56 * legSize
  const legLength = Math.min(legLen * 0.94, legNatural * 1.1)
  const legPath = goldSeal
    ? `M ${(32 + legR * Math.cos((190 * Math.PI) / 180)).toFixed(2)} ${(32 + legR * Math.sin((190 * Math.PI) / 180)).toFixed(2)}` +
      ` A ${legR} ${legR} 0 1 0 ${(32 + legR * Math.cos((-10 * Math.PI) / 180)).toFixed(2)} ${(32 + legR * Math.sin((-10 * Math.PI) / 180)).toFixed(2)}`
    : `M ${(32 + legR * Math.cos((150 * Math.PI) / 180)).toFixed(2)} ${(32 + legR * Math.sin((150 * Math.PI) / 180)).toFixed(2)}` +
      ` A ${legR} ${legR} 0 1 1 ${(32 + legR * Math.cos((30 * Math.PI) / 180)).toFixed(2)} ${(32 + legR * Math.sin((30 * Math.PI) / 180)).toFixed(2)}`

  // Screws sit in the arc the legend leaves empty: low on the brass seal,
  // high on the gold one. A screw landing on the type is the difference
  // between struck and sloppy.
  const screwAngles = goldSeal
    ? [(250 * Math.PI) / 180, (290 * Math.PI) / 180]
    : seal
      ? [(68 * Math.PI) / 180, (112 * Math.PI) / 180]
      : [0, 1, 2, 3].map((i) => (i * Math.PI) / 2 + Math.PI / 4)
  const screwR = seal ? 27.1 : 24.4

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        {/*
         * A turned brass ring lit from the top left is brightest there and
         * falls to a warm mid at the bottom right — never to near-black. It
         * used to end at #2C1D0B, which put the right half of the ring at wall
         * luminance and made the coin read as lit from the left only. Sampled
         * off the reference coin: both sides sit at L 122-156.
         */}
        <linearGradient id={g('rim')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={gold ? '#fff0c0' : '#f2dfae'} />
          <stop offset="30%" stopColor={gold ? '#f2cf72' : '#d8b273'} />
          <stop offset="65%" stopColor={gold ? '#d4ab48' : '#bd9857'} />
          <stop offset="100%" stopColor={gold ? '#b88f34' : '#a37f45'} />
        </linearGradient>
        {/* one smooth specular that decays with angle, for the bezel's lit side */}
        <linearGradient id={g('sheen')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff0cd" stopOpacity="0.6" />
          <stop offset="55%" stopColor="#fff0cd" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#fff0cd" stopOpacity="0" />
        </linearGradient>
        {/*
         * A struck emblem is lit by the same key light as the plates: light on
         * its upper-left facets, falling away to the lower right. A flat fill
         * reads as a printed sticker however good the coin under it is.
         */}
        <linearGradient id={g('emb')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={shade(hex, 0.3)} />
          <stop offset="45%" stopColor={shade(hex, -0.04)} />
          <stop offset="100%" stopColor={shade(hex, -0.46)} />
        </linearGradient>
        <linearGradient id={g('rimDark')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={gold ? '#c69a3a' : '#8b6730'} />
          <stop offset="50%" stopColor={gold ? '#7d5a18' : '#543c1a'} />
          <stop offset="100%" stopColor="#1d1206" />
        </linearGradient>
        {/* cast-brass pitting on the bezel (~3.5 CSS px cells at render size) */}
        <filter id={g('pit')}>
          <feTurbulence type="fractalNoise" baseFrequency="0.3" numOctaves="3" seed="5" stitchTiles="stitch" />
          <feColorMatrix values="0 0 0 0 0.08  0 0 0 0 0.07  0 0 0 0 0.03  0 0 0 0.55 0" />
          <feComposite operator="in" in2="SourceGraphic" />
        </filter>
        {/*
         * The interior. Brass only on the brass seal — the medallion and the
         * gold seal both want a dark ground for a luminous emblem to sit in.
         */}
        <radialGradient id={g('inner')} cx="0.38" cy="0.32" r="0.98">
          {goldSeal ? (
            <>
              <stop offset="0%" stopColor="#7d5024" />
              <stop offset="42%" stopColor="#67411d" />
              <stop offset="78%" stopColor="#4d2e13" />
              <stop offset="100%" stopColor="#331e0b" />
            </>
          ) : seal ? (
            <>
              <stop offset="0%" stopColor="#c9a26a" />
              <stop offset="38%" stopColor="#a37a4b" />
              <stop offset="74%" stopColor="#7d5a33" />
              <stop offset="100%" stopColor="#5a3d22" />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor={shade(hex, -0.7)} />
              <stop offset="52%" stopColor={shade(hex, -0.8)} />
              <stop offset="100%" stopColor={shade(hex, -0.9)} />
            </>
          )}
        </radialGradient>
        {/* radial brushing across the seal's face, struck from the centre out */}
        <filter id={g('turn')}>
          <feTurbulence type="fractalNoise" baseFrequency="0.02 0.6" numOctaves="3" seed="17" stitchTiles="stitch" />
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 0.94 0 0 0 0 0.82  0 0 0 0.16 0" />
          <feComposite operator="in" in2="SourceGraphic" />
        </filter>
        {/* the emblem's own light, pooling on the interior around it */}
        <radialGradient id={g('bloom')} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor={goldSeal ? 'var(--color-key)' : hex} stopOpacity={goldSeal ? 0.34 : 0.45} />
          <stop offset="55%" stopColor={goldSeal ? 'var(--color-key)' : hex} stopOpacity={goldSeal ? 0.14 : 0.14} />
          <stop offset="100%" stopColor={goldSeal ? 'var(--color-key)' : hex} stopOpacity="0" />
        </radialGradient>
        {seal && <path id={g('arc')} d={legPath} fill="none" />}
      </defs>

      {/* contact shadow under the whole medallion */}
      <ellipse cx="32" cy="35" rx="28.5" ry="27.5" fill="rgba(0,0,0,0.5)" />

      {/* outer dark retaining rim, then the main brass bezel */}
      <circle cx="32" cy="32" r="29" fill={`url(#${g('rimDark')})`} />
      <circle cx="32" cy="32" r="27.2" fill={`url(#${g('rim')})`} />
      <circle cx="32" cy="32" r="27.2" filter={`url(#${g('pit')})`} opacity="0.85" />
      {/* the inner of the two rings: a raised step with its own lit edge */}
      <circle cx="32" cy="32" r={stepR} fill="none" stroke={`url(#${g('rim')})`} strokeWidth={stepW} />
      <circle
        cx="32"
        cy="32"
        r={stepR + stepW / 2 + 0.2}
        fill="none"
        stroke="rgba(24,14,5,0.55)"
        strokeWidth="1.1"
      />

      {/*
       * One smooth specular on the bezel's lit side, decaying with angle, run
       * at the outer radius so it never crosses the legend's type. It used to
       * be three hard-capped near-white segments — the same "paint dashes"
       * failure the plate chamfers had, and on a labelled coin they landed
       * directly on the letters.
       */}
      <path
        d="M 5.9 27.5 A 26.3 26.3 0 0 1 27.5 5.9"
        fill="none"
        stroke={`url(#${g('sheen')})`}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path d="M 55 38 A 24 24 0 0 1 38 55" fill="none" stroke="rgba(20,12,4,0.4)" strokeWidth="2.6" strokeLinecap="round" />

      {/* Bezel screws — four on a medallion's diagonals, two on a seal. */}
      {screwAngles.map((a, i) => {
        const cx = 32 + Math.cos(a) * screwR
        const cy = 32 + Math.sin(a) * screwR
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r="1.8" fill="#2e2010" />
            <circle cx={cx - 0.4} cy={cy - 0.5} r="1" fill="#e0bc82" opacity="0.85" />
          </g>
        )
      })}

      {/* seat shadow where the interior meets the bezel, offset down-right */}
      <circle cx="32.6" cy="32.8" r={rDisc + 0.4} fill="rgba(0,0,0,0.55)" />
      {/* the interior: a brass coin face on the brass seal, a dark well otherwise */}
      <circle cx="32" cy="32" r={rDisc} fill={`url(#${g('inner')})`} />
      {seal && !goldSeal && <circle cx="32" cy="32" r={rDisc} filter={`url(#${g('turn')})`} opacity="0.7" />}
      {/*
       * A luminous emblem pools light on the well around it. The brass seal's
       * emblem is struck metal on metal — no pooling, or the coin turns into a
       * lamp and outshines the numerals it is supposed to label.
       */}
      {!(seal && !goldSeal) && <circle cx="32" cy="32" r={rDisc} fill={`url(#${g('bloom')})`} />}
      {/* grime in the seat, and the recess lip */}
      <circle
        cx="32"
        cy="32"
        r={rDisc - 0.8}
        fill="none"
        stroke={seal && !goldSeal ? 'rgba(40,24,10,0.35)' : 'rgba(14,8,3,0.6)'}
        strokeWidth="2"
      />
      <circle cx="32" cy="32" r={rDisc} fill="none" stroke="rgba(0,0,0,0.6)" strokeWidth="1.3" />

      {/*
       * The legend, struck around the coin. Dark into bright brass on the team
       * sheet's coin; bright out of a dark field on the ceremony's, where the
       * coin is the emitter.
       */}
      {seal && (
        <>
          <text
            fontFamily="Oswald, sans-serif"
            fontSize={legSize}
            fontWeight={goldSeal ? 600 : 700}
            fill={goldSeal ? '#ffeec2' : '#33240f'}
            stroke={goldSeal ? 'rgba(120,74,12,0.45)' : undefined}
            strokeWidth={goldSeal ? 0.24 : undefined}
            style={{ textTransform: 'uppercase' }}
          >
            <textPath
              href={`#${g('arc')}`}
              startOffset="50%"
              textAnchor="middle"
              textLength={legLength.toFixed(2)}
              lengthAdjust="spacing"
            >
              {(label ?? '').toUpperCase()}
            </textPath>
          </text>
          {/*
           * A struck letter has a lit lower-right shoulder where the key light
           * catches the wall of the cut. One offset copy, at low opacity, is
           * the whole effect — it is what separates struck from printed.
           */}
          {!goldSeal && (
            <text
              fontFamily="Oswald, sans-serif"
              fontSize={legSize}
              fontWeight={700}
              fill="rgba(255,235,190,0.34)"
              transform="translate(0.32 0.42)"
              style={{ textTransform: 'uppercase' }}
            >
              <textPath
                href={`#${g('arc')}`}
                startOffset="50%"
                textAnchor="middle"
                textLength={legLength.toFixed(2)}
                lengthAdjust="spacing"
              >
                {(label ?? '').toUpperCase()}
              </textPath>
            </text>
          )}
          {/* the reference's two lamp dots closing the gold legend's arc */}
          {goldSeal &&
            [180, 0].map((deg) => (
              <circle
                key={deg}
                cx={32 + legR * 0.96 * Math.cos((deg * Math.PI) / 180)}
                cy={32 + legR * 0.96 * Math.sin((deg * Math.PI) / 180)}
                r="0.9"
                fill="#ffeec2"
                opacity="0.9"
              />
            ))}
        </>
      )}

      {/*
       * The emblem, drawn two ways for the two kinds of object.
       *
       * Luminous (medallion, gold seal): a soft under-bloom, the body at full
       * token luminance, and a lit leading edge. It is the emitter.
       *
       * Struck (brass seal): a cast shadow down-right into the coin face, the
       * body in team colour, and a brass specular along the top-left edge
       * where the raised metal catches the key light. No bloom — a struck
       * emblem does not glow, it casts.
       */}
      <g transform={`translate(32 32) scale(${embScale.toFixed(4)}) translate(-24 -24)`}>
        {seal && !goldSeal ? (
          <>
            <path d={EMBLEMS[teamId]} fill="rgba(28,14,4,0.55)" fillRule="evenodd" transform="translate(0.9 1.1)" />
            <path d={EMBLEMS[teamId]} fill={`url(#${g('emb')})`} fillRule="evenodd" />
            <path
              d={EMBLEMS[teamId]}
              fill="none"
              stroke="#f6dfae"
              strokeWidth="1.2"
              strokeLinejoin="round"
              fillRule="evenodd"
              transform="translate(-0.5 -0.6)"
              opacity="0.85"
            />
          </>
        ) : (
          <>
            <path
              d={EMBLEMS[teamId]}
              fill={goldSeal ? '#ffd98a' : hex}
              fillRule="evenodd"
              opacity="0.5"
              style={{ filter: 'blur(2.4px)' }}
            />
            <path
              d={EMBLEMS[teamId]}
              fill={goldSeal ? '#ffdf9c' : hex}
              fillRule="evenodd"
              style={{ filter: `drop-shadow(0 0 2px ${goldSeal ? '#ffc63d' : hex})` }}
            />
            <path
              d={EMBLEMS[teamId]}
              fill="none"
              stroke={goldSeal ? '#fff6dc' : shade(hex, 0.55)}
              strokeWidth="0.9"
              strokeLinejoin="round"
              fillRule="evenodd"
              transform="translate(-0.45 -0.5)"
              opacity="0.55"
            />
          </>
        )}
      </g>

      {glow > 0 && (
        <circle
          cx="32"
          cy="32"
          r={rDisc + 1.4}
          fill="none"
          stroke={hex}
          strokeWidth="1.6"
          opacity={0.9 * glow}
          style={{ filter: `drop-shadow(0 0 5px ${hex})` }}
        />
      )}

      {/* tight specular on the bezel rim only, top-left */}
      <path d="M 13.5 20.5 A 22 22 0 0 1 21 12.8" fill="none" stroke="rgba(255,248,224,0.55)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}
