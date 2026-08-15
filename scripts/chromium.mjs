// One place that knows where Chromium lives. The CI image ships it at a fixed
// path; a dev machine has whatever playwright downloaded into its cache.
import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export function chromiumPath() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH
  if (existsSync('/opt/pw-browsers/chromium')) return '/opt/pw-browsers/chromium'
  const cache = join(homedir(), 'Library/Caches/ms-playwright')
  if (!existsSync(cache)) return undefined
  const versions = readdirSync(cache)
    .filter((d) => d.startsWith('chromium-'))
    .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]))
  for (const v of versions) {
    for (const app of ['Google Chrome for Testing.app', 'Chromium.app']) {
      const p = join(cache, v, 'chrome-mac-arm64', app, 'Contents/MacOS', app.replace('.app', ''))
      if (existsSync(p)) return p
    }
    const linux = join(cache, v, 'chrome-linux', 'chrome')
    if (existsSync(linux)) return linux
  }
  // undefined lets playwright fall back to its own resolution and produce a
  // better error message than a bogus path would.
  return undefined
}
