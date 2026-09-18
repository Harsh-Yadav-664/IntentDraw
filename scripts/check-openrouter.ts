/**
 * Live smoke test for the OpenRouter provider — one trivial call, one model.
 *
 *   npx tsx scripts/check-openrouter.ts                 # default model
 *   npx tsx scripts/check-openrouter.ts z-ai/glm-5.2:free
 *
 * Costs one free-tier request, not a generation-sized one. Use it to confirm
 * the key works and the model ID is still live BEFORE burning quota on a real
 * generation. Without OPENROUTER_API_KEY it still runs and should print a clear,
 * actionable error rather than a stack trace.
 *
 * Note: tsx runs this as CJS, so there is no top-level await — hence main().
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Minimal .env.local loader. The repo has no dotenv dependency and tsx doesn't
 * honour Node's --env-file, so read the file directly rather than adding a
 * package just for one script. Existing process.env values always win.
 */
function loadEnvLocal(): void {
  try {
    const raw = readFileSync(resolve(__dirname, '..', '.env.local'), 'utf8')
    for (const line of raw.split('\n')) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (!match) continue
      const [, key, rawValue] = match
      if (process.env[key]) continue
      process.env[key] = rawValue.trim().replace(/^["']|["']$/g, '')
    }
  } catch {
    // No .env.local — fine, the provider will report the missing key itself.
  }
}

async function main(): Promise<void> {
  loadEnvLocal()

  // Imported after the env is populated: the module reads process.env at call
  // time, but keeping the order explicit avoids a future footgun.
  const { openrouterGenerate, OPENROUTER_DEFAULT_MODEL, OPENROUTER_ALTERNATE_MODELS } =
    await import('../src/lib/ai/openrouter')

  const model = process.argv[2] || OPENROUTER_DEFAULT_MODEL

  console.log('OpenRouter smoke test')
  console.log('  model     :', model)
  console.log('  alternates:', OPENROUTER_ALTERNATE_MODELS.join(', '))
  console.log('  key set   :', process.env.OPENROUTER_API_KEY ? 'yes' : 'NO')
  console.log()

  const started = Date.now()
  try {
    const text = await openrouterGenerate(
      'You are a terse assistant. Answer in one short line, no preamble.',
      'Reply with exactly: OPENROUTER OK',
      model
    )
    console.log(`--- response (${Date.now() - started}ms) ---`)
    console.log(text.trim())
    console.log('\nPASS — provider reachable and the model ID is live.')
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`--- failed after ${Date.now() - started}ms ---`)
    console.error(message)
    console.error('\nFAIL — see the message above. A missing/invalid key or a 402')
    console.error('daily-allowance message is expected until a key is configured.')
    process.exitCode = 1
  }
}

main()
