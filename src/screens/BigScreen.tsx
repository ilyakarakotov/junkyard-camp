import { useEffect, useMemo, useState } from 'react'
import TeamCrest from '../components/TeamCrest'
import { BrassRail, KeyGlyph, Plate, Screw, Well } from '../components/chrome'
import { ArcBolt, ContactPost } from '../fx/Arc'
import { dayScores } from '../data/derive'
import { formatDeci } from '../data/scoring'
import { useStore } from '../data/store'
import type { DayScore, Team } from '../data/types'

/**
 * The evening gathering display. 16:9, landscape, read from across a room.
 *
 * The whole screen is one machine: a mounting panel bolted to the wall,
 * carrying two brass title plates and eight team columns. Each column is a
 * tall brushed plate standing on its own brass footing, with a recessed
 * segmented meter cut into it — one slot per point, so the standings are
 * countable from the back of a hall rather than read off a numeral.
 *
 * The board is DAY-scoped, not cumulative: one slot = 1.0 point, the channel
 * holds ten slots (6.0 of base plus four keys), and every column shares that
 * scale so the meters are directly comparable.
 *
 * Laid out at a fixed 1920x1080 and scaled to fit, so proportions are exact on
 * any projector rather than reflowing into something the design never saw.
 */

const W = 1920
const H = 1080

/* ---- the machine ------------------------------------------------------- */

const PANEL_INSET = 22

/* Header plates, with the key-rail gap between them centred over the leader. */
const HDR_TOP = 40
const HDR_H = 168
const HDR_L_X = 48
const HDR_L_W = 816 // 48 .. 864
const HDR_R_X = 1256
const HDR_R_W = 616 // 1256 .. 1872

/* ---- the columns ------------------------------------------------------- */

const COL_W = 160
const LEADER_W = 192
/*
 * Eight columns on the 8px grid inside a 48..1872 band, laid out 4 · leader · 3.
 * The leader is wider and sits centred in the composition (1060), with a
 * matching 156px corridor either side for its brackets, cables and arcs.
 */
const LEFT_X = [48, 248, 448, 648]
const LEADER_X = 964
const RIGHT_X = [1312, 1512, 1712]

const COL_TOP = 368
const LEADER_TOP = 296 // the leader stands 72px proud of the others
const COL_BOTTOM = 912

const FOOT_TOP = 900
const FOOT_H = 92
const FOOT_OVERHANG = 14

/*
 * The mounting shelf the eight footings stand on. Without it the bottom of the
 * panel fell to wall level and the columns stood on nothing — the reference
 * puts a lit brass ledge there, and it is the screen's lowest depth layer.
 * The footings overlap its top edge, so its bevel line shows in the gaps.
 */
const SHELF_TOP = 894
const SHELF_H = 142

/*
 * The meter channel is identical in all eight columns — same top, same bottom,
 * same slot count — or the meters stop being comparable, which is the only
 * reason the meter exists. The leader's extra height goes into its head.
 */
const CH_TOP = 560
const CH_BOTTOM = 896
const CH_INSET = 20
const CAP = 10 // slots; 1 slot = 1.0 point. 6.0 of base plus four keys fits.
const PITCH = (CH_BOTTOM - CH_TOP) / CAP
const SLOT_H = PITCH - 6

/* Key rails: the leader's hangs in the open gap between the title plates. */
const RAIL_TOP = 216
const LEADER_RAIL_TOP = 62

/** Ambient shading laid over a Plate's face to seat it at the reference tone. */
function shade(from: number, to: number) {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        background: `linear-gradient(180deg, rgba(17,13,10,${from}) 0%, rgba(17,13,10,${to}) 100%)`,
      }}
    />
  )
}

/*
 * Oxide speckle, not an overall wash: thresholded noise so it breaks into
 * grains rather than tinting the face, masked to the bottom lip of whatever
 * plate it is dropped into. Crevices and lower edges only.
 */
const OXIDE_GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='120'%3E%3Cfilter id='r'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.55' numOctaves='3' seed='11' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.60 0 0 0 0 0.28 0 0 0 0 0.11 0 0 0 0.95 -0.54'/%3E%3C/filter%3E%3Crect width='320' height='120' filter='url(%23r)'/%3E%3C/svg%3E\")"

/** Rust creeping up from a plate's lower edge. `band` is its reach in px. */
function oxide(band = 26, strength = 1) {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: band,
        pointerEvents: 'none',
        opacity: strength,
        backgroundImage:
          OXIDE_GRAIN +
          ',radial-gradient(58% 120% at 14% 100%, rgba(148,72,30,0.5) 0%, transparent 72%)' +
          ',radial-gradient(40% 120% at 47% 100%, rgba(126,58,24,0.4) 0%, transparent 70%)' +
          ',radial-gradient(50% 120% at 82% 100%, rgba(140,66,28,0.46) 0%, transparent 74%)',
        backgroundSize: '320px 120px, auto, auto, auto',
        maskImage: 'linear-gradient(0deg, #000 0%, rgba(0,0,0,0.55) 45%, transparent 100%)',
      }}
    />
  )
}

