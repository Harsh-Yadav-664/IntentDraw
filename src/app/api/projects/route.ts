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
      .select('id, name, prompt, created_at, updated_at, is_public')
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

    return NextResponse.json({ success: true, data: { projects } })
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