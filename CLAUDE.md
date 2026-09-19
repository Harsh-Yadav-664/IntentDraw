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
- **Testing is explicitly wanted.** A vitest suite covers the pipeline's pure logic (`pnpm test`); extend it with every fix. In-browser verification (the built-in browser / preview tools) is welcome, not scope creep.
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
- `pnpm typecheck` — `tsc --noEmit`. Run after any AI-pipeline change.
- `pnpm test` / `pnpm test:watch` — vitest. Covers the pure logic where a bug becomes a broken preview: import merging, duplicate-declaration dedupe, and section derivation. Add cases here rather than burning API quota to find regressions.
- `npx tsx scripts/diagnose-prompt.ts curves|circles` — prints the EXACT prompt a given drawing scenario produces, with **zero API calls**. Use this before spending free-tier quota: most "the AI ignored my drawing" bugs are visible here as missing data in the prompt.
- `npx tsx scripts/diagnose-scene.ts <project.json> [brief.json]` — renders the exact `<IntentScene />` a drawing produces to `public/_scene-debug.svg`, zero API calls. Use it to check drawing-to-picture geometry by eye (`project.json` is a `GET /api/projects/:id` response).
- `npx tsx scripts/preview-harness.ts public/preview-harness.html` — renders a sample component through the real preview pipeline so the iframe runtime (Babel transform, import rewriting, GSAP, lucide) can be verified in a browser with no AI call. Serve it via `pnpm dev` at `/preview-harness.html` — a `file://` URL will not execute its scripts.
- Root-level `test-limits.js`, `test-supabase.js`, `check-users.js` are ad hoc manual debug scripts, not CI. `vitest.config.ts` maps the `@/` alias so tests can import modules that use it at runtime.
- Package manager is **pnpm**. Node pinned to 22 via `.nvmrc`.
- **Windows dev-server gotcha:** only one `next dev` can hold `.next/dev/lock` + port 3000. A wedged instance causes port-in-use / empty-reply errors — kill the port owner and delete `.next/dev/lock` to recover.

## Generation pipeline (the core of the app)

Request path — `POST src/app/api/generate/route.ts`:

