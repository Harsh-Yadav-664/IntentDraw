// =============================================================================
// Environment Variable Validation (Server-side)
// =============================================================================

function getRequiredEnvVar(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function getOptionalEnvVar(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue
}

export const env = {
  supabase: {
    url: getRequiredEnvVar('NEXT_PUBLIC_SUPABASE_URL'),
    anonKey: getRequiredEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    serviceRoleKey: getRequiredEnvVar('SUPABASE_SERVICE_ROLE_KEY'),
  },
  ai: {
    geminiApiKey: getRequiredEnvVar('GOOGLE_AI_API_KEY'),
    groqApiKey: getRequiredEnvVar('GROQ_API_KEY'),
  },
  app: {
    url: getOptionalEnvVar('NEXT_PUBLIC_APP_URL', 'http://localhost:3000'),
    name: getOptionalEnvVar('NEXT_PUBLIC_APP_NAME', 'IntentDraw'),
  },
  rateLimit: {
    maxGenerations: parseInt(getOptionalEnvVar('RATE_LIMIT_MAX_GENERATIONS', '10'), 10),
  },
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
} as const