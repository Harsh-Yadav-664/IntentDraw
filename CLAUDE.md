# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Start here

**`BACKLOG.md` holds every known-but-unfinished item, plus the decisions waiting on the owner.** At the start of a session, if the owner hasn't said what to work on, remind them the backlog exists and ask which item to pick up — they explicitly asked to be reminded so nothing gets lost between sessions. Don't start executing backlog items unprompted; several are blocked on a decision.

## What this is

IntentDraw: the user draws a rough wireframe on a canvas (rectangles / circles / freeform / arrows) and writes a text prompt. The AI reads the shape geometry and overlaps ("spatial intent") alongside the prompt, and generates a single-file React TSX site that is compiled client-side and rendered live in a sandboxed iframe.

## Product vision (owner's own words, structured — do not lose this)

This is a solo project. The owner's stated goals, in priority order:

1. **The intent layer (drawing) is THE feature, and it is optional.**
   The tool must be usable as a pure text-to-site generator that is as good as Lovable / v0 / any market leader — a user who never draws anything should still get a great result. The drawing layer sits on top of that as the differentiator: it exists to give the most customizability of any tool on the market, and it solves a problem the owner personally hit (describing layout in prose is miserable).
   **Currently the weakest part: the drawing layer "isn't working good at all," and attempts to fix it degraded plain website generation too.** Any work here must keep the no-drawing path working.

2. **Output must not look generic — and must impress on the FIRST prompt.**
   The bar is not "avoids gray-50 backgrounds." The bar is: a new user types one mediocre prompt and thinks *"damn, this tool makes good websites — that's what I wanted or better."* Generic AI-looking output (soft rounded corners, gray borders, Inter, Shadcn-card look) is the exact failure mode this tool exists to avoid. Prose instructions ("be bold", "avoid generic") are a rejected fix — enforcement must be concrete (resolved tokens, banned class names, explicit skeletons).

3. **The tool's own UI should be premium, elegant, exquisite.** (Not the current focus — build it when the generation core is solid.) The app itself should look like the best and most practical web-dev tool on the market, marketing site included.

4. **Future: beyond static sites.** End-to-end, fully working apps. Ideally native backend generation eventually; at minimum, a backend-integration story good enough that users switch to this tool over competitors. **Not now** — noted so the architecture isn't painted into a static-only corner.

**Positioning:** top competitor in the market + more useful/practical features + better for the customer. A custom fine-tuned or self-trained model is an eventual goal *after* the tool is good enough to showcase/sell — explicitly not the approach at this stage.

### Planned features the owner wants (not built yet)

- **Region grouping.** Select many shapes (e.g. 20 shapes making up one feature/section) and group them, then write ONE prompt describing that group's purpose/context — instead of repeating instructions per shape.
- **Per-region prompt UI.** Click a region chip/box above the prompt panel and write that region's description *there*, instead of typing "region 1 is a navbar, region 2 is..." into the single global prompt box. (A minimal version exists: a per-region intent `Textarea` in `controls-panel.tsx`. The intended UX is a first-class region/group selector above the prompt panel.)

### Working agreements with the owner

- **Ask instead of guessing.** If requirements are ambiguous, ask a question rather than burning hours and tokens building something that gets reverted.
- **Tech stack is not sacred.** If a materially better library/pattern/service exists, propose it — the owner does not want to be locked to current choices out of caution. (Still: state what problem the swap solves before doing it — see standing rules below.)
- **Testing is explicitly wanted.** There is no test suite today. Automated tests and in-browser verification (the built-in browser / preview tools) are welcome, not scope creep.
- **Free-tier API quota is a real constraint.** Generation testing runs on free Gemini/Groq tiers. Be strategic: prefer deterministic/offline verification (typecheck, unit tests on prompt assembly, fixture-based rendering) over burning live generation calls to check things that don't need a live model.

## Standing rules (from `AGENTS.md` — gitignored but present at repo root; read it before generation-pipeline work)

- No architecture or foundational-dependency changes (rendering engine, AI providers, DB/auth, core framework) without asking first and stating what problem it solves. Small implementation-level choices don't need this.
- Verify fixes by actually running the flow, not by reading the diff and declaring success.
- If something already works, don't touch it while fixing something else. One task at a time.
- No dated planning docs, weekly roadmaps, or persistent issue logs — solo personal project.

## Commands

