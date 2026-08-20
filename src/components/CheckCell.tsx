import { usePrefersReducedMotion } from '../fx/Arc'

/**
 * CheckCell — the award state of a binary category, as a checkmark.
 *
 * A switch says "a setting is on". A check says "the point was given", which is
 * what the leader is actually recording, and it is one tap to read across six
 * rows at arm's length in a noisy hall.
 *
 * Unawarded is a **dark recess with the check engraved into its floor** — never
 * an empty hole. You have to be able to read what a team is missing as easily
 * as what they earned, and an engraved ghost is what makes the empty socket
 * read as a place a mark goes rather than as a gap in the plate.
 *
 * Awarded, the check is the emitter: amber (energized contacts are amber, teal
 * is only ever electricity), a white-hot core over a lamp-coloured body, and a
 * tight spill onto the metal around the socket with a real falloff. The socket
 * walls catch that light along their lower-right lip, which is the same top-left
 * key light every other part on the screen is lit by.
 *
 * Motion is transform and opacity only — the mark scales up out of the well as
 * it ignites — and `prefers-reduced-motion` drops the travel while keeping the
 * state change.
 */

export interface CheckCellProps {
  on: boolean
  /** Box edge in px. */
  size?: number
  /** Category label, for the image role's accessible name. */
  title?: string
}

/* The check itself, drawn in a 24-square so the stroke weights stay honest at
   any size. Struck low-left to high-right, with a short foot and a long tail. */
const CHECK_D = 'M5.2 12.6 L9.9 17.4 L18.8 6.9'

export default function CheckCell({ on, size = 34, title }: CheckCellProps) {
  const reduced = usePrefersReducedMotion()
  const r = Math.round(size * 0.12)
  return (
    <span
      role="img"
      aria-label={title ? `${title}: ${on ? 'earned' : 'not earned'}` : undefined}
      className="relative block shrink-0"
      style={{ width: size, height: size }}
    >
      {/*
       * The light the mark throws onto the plate. Sized the way the toggle's
       * was: strong within half a socket's width, gone by one socket out, so
       * six lit rows do not merge into one orange band.
       */}
      {on && (
        <span
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            inset: -Math.round(size * 0.32),
            borderRadius: 9999,
            background:
              'radial-gradient(ellipse closest-side, rgba(252,150,46,0.5) 0%, rgba(252,150,46,0.44) 42%, rgba(250,145,42,0.28) 58%, rgba(248,140,38,0.14) 72%, rgba(246,135,34,0.05) 86%, transparent 100%)',
          }}
        />
      )}

      {/* the well: a square socket milled into the plate, dark under its
          top-left lip, one lit lower-right lip. Lit, that lip is warmer,
          because the mark inside it is throwing light down onto it. */}
      <span
        aria-hidden
        className="absolute inset-0"
        style={{
          borderRadius: r,
          background: on
            ? 'linear-gradient(158deg, #16100a 0%, #24170e 52%, #3a2414 100%)'
            : 'linear-gradient(158deg, #0f0a07 0%, var(--color-well) 54%, #2a2019 100%)',
          boxShadow: on
            ? 'inset 2px 2px 5px rgba(0,0,0,0.88), inset -1px -1px 0 rgba(255,214,150,0.42), 0 1px 0 rgba(255,240,216,0.16)'
            : 'inset 2px 2px 5px rgba(0,0,0,0.9), inset -1px -1px 0 var(--color-well-rim)',
        }}
      />

      {/* the socket's brass bezel: a hairline chamfer, lit top-left */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          borderRadius: r,
          boxShadow: on
            ? 'inset 0 1px 0 rgba(255,236,196,0.3), 0 1px 1px rgba(0,0,0,0.55)'
            : 'inset 0 1px 0 rgba(255,236,196,0.14), 0 1px 1px rgba(0,0,0,0.55)',
        }}
      />

      {/* the mark */}
      <span
        className="pointer-events-none absolute inset-0"
        style={{
          opacity: on ? 1 : 0.85,
          transform: on ? 'scale(1)' : 'scale(0.94)',
          transition: reduced ? 'none' : 'transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 140ms linear',
        }}
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          aria-hidden
          style={{ display: 'block', overflow: 'visible' }}
        >
          {on ? (
            <>
              {/* the light bleeding off the filament onto the well floor */}
              <path
                d={CHECK_D}
                fill="none"
                stroke="var(--color-lamp)"
                strokeWidth="6.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.16"
              />
              <path
                d={CHECK_D}
                fill="none"
                stroke="var(--color-lamp)"
                strokeWidth="4.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.34"
              />
              {/* the body of the filament */}
              <path
                d={CHECK_D}
                fill="none"
                stroke="var(--color-lamp)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* white-hot core, thinner than the body it sits inside */}
              <path
                d={CHECK_D}
                fill="none"
                stroke="var(--color-lamp-hot)"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          ) : (
            <>
              {/* engraved: a dark groove with one lit lower lip, cut into the
                  well floor by the same top-left key light */}
              <path
                d={CHECK_D}
                fill="none"
                stroke="rgba(0,0,0,0.72)"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={CHECK_D}
                fill="none"
                stroke="var(--color-off-knob)"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.9"
                transform="translate(0.35 0.55)"
              />
              <path
                d={CHECK_D}
                fill="none"
                stroke="var(--color-off-track)"
                strokeWidth="0.9"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.55"
                transform="translate(0.5 0.8)"
              />
            </>
          )}
        </svg>
      </span>
    </span>
  )
}
