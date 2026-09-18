# IntentDraw — Backlog

Everything known-but-not-done, as of the 2026-09-18 session. Nothing here is in
progress; it is all waiting on a decision or a go-ahead.

> **Note for Claude:** `AGENTS.md` §6 says "no persistent issues log needed."
> That rule is superseded for this file — the owner explicitly asked for it on
> 2026-09-18. Do not delete it citing that rule.

> **Standing instruction for Claude: at the start of a session, if the owner has
> not said what to work on, remind them this backlog exists and ask which item to
> pick up.** The owner asked to be reminded so neither side forgets. Do not start
> executing items from here unprompted — several need a decision first, and the
> owner said they have more requirements to add before work resumes.

---

## Decisions needed from the owner (blocking)

- ~~**Better free models.**~~ — **done.** OpenRouter is wired into the provider chain (`src/lib/ai/openrouter.ts`), with model IDs selected from the live catalogue rather than from memory. **Owner action required: add `OPENROUTER_API_KEY` to `.env.local`** (free key at https://openrouter.ai/keys, no card needed) — until then OpenRouter is skipped entirely and the chain behaves exactly as before.
- **GSAP licensing.** The free Standard license prohibits "tools that allow users to build visual animations without code that compete with Webflow's visual animation building capabilities." IntentDraw generates code, so it probably falls outside — but confirm with Webflow before animation becomes a headline paid feature. Swapping engines later is contained to `wrapReactForPreview` + the prompt's allowed-library rule.
- **Parser dependency.** Validating that generated code parses (see Reliability below) needs a parser such as `@babel/parser`. `AGENTS.md` requires asking before dependency-level changes.

---

## Reliability

1. **Validate that generated code actually parses, then retry / fall through.** Still open, but narrower now: the staged path validates that a section declares what was asked for, and `assemble.ts` removes the two collision classes that caused most failures. What remains uncaught is genuinely malformed syntax from a weak model (observed from Groq: an unterminated string literal). Needs a parser — see the blocking decision above.
2. ~~Chunked assembly is raw string splicing~~ — **done.** Replaced by `assemble.ts`, which merges imports per specifier and drops duplicate declarations, with unit tests.
3. **Debug file writes on every request.** `intent-classifier.ts` writes `.system_generated/region-intent-debug.json` with no environment gate; it is committed to git and always dirty. Gate it to dev and gitignore it.
4. **`tsconfig.tsbuildinfo` is tracked in git** — a build artifact that will conflict constantly. Needs `git rm --cached tsconfig.tsbuildinfo` plus a gitignore entry.
5. **Pre-existing lint errors** (untouched code): `@typescript-eslint/no-explicit-any` ×5 in `canvas-store.ts` `exportToPng`, and `react-hooks/set-state-in-effect` in the `controls-panel.tsx` NVIDIA-models effect.
6. ~~No test suite at all~~ — **done.** vitest is installed with `pnpm test`; 21 tests cover import merging, duplicate-declaration dedupe and section derivation. Still uncovered and worth adding: `shape-path.ts` geometry and `region-analyzer.ts` skeleton output.

## Output quality — "must not look generic" (goal #2)

1. ~~**Replace the 4 random style presets with a curated reference corpus.**~~ — **done**, see `src/lib/ai/references.ts` and the CLAUDE.md section on it. Original structural sketches only, 1-2 selected per run with no API call, and the drawing's skeleton explicitly outranks the reference. Still open underneath it: Feed the model real, high-quality exemplars rather than abstract token values plus adjectives. Models imitate what they are *shown* far more reliably than what they are *told*. This is the highest-leverage non-model lever.

   **Owner's framing (2026-09-18), which is the correct one:** take *inspiration* from well-known free UI libraries — never paste their UI into the output. The reference supplies the structural idea; the resolved design tokens and the user's own theme/prompt supply every visual decision. Output must still be non-generic and theme-specific. Expected side benefits the owner called out: less time, better quality, and *fewer* tokens, because the model no longer has to infer from adjectives what the user means.

   Implementation notes for whoever picks this up:
   - Store exemplars as compact **structural sketches** (layout archetype, hierarchy, rhythm), not full markup — full markup is expensive in tokens and invites copying.
   - Select 1–2 by relevance to the prompt; never inject the whole corpus.
   - Pair every exemplar with an explicit transformation instruction: adopt the structure, re-skin completely to the resolved tokens, and never reuse the reference's colours, radii or type.
   - The existing per-preset `bannedClasses` list already forces divergence — keep it applied on top.
   - **Licensing:** verify each source's licence before shipping its markup as reference material. MIT (shadcn/ui, many others) is fine; some popular kits are not free for redistribution. Inspiration is safe, verbatim markup is the risk.
2. **Drop the design-token Gemini call.** One "Generate" click can fire up to 3 Gemini calls (intent classification + token resolution + generation). Using keyword-or-random only would cut free-tier 429 risk by a third.
3. **No automated signal for "does this look generic."** Currently judged by eye, forever. Even a crude second-pass critique on a screenshot would let quality work proceed without manual review every time.
4. The random-preset fallback is blunt — it guarantees "not default gray" but does not tie the chosen style to what the user actually asked for.

## Preview fidelity & the page system (owner request, 2026-09-18)

The owner's words: the preview is "not that good and small as well," and it should
show the site "exactly how we see when we visit that website."

1. ~~Render the preview at a real desktop viewport, then scale to fit~~ — **done.** The iframe renders at a 1280 logical width, is sized to the generated page's true height via the `IFRAME_HEIGHT` message (no more second inner scrollbar), and Output mode collapses the controls sidebar to reclaim the width. Remaining polish: 1280 was kept because it matches the drawing canvas's reference width — **changing one requires changing both**, or drawn coordinates stop matching the preview.
2. **Page sections + a page-number rail.** Divide the canvas into standard viewport-sized sections (one "page" = one screenful at the chosen device size), draw the boundaries, and put clickable numbers down the side. Clicking `2` jumps to the second section. Scrolling stays continuous — the sections are guides for drawing precisely against a real fold, not hard boundaries. A sensible default number of sections is created up front so there is room to draw.
   This is `AGENTS.md` §4's "paginated/slide mode vs continuous mode", now with a concrete design.
3. **Regions need a section index**, derived from `y` position (or explicit), so a drawing can say "this belongs on screen 3."
4. **Monetisation hook (design for, don't build).** The owner wants section/page count to be a plan lever later — free capped at ~8, paid unlocks more. Keep the cap a config value read from a plan object; do not hardcode it and do not build billing now.

## Multi-screen generation — login, dashboard, not just a landing page

The owner wants real multi-screen apps, not one page. This is the largest open
item and it breaks the current single-file assumption.

1. **Cheapest path that keeps the current runtime:** generate ONE file exporting several screen components plus a tiny injected `useState` router, and add a screen switcher to the preview. No new dependency, no bundler, no `react-router` (which is banned and unavailable anyway). This gets multi-screen without abandoning Babel-in-iframe.
2. **True multi-file** (separate route files, real routing, a backend) needs a different runtime — WebContainers or a container service. That is the v2 track in `AGENTS.md` §8, not an increment.
3. **Token/quota consequence:** multiple screens multiply generation size, which collides head-on with free-tier limits. This makes staged generation (below) a prerequisite rather than a nice-to-have.

## Generation orchestration — make the wait worth it

Owner's framing: a long wait is only acceptable if the output is exceptional, and
it must never be a silent black box that fails after minutes. Their "loop logic"
idea — spread calls out so quota replenishes — is the right instinct.

1. ~~Make staged generation the primary path~~ — **done.** `/api/generate/shell` + `/api/generate/section`, driven by `use-ai.ts`.
2. ~~Stream real progress to the UI~~ — **done.** Labelled progress with a bar, and the preview repaints after every stage with placeholders for sections still building.
3. ~~**Quota-aware pacing**~~ — **done.** A rate-limited section now waits and retries the chain (8s then 16s) instead of falling straight through, so a temporary 429 no longer becomes a permanently missing section.
4. **Generation is non-deterministic across runs.** The same project classified its regions as decorative on one run and structural on the next, producing a completely different page. Worth deciding whether classification should be cached per drawing, or surfaced so the user can pin it.
4. **Deployment constraint to verify before relying on long generations:** current generations take 25–140s. Vercel's serverless function duration is capped well below that on the free plan, so a single long request will time out in production even though it works locally. Staged generation also helps here, since each stage is short. Confirm the current limits for the plan in use before deploying.

## Intent layer / canvas

1. **Drawing UX audit.** The owner reports the canvas itself is clunky; this has not been touched. Selection, resizing, labelling, marquee behaviour.
2. **Grouping from the canvas.** Grouping currently requires multi-select in the Layers panel. There is no canvas-side affordance (marquee → right-click → group, or a keyboard shortcut).
3. **Region intent editor vs. chip strip.** Both exist now and overlap; the per-region editor lives in a separate panel above. Worth merging into one place.
4. **Misclassification is invisible and uncorrectable.** `classificationTag` / `backgroundScope` are computed server-side and never surfaced, so a user cannot see or fix a wrong call (e.g. a shape wrongly treated as decorative).
5. **`regenerate-region` is fully built but unwired** — API route and `useAI().regenerateRegion()` both work; no UI calls them. `AGENTS.md` itself calls full regeneration the expensive failure mode this avoids.

## Animation — the wedge (owner's priority, mostly unbuilt)

Runtime is in place (GSAP + MotionPathPlugin + ScrollTrigger, verified). What is *not* built:

1. **Motion intent from drawings.** Arrows → transitions/reveals; drawn curves → scroll-linked motion paths; a `motion` tag in the intent classifier. This is the part competitors structurally cannot copy without a canvas, and the strongest argument for drawing over prose: layout can be described in words, motion cannot.
2. **Animation primitives the model composes** rather than invents — scroll-reveal, parallax, magnetic hover, marquee, gradient mesh, path-follow. Models are poor at authoring motion from scratch, good at assembling known pieces.
3. **3D (later).** Three.js is feasible in the iframe but a UMD path pins to ~r147 (classic-script addons were removed after that); modern three is ESM-only and the eval-based mount cannot host it. Good 3D also needs multi-file output — treat as a separate track, per `AGENTS.md` §8.

## Product / architecture (longer horizon)

1. **Beyond static sites** — multi-file output, a real runtime (WebContainers or containers), backend generation or a strong backend-integration story. A different architecture, not an increment. The single-file assumption is currently baked deep (one TSX string, Babel-in-iframe); avoid deepening it further.
2. **Premium GUI for the tool itself.** Deferred by the owner until the generation core is solid. Note it doubles as the best proof of the product.
3. `/p/[id]` public share route — DB has `is_public` + RLS, but there is no page.
4. **Auth is stubbed** to a fake dev user; the real `401` branch has never executed. Reconnecting real auth will fire untested paths.
5. Unused DB tables `regions` and `generation_history` (full RLS, zero application code). Either use or drop.
6. `viewMode: 'split'` is unreachable — no UI sets it, no render branch exists.
7. Stale UI label: `controls-panel.tsx` shows "NIM Llama 3.1" for a provider whose wired default is `nemotron-3.5-lightning`.

## Owner's standing intent (context for prioritising)

- The tool should be a **full-fledged, genuinely advanced web-dev tool**, not a demo — something the owner is proud of, not a résumé project. Willing to change stack, structure or architecture wherever that is the right call.
- **Free tiers now, paid later.** Infrastructure is Vercel + Supabase, models are free-tier. Moving to a paid API (Claude or similar) is acceptable *once output quality justifies it* — so avoid decisions that lock the pipeline to one provider.
- Owner wants suggestions proactively, and wants to be told when setup work is needed on their side (accounts, keys, config).
- Deferred but real: subscription tiers, with section/page count as one lever.

---

## Done in the 2026-09-19 session (kept briefly so nothing is re-investigated)

- **Lag.** Root causes were found with evidence, not guessed. The canvas sized itself from the height its own backdrop iframe reported (unbounded growth, Konva stage re-allocated each round); the backdrop's html2canvas snapshot could never succeed in an opaque-origin sandbox, so a live animating iframe stayed mounted forever; `/api/models` re-fetched in an unbounded loop whenever the NVIDIA key was absent; and three stacked `blur-[150px]` + `mix-blend-*` layers plus four `backdrop-filter` surfaces meant every paint re-rasterized a full-viewport blur. Measured after: canvas size stable, **zero long tasks at idle**, worst keystroke 37ms → 24ms.
- **Generation cap in development.** `DEFAULT_MAX_GENERATIONS = 10` predated the session and blocked the owner's own testing. Development is now uncapped unconditionally; production keeps a real default.
- **Project naming.** Rename from the dashboard card menu (optimistic, rolls back on failure) and click-to-edit in the editor header. `projectName` was added to the auto-save watcher — without it a rename marked the project unsaved and then never persisted.
- **Unresponsive project cards.** There was no pending state and no `loading.tsx`, so opening a project — which compiles a route and loads the Konva bundle — looked like a dead button. Both added.
- **Undo across projects.** `_history` is module-level and survived navigation, so undo after opening a second project restored the *first* project's shapes and auto-save then persisted them. `setCanvasData` now resets it.
- **Dashboard.** Cards show a wireframe of the project's actual drawing, derived server-side from `canvas_data` (24 projects = 19.7 KB), plus shape count and a "Built" marker.
- **Prompt panel.** The prompt textarea was `flex-1` inside a scrolling flex column and overflowed onto the provider selects. Extracted to `prompt-composer.tsx` with a debounced draft, so typing no longer re-renders the layer list.
