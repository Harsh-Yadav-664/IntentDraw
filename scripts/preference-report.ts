/**
 * Which models' sections the owner preferred when comparing versions — read
 * from the log `POST /api/preferences` writes. Zero API calls.
 *
 *   npx tsx scripts/preference-report.ts [path/to/version-preferences.jsonl]
 */
import { readFileSync } from 'node:fs'
import { cleanPreferenceRecord, PREFERENCE_LOG, summarizePreferences, type PreferenceRecord } from '../src/lib/ai/versions'

const file = process.argv[2] ?? PREFERENCE_LOG
let text = ''
try {
  text = readFileSync(file, 'utf8')
} catch {
  console.log(`No preferences logged yet (${file}). Star a version in the editor's Versions list first.`)
  process.exit(0)
}

const records = text
  .split('\n')
  .filter(Boolean)
  .map(line => {
    try {
      return cleanPreferenceRecord(JSON.parse(line))
    } catch {
      return null
    }
  })
  .filter((r): r is PreferenceRecord => r !== null)

console.log(`${records.length} preference${records.length === 1 ? '' : 's'} from ${file}\n`)

console.log('Per model (sections that differed between the preferred page and another):')
for (const { model, wins, losses } of summarizePreferences(records)) {
  console.log(`  ${model.padEnd(44)} preferred ${String(wins).padStart(3)}   passed over ${String(losses).padStart(3)}`)
}

// Which pipeline steps tend to make a page worse — e.g. the layout auto-fix.
const lostBy = new Map<string, number>()
const kept = new Map<string, number>()
for (const r of records) {
  kept.set(r.preferred.kind, (kept.get(r.preferred.kind) ?? 0) + 1)
  for (const o of r.others) lostBy.set(o.kind, (lostBy.get(o.kind) ?? 0) + 1)
}
console.log('\nPer kind of version:')
for (const kind of new Set([...kept.keys(), ...lostBy.keys()])) {
  console.log(`  ${kind.padEnd(16)} preferred ${String(kept.get(kind) ?? 0).padStart(3)}   passed over ${String(lostBy.get(kind) ?? 0).padStart(3)}`)
}