export default function BigScreen() {
  const { teams, events, activeDay, ready } = useStore()
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / W, window.innerHeight / H))
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  const byId = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams])
  /*
   * One day, not the camp: the title plate names a single day, so the columns
   * have to read that day. A cumulative total would put 16 slots in the
   * channel, and 16 slots are not countable from the back of a hall.
   */
  const scores = useMemo(
    () => [...dayScores(events, activeDay.id, teams)].sort((a, b) => b.totalDeci - a.totalDeci),
    [events, activeDay.id, teams],
  )

  if (!ready) return <div className="min-h-dvh" style={{ background: 'var(--color-bg)' }} />

  const leader = scores[0]
  const rest = scores.slice(1)
  const placed: { score: DayScore; x: number; leader: boolean }[] = []
  rest.slice(0, 4).forEach((s, i) => placed.push({ score: s, x: LEFT_X[i], leader: false }))
  if (leader) placed.push({ score: leader, x: LEADER_X, leader: true })
  rest.slice(4, 7).forEach((s, i) => placed.push({ score: s, x: RIGHT_X[i], leader: false }))

  const [themeName, themeLine] = activeDay.theme.split('—').map((s) => s.trim())

  return (
    /*
     * Fixed to the viewport rather than min-h-dvh: the 1080-tall child is
     * bigger than the screen on a laptop, so under min-height it would stretch
     * the container and push the footings below the fold. Pinned to the
     * viewport, the oversized child centres and the overflow clips evenly.
     */
    <div
      className="flex items-center justify-center overflow-hidden"
      style={{ position: 'fixed', inset: 0, background: 'var(--color-bg)' }}
    >
      <div
        style={{
          width: W,
          height: H,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          position: 'relative',
          flexShrink: 0,
          // the wall, which shows only as a band at the extreme edges
          background:
            'radial-gradient(120% 90% at 50% 22%, transparent 42%, rgba(0,0,0,0.7) 100%),' +
            'radial-gradient(90% 60% at 18% 0%, rgba(150,106,58,0.12) 0%, transparent 55%),' +
            'linear-gradient(180deg, #221a14 0%, #1a140e 55%, #130f0a 100%)',
        }}
      >
        {/* ---- the mounting panel everything is bolted to ---- */}
        <Plate
          chamfer={20}
          screws
          screwInset={20}
          rust
          style={{ position: 'absolute', inset: PANEL_INSET }}
        >
          {shade(0.66, 0.85)}
        </Plate>

        {/*
         * ---- the mounting shelf ----
         * Drawn before the columns so the eight footings overlap its top edge
         * and it reads as one continuous ledge running behind them. Its face
         * stays at the panel's mid tone rather than falling into the vignette:
         * a shelf you cannot see is a depth layer you have thrown away.
         */}
        <Plate
          chamfer={10}
          screws
          screwInset={20}
          rust
          style={{
            position: 'absolute',
            left: PANEL_INSET + 6,
            top: SHELF_TOP,
            width: W - (PANEL_INSET + 6) * 2,
            height: SHELF_H,
          }}
        >
          {shade(0.44, 0.6)}
          {/* key light on the ledge, decaying away from its top-left corner */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              background:
                'radial-gradient(120% 200% at 5% 0%, rgba(255,244,220,0.15) 0%, rgba(255,240,212,0.05) 38%, transparent 66%)',
            }}
          />
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              boxShadow:
                'inset 0 2px 0 rgba(255,248,228,0.74), inset 2px 0 0 rgba(255,240,212,0.24),' +
                'inset 0 -3px 0 rgba(255,238,208,0.13), inset 0 -7px 9px rgba(0,0,0,0.45)',
            }}
          />
          {oxide(30, 0.45)}
        </Plate>

        {/* ---- title plates ---- */}
        <Plate
          chamfer={16}
          screws
          screwInset={18}
          rust
          style={{ position: 'absolute', left: HDR_L_X, top: HDR_TOP, width: HDR_L_W, height: HDR_H }}
        >
          {shade(0.12, 0.4)}
          {oxide(24, 0.5)}
          <div style={{ position: 'absolute', left: 40, top: 22 }}>
            <div
              className="display-title"
              style={{
                fontSize: 76,
                lineHeight: 1,
                letterSpacing: '0.015em',
                color: 'var(--color-text)',
                textShadow: '0 3px 0 rgba(24,14,6,0.8), 0 6px 12px rgba(0,0,0,0.6)',
              }}
            >
              JUNKYARD REDEMPTION
            </div>
            <div
              className="display-title"
              style={{
                marginTop: 12,
                fontSize: 28,
                lineHeight: 1,
                letterSpacing: '0.1em',
                color: 'var(--color-text)',
                textShadow: '0 2px 0 rgba(24,14,6,0.8), 0 4px 8px rgba(0,0,0,0.55)',
              }}
            >
              SOL KIDS CAMP
            </div>
          </div>
        </Plate>

        <Plate
          chamfer={16}
          screws
          screwInset={18}
          rust
          style={{ position: 'absolute', left: HDR_R_X, top: HDR_TOP, width: HDR_R_W, height: HDR_H }}
        >
          {shade(0.12, 0.4)}
          {oxide(24, 0.5)}
          <div style={{ position: 'absolute', right: 40, top: 22, textAlign: 'right' }}>
            <div
              className="display-title"
              style={{
                fontSize: 76,
                lineHeight: 1,
                letterSpacing: '0.015em',
                color: 'var(--color-text)',
                textShadow: '0 3px 0 rgba(24,14,6,0.8), 0 6px 12px rgba(0,0,0,0.6)',
              }}
            >
              {activeDay.name.toUpperCase()} · {(themeName ?? '').toUpperCase()}
            </div>
            <div
              className="display-title"
              style={{
                marginTop: 12,
                fontSize: 28,
                lineHeight: 1,
                letterSpacing: '0.06em',
                color: 'var(--color-text)',
                textShadow: '0 2px 0 rgba(24,14,6,0.8), 0 4px 8px rgba(0,0,0,0.55)',
              }}
            >
              {(themeLine ?? '').toUpperCase()}
            </div>
          </div>
        </Plate>

        {/* ---- eight columns, 4 · leader · 3 ---- */}
        {placed.map(({ score, x, leader: isLeader }) => {
          const team = byId.get(score.teamId)
          if (!team) return null
          return <Column key={score.teamId} score={score} team={team} x={x} isLeader={isLeader} />
        })}
      </div>
    </div>
  )
}