- `pnpm dev` — dev server (Next.js App Router, port 3000)
- `pnpm build` / `pnpm start` — production build / run
- `pnpm lint` — ESLint (flat config, `eslint-config-next`)
- `npx tsc --noEmit` — typecheck. **No typecheck script exists**; run this manually after AI-pipeline changes.
- `npx tsx scripts/diagnose-prompt.ts curves|circles` — prints the EXACT prompt a given drawing scenario produces, with **zero API calls**. Use this before spending free-tier quota: most "the AI ignored my drawing" bugs are visible here as missing data in the prompt.
- `npx tsx scripts/preview-harness.ts public/preview-harness.html` — renders a sample component through the real preview pipeline so the iframe runtime (Babel transform, import rewriting, GSAP, lucide) can be verified in a browser with no AI call. Serve it via `pnpm dev` at `/preview-harness.html` — a `file://` URL will not execute its scripts.
- **No test suite exists** (no test script, no framework installed). Root-level `test-limits.js`, `test-supabase.js`, `check-users.js` are ad hoc manual debug scripts, not CI.
- Package manager is **pnpm**. Node pinned to 22 via `.nvmrc`.
- **Windows dev-server gotcha:** only one `next dev` can hold `.next/dev/lock` + port 3000. A wedged instance causes port-in-use / empty-reply errors — kill the port owner and delete `.next/dev/lock` to recover.

## Generation pipeline (the core of the app)

Request path — `POST src/app/api/generate/route.ts`:

