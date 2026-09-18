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

/** Reference width the canvas draws against — thumbnails normalise against it. */
const CANVAS_WIDTH = 1280
const CANVAS_HEIGHT = 1000
const MAX_THUMBNAIL_SHAPES = 24

export interface ProjectThumbnail {
  shapes: Array<{ x: number; y: number; w: number; h: number; type: string }>
  total: number
}

/**
 * Reduces a saved canvas to a handful of normalised (0-1) boxes the dashboard
 * can draw as a wireframe. Older projects stored a bare `Region[]` rather than
 * `{ regions, groups }`, so both shapes are accepted.
 */
function toThumbnail(canvasData: unknown): ProjectThumbnail | null {
  const regions = Array.isArray(canvasData)
    ? canvasData
    : (canvasData as { regions?: unknown[] } | null)?.regions

  if (!Array.isArray(regions) || regions.length === 0) return null

  const shapes = regions
    .slice(0, MAX_THUMBNAIL_SHAPES)
    .map((region) => (region as { geometry?: Record<string, number | string> }).geometry)
    .filter((g): g is Record<string, number | string> => !!g)
    .map((g) => ({
      x: +(Number(g.x) / CANVAS_WIDTH).toFixed(4),
      y: +(Number(g.y) / CANVAS_HEIGHT).toFixed(4),
      w: +(Number(g.width) / CANVAS_WIDTH).toFixed(4),
      h: +(Number(g.height) / CANVAS_HEIGHT).toFixed(4),
      type: String(g.type ?? 'rectangle'),
    }))
    .filter((s) => Number.isFinite(s.x) && Number.isFinite(s.y) && s.w > 0 && s.h > 0)

  return shapes.length > 0 ? { shapes, total: regions.length } : null
}

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

    const body = await request.json()
    const { name = 'Untitled Project' } = body as { name?: string }

    const admin = createAdminClient()
    const { data: project, error } = await admin
      .from('projects')
      .insert({
        user_id: user.id,
        name: name.trim().slice(0, 100) || 'Untitled Project',
        canvas_data: null,
        prompt: '',
        generated_code: null,
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