// =============================================================================
// Projects API — Single Project (Load, Save, Delete)
// src/app/api/projects/[id]/route.ts
// =============================================================================
// GET    /api/projects/[id]  → load full project data
// PATCH  /api/projects/[id]  → auto-save project (canvas + prompt + code)
// DELETE /api/projects/[id]  → delete project
// =============================================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'

type RouteParams = { params: Promise<{ id: string }> }

// =============================================================================
// GET — Load a single project
// =============================================================================
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const admin = createAdminClient()
    const { data: project, error } = await admin
      .from('projects')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error || !project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: { project } })
  } catch (error) {
    console.error('[API projects GET id]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to load project' },
      { status: 500 }
    )
  }
}

// =============================================================================
// PATCH — Auto-save project
// =============================================================================
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { name, canvas_data, prompt, generated_code, global_theme } = body as {
      name?: string
      canvas_data?: unknown
      prompt?: string
      generated_code?: string
      global_theme?: string
    }

    // Build update object with only provided fields
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    if (name !== undefined) updates.name = name.trim().slice(0, 100)
    if (canvas_data !== undefined) updates.canvas_data = canvas_data
    if (prompt !== undefined) updates.prompt = prompt
    if (generated_code !== undefined) updates.generated_code = generated_code
    if (global_theme !== undefined) updates.global_theme = global_theme

    const admin = createAdminClient()

    // Verify ownership first
    const { data: existing } = await admin
      .from('projects')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      )
    }

    const { data: project, error } = await admin
      .from('projects')
      .update(updates)
      .eq('id', id)
      .select('id, name, updated_at')
      .single()

    if (error) {
      console.error('[API projects PATCH]', error)
      return NextResponse.json(
        { success: false, error: 'Failed to save project' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: { project } })
  } catch (error) {
    console.error('[API projects PATCH]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to save project' },
      { status: 500 }
    )
  }
}

// =============================================================================
// DELETE — Delete a project
// =============================================================================
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const admin = createAdminClient()

    const { error } = await admin
      .from('projects')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('[API projects DELETE]', error)
      return NextResponse.json(
        { success: false, error: 'Failed to delete project' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API projects DELETE]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete project' },
      { status: 500 }
    )
  }
}