/*
 * Oswald semibold uppercase advance widths, in em, measured off the rendered
 * face rather than estimated — a flat per-character guess over-squeezed
 * REVIVAL CO. by 15% because I and . are a third the width of M and W.
 */
const ADVANCE: Record<string, number> = {
  A: 0.538, B: 0.574, C: 0.553, D: 0.573, E: 0.438, F: 0.425, G: 0.572,
  H: 0.6, I: 0.29, J: 0.339, K: 0.552, L: 0.433, M: 0.695, N: 0.554,
  O: 0.576, P: 0.552, Q: 0.576, R: 0.583, S: 0.492, T: 0.438, U: 0.578,
  V: 0.522, W: 0.704, X: 0.508, Y: 0.49, Z: 0.43, ' ': 0.25, "'": 0.161,
  '.': 0.232, '-': 0.32,
}
const NAMEPLATE_TRACKING = 0.03 // em, matches the rendered letterSpacing

/*
 * ONE type size on all eight nameplates. Auto-sizing per column made the same
 * list read at three different weights — RUST REVIVAL CO. visibly lighter than
 * INNOCENT beside it — which is the opposite of the identical-row-heights rule.
 * 22px is what the reference plates measure.
 */
const NAMEPLATE_TYPE = 22

/** Rendered width of one nameplate line, in px, at NAMEPLATE_TYPE. */
function lineWidth(line: string): number {
  let em = 0
  for (const ch of line) em += (ADVANCE[ch] ?? 0.55) + NAMEPLATE_TRACKING
  return em * NAMEPLATE_TYPE
}

/**
 * Full team name over two lines, split where the LONGER line comes out
 * shortest. Splitting before the last word instead put RUST REVIVAL (132px)
 * over CO. (32px) — a line 17px wider than the plate can hold beside a line
 * that wastes two thirds of it. Balanced, it is REVIVAL CO. at 115px.
 */
function nameLines(team: Team): string[] {
  const words = team.name.toUpperCase().split(' ')
  if (words.length === 1) return words
  let best: string[] = []
  let bestMax = Infinity
  for (let i = 1; i < words.length; i++) {
    const pair = [words.slice(0, i).join(' '), words.slice(i).join(' ')]
    const max = Math.max(lineWidth(pair[0]), lineWidth(pair[1]))
    if (max < bestMax) {
      bestMax = max
      best = pair
    }
  }
  return best
}

/**
 * Last-resort squeeze for a line that still overruns: a hair of scaleX keeps
 * cap height and stroke weight identical down the row where a smaller font
 * size would not.
 */
function squeeze(lines: string[], avail: number): number {
  return Math.min(1, avail / Math.max(...lines.map(lineWidth)))
}

