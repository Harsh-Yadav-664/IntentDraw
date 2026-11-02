import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cleanPreferenceRecord, PREFERENCE_LOG, VERSIONS_ENABLED } from '@/lib/ai/versions'

/**
 * POST /api/preferences — logs which version of a page the user preferred,
 * with the prompt and the model behind each section (versions.ts). Read with
 * `npx tsx scripts/preference-report.ts`.
 *
 * Development only, like version comparison itself. Appended to a local file;
 * where the filesystem is read-only (a deployed build with comparison turned
 * on) the record goes to the server log instead. No database table yet — that
 * is a schema decision for when the data has proved useful.
 */
export async function POST(request: Request) {
  if (!VERSIONS_ENABLED) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized. Please sign in.' }, { status: 401 })
  }

  const record = cleanPreferenceRecord(await request.json().catch(() => null))
  if (!record) return NextResponse.json({ success: false, error: 'Not a preference record' }, { status: 400 })

  const line = JSON.stringify({ ...record, userId: user.id }) + '\n'
  try {
    const fs = await import('fs/promises')
    const path = await import('path')
    const file = path.join(process.cwd(), PREFERENCE_LOG)
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.appendFile(file, line)
    return NextResponse.json({ success: true, data: { stored: 'file' } })
  } catch {
    console.info('[preference]', line.trim())
    return NextResponse.json({ success: true, data: { stored: 'log' } })
  }
}
