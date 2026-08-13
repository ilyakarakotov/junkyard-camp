import { ArcGap } from '../fx/Arc'
import Lever from '../components/Lever'

/** Dev-only bench for FX components. Not linked from the app. */
export default function Lab() {
  return (
    <div className="flex min-h-dvh flex-col items-center gap-10 p-8">
      <div className="w-full max-w-[358px]">
        <Lever label="PULL DOWN TO AWARD +1" onFire={() => console.log('FIRE')} />
      </div>
      <div className="steel bevel rounded-sm p-6">
        <div className="tech-label mb-2">ARC-GAP / IDLE 0.5</div>
        <ArcGap width={220} seed={3} intensity={0.5} />
      </div>
      <div className="steel-raised bevel rounded-sm p-6">
        <div className="tech-label mb-2">ARC-GAP / FULL 1.0</div>
        <ArcGap width={300} seed={8} intensity={1} />
      </div>
      <div className="steel bevel rounded-sm p-6">
        <div className="tech-label mb-2">ARC-GAP / SHORT</div>
        <ArcGap width={110} seed={5} intensity={0.9} postR={4} height={22} />
      </div>
    </div>
  )
}