function Column({
  score,
  team,
  x,
  isLeader,
}: {
  score: DayScore
  team: Team
  x: number
  isLeader: boolean
}) {
  const color = `var(--color-team-${team.colorToken})`
  const top = isLeader ? LEADER_TOP : COL_TOP
  const w = isLeader ? LEADER_W : COL_W
  const crestSize = isLeader ? 116 : 96
  const scoreSize = isLeader ? 112 : 92
  const lines = nameLines(team)
  /*
   * The nameplate is INSET 10px a side, not overhanging: a plate bolted to the
   * column has to have column metal under its screws. Overhanging it left only
   * 16px of wall between neighbouring nameplates against 40px between the
   * column plates, so the eight machines read as one continuous strip. In the
   * reference the dark column is visibly wider than the brass plate on both
   * sides. Screws come down to 10px to match — the reference's are ~7px on a
   * 143px plate, where mine were 13px on 184px.
   */
  const npW = w - 20
  const npH = 54
  const npTop = isLeader ? 52 : 42
  const npSqueeze = squeeze(lines, npW - 36) // 3px of brass either side of the screws

  // Integer tenths throughout: whole slots, then a partial for the remainder.
  const litSlots = Math.floor(score.totalDeci / 10)
  const partial = score.totalDeci % 10
  /*
   * How far up the channel the light reaches, so the coloured spill onto the
   * plate and the footing tracks the meter rather than being painted on.
   */
  const litPct = ((litSlots + (partial > 0 ? 0.5 : 0)) / CAP) * 100

  return (
    <>
      {/* ---- key rail above the column, only if this team holds keys ---- */}
      {score.keys > 0 && (
        <KeyHanger
          x={x}
          w={w}
          keys={score.keys}
          top={isLeader ? LEADER_RAIL_TOP : RAIL_TOP}
          /*
           * The leader's rail bridges the whole gap between the two title
           * plates, as the reference's does, so both its ends land on
           * something. Sized to the column it hung over, it floated in the
           * middle of a 392px hole with 90px of bare wall either side — a rod
           * bolted to nothing, which is the hardware equivalent of an
           * unmotivated glow. The span is symmetric about 1060, the leader
           * column's own centre line, so the keys stay over their team.
           */
          span={
            isLeader
              ? { left: HDR_L_X + HDR_L_W, width: HDR_R_X - (HDR_L_X + HDR_L_W) }
              : undefined
          }
        />
      )}

      {/* ---- the column body ---- */}
      <Plate
        chamfer={14}
        screws
        screwInset={16}
        rust
        style={{ position: 'absolute', left: x, top, width: w, height: COL_BOTTOM - top }}
      >
        {shade(isLeader ? 0.2 : 0.36, isLeader ? 0.46 : 0.62)}
        {/*
         * The ambient shading would swallow the plate's own chamfer, so the
         * key-light specular is re-struck over it: a crisp warm line along the
         * top and left edges only, one light direction, top left.
         */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            boxShadow:
              'inset 0 2px 0 rgba(255,243,220,0.62), inset 2px 0 0 rgba(255,238,211,0.26),' +
              'inset 0 -2px 3px rgba(0,0,0,0.5), inset -2px 0 3px rgba(0,0,0,0.35)',
          }}
        />
      </Plate>

      {/*
       * Engraved nameplate. The name has to survive being read from the back
       * of a hall, so the brass face is lit up to its bright band rather than
       * left on the body gradient — dark type on mid-brass is what made the
       * short names vanish — and the cut is deep: near-black letter, hard
       * cream highlight along the bottom lip.
       */}
      <div
        style={{
          position: 'absolute',
          left: x + 10,
          top: top + npTop,
          width: npW,
          height: npH,
        }}
      >
        <div
          className="brass-band grain"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 3,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow:
              'inset 0 1px 0 rgba(255,248,226,0.75), inset 1px 0 0 rgba(255,244,214,0.4),' +
              'inset 0 -2px 0 rgba(40,26,12,0.75), 0 4px 7px rgba(0,0,0,0.6)',
          }}
        >
          {/* lift the face onto the lit part of the brass so the cut reads */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 3,
              pointerEvents: 'none',
              background:
                'linear-gradient(178deg, rgba(255,238,205,0.52) 0%, rgba(255,230,186,0.36) 46%,' +
                'rgba(236,200,142,0.34) 78%, rgba(202,164,106,0.30) 100%)',
            }}
          />
          {/*
           * Wrapped rather than positioned by class: the nameplate face is a
           * flex column, so an absolutely-positioned screw with no offsets
           * falls to its static position — the centre of the stack, on top of
           * the name. The wrapper gives it a containing block at the edge.
           */}
          <div style={{ position: 'absolute', left: 5, top: npH / 2 - 5, width: 10, height: 10 }}>
            <Screw slot={22} size={10} />
          </div>
          <div style={{ position: 'absolute', right: 5, top: npH / 2 - 5, width: 10, height: 10 }}>
            <Screw slot={-51} size={10} />
          </div>
          {lines.map((l) => (
            <span
              key={l}
              className="font-display font-semibold uppercase"
              style={{
                position: 'relative',
                display: 'inline-block',
                fontSize: NAMEPLATE_TYPE,
                lineHeight: 1.12,
                letterSpacing: '0.03em',
                whiteSpace: 'nowrap',
                transform: npSqueeze < 1 ? `scaleX(${npSqueeze.toFixed(3)})` : undefined,
                color: '#221606',
                textShadow: '0 1.5px 0 rgba(255,247,222,0.85)',
              }}
            >
              {l}
            </span>
          ))}
        </div>
      </div>

      {/* ---- the column's instruments, laid over its plate ---- */}
      <div style={{ position: 'absolute', left: x, top, width: w, height: COL_BOTTOM - top }}>

        {/* the score, in the column head above the meter */}
        <div
          className="numeral"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: isLeader ? 110 : 96,
            textAlign: 'center',
            fontSize: scoreSize,
            lineHeight: 1.05,
            color: 'var(--color-text)',
            fontVariantNumeric: 'tabular-nums',
            textShadow: '0 3px 0 rgba(20,11,4,0.7), 0 6px 12px rgba(0,0,0,0.6)',
          }}
        >
          {formatDeci(score.totalDeci)}
        </div>

        {/*
         * The lit slots are emitters, so they have to land colour on the metal
         * around them: a wash climbing the plate exactly as far as the fill
         * does. Without it the channel read as a decal on a warm-grey plate.
         */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: -10,
            right: -10,
            top: CH_TOP - top - 18,
            height: CH_BOTTOM - CH_TOP + 26,
            pointerEvents: 'none',
            background:
              `radial-gradient(66% ${Math.max(12, litPct + 6)}% at 50% 100%,` +
              ` color-mix(in oklab, ${color} 29%, transparent) 0%,` +
              ` color-mix(in oklab, ${color} 12%, transparent) 52%, transparent 86%)`,
          }}
        />

        {/*
         * Leader only: the channel's own walls are lit tubes, brass-collared at
         * both ends, so the current visibly runs *through* the meter instead of
         * only beside it. This is the strongest read in the concept art.
         */}
        {isLeader &&
          ([-1, 1] as const).map((side) => (
            <div key={side} aria-hidden>
              <div
                style={{
                  position: 'absolute',
                  left: side === -1 ? CH_INSET - 9 : undefined,
                  right: side === 1 ? CH_INSET - 9 : undefined,
                  top: CH_TOP - top - 8,
                  width: 6,
                  height: CH_BOTTOM - CH_TOP + 14,
                  borderRadius: 3,
                  background:
                    'linear-gradient(90deg, rgba(35,150,145,0.85) 0%, #d3fffb 40%,' +
                    '#2fd9d0 74%, rgba(20,104,100,0.9) 100%)',
                  boxShadow:
                    '0 0 5px rgba(47,217,208,0.95), 0 0 16px rgba(47,217,208,0.6),' +
                    '0 0 40px rgba(47,217,208,0.34), 0 0 76px rgba(47,217,208,0.16)',
                }}
              />
              {[CH_TOP - top - 12, CH_BOTTOM - top - 2].map((cy) => (
                <div
                  key={cy}
                  className="brass-band"
                  style={{
                    position: 'absolute',
                    left: side === -1 ? CH_INSET - 12 : undefined,
                    right: side === 1 ? CH_INSET - 12 : undefined,
                    top: cy,
                    width: 11,
                    height: 10,
                    borderRadius: 2,
                    boxShadow:
                      'inset 0 1px 0 rgba(255,248,226,0.8), inset -1px -1px 0 rgba(40,26,12,0.7),' +
                      '0 1px 2px rgba(0,0,0,0.6)',
                  }}
                />
              ))}
            </div>
          ))}

        {/* ---- the meter: a recessed channel of discrete slots ---- */}
        <Well
          radius={4}
          style={{
            position: 'absolute',
            left: CH_INSET,
            width: w - CH_INSET * 2,
            top: CH_TOP - top,
            height: CH_BOTTOM - CH_TOP,
            boxShadow: isLeader
              ? 'inset 2px 3px 6px rgba(0,0,0,0.92), 0 0 0 1px rgba(47,217,208,0.5), 0 0 22px rgba(47,217,208,0.28)'
              : undefined,
          }}
        >
          {Array.from({ length: CAP }, (_, i) => {
            const lit = i < litSlots
            const half = !lit && i === litSlots && partial > 0
            if (!lit && !half) {
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: 4,
                    right: 4,
                    bottom: i * PITCH + 3,
                    height: SLOT_H,
                    borderRadius: 5,
                    background: 'linear-gradient(180deg, #150e0c 0%, #211714 100%)',
                    boxShadow:
                      'inset 0 2px 4px rgba(0,0,0,0.9), inset 0 -1px 0 rgba(122,102,90,0.8),' +
                      'inset -1px 0 0 rgba(96,80,70,0.45)',
                  }}
                />
              )
            }
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: 4,
                  width: half ? `calc(50% - 4px)` : 'calc(100% - 8px)',
                  bottom: i * PITCH + 3,
                  height: SLOT_H,
                  borderRadius: 5,
                  /*
                   * A bright inner face, as the reference segments have: the
                   * upper third of the slot is where the emitter is hottest,
                   * and it is what makes the fill readable from the back of a
                   * hall rather than a flat coloured brick.
                   */
                  background: `linear-gradient(180deg, color-mix(in oklab, ${color} 44%, #fff) 0%, color-mix(in oklab, ${color} 78%, #fff) 24%, ${color} 48%, ${color} 74%, color-mix(in oklab, ${color} 70%, #000) 100%)`,
                  boxShadow: `inset 0 1px 0 rgba(255,255,255,0.7), inset 0 -2px 3px rgba(0,0,0,0.35), 0 0 10px ${color}, 0 0 24px color-mix(in oklab, ${color} 48%, transparent)`,
                }}
              />
            )
          })}
        </Well>
      </div>

      {/* medallion overhanging the plate's top edge */}
      <div
        style={{
          position: 'absolute',
          left: x + (w - crestSize) / 2,
          top: top - Math.round(crestSize * 0.64),
        }}
      >
        <TeamCrest teamId={team.id} size={crestSize} glow={isLeader ? 1 : 0.5} />
      </div>

      {/* ---- the footing: what the column stands on ---- */}
      <Plate
        chamfer={6}
        screws
        screwInset={14}
        rust
        style={{
          position: 'absolute',
          left: x - FOOT_OVERHANG,
          top: FOOT_TOP,
          width: w + FOOT_OVERHANG * 2,
          height: FOOT_H,
        }}
      >
        {/*
         * Bronze, not chrome. The face used to sit ~40L above the reference's,
         * which made the eight footings the brightest and coolest thing on a
         * screen that is meant to read warm.
         */}
        {shade(0.4, 0.58)}
        {/*
         * A narrow specular streak — a highlight raked across brass, not a
         * full-face gradient. Same rake on all eight; the key light is top left.
         */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background:
              'linear-gradient(118deg, transparent 37%, rgba(255,246,222,0.44) 40.5%, rgba(255,238,208,0.16) 44%, rgba(255,234,200,0.05) 49%, transparent 55%)',
          }}
        />
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            boxShadow: 'inset 0 2px 0 rgba(255,248,226,0.82), inset 0 -2px 3px rgba(0,0,0,0.55)',
          }}
        />
        {/*
         * The meter's light landing on the ledge 8px beneath it. Drawn over the
         * top bevel, not under it: the reference's footing lip is visibly
         * colour-cast, because coloured light falls on a specular edge the same
         * as on anything else. Tight — the lower two thirds stay bronze.
         */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background:
              `radial-gradient(46% 42% at 50% -8%, color-mix(in oklab, ${color} 44%, transparent) 0%,` +
              ` color-mix(in oklab, ${color} 16%, transparent) 46%, transparent 80%)`,
          }}
        />
        {oxide(14, 0.5)}
      </Plate>

      {isLeader && <LeaderRig x={x} w={w} />}
    </>
  )
}