1. `createClient()` auth. **Development runs as one fixed user** so the owner can work without signing in; **production always requires real sign-in.** Both are decided in one place, `src/lib/auth/bypass.ts` (`authBypassed()`), used by the server client, the middleware and the browser `AuthProvider` — it used to be hard-coded in all three, which would have served every production visitor as the same user. Set `NEXT_PUBLIC_AUTH_BYPASS=false` to exercise real sign-in locally. Verified against a production build: signed-out page visits redirect to `/login`, APIs return 401. Email links (signup confirmation, password reset) go through `/auth/callback`, which exchanges the PKCE code for a session and only redirects to same-site paths.
2. `checkRateLimit(userId)` — real Supabase `usage` table call, wrapped in a 4s timeout and **fails open** (allows generation) on any DB error.
3. If regions were drawn: `classifyRegionIntents()` (`src/lib/ai/intent-classifier.ts`) — one Gemini vision call tagging each shape `exact-placement | approximate-area | decorative | relational` (+ `backgroundScope` for decorative). Fails safe to all-`exact-placement`. Writes a debug dump to `.system_generated/region-intent-debug.json` on every call (no env gate — that's why the file is perpetually dirty in git).
4. `generateCode()` in `src/lib/ai/provider.ts` — the orchestrator:
   - `resolveDesignTokens()` (`src/lib/ai/design-tokens.ts`) picks one of 4 hardcoded presets (`neosleek`, `playful_pop`, `elegant_serif`, `glassmorphism`), each with exact border-radius / palette / font / shadow **and a banned Tailwind class list**. Resolution order: keyword scoring on the prompt (free) → if ambiguous, a cheap Gemini classification call → if still ambiguous, **random preset**. The random fallback is deliberate (guarantees no generic default) but is blunt: it can pick a style unrelated to what the user asked for.
   - ≤12 regions → one monolithic provider call. >12 regions → chunked: shell generation + **serial** per-chunk region calls (trying the shell's winning provider first — parallel `Promise.all` bursts trip free-tier rate limits) + assembly.
   - **Chunk assembly is raw string splicing** on `indexOf('export default')` with Set-based import dedup. No AST. Treat as fragile.
   - Provider fallback chain reorders `[gemini, groq, nvidia]` to put the user's pick first. `humanizeProviderError()` aggregates *every* provider's failure into one readable message rather than surfacing only the last.
5. **Never call `sanitizeHtml()` on generated TSX.** It is an HTML attribute stripper and corrupts JSX handlers (`onClick={() => ...}` gets truncated → "Unexpected token" compile errors). The sandboxed iframe (`sandbox="allow-scripts"`, no `allow-same-origin`) is the real security boundary. `sanitizeHtml` / `isHtmlSafe` remain in `src/lib/utils/sanitize.ts` as dead code — do not reintroduce call sites.
6. `incrementUsage()` / `getUsageStats()` (Supabase) → return code.

Prompt engineering lives in `src/lib/ai/prompts.ts` (system prompt: banned generic-UI patterns, structural-variety rules), `src/lib/ai/region-analyzer.ts` (`describeLayout()` converts drawn geometry into a literal TSX flex/grid skeleton the model must reuse rather than reinvent), and `src/lib/ai/references.ts`.

### Design references (`src/lib/ai/references.ts`)

Models imitate what they are *shown* far more reliably than what they are *told*, and adjectives plus token values were not enough — output stayed generic. The corpus holds seven original **structural sketches** (agency/editorial, SaaS, portfolio, hospitality, e-commerce, app marketing, event launch), each describing section order, where visual weight sits, which element breaks full-bleed, how density alternates, and the one move that reads as designed. `selectReferences()` picks 1-2 by keyword score with zero API calls.

Two rules that are load-bearing:
- **Structure only, never markup.** Sketches are prose. Nothing is copied from any library or site — inspiration is safe, verbatim markup is a licensing risk. A test asserts no markup can leak into the corpus.
- **The drawing outranks the reference.** Every injected sketch carries an explicit instruction that where it conflicts with the LAYOUT SKELETON, the skeleton wins — otherwise this would quietly degrade the drawing path, which is the whole product.

`DESIGN_RULES` also carries a checkable vertical-rhythm block (padding ceiling of `py-24`, no spacer elements, real content on the first screen, no two consecutive sections sharing padding *and* layout). Those exist because a real run produced several screens of empty background before any content — the shell's own `space-y` stacking on top of each section's padding.

### Understanding stage — what the user meant (`brief.ts`, `understand.ts`, `perception.ts`)

Every generation starts with `POST /api/generate/understand`, which writes a **design brief** before anything is built. It exists because nothing in the pipeline ever asked what a drawing was a *picture of*: a stroke was either a layout box or "decorative", so a drawing of mountains, a sun and a river came out as neon streaks — and a river, which is the space *between* two strokes, could not be seen at all.

The brief (`DesignBrief`) carries three things, matching the owner's three pillars:
1. **The drawing, understood** — elements grouping one or more regions, each with a `role` (`layout | illustration | decoration | motion | connector`), and for pictures a `form` (`silhouette | band | disc | rays | shape | line`), `depth` and `placement`.
2. **The site** — summary, audience, primary action, and a section plan with real content (PascalCase names the shell must use).
3. **What makes it unlike a template** — a concept tied to the business and drawing, one signature element, clichés to avoid, and a five-colour palette that overrides the preset's colours.

Load-bearing details:
- **It replaces two calls**, not adds one: region classification and the design-token model call are gone from the staged path, and the style preset comes from the brief (keyword signal, else a *stable* hash of the prompt — the old random fallback made the same prompt look different on every run).
- **`perception.ts` measures strokes in code** before the model sees them — ridge-like, circular arc (centre/radius/span), zig-zag with N spikes, wraps around another stroke's arc, runs alongside another stroke as the edges of one band (allowing a river that widens in perspective). Facts are stated only when the geometry clearly supports them, because a wrong measured fact gets trusted over a correct visual read. This is what makes understanding work on text-only providers: in a live run Gemini returned 503, understanding fell to Groq (which cannot see the image), and it still produced a perfect read from the measured facts alone.
- **The brief crosses the client** (understand → client → shell → client → sections), so every route re-runs `normalizeBrief()` on it: lengths capped, enums checked, palette hex-validated, every region assigned to exactly one element.
- `extractJson` in `lib/utils` tries `[...]` before `{...}`, which truncates any object containing an array to that array. Briefs use `parseJsonObject()` instead.
- The client shows the brief in `<BriefCard />` as soon as it lands, so a misread drawing is visible rather than silently shaping the output.

### Drawings as pictures — rendered in code (`scene.ts`, `scene-render.ts`)

Exact geometry handed to the model was not enough: across real runs, models still painted the sun in front of the mountains, faded the picture into the page, or turned fills back into outlines. So the picture is rendered **entirely in code** as a ready-made `<IntentScene />` component; the model is told it is supplied, places it, and designs the site around it.
- `scene.ts` computes geometry: a ridge is closed to the ground as a silhouette (feet may spread only ~20% of the stroke width — uncapped, one mountain swallowed the other), two banks are joined into one band, an arc is circle-fitted (Kåsa) to the whole disc so a rising sun sits behind the land. A disc element keeps any spiky member as rays — a zig-zag around a sun is loosely circular and otherwise became a second, blank disc.
- `scene-render.ts` fixes layering (sky bodies behind land behind water, whatever depth the model gave), shades land by depth from the palette (taller peaks farther and lighter; nearest land held at ≥3:1 contrast), adds sky light, a sun glow and water glints, animates only elements the brief gave `motion`, and honours `prefers-reduced-motion`.
- The scene code is assembled in **ahead of** the sections, so assembly's first-definition-wins rule means no section can replace it. `IntentScene` is filtered out of the section list, and if the shell never referenced it, `placeSceneBehind()` wraps the page with it.

### Staged generation (the primary path)

`use-ai.ts` drives generation as several short calls instead of one long one:

1. `POST /api/generate/shell` — classifies the drawing, resolves design tokens, and generates only the **page shell**: layout, full-page background layers, and a `/* SECTIONS: Hero, Features, … */` manifest naming the components a later pass must build. This call consumes the generation's single quota slot.
2. `POST /api/generate/section` — builds one batch of named components. Deliberately does **not** touch the rate limiter; charging per section would penalise a design for having more sections.

`sections.ts` derives the section list from the shell for free — the shell already declares its structure by referencing components it doesn't define (`resolveSections` prefers the manifest, falls back to inferring undefined JSX references). This works identically whether the structure came from a drawing or from the prompt alone, so **prompt-only generation is staged too**.

Why it's built this way — all four matter, don't collapse it back into one call:
- The user sees progress and a partially rendered page instead of a blank two-minute wait. `assembleProgressive()` fills not-yet-built sections with placeholder components so the page can render after every stage.
- Each call is short enough to fit a serverless duration limit. A single 25–140s request will time out on Vercel.
- Section calls run **serially**; a parallel burst is what trips free-tier rate limits, and spacing them lets per-minute quota recover.
- A failed section leaves a placeholder and reports itself, rather than discarding every section that succeeded.

The old single-call `generateCode()` and `POST /api/generate` still exist and still work; the staged path is what the UI uses.

### Rebuilding one section (`src/lib/ai/page-parts.ts`, `<SectionList />`)

A full run is understand + shell + one call per batch; when one section is weak or failed, `useAI().rebuildSection(name, note?)` rebuilds just that one with a **single** `POST /api/generate/section` call (optional `note` → a labelled, sanitized, 300-char-capped `USER INSTRUCTION FOR <name>` block in `buildStagedSectionUserPrompt`).
- The run's parts (`PageParts`: shell, scene, tokenId, brief, classified regions, resolved prompt, section blocks, failed list) live in `workflow-store.pageParts`, and are saved inside `canvas_data.pageParts` (no migration). `parseSavedParts()` restores them only if reassembling them reproduces the saved `generated_code` exactly — older projects, or parts that no longer match the page, simply have no section list.
- `replaceSection()` is pure: the new block goes ahead of older blocks, the old definition is removed (a single-section block is dropped whole, helpers included), and any *other* section or `IntentScene` the new block redefines is stripped first. `assembleParts()` always puts the scene block first, and `IntentScene` is never listed as a section — nothing can replace the user's drawing.
- Replaced the unwired `POST /api/regenerate-region` path, which predated the staged pipeline, the brief and the scene.

### Assembling generated pieces (`src/lib/ai/assemble.ts`)

Independently generated blocks don't coordinate, so assembly is where their collisions get resolved. It is pure and client-safe (the browser assembles partial results).

- **Imports merge per module and per specifier.** Deduping whole import *lines* is not enough: `import { Star }` and `import { Star, Moon }` are different lines that declare `Star` twice — fatal.
- **Duplicate declarations are dropped, first definition wins**, seeded with the shell's own names. Models genuinely do redefine a component another batch already built; this has been the single most common fatal error.
- `splitTopLevelChunks()` is a small brace-matching scanner that skips strings, template literals and comments. It only needs to survive the TSX these models emit — resist replacing it with a parser dependency unless something concrete demands one.

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

- **Gemini** (`gemini.ts`): a **chain of models, newest first** — `gemini-3.8-flash → 3.7 → 3.6 → 3.5 → 2.5-flash` (override with `GEMINI_MODELS`). IDs were verified 2026-09-19 by listing the key's models and probing each; `gemini-2.5-flash-lite` and `gemini-2.5-pro` already return 404 "no longer available to new users". **Free quota is per project per model** (the 429 says so: `GenerateRequestsPerDayPerProjectPerModel-FreeTier`, 20/day for 2.5-flash), so one pinned model capped the app at ~4 generations a day. `classifyGeminiError()` decides the move: a spent daily quota or retired model → next model immediately; a per-minute 429 or 503 "high demand" → wait (honouring `retryDelay`) and retry, then the next *Gemini* model rather than dropping to a text-only provider; anything else → throw to the provider chain. Unusable models are remembered per server instance. These are *thinking* models — **never set `maxOutputTokens`**, since thinking tokens consume the cap before any real output (proven: 8192 cap → 7860 thinking → 328 output → truncated).
- **Groq** (`groq.ts`): `openai/gpt-oss-120b`. The old `llama-3.1-70b-versatile` is decommissioned — do not reintroduce. `max_tokens=5000` is deliberate: the free tier's ~8k TPM counts `max_tokens` against the budget **up front**, so 8000 caused HTTP 413 "reduce your message size."
- **OpenRouter** (`openrouter.ts`): raw `fetch`, OpenAI-compatible. Gives access to materially stronger *free* coding models than Groq or NVIDIA, which is the main lever on output quality. Model IDs were selected from the live catalogue (`GET https://openrouter.ai/api/v1/models`, keep entries where `pricing.prompt` and `pricing.completion` are both `"0"`) — **never edit those strings from memory**, that has broken this project twice. Needs `OPENROUTER_API_KEY`; it is appended to the fallback chain only when that key is set, so its absence doesn't pollute every error message. A `402` means the free daily allowance is spent, not a broken key.
- **NVIDIA** (`nvidia.ts`): raw `fetch` to `integrate.api.nvidia.com`, no SDK. Default `nvidia/nemotron-3.5-lightning-30b-a3b`; the old `meta/llama-3.1-70b-instruct` hit EOL 2026-08-26. Slowest and least reliable of the three. `GET /api/models` lets the user pick any NIM model from a dropdown.
- **Images reach providers as bare base64.** The canvas exports a *data URL*; Gemini's `inlineData` rejects the prefix with a 400 and OpenRouter adds its own. `callProvider()` strips it once for every caller. Before this, every staged generation with a drawing failed on Gemini and silently fell through to a text-only provider that never saw the drawing.
- **Gemini 503 "high demand" is retried** like a 429 (short backoff) rather than dropping the run to a weaker provider.
- `PROVIDER_TIMEOUT_MS` in `provider.ts`: `gemini: 120000, groq: 45000, nvidia: 75000`, each with an additional backstop wrapper. These were tuned against measured latency (Gemini vision alone runs 30–45s), not guessed.
- **Call budget (staged path):** one understanding call, one shell call, and one call per section batch. The legacy `POST /api/generate` route still runs intent classification and design-token resolution as separate calls.

## Frontend / state architecture

- `src/app/` — App Router. Route groups: `(auth)` (login / signup / forgot-password), `(dashboard)` (project list + `/project/[id]` editor). `p/[id]` is an empty directory — the public-share view is planned (DB has `is_public` + RLS for it) but has no `page.tsx`.
- `src/store/canvas-store.ts` (zustand) — **`regions[]` is the real data model**, not raw Konva shapes. Each region: `geometry` (`rectangle | circle | freeform | arrow`), `intent` text, server-computed `classificationTag` / `backgroundScope` (backend-only — no UI surfaces them; don't assume they're user-editable), `lockState`, `generatedCode`. Also owns undo/redo (module-level history, capped at 50) and `exportToPng()` (feeds the AI call).
- `src/store/workflow-store.ts` (zustand) — prompt, provider/model selection, `status` state machine, the last `brief` (in-memory only), and debounced (3s) autosave (`saveNow` / `performSave` → `PATCH /api/projects/[id]`). The prompt box (`prompt-composer.tsx`) keeps a local draft and pushes it to the store on a debounce, so typing doesn't re-render the layer list; `generateCode()` reads the prompt from `getState()` at call time because the composer flushes and generates in the same tick.
- `src/components/canvas/drawing-canvas.tsx` — React Konva `Stage`/`Layer`. Renders the generated preview as its own backdrop in a **frozen live iframe** (`wrapReactForPreview(code, { freeze: true })`): it renders once, then every GSAP/WAAPI animation is finished and paused and CSS animation/transition is disabled, so it costs nothing per frame. The backdrop is skipped entirely while a generation is running — otherwise every staged batch triggered a fresh CDN + Babel run behind the canvas.
  - **The old `html2canvas` snapshot could never have worked.** The iframe is `sandbox="allow-scripts"` with no `allow-same-origin`, so its origin is opaque; html2canvas renders into a nested iframe and must read that iframe's `document`, which is blocked as cross-origin every time. The snapshot never arrived, so the parent kept a live, fully animating iframe mounted behind the canvas *forever* — a large, permanent source of the lag this project had. Don't reintroduce it, and don't "fix" it by adding `allow-same-origin`: that grants model-written code the app's own origin.
  - **The canvas height must never derive from the iframe's reported height.** `min-h-screen` inside the generated page resolves against the frame, so each measurement grows the page, which regrows the frame — an unbounded loop that re-allocates the Konva stage on every round. Height comes from the drawing (`max(1000, maxShapeY + 400)`).
- `src/components/preview/preview-frame.tsx` — sandboxed iframe via `wrapReactForPreview` (`src/lib/utils/sanitize.ts`): Babel Standalone + React UMD, no bundler. Sandpack was tried and removed for React 19 incompatibility; don't re-add without confirming that's resolved upstream.

### Preview runtime (`wrapReactForPreview`) — hard-won details

The iframe is the whole rendering engine, and several things in it are load-bearing:

- **React 18 UMD, deliberately.** The app runs React 19, but React 19 ships no UMD build, so the iframe pins React 18. Don't "fix" this mismatch.
- **CDN versions must be pinned.** `@babel/standalone` was unpinned, and Babel 7.29.x started requiring a `filename` for the TypeScript preset — which silently broke *every* preview with a compile error. It is now pinned and passes `filename: 'generated.tsx'`. Treat any unpinned CDN script here as a live outage waiting to happen.
- **React exports are re-exposed on `window`** before the transform, because the transform strips `import { useState } from 'react'` while the UMD build only exposes `React` — without it, previews die with "useState is not defined."
- **Imports are rewritten, not resolved.** A `MODULE_GLOBALS` map converts allowed imports into destructures off `window`; anything else is stripped. So an unsupported library fails at runtime as "X is not defined", never as a compile error. Import maps are not an option — the code is `eval`'d as a classic script.
- **Lucide icons** render as inline SVG built from the UMD's icon data. The proxy must capture the real `window.lucide` *before* shadowing it; an earlier version overwrote the global and called a non-existent `window.lucideIcons`, so no icon ever rendered.
- **Animation: GSAP 3.15 + MotionPathPlugin + ScrollTrigger** are loaded as UMD globals and allowed in generated code. framer-motion / `motion` publishes **no UMD build of its React API** — it cannot work here, and the system prompt bans it explicitly.
- **Preview sizing.** The iframe renders at a fixed *logical* device width (1280 desktop) and is CSS-scaled to fit the panel, so generated sites lay out as real desktop sites rather than triggering their own mobile breakpoints in a narrow box. Its height is derived from the **panel**, making it a true fixed viewport that scrolls internally like a real browser window. It is emphatically **not** sized from the page's own `IFRAME_HEIGHT` report — that is the runaway loop described above, and it is what produced "I scrolled for ten seconds through empty purple background." `IFRAME_HEIGHT` is still posted once on load but nothing sizes itself from it. Output mode collapses the controls sidebar to reclaim width. 1280 also matches the drawing canvas's reference width — **keep those two in sync**, or drawn coordinates stop matching the preview.
- **Images.** Models cannot know real Unsplash photo IDs, so invented URLs were broken or unrelated. The prompt now requires keyword URLs (`https://loremflickr.com/{w}/{h}/{keyword},{keyword}?lock={n}`), and the runtime swaps any image that fails to load for a labelled tile. **Licensing:** those are Flickr Creative Commons photos with mixed licences — fine for previews, not for sites users publish commercially. Switch to a licensed API (Unsplash/Pexels with a key) before selling.
- **Import normalisation runs at render time too.** `normalizeImports()` (from `assemble.ts`) runs inside `wrapReactForPreview`, so already-saved files with an import collision (e.g. `import gsap, { gsap }`) are repaired without regenerating. Relative/alias imports (`./Hero`, `@/x`) are dropped: the output is a single file, so they can never resolve.
- **Freezing vs. animation.** The backdrop's freeze step runs `gsap.globalTimeline.progress(1)` then pauses it, kills every ScrollTrigger, finishes all WAAPI animations, and injects `animation-play-state: paused; transition: none`. GSAP writes inline styles on real nodes, so a frozen GSAP entrance still shows its end state — a concrete reason to prefer GSAP over CSS keyframes for entrance animation.

> **Open licensing question (decide before monetizing):** GSAP's free Standard license prohibits use in "tools that allow users to build visual animations without code that compete with Webflow's visual animation building capabilities." IntentDraw generates code rather than being a no-code animation builder, which likely falls outside that — but it is close enough to the line that it should be confirmed with Webflow before animation becomes a headline paid feature. Swapping engines later is contained to `wrapReactForPreview` + the prompt's allowed-library rule.
- Persistence is real: the Supabase `projects` table stores the entire `regions[]` array as one JSONB blob (`canvas_data`) plus prompt / theme / generated_code. The SQL migration also defines normalized `regions` and `generation_history` tables with full RLS — **no application code reads or writes them.** Don't assume they work or that `canvas_data` should be replaced by querying them.

## Known dead / half-wired code

These are incomplete features, not bugs. Don't "fix" them as defects without asking.

- `viewMode: 'split'` exists in `canvas-store.ts`, but nothing sets it and `canvas-editor.tsx` has no render branch for it.
- `components/regions/` and `components/export/` are empty directories.
- `globalTheme` in `workflow-store.ts` is stored and persisted but rendered by no control — currently a dead input.
- `canvas-editor.tsx` has a leftover "HOW TO CREATE THIS:" scaffolding comment from an old refactor.
