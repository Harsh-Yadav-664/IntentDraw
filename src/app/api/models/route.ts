import { NextResponse } from 'next/server'

export async function GET() {
  const apiKey = process.env.NVIDIA_NIM_API_KEY
  if (!apiKey) {
    return NextResponse.json({ success: false, error: 'API key missing on server' }, { status: 401 })
  }

  try {
    const res = await fetch('https://integrate.api.nvidia.com/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      }
    })

    if (!res.ok) {
      throw new Error(`NVIDIA API Error: ${res.status}`)
    }

    const data = await res.json()
    // data.data is an array of model objects { id: 'meta/llama3-70b-instruct', ... }
    const models = data.data.map((m: any) => m.id).sort()

    return NextResponse.json({ success: true, models })
  } catch (error) {
    console.error('[API Models]', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch models' }, { status: 500 })
  }
}
