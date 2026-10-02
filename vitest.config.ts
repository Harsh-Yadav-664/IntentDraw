import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Mirrors tsconfig's `@/*` path so tests can import modules that use it at
// runtime, not only for types (which TypeScript erases).
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
