// Starts `next dev`, then compiles every page and API route up front.
//
// Next's dev server compiles a route the first time it is requested, and on
// this machine that is 8-13s per route: "Get started" waited for /dashboard to
// compile, "New project" for /project/[id] and /api/projects, and the first
// Generate for each /api/generate/* route. Requesting them all once, in the
// background, right after the server is ready means a click finds them built.
//
// `pnpm dev:raw` runs plain `next dev` without the warm-up.
import { spawn } from 'node:child_process'

const PORT = process.env.PORT || '3000'
const BASE = `http://localhost:${PORT}`

// Pages first (what the owner clicks), then the API routes behind them.
// A GET to a POST-only route still compiles it; the 405 it returns is expected.
const ROUTES = [
  '/',
  '/dashboard',
  '/project/00000000-0000-0000-0000-000000000000',
  '/api/projects',
  '/api/usage',
  '/api/generate/understand',
  '/api/generate/shell',
  '/api/generate/section',
  '/api/image',
  '/api/models',
]

const next = spawn('pnpm', ['exec', 'next', 'dev', '--port', PORT], { stdio: 'inherit', shell: true })
next.on('exit', code => process.exit(code ?? 0))
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => next.kill(signal))

async function hit(path) {
  try {
    const res = await fetch(BASE + path, { redirect: 'manual', signal: AbortSignal.timeout(180_000) })
    await res.arrayBuffer()
    return res.status
  } catch {
    return null
  }
}

async function warm() {
  // Wait for the server to answer at all.
  for (let i = 0; i < 240 && (await hit('/api/usage')) === null; i++) {
    await new Promise(r => setTimeout(r, 1000))
  }
  const started = Date.now()
  for (const route of ROUTES) await hit(route)
  const secs = Math.round((Date.now() - started) / 1000)
  console.log(`\n  ✓ IntentDraw warmed up in ${secs}s — every page is compiled. Open ${BASE}\n`)
}

warm()
