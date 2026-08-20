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
