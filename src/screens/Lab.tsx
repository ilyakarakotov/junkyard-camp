import { useState } from 'react'
import Breaker from '../components/Breaker'
import CheckCell from '../components/CheckCell'
import Lever from '../components/Lever'
import ChargeTrack, { ChargeReadout } from '../components/ChargeTrack'
import KeyRail, { KeyCount } from '../components/KeyRail'
import TeamCrest from '../components/TeamCrest'
import { Plate } from '../components/chrome'
import { TEAMS } from '../data/seed'
import type { TeamId } from '../data/types'

/**
 * Component bench. Every award mechanic in every state, at both the board size
 * and the sheet size, so a critic can judge them without a screen around them.
 */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <div className="tech-label mb-2 px-1">{title}</div>
      <Plate screws>
        <div className="p-3 pt-5">{children}</div>
      </Plate>
    </section>
  )
}

export default function Lab() {
  const [ticks, setTicks] = useState(6)
  const [keys, setKeys] = useState(2)
  const [fired, setFired] = useState(0)

  return (
    <div className="min-h-dvh px-4 py-5" style={{ maxWidth: 390, margin: '0 auto' }}>
      <h1 className="display-title mb-4 text-[22px]">Component bench</h1>

      <Section title={`Lever · commit stroke · fired ${fired}`}>
        <Lever pendingCount={5} onFire={() => setFired((n) => n + 1)} />
      </Section>

      <Section title="Lever · disabled (nothing selected)">
        <Lever pendingCount={0} onFire={() => {}} />
      </Section>

      <Section title="Breaker · unearned / earned · board size 22px">
        <div className="flex items-center justify-between px-1">
          {TEAMS.slice(0, 5).map((t, i) => (
            <div key={t.id} className="flex flex-col items-center gap-2">
              <Breaker on={i % 2 === 0} color={`var(--color-team-${t.colorToken})`} size={22} glyph="CLN" />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Breaker · sheet size 40px">
        <div className="flex items-center justify-around">
          <Breaker on={false} color="var(--color-team-gems)" size={40} glyph="VRS" />
          <Breaker on color="var(--color-team-gems)" size={40} glyph="VRS" />
          <Breaker on={false} color="var(--color-team-knights)" size={40} glyph="BHV" />
          <Breaker on color="var(--color-team-knights)" size={40} glyph="BHV" />
        </div>
      </Section>

      <Section title="Check cell · not earned / earned · team sheet size 34px">
        <div className="flex items-center justify-around">
          <CheckCell on={false} title="Cleanliness" size={34} />
          <CheckCell on title="Cleanliness" size={34} />
          <CheckCell on={false} title="Behavior" size={44} />
          <CheckCell on title="Behavior" size={44} />
        </div>
      </Section>

      <Section title="Charge track · 0 through 7">
        <div className="flex flex-col gap-2">
          {[0, 3, 5, 6, 7].map((t) => (
            <div key={t} className="flex items-center gap-3">
              <ChargeTrack ticks={t} width={150} />
              <ChargeReadout ticks={t} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Charge track · board size 42px">
        <div className="flex flex-col gap-[6px]">
          {[2, 6, 7].map((t) => (
            <ChargeTrack key={t} ticks={t} width={42} />
          ))}
        </div>
      </Section>

      <Section title="Charge track · live">
        <div className="flex items-center gap-3">
          <ChargeTrack ticks={ticks} width={150} surging={ticks === 7} />
          <ChargeReadout ticks={ticks} />
        </div>
        <div className="mt-3 flex gap-2">
          <button
            className="steel-raised bevel display-title h-9 flex-1 rounded text-[12px]"
            onClick={() => setTicks((t) => Math.max(0, t - 1))}
          >
            −
          </button>
          <button
            className="steel-raised bevel display-title h-9 flex-1 rounded text-[12px]"
            onClick={() => setTicks((t) => Math.min(7, t + 1))}
          >
            +
          </button>
        </div>
      </Section>

      <Section title="Key rail · 0 / 1 / 3 / 5 keys">
        <div className="flex flex-col gap-3">
          {[0, 1, 3, 5].map((k) => (
            <KeyRail key={k} keys={k} width={150} />
          ))}
        </div>
      </Section>

      <Section title="Key rail · live">
        <KeyRail keys={keys} width={170} justAdded />
        <div className="mt-3 flex gap-2">
          <button
            className="steel-raised bevel display-title h-9 flex-1 rounded text-[12px]"
            onClick={() => setKeys((k) => Math.max(0, k - 1))}
          >
            −
          </button>
          <button
            className="steel-raised bevel display-title h-9 flex-1 rounded text-[12px]"
            onClick={() => setKeys((k) => k + 1)}
          >
            +
          </button>
        </div>
      </Section>

      <Section title="Key count · board form (no multiplier)">
        <div className="flex items-center justify-around">
          {[0, 1, 2, 4].map((k) => (
            <KeyCount key={k} keys={k} />
          ))}
        </div>
      </Section>

      <Section title="Eight crests">
        <div className="grid grid-cols-4 gap-3">
          {TEAMS.map((t) => (
            <div key={t.id} className="flex flex-col items-center gap-1">
              <TeamCrest teamId={t.id as TeamId} size={56} />
              <span className="tech-label text-[7px]">{t.shortName}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}