/**
 * The leader's hardware, per side, exactly as the reference stacks it:
 *
 *   · a vertical brass mounting rail hard against the column's own edge;
 *   · a two-screw contact bracket at the TOP of that rail and another at the
 *     BOTTOM — the arc's two endpoints are the same hardware the cable hangs
 *     off, not a separate set of caps;
 *   · a heavier stand-off bracket further out, high and low, with the dark
 *     rubber cable looping between the lower pair down to the footing;
 *   · the bolt running the rail's full height between the two contact posts.
 *
 * The rails stay hard against the column's sides. Run them out in the corridor
 * and the two bolts read as a pair of separate lightning columns rather than as
 * current running up the leader, which is the whole point of the rig.
 */
function LeaderRig({ x, w }: { x: number; w: number }) {
  const sides: { cx: number; seed: number; dir: 1 | -1 }[] = [
    { cx: x - 5, seed: 21, dir: -1 },
    { cx: x + w + 5, seed: 61, dir: 1 },
  ]
  const railTop = 404
  const railBottom = 892
  const topY = 432 // upper contact post — level with the score
  const botY = 826 // lower contact post — level with the last slot
  const standHi = 540
  const standLo = 862
  return (
    <>
      {sides.map(({ cx, seed, dir }) => {
        /*
         * The bolt's interior vertices, in the arc svg's own coordinates: four
         * unequal runs between the two posts, drifting out away from the column
         * and back. Unequal on purpose — the generator spaces its own vertices
         * evenly within whatever span it is handed, so equal pieces would
         * rebuild the same metronome the chain exists to break.
         */
        const run = botY - topY
        const knees = [
          /*
           * Chaos stays near 1 now that the knees carry the excursion. The
           * generator's vertex spacing is fixed at ~9px, so amplitude above
           * about 10 turns the run into a scribble rather than a discharge —
           * the reference's kinks are roughly as tall as they are long.
           */
          { t0: 0, t1: 0.3, ox0: 0, ox1: 16, chaos: 1.05 },
          { t0: 0.3, t1: 0.48, ox0: 16, ox1: -13, chaos: 0.85 },
          { t0: 0.48, t1: 0.77, ox0: -13, ox1: 9, chaos: 1 },
          { t0: 0.77, t1: 1, ox0: 9, ox1: 0, chaos: 0.9 },
        ].map(({ t0, t1, ox0, ox1, chaos }) => ({
          x1: 60 + (t0 === 0 ? 0 : dir * ox0),
          y1: 20 + run * t0,
          x2: t1 === 1 ? 66 : 60 + dir * ox1,
          y2: 20 + run * t1,
          chaos,
        }))
        return (
        <div key={cx} style={{ position: 'absolute', left: 0, top: 0 }} aria-hidden>
          {/* vertical brass mounting rail */}
          <div
            className="brass-band grain"
            style={{
              position: 'absolute',
              left: cx - 7,
              top: railTop,
              width: 14,
              height: railBottom - railTop,
              borderRadius: 3,
              boxShadow:
                'inset 1px 0 0 rgba(255,244,214,0.55), inset -1px 0 0 rgba(40,26,12,0.7), 0 3px 6px rgba(0,0,0,0.6)',
            }}
          />

          {/* the two contact brackets the bolt terminates on */}
          <Bracket cx={cx} top={topY - 20} w={34} h={46} />
          <Bracket cx={cx} top={botY - 26} w={34} h={46} />

          {/* the two stand-off brackets the cable is bolted between */}
          <Bracket cx={cx + dir * 44} top={standHi} w={46} h={118} />
          <Bracket cx={cx + dir * 44} top={standLo} w={46} h={46} />

          {/* dark rubber cable looping out and down between the stand-offs */}
          <svg
            style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, overflow: 'visible' }}
          >
            {[
              { stroke: '#120c09', width: 13, dx: 0 },
              { stroke: 'rgba(146,124,104,0.5)', width: 2.6, dx: -1.5 },
            ].map(({ stroke, width, dx }) => (
              <path
                key={stroke}
                d={
                  `M ${cx + dir * 44 + dx} ${standHi + 108 + dx}` +
                  ` C ${cx + dir * 74 + dx} ${standHi + 152}, ${cx + dir * 72 + dx} ${standLo - 16},` +
                  ` ${cx + dir * 44 + dx} ${standLo + 10 + dx}`
                }
                fill="none"
                stroke={stroke}
                strokeWidth={width}
                strokeLinecap="round"
              />
            ))}
          </svg>

          {/*
           * The bolt's light landing on the metal it crosses. Wide and soft:
           * the reference's bloom is still measurable 25px out from a 4px core,
           * so most of the arc's footprint is spill, not stroke.
           */}
          <div
            style={{
              position: 'absolute',
              left: cx - 104,
              top: topY - 56,
              width: 208,
              height: botY - topY + 112,
              pointerEvents: 'none',
              background:
                'radial-gradient(30% 50% at 50% 50%, rgba(47,217,208,0.30) 0%, rgba(47,217,208,0.13) 44%, rgba(47,217,208,0.05) 68%, transparent 88%)',
            }}
          />

          {/* the arc itself, terminating on the two visible brass posts */}
          <svg
            style={{
              position: 'absolute',
              left: cx - 60,
              top: topY - 20,
              width: 120,
              height: botY - topY + 40,
              overflow: 'visible',
            }}
          >
            {/*
             * Thin cyan filament, not a fat neon ribbon: the reference core is
             * ~4px of #98f9f8 sitting inside a broad ramp. weight scales every
             * stroke together, so the width comes down and the surrounding
             * spill (above) carries the bloom instead.
             *
             * Run in four unequal pieces through the knees above rather than as
             * one 394px bolt. The generator lays a fixed number of evenly
             * spaced vertices between its two endpoints and tapers the jitter
             * to zero at each of them, so a single call over this distance came
             * out a metronome: constant segment length, constant left/right
             * amplitude, top to bottom. Chained, the trunk drifts laterally
             * across its run and the amplitude swells and pinches — which is
             * what the reference bolt does between the same two posts. The
             * joints are interior vertices of one conductor; the arc still
             * terminates on the two brass posts and nothing else.
             */}
            {knees.map((k, i) => (
              <ArcBolt
                key={i}
                x1={k.x1}
                y1={k.y1}
                x2={k.x2}
                y2={k.y2}
                seed={seed + i * 313}
                intensity={1}
                chaos={k.chaos}
                weight={1.2}
                strands={i === 0 || i === 2 ? 2 : 1}
                coreColor="#a6fcf7"
              />
            ))}
            <ContactPost cx={60} cy={20} r={8} />
            <ContactPost cx={66} cy={botY - topY + 20} r={8} />
          </svg>
        </div>
        )
      })}
    </>
  )
}

