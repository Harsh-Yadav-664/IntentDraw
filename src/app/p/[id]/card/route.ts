import { createAdminClient } from '@/lib/supabase/server'
import { siteCard } from '@/lib/share/site-card'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * The link-preview image of a shared site (og:image of /p/<id>). Only for
 * sites that are shared; anything else is a plain 404, so a guessed id
 * reveals nothing.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID.test(id)) return new Response('Not found', { status: 404 })

  const { data: project } = await createAdminClient()
    .from('projects')
    .select('name, is_public, brand:canvas_data->pageParts->brief->>brand, summary:canvas_data->pageParts->brief->>summary, palette:canvas_data->pageParts->brief->palette')
    .eq('id', id)
    .single()
  if (!project || !project.is_public) return new Response('Not found', { status: 404 })

  const brand = typeof project.brand === 'string' && project.brand.trim() ? project.brand : project.name
  const card = siteCard({ name: String(brand ?? ''), summary: typeof project.summary === 'string' ? project.summary : null, palette: project.palette && typeof project.palette === 'object' ? (project.palette as Record<string, unknown>) : null })
  // Short, like the page: turning sharing off must take effect quickly.
  return new Response(card.body, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=0, s-maxage=300' } })
}
