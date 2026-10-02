import { createAdminClient } from '@/lib/supabase/server'
import { exportHtml } from '@/lib/export'

/**
 * A shared site, served as a real web page at /p/<id>.
 *
 * SECURITY — this serves model-generated JavaScript from the app's own domain.
 * Without isolation that would be stored XSS: the generated code could read the
 * app's cookies (including the Supabase session) and call its APIs as the
 * visitor. The `sandbox` directive in the Content-Security-Policy gives the
 * document an opaque origin, exactly like the editor's sandboxed preview
 * iframe: scripts run, but they cannot touch this origin's cookies, storage or
 * credentialed requests. Never serve this route without that header.
 */

const SANDBOX_CSP = 'sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function notFound(): Response {
  return new Response(
    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Not found</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;background:#0a0a0b;color:#e5e5e5">
<div style="text-align:center"><p style="font-size:14px;opacity:.6">This site isn't shared, or no longer exists.</p>
<a href="/" style="color:#facc15;font-size:14px">Make your own with IntentDraw</a></div></body></html>`,
    {
      status: 404,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': SANDBOX_CSP,
        'Cache-Control': 'public, max-age=60',
      },
    }
  )
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID.test(id)) return notFound()

  const { data: project } = await createAdminClient()
    .from('projects')
    .select('name, generated_code, is_public')
    .eq('id', id)
    .single()

  // Unshared and missing look identical, so a guessed id reveals nothing.
  if (!project || !project.is_public || !project.generated_code) return notFound()

  const origin = new URL(request.url).origin
  const html = exportHtml(project.generated_code, project.name, origin)

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': SANDBOX_CSP,
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      // Short: turning sharing off must take effect quickly.
      'Cache-Control': 'public, max-age=0, s-maxage=60',
    },
  })
}