/** A rectangular brass contact-post bracket with two screws. */
function Bracket({ cx, top, w, h }: { cx: number; top: number; w: number; h: number }) {
  return (
    <Plate
      chamfer={3}
      rust
      style={{ position: 'absolute', left: cx - w / 2, top, width: w, height: h }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'linear-gradient(160deg, rgba(255,238,211,0.3) 0%, transparent 34%),' +
            'linear-gradient(180deg, rgba(224,180,104,0.38) 0%, rgba(96,68,32,0.5) 100%),' +
            'linear-gradient(180deg, rgba(17,13,10,0.14) 0%, rgba(17,13,10,0.34) 100%)',
        }}
      />
      <div style={{ position: 'absolute', left: w / 2 - 5.5, top: 9, width: 11, height: 11 }}>
        <Screw slot={31} />
      </div>
      <div style={{ position: 'absolute', left: w / 2 - 5.5, top: h - 20, width: 11, height: 11 }}>
        <Screw slot={-18} />
      </div>
      {oxide(Math.min(14, Math.round(h * 0.3)), 0.6)}
    </Plate>
  )
}

/**
 * Keys hang from a short brass rail directly above the column that holds them.
 * The keys are the emitters here: their gold light lands on the rail and the
 * plate below, and nowhere else.
 */
