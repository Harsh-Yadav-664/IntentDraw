import { getProModel } from './gemini'

export interface DesignTokenSet {
  id: string
  name: string
  borderRadius: string
  colorPalette: string
  typography: string
  shadowTreatment: string
  bannedClasses: string[]
  specialInstructions?: string
}

export const PRESETS: Record<string, DesignTokenSet> = {
  neosleek: {
    id: 'neosleek',
    name: 'Neosleek / Brutalist',
    borderRadius: 'rounded-none (0px, sharp corners exclusively)',
    colorPalette: 'High contrast monochrome (bg-white/bg-black) with one striking accent color (e.g., bg-orange-600 or bg-blue-600). Do not use soft grays (gray-50) for backgrounds.',
    typography: 'Modern Sans (e.g., Space Grotesk, Inter). Very tight tracking (tracking-tighter), heavy font weights (font-black, font-extrabold) for headings.',
    shadowTreatment: 'Hard brutalist shadows (e.g., shadow-[4px_4px_0_0_rgba(0,0,0,1)]) and thick borders (border-2 border-black).',
    bannedClasses: ['rounded-md', 'rounded-lg', 'rounded-xl', 'rounded-full', 'shadow-sm', 'shadow-md', 'shadow-lg', 'bg-gray-50', 'bg-slate-50', 'bg-gray-100', 'text-gray-500'],
    specialInstructions: 'Components should look stark, bold, and highly structural. Avoid subtlety.',
  },
  playful_pop: {
    id: 'playful_pop',
    name: 'Playful Pop',
    borderRadius: 'rounded-full or rounded-3xl (pill shapes and heavy rounding exclusively)',
    colorPalette: 'Vibrant pastels and soft brights (e.g., bg-pink-100, bg-yellow-100, bg-purple-500).',
    typography: 'Friendly rounded sans-serif. Loose tracking, chunky weights for headings.',
    shadowTreatment: 'Soft, large, colorful drop shadows (e.g., shadow-[0_8px_30px_rgb(0,0,0,0.12)]) or bouncy offset shadows.',
    bannedClasses: ['rounded-none', 'rounded-sm', 'border-black', 'shadow-sm', 'bg-gray-900', 'rounded-md'],
    specialInstructions: 'Interfaces should feel friendly, bubbly, and approachable. Use plenty of padding.',
  },
  elegant_serif: {
    id: 'elegant_serif',
    name: 'Elegant Serif / Editorial',
    borderRadius: 'rounded-sm or rounded-md (slight, sophisticated rounding)',
    colorPalette: 'Muted, editorial tones (e.g., slate, cream, beige, gold, dark forest green, navy). bg-[#FAFAFA] or bg-[#F3F4F6] with subtle borders.',
    typography: 'Elegant serif fonts (e.g., Playfair Display, Merriweather) for headings, highly legible clean sans-serif for body text. Wide tracking for uppercase subtitles.',
    shadowTreatment: 'Very subtle, elegant shadows or no shadows at all (relying on fine borders instead).',
    bannedClasses: ['rounded-full', 'rounded-3xl', 'shadow-xl', 'shadow-2xl', 'font-black', 'bg-blue-600', 'bg-red-500'],
    specialInstructions: 'Design should read like a premium magazine or high-end portfolio. Emphasize white space and typographic hierarchy.',
  },
  glassmorphism: {
    id: 'glassmorphism',
    name: 'Premium Glassmorphism',
    borderRadius: 'rounded-2xl or rounded-[32px] (modern soft-app rounding)',
    colorPalette: 'Dark mode base (bg-slate-950) with vibrant glowing gradients behind components (e.g., bg-gradient-to-tr from-purple-600 to-blue-500).',
    typography: 'Clean modern sans (Inter, Roboto). Use text-transparent bg-clip-text for gradient headings.',
    shadowTreatment: 'Translucent glass surfaces: bg-white/10 (or bg-black/10), backdrop-blur-md, and thin translucent borders (border border-white/20). Soft glowing ambient shadows.',
    bannedClasses: ['bg-white', 'bg-gray-50', 'shadow-sm', 'rounded-none'],
    specialInstructions: 'Components must float over colorful blurred backgrounds. Use backdrop filters heavily for depth.',
  }
}