1. `createClient()` auth — **currently stubbed to a fake dev user** (`src/lib/supabase/server.ts` monkey-patches `auth.getUser`). The real `401` branch in the route is therefore dead code until real auth is reconnected.
2. `checkRateLimit(userId)` — real Supabase `usage` table call, wrapped in a 4s timeout and **fails open** (allows generation) on any DB error.
3. If regions were drawn: `classifyRegionIntents()` (`src/lib/ai/intent-classifier.ts`) — one Gemini vision call tagging each shape `exact-placement | approximate-area | decorative | relational` (+ `backgroundScope` for decorative). Fails safe to all-`exact-placement`. Writes a debug dump to `.system_generated/region-intent-debug.json` on every call (no env gate — that's why the file is perpetually dirty in git).
4. `generateCode()` in `src/lib/ai/provider.ts` — the orchestrator:
   - `resolveDesignTokens()` (`src/lib/ai/design-tokens.ts`) picks one of 4 hardcoded presets (`neosleek`, `playful_pop`, `elegant_serif`, `glassmorphism`), each with exact border-radius / palette / font / shadow **and a banned Tailwind class list**. Resolution order: keyword scoring on the prompt (free) → if ambiguous, a cheap Gemini classification call → if still ambiguous, **random preset**. The random fallback is deliberate (guarantees no generic default) but is blunt: it can pick a style unrelated to what the user asked for.
   - ≤12 regions → one monolithic provider call. >12 regions → chunked: shell generation + **serial** per-chunk region calls (trying the shell's winning provider first — parallel `Promise.all` bursts trip free-tier rate limits) + assembly.
   - **Chunk assembly is raw string splicing** on `indexOf('export default')` with Set-based import dedup. No AST. Treat as fragile.
   - Provider fallback chain reorders `[gemini, groq, nvidia]` to put the user's pick first. `humanizeProviderError()` aggregates *every* provider's failure into one readable message rather than surfacing only the last.
5. **Never call `sanitizeHtml()` on generated TSX.** It is an HTML attribute stripper and corrupts JSX handlers (`onClick={() => ...}` gets truncated → "Unexpected token" compile errors). The sandboxed iframe (`sandbox="allow-scripts"`, no `allow-same-origin`) is the real security boundary. `sanitizeHtml` / `isHtmlSafe` remain in `src/lib/utils/sanitize.ts` as dead code — do not reintroduce call sites.
6. `incrementUsage()` / `getUsageStats()` (Supabase) → return code.

Prompt engineering lives in `src/lib/ai/prompts.ts` (system prompt: banned generic-UI patterns, structural-variety rules) and `src/lib/ai/region-analyzer.ts` (`describeLayout()` converts drawn geometry into a literal TSX flex/grid skeleton the model must reuse rather than reinvent).

### Region groups (`Region.groupId` + `canvas-store.groups`)

Users draw one feature as many shapes and want to describe it once. A `RegionGroup` holds `{id, name, intent}`; membership lives on `Region.groupId` so deleting a region can't leave a dangling reference (`dropEmptyGroups` prunes empties). Groups flow: canvas-store → `use-ai` → `/api/generate` → `generateCode` → `describeLayout`, which emits a `REGION GROUPS:` block *before* the skeleton, since the user's own account of the shapes should frame everything after it. A group whose members are all decorative is treated as one composed background (`sharesOneGroup`).

`projects.canvas_data` now stores `{ regions, groups }`, but older projects hold a bare `Region[]` — always read it through `parseCanvasData()`, never assume the shape.

### Generated-code repair (`src/lib/ai/repair.ts`)

The preview has no bundler or type checker, so a model slip becomes a red error box. `repairGeneratedCode()` applies only *unambiguous* fixes (currently: dropping a lucide import the file also declares itself, which is a fatal duplicate declaration). Anything needing judgement belongs in the prompt instead. The runtime complements this by exposing every lucide icon as a global, so a forgotten icon import renders rather than crashing.

**Model quality is the real ceiling here.** In back-to-back runs on the same project, Gemini produced clean, correct code while Groq (`gpt-oss-120b`) produced a duplicate declaration, a missing import, and a malformed string literal. Don't chase Groq's syntax errors with ever more repairs — that's whack-a-mole against model capability. The pipeline currently only validates `length` and `includes('export default')`; it never checks that the output *parses*, so invalid code is returned as a success.

### Drawn geometry → prompt (`src/lib/ai/shape-path.ts`)

Freeform strokes and arrows carry their real shape in `geometry.path`. `buildShapePath()` simplifies that stroke (Ramer-Douglas-Peucker) and emits an SVG `d` string, either in the region's own `0 0 100 100` box or — passing canvas dimensions — in whole-page coordinates. Without this the model sees only a bounding box, so a hand-drawn wave and a straight line are indistinguishable; that was the root cause of "I drew 7 curves and got nothing."

Two rules that matter when editing this area:
- `pointBudget()` trims stroke detail as a drawing gets busier, because free-tier providers count prompt tokens tightly (Groq's 8k TPM budget includes `max_tokens`).
- `describeLayout()` treats multiple decorative strokes that collectively span >60% of the canvas as **one composed background** in a single page-wide `<svg>`. Describing them individually tells the model "confined to this area, NOT a page-wide background" once per stroke — the exact opposite of what the user drew.

A stroke is also a **motion path** — the same data drives drawn-curve animation (see below). Keep that in mind before "simplifying" it away.

### Provider / model gotchas (already debugged the hard way — do not regress)

- **Gemini** (`gemini.ts`): `gemini-2.5-flash` everywhere. It is a *thinking* model — **never set `maxOutputTokens`**, since thinking tokens consume the cap before any real output (proven: 8192 cap → 7860 thinking → 328 output → truncated). Has real 429 handling: parses the server's `retryDelay` from the error and waits accordingly (capped 20s, `maxRetries=2`), exponential backoff when absent.
- **Groq** (`groq.ts`): `openai/gpt-oss-120b`. The old `llama-3.1-70b-versatile` is decommissioned — do not reintroduce. `max_tokens=5000` is deliberate: the free tier's ~8k TPM counts `max_tokens` against the budget **up front**, so 8000 caused HTTP 413 "reduce your message size."
- **NVIDIA** (`nvidia.ts`): raw `fetch` to `integrate.api.nvidia.com`, no SDK. Default `nvidia/nemotron-3.5-lightning-30b-a3b`; the old `meta/llama-3.1-70b-instruct` hit EOL 2026-08-26. Slowest and least reliable of the three. `GET /api/models` lets the user pick any NIM model from a dropdown — note `controls-panel.tsx` still labels this option "NIM Llama 3.1" even though the wired default is nemotron (cosmetic bug).
- `PROVIDER_TIMEOUT_MS` in `provider.ts`: `gemini: 120000, groq: 45000, nvidia: 75000`, each with an additional backstop wrapper. These were tuned against measured latency (Gemini vision alone runs 30–45s), not guessed.
- **Call budget:** one "Generate" click can fire up to **3 Gemini calls** — intent classification (only when regions exist) + design-token resolution (only when no style keyword matches) + the generation call itself. The two auxiliary calls fail safe but still consume RPM. Reducing this count is the highest-leverage free-tier reliability lever.

## Frontend / state architecture

- `src/app/` — App Router. Route groups: `(auth)` (login / signup / forgot-password), `(dashboard)` (project list + `/project/[id]` editor). `p/[id]` is an empty directory — the public-share view is planned (DB has `is_public` + RLS for it) but has no `page.tsx`.
- `src/store/canvas-store.ts` (zustand) — **`regions[]` is the real data model**, not raw Konva shapes. Each region: `geometry` (`rectangle | circle | freeform | arrow`), `intent` text, server-computed `classificationTag` / `backgroundScope` (backend-only — no UI surfaces them; don't assume they're user-editable), `lockState`, `generatedCode`. Also owns undo/redo (module-level history, capped at 50) and `exportToPng()` (feeds the AI call).
- `src/store/workflow-store.ts` (zustand) — prompt, provider/model selection, `status` state machine, `previewSnapshot` (in-memory only, never persisted), and debounced (3s) autosave (`saveNow` / `performSave` → `PATCH /api/projects/[id]`).
- `src/components/canvas/drawing-canvas.tsx` — React Konva `Stage`/`Layer`. Renders the generated preview as its own backdrop via a **one-shot `html2canvas` snapshot** (`IFRAME_SNAPSHOT` postMessage), not a continuously running iframe — that was a deliberate perf fix. If the canvas feels slow, check this snapshot path before assuming a live-render problem.
- `src/components/preview/preview-frame.tsx` — sandboxed iframe via `wrapReactForPreview` (`src/lib/utils/sanitize.ts`): Babel Standalone + React UMD, no bundler. Sandpack was tried and removed for React 19 incompatibility; don't re-add without confirming that's resolved upstream.

### Preview runtime (`wrapReactForPreview`) — hard-won details

The iframe is the whole rendering engine, and several things in it are load-bearing:

- **React 18 UMD, deliberately.** The app runs React 19, but React 19 ships no UMD build, so the iframe pins React 18. Don't "fix" this mismatch.
- **CDN versions must be pinned.** `@babel/standalone` was unpinned, and Babel 7.29.x started requiring a `filename` for the TypeScript preset — which silently broke *every* preview with a compile error. It is now pinned and passes `filename: 'generated.tsx'`. Treat any unpinned CDN script here as a live outage waiting to happen.
- **React exports are re-exposed on `window`** before the transform, because the transform strips `import { useState } from 'react'` while the UMD build only exposes `React` — without it, previews die with "useState is not defined."
- **Imports are rewritten, not resolved.** A `MODULE_GLOBALS` map converts allowed imports into destructures off `window`; anything else is stripped. So an unsupported library fails at runtime as "X is not defined", never as a compile error. Import maps are not an option — the code is `eval`'d as a classic script.
- **Lucide icons** render as inline SVG built from the UMD's icon data. The proxy must capture the real `window.lucide` *before* shadowing it; an earlier version overwrote the global and called a non-existent `window.lucideIcons`, so no icon ever rendered.
- **Animation: GSAP 3.15 + MotionPathPlugin + ScrollTrigger** are loaded as UMD globals and allowed in generated code. framer-motion / `motion` publishes **no UMD build of its React API** — it cannot work here, and the system prompt bans it explicitly.
- **Snapshot vs. animation.** html2canvas screenshots a *clone* of the DOM, where CSS keyframes restart at t=0 — anything entering from `opacity:0` would capture blank. Before capture the snapshot script runs `gsap.globalTimeline.progress(1)` and finishes all WAAPI animations. GSAP writes inline styles on real nodes, so its output survives cloning; this is a concrete reason to prefer GSAP over CSS keyframes for entrance animation.

> **Open licensing question (decide before monetizing):** GSAP's free Standard license prohibits use in "tools that allow users to build visual animations without code that compete with Webflow's visual animation building capabilities." IntentDraw generates code rather than being a no-code animation builder, which likely falls outside that — but it is close enough to the line that it should be confirmed with Webflow before animation becomes a headline paid feature. Swapping engines later is contained to `wrapReactForPreview` + the prompt's allowed-library rule.
- Persistence is real: the Supabase `projects` table stores the entire `regions[]` array as one JSONB blob (`canvas_data`) plus prompt / theme / generated_code. The SQL migration also defines normalized `regions` and `generation_history` tables with full RLS — **no application code reads or writes them.** Don't assume they work or that `canvas_data` should be replaced by querying them.

## Known dead / half-wired code

These are incomplete features, not bugs. Don't "fix" them as defects without asking.

- `POST /api/regenerate-region` + `useAI().regenerateRegion()` — fully implemented end to end, but **no UI calls it.** Likely a quick win, since full regeneration is the expensive failure mode this avoids.
- `viewMode: 'split'` exists in `canvas-store.ts`, but nothing sets it and `canvas-editor.tsx` has no render branch for it.
- `components/regions/` and `components/export/` are empty directories.
- `globalTheme` in `workflow-store.ts` is stored and persisted but rendered by no control — currently a dead input.
- `canvas-editor.tsx` has a leftover "HOW TO CREATE THIS:" scaffolding comment from an old refactor.
