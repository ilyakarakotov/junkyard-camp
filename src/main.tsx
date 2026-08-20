import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/oswald/400.css'
import '@fontsource/oswald/500.css'
import '@fontsource/oswald/600.css'
import '@fontsource/oswald/700.css'
import '@fontsource/barlow-condensed/400.css'
import '@fontsource/barlow-condensed/500.css'
import '@fontsource/barlow-condensed/600.css'
import '@fontsource/barlow-condensed/700.css'
import '@fontsource/jetbrains-mono/400.css'
import './theme.css'
import App from './App'
import { applyDataEpoch } from './data/epoch'

/*
 * Before anything reads storage: sweep whatever a previous epoch left on this
 * device. Every phone that ran the rehearsal build holds a mirror full of
 * invented scores, and no server command can reach it — the wipe has to
 * travel in the bundle. See src/data/epoch.ts.
 */
applyDataEpoch()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

/*
 * The splash plate in index.html covers the JS download — but on a warm cache
 * that download takes 100ms and the marquee read as a flicker, so the plate
 * holds for ~1.5s measured FROM NAVIGATION START before fading. A slow first
 * load that already spent the budget gets the app the moment it's ready; the
 * hold never adds waiting on top of real loading. Gates mode drops the hold so
 * the screenshot checks measure the screens, not the splash. The fade is
 * opacity only, per the motion rules, and runs two frames after React's first
 * render so the real UI is already painted underneath.
 */
const splash = document.getElementById('splash')
if (splash) {
  const MIN_SHOW_MS = import.meta.env.MODE === 'gates' ? 0 : 1500
  setTimeout(
    () =>
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          splash.style.opacity = '0'
          setTimeout(() => splash.remove(), 450)
        }),
      ),
    Math.max(0, MIN_SHOW_MS - performance.now()),
  )
}
