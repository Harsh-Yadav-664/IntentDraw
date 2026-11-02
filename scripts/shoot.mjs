/**
 * Screenshots pages with the locally installed Chrome, headless — for checking
 * generated pages by eye when no browser pane is available (a hidden pane draws
 * no frames, so animation never runs). Zero API calls.
 *
 *   node scripts/shoot.mjs <outDir> <url> [url…] [--size=1280,800] [--wait=9000] [--scroll=N]
 *
 * --scroll=N also shoots N screens further down (the page is scrolled by script).
 *
 * Headless Chrome runs only a handful of animation frames, so pages are shot
 * with prefers-reduced-motion forced on: generated scenes then render their
 * finished state. Check motion itself in a real browser.
 */
import { execFileSync } from 'child_process'
import { existsSync, mkdirSync } from 'fs'
import { join, resolve } from 'path'

const args = process.argv.slice(2)
const flag = (name, fallback) => args.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback
const [outDir, ...urls] = args.filter(a => !a.startsWith('--'))
if (!outDir || urls.length === 0) throw new Error('usage: shoot.mjs <outDir> <url> [url…]')
const chrome = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].find(p => p && existsSync(p))
if (!chrome) throw new Error('no Chrome found — set CHROME=/path/to/chrome')
mkdirSync(outDir, { recursive: true })
const size = flag('size', '1280,800')
const wait = flag('wait', '9000')
const screens = Number(flag('scroll', '0'))

for (const url of urls) {
  const name = url.replace(/^https?:\/\/[^/]+\//, '').replace(/[^\w.-]+/g, '_').replace(/\.html$/, '') || 'page'
  for (let i = 0; i <= screens; i++) {
    const target = i === 0 ? url : `${url}${url.includes('#') ? '' : '#'}__scroll=${i}`
    const file = resolve(join(outDir, `${name}${i ? `-${i}` : ''}.png`))
    execFileSync(chrome, ['--headless=new', '--disable-gpu', '--force-prefers-reduced-motion', '--hide-scrollbars', `--window-size=${size}`, `--virtual-time-budget=${wait}`, `--screenshot=${file}`, target], { stdio: 'ignore' })
    console.log(file)
  }
}
