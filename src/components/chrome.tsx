import type { CSSProperties, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

/** Four corner rivets for a plate. */
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

/** Four slotted screws on a plate frame. Slot angles vary per screw. */
export function CornerScrews() {
  const angles = [38, -24, 71, 12]
  return (
    <>
      {(['left-[7px] top-[7px]', 'right-[7px] top-[7px]', 'bottom-[7px] left-[7px]', 'bottom-[7px] right-[7px]'] as const).map(
        (pos, i) => (
          <span key={pos} className={`screw ${pos}`} style={{ ['--slot' as string]: `${angles[i]}deg` }} />
        ),
      )}
    </>
  )
}

/**
 * Machined steel plate: chamfered frame (lit top-left), corner screws,
 * recessed inner panel, fine grain. The wrapper carries the drop shadow
 * because clip-path would clip it off the frame itself.
 */
export function Plate({
  children,
  className = '',
  innerClassName = '',
  frameClassName = '',
  onClick,
  style,
}: {
  children: ReactNode
  className?: string
  innerClassName?: string
  frameClassName?: string
  onClick?: () => void
  style?: CSSProperties
}) {
  return (
    <div className={`plate-shadow ${className}`} style={style}>
      <div
        className={`plate grain h-full p-[9px] ${frameClassName}`}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && onClick() : undefined}
      >
        <CornerScrews />
        <div className={`plate-inner h-full ${innerClassName}`}>{children}</div>
      </div>
    </div>
  )
}

/** Decorative micro barcode. */
export function Barcode({ width = 46, height = 10, className = '' }: { width?: number; height?: number; className?: string }) {
  const bars = [2, 1, 3, 1, 1, 2, 1, 4, 1, 2, 2, 1, 3, 1, 2]
  let x = 0
  return (
    <svg width={width} height={height} viewBox="0 0 40 10" className={className} aria-hidden preserveAspectRatio="none">
      {bars.map((b, i) => {
        const el = <rect key={i} x={x} y="0" width={b * 0.8} height="10" fill="var(--color-text-dim)" opacity="0.85" />
        x += b * 0.8 + 1.1
        return el
      })}
    </svg>
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
            <path d="M10 1 L2 10 L10 19 M2.5 10 H25" fill="none" stroke="var(--color-text)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
      <h1 className="display-title text-[26px] leading-none" style={{ letterSpacing: '0.12em' }}>
        {title}
      </h1>
    </header>
  )
}

/** Engraved brass nameplate (LEADING tag etc.). */
export function BrassPlate({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`inline-block px-3 py-0.5 ${className ?? ''}`}
      style={{
        background: 'linear-gradient(180deg, #d9b06a 0%, #b3823c 30%, #7a5622 78%, #4a3414 100%)',
        borderRadius: 3,
        boxShadow:
          'inset 0 1px 0 rgba(255,232,190,0.65), inset 0 -1px 1px rgba(0,0,0,0.55), 0 2px 3px rgba(0,0,0,0.6)',
      }}
    >
      <span
        className="font-display text-[11px] font-semibold uppercase"
        style={{ letterSpacing: '0.24em', color: '#241708', textShadow: '0 1px 0 rgba(255,232,190,0.35)' }}
      >
        {children}
      </span>
    </div>
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
