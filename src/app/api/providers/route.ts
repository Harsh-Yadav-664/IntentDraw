import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/providers — which AI providers this server can call.
 *
 * Only yes/no per provider: a key's value never leaves the server. Signed-in
 * users only, since it describes the deployment.
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  return NextResponse.json({
    success: true,
    data: {
      gemini: !!process.env.GOOGLE_AI_API_KEY,
      groq: !!process.env.GROQ_API_KEY,
      openrouter: !!process.env.OPENROUTER_API_KEY,
      nvidia: !!process.env.NVIDIA_NIM_API_KEY,
    },
  })
}