/**
 * Deterministic keyword pre-pass. If the prompt contains strong, unambiguous
 * stylistic cues, resolve the preset WITHOUT spending a model call.
 * Returns null when the signal is weak or conflicting — the LLM decides then.
 */
function resolveByKeywords(prompt: string): DesignTokenSet | null {
  const p = prompt.toLowerCase()

  const scores: Record<string, number> = { neosleek: 0, playful_pop: 0, elegant_serif: 0, glassmorphism: 0 }

  const cues: Record<string, string[]> = {
    neosleek: ['brutalist', 'brutalism', 'stark', 'sharp corners', 'high contrast', 'bold and raw', 'neo-brutal'],
    playful_pop: ['playful', 'fun ', 'bubbly', 'bouncy', 'pastel', 'colorful', 'cartoon', 'kid', 'cheerful'],
    elegant_serif: ['elegant', 'editorial', 'serif', 'magazine', 'luxurious', 'luxury', 'premium', 'sophisticated', 'classic', 'refined'],
    glassmorphism: ['glassmorphism', 'glass', 'futuristic', 'gradient', 'glow', 'neon', 'translucent', 'blur', 'modern saas', 'tech'],
  }

  for (const [preset, words] of Object.entries(cues)) {
    for (const w of words) {
      if (p.includes(w)) scores[preset]++
    }
  }

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1])
  const [bestKey, bestScore] = sorted[0]
  const runnerUpScore = sorted[1][1]

  // Only trust the keyword pass when there is a clear, unopposed signal
  if (bestScore >= 1 && bestScore > runnerUpScore) {
    return PRESETS[bestKey]
  }
  return null
}

/**
 * Resolves concrete design tokens based on the user's prompt.
 * Fast path: deterministic keyword matching (no model call).
 * Slow path: a small LLM classification call when keywords are ambiguous.
 * Fallback: random preset rotation so output never defaults to generic.
 */
export async function resolveDesignTokens(prompt: string): Promise<DesignTokenSet> {
  const keys = Object.keys(PRESETS)

  // 1. Deterministic keyword resolution — free and instant
  const byKeyword = resolveByKeywords(prompt)
  if (byKeyword) {
    console.log(`[AI Classify] Design tokens resolved by keywords: ${byKeyword.id}`)
    return byKeyword
  }

  // 2. Ambiguous prompt — ask a cheap model call
  try {
    const model = getProModel()
    const systemPrompt = `You are a design intent classifier.
You must map the user's prompt to one of the following exact preset IDs: ${keys.join(', ')}.

PRESETS:
- neosleek: Brutalist, stark, sharp, high contrast, bold structural design.
- playful_pop: Fun, bouncy, pastel, highly rounded, bubbly.
- elegant_serif: Sophisticated, editorial, minimal borders, serif fonts, magazine-like.
- glassmorphism: Modern premium software, gradients, blurred backgrounds, translucent.

RULES:
1. ONLY return the exact string ID of the preset. No extra text, no markdown.
2. Weight EXPLICIT stylistic adjectives (e.g. "playful and fun", "minimal and clean", "brutalist") heavily.
3. IGNORE incidental structural adjectives (e.g., if a user says "a bold headline", that does NOT mean they want the entire site to be "neosleek" brutalist. A playful site can have a bold headline).
4. If the prompt has absolutely no explicit or implied stylistic direction, return "random".`

    const result = await model.generateContent([
      { text: systemPrompt },
      { text: `User Prompt: "${prompt}"` }
    ], {
      // Cheap classification; if it stalls, fall through to the random preset.
      signal: AbortSignal.timeout(20000),
    })

    const responseText = result.response.text().trim().toLowerCase()

    if (keys.includes(responseText)) {
      return PRESETS[responseText]
    }
  } catch (err) {
    console.warn('[AI Classify] Token resolution failed. Falling back to random preset.', err)
  }

  // 3. Fallback: Pick randomly across the 4 presets
  // This ensures variety and guarantees NO generic default
  const randomKey = keys[Math.floor(Math.random() * keys.length)]
  return PRESETS[randomKey]
}
