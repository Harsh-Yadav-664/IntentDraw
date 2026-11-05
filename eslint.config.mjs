import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Ad hoc manual debug scripts at the root (CommonJS, not shipped, not CI).
    "test-limits.js",
    "test-supabase.js",
    "check-users.js",
    "setup-dev-user.js",
  ]),
]);

export default eslintConfig;
