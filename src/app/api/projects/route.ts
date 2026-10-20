// =============================================================================
// Projects API — List & Create
// src/app/api/projects/route.ts
// =============================================================================
// GET  /api/projects        → list authenticated user's projects
// POST /api/projects        → create a new project
// =============================================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { toThumbnail } from '@/lib/projects/thumbnail'

/** How many sections the last generation planned (0 when nothing was built yet). */
function sectionCountOf(canvasData: unknown): number {
  const parts = (canvasData as { pageParts?: { sections?: unknown } } | null)?.pageParts
  return Array.isArray(parts?.sections) ? parts.sections.length : 0
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_PROMPT_CHARS = 8000

// =============================================================================
// GET — List user's projects
// =============================================================================
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const admin = createAdminClient()
    const { data: projects, error } = await admin
      .from('projects')
      .select('id, name, prompt, created_at, updated_at, is_public, canvas_data, generated_code')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('[API projects GET]', error)
      return NextResponse.json(
        { success: false, error: 'Failed to load projects' },
        { status: 500 }
      )
    }

    // `canvas_data` and `generated_code` are read so the dashboard can show what
    // a project actually contains, but never sent whole — a page of 50 projects
    // would be megabytes of region intent text and TSX. Each is reduced here to
    // the few numbers the card renders.
    const summarized = (projects ?? []).map(({ canvas_data, generated_code, ...project }) => ({
      ...project,
      hasOutput: typeof generated_code === 'string' && generated_code.length > 0,
      thumbnail: toThumbnail(canvas_data),
      sectionCount: sectionCountOf(canvas_data),
    }))

    return NextResponse.json({ success: true, data: { projects: summarized } })
  } catch (error) {
    console.error('[API projects GET]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to load projects' },
      { status: 500 }
    )
  }
}

// =============================================================================
// POST — Create a new project
// =============================================================================
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = (await request.json().catch(() => ({}))) as {
      name?: unknown
      prompt?: unknown
      canvas_data?: unknown
      duplicateOf?: unknown
    }
    const admin = createAdminClient()

    // A new project is empty, starts from an example (prompt + drawing), or is
    // a copy of one of the user's own projects. A copy is never public.
    let row: { name: string; prompt: string; canvas_data: unknown; generated_code: string | null; global_theme?: string | null } = {
      name: typeof body.name === 'string' ? body.name : 'Untitled Project',
      prompt: typeof body.prompt === 'string' ? body.prompt.slice(0, MAX_PROMPT_CHARS) : '',
      canvas_data: body.canvas_data && typeof body.canvas_data === 'object' ? body.canvas_data : null,
      generated_code: null,
    }
    if (typeof body.duplicateOf === 'string') {
      if (!UUID.test(body.duplicateOf)) {
        return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 })
      }
      const { data: source } = await admin
        .from('projects')
        .select('name, prompt, canvas_data, generated_code, global_theme')
        .eq('id', body.duplicateOf)
        .eq('user_id', user.id)
        .single()
      if (!source) {
        return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 })
      }
      row = {
        name: `${source.name} (copy)`,
        prompt: source.prompt ?? '',
        canvas_data: source.canvas_data,
        generated_code: source.generated_code,
        global_theme: source.global_theme,
      }
    }

    const { data: project, error } = await admin
      .from('projects')
      .insert({
        user_id: user.id,
        name: row.name.trim().slice(0, 100) || 'Untitled Project',
        canvas_data: row.canvas_data as never,
        prompt: row.prompt,
        generated_code: row.generated_code,
        ...(row.global_theme !== undefined ? { global_theme: row.global_theme } : {}),
        is_public: false,
      })
      .select('id, name, created_at, updated_at')
      .single()

    if (error) {
      console.error('[API projects POST]', error)
      return NextResponse.json(
        { success: false, error: 'Failed to create project' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { success: true, data: { project } },
      { status: 201 }
    )
  } catch (error) {
    console.error('[API projects POST]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create project' },
      { status: 500 }
    )
  }
}