function KeyHanger({
  x,
  w,
  keys,
  top,
  span,
}: {
  x: number
  w: number
  keys: number
  top: number
  /** Explicit rail extent, when the rail has to reach fixed hardware. */
  span?: { left: number; width: number }
}) {
  const drawn = Math.min(keys, 3)
  const overflow = keys - drawn
  const pitch = 52
  const railLeft = span ? span.left : x - 12
  const railW = span ? span.width : w + 24
  /*
   * Key size is set against the reference, not against the rail. In
   * 06-big-screen.jpg a hanging key measures ~73 CSS px from the top of its bow
   * to the tip of its bit, with a bow ~33px across — it is the second-largest
   * object on the wall after the score numerals, because on this screen the
   * camp is decided on keys and the board is read from the back of a hall. At
   * size 26 the glyph came out 50px tall with a 14px bow: a lapel pin.
   *
   * KeyGlyph draws 46 viewBox units tall for `size` wide, of which the inked
   * glyph occupies y=2.4..41.2, so the visible run is size * 2.3 * 38.8/46.
   */
  const KEY_W = 38
  const KEY_INK = KEY_W * 2.3 * (38.8 / 46) // 73px — the reference measurement
  /*
   * The drop leaves room for the hook and still lands the key's bit ~15px clear
   * of the medallion bezel below. It used to overlap it by ~5px, which read as
   * a collision rather than as a key hanging above a crest.
   */
  const DROP = 13
  return (
    <div
      style={{ position: 'absolute', left: railLeft, top, width: railW, height: 108 }}
      aria-hidden
    >
      <BrassRail height={13} style={{ width: railW }}>
        {/*
         * The reference's rail is a turned rod, not a flat strip: a hard
         * specular line along the upper quarter, the underside falling to
         * shadow. Same key light as everything else, top left.
         */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 3,
            pointerEvents: 'none',
            background:
              'linear-gradient(180deg, rgba(255,248,226,0.5) 0%, rgba(255,240,208,0.14) 24%,' +
              'rgba(0,0,0,0) 50%, rgba(34,20,8,0.34) 82%, rgba(24,14,6,0.5) 100%)',
          }}
        />
        {/* the two collars the rod is bolted through at each end */}
        {([0, 1] as const).map((end) => (
          <div
            key={end}
            className="brass-band"
            aria-hidden
            style={{
              position: 'absolute',
              left: end === 0 ? 17 : undefined,
              right: end === 1 ? 17 : undefined,
              top: -4,
              width: 12,
              height: 21,
              borderRadius: 2,
              boxShadow:
                'inset 0 1px 0 rgba(255,248,226,0.85), inset 1px 0 0 rgba(255,242,212,0.4),' +
                'inset -1px -1px 0 rgba(38,24,10,0.75), 0 2px 3px rgba(0,0,0,0.55)',
            }}
          />
        ))}
      </BrassRail>
      {/* the keys' light pooling on the rail */}
      <div
        style={{
          position: 'absolute',
          left: railW / 2 - 74,
          top: -8,
          width: 148,
          height: 52,
          pointerEvents: 'none',
          background:
            'radial-gradient(50% 60% at 50% 40%, rgba(255,198,61,0.24) 0%, rgba(255,198,61,0.07) 50%, transparent 78%)',
        }}
      />
      {Array.from({ length: drawn }, (_, i) => {
        const cx = railW / 2 + (i - (drawn - 1) / 2) * pitch
        return (
          <div key={i}>
            {/* the brass collar the key hangs from — one end of the crackle */}
            <div
              className="brass-band"
              style={{
                position: 'absolute',
                left: cx - 8,
                top: 1,
                width: 16,
                height: 16,
                borderRadius: 2,
                boxShadow:
                  'inset 0 1px 0 rgba(255,248,226,0.7), inset -1px -1px 0 rgba(40,26,12,0.7), 0 2px 3px rgba(0,0,0,0.55)',
              }}
            />
            {/* The brass hook the key's bow is threaded on. */}
            <svg
              viewBox="0 0 16 22"
              style={{
                position: 'absolute',
                left: cx - 11,
                top: 4,
                width: 22,
                height: 30,
                overflow: 'visible',
              }}
            >
              <path
                d="M 8 0 C 8 6, 4 8, 4 12 C 4 16, 8 17, 9 14"
                fill="none"
                stroke="#7a5a24"
                strokeWidth="3.4"
                strokeLinecap="round"
              />
              <path
                d="M 8 0 C 8 6, 4 8, 4 12 C 4 16, 8 17, 9 14"
                fill="none"
                stroke="#e2c186"
                strokeWidth="1.3"
                strokeLinecap="round"
                transform="translate(-0.7,-0.7)"
              />
            </svg>
            {/*
             * The key's own emission landing on the hook, the collar and the
             * rail above it. Static: it is 26px of gold on a board read from
             * across a room, and a flickering bolt at that size is noise.
             */}
            <div
              style={{
                position: 'absolute',
                left: cx - 48,
                top: DROP - 22,
                width: 96,
                height: KEY_INK + 48,
                pointerEvents: 'none',
                background:
                  'radial-gradient(38% 42% at 50% 44%, rgba(255,244,208,0.34) 0%,' +
                  'rgba(255,198,61,0.22) 34%, rgba(255,198,61,0.07) 62%, transparent 84%)',
              }}
            />
            <div style={{ position: 'absolute', left: cx - KEY_W / 2, top: DROP }}>
              <KeyGlyph hanging size={KEY_W} />
            </div>
            {/*
             * The key crackles gold, as the concept art shows. This is the one
             * carve-out CLAUDE.md grants outside the ceremony, and it holds to
             * all three of its conditions: each bolt terminates on two visible
             * brass parts — the rail collar above (x cx±8, y 1..17) and the
             * key's own collar bar below (x cx±8, y 70..76) — it stays inside
             * the key's own bloom, and it touches no meter, column or score.
             * Gold appears nowhere else on this screen.
             */}
            <svg
              aria-hidden
              style={{
                position: 'absolute',
                left: cx - 46,
                top: 0,
                width: 92,
                height: DROP + KEY_INK + 16,
                overflow: 'visible',
              }}
            >
              {/*
               * Three unequal segments a side, kneeing out around the bow and
               * back down to the key's collar bar.
               *
               * Run straight down as one 20px bolt it landed inside the bow's
               * own 28px ring and was swallowed by the key's drop shadow —
               * gold crackle nothing could see. Kneed out symmetrically it was
               * worse: two mirrored runs of near-equal length drew a clean
               * lozenge around the key, which reads as an ornament, not as
               * current. The knees below are deliberately different left from
               * right and unevenly spaced down the drop, and chaos is high
               * enough that the generator's jitter survives at this scale.
               *
               * The joints are interior vertices of one conductor; the
               * endpoints are still only the two brass parts.
               */}
              {(
                [
                  { side: -1, xs: [39, 25, 35, 38], ys: [12, 30, 47, 73] },
                  { side: 1, xs: [53, 68, 58, 54], ys: [10, 38, 60, 73] },
                ] as const
              ).map(({ side, xs, ys }) => (
                <g key={side}>
                  {[0, 1, 2].map((s) => (
                    <ArcBolt
                      key={s}
                      x1={xs[s]}
                      y1={ys[s]}
                      x2={xs[s + 1]}
                      y2={ys[s + 1]}
                      seed={i * 31 + side * 7 + s * 313}
                      intensity={0.9}
                      chaos={1.3}
                      weight={0.28}
                      color="var(--color-key)"
                      coreColor="var(--color-key-hot)"
                    />
                  ))}
                </g>
              ))}
            </svg>
          </div>
        )
      })}
      {overflow > 0 && (
        <div
          className="numeral"
          style={{
            position: 'absolute',
            left: railW / 2 + ((drawn - 1) / 2) * pitch + KEY_W / 2 + 10,
            top: DROP + KEY_INK / 2 - 22,
            fontSize: 40,
            color: 'var(--color-key)',
            fontVariantNumeric: 'tabular-nums',
            textShadow: '0 0 10px rgba(255,198,61,0.5)',
          }}
        >
          +{overflow}
        </div>
      )}
    </div>
  )
}
