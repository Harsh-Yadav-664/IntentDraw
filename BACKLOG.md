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

- **Better free models.** The owner chose "free tier, but add better free models" and this was never implemented. Candidates to wire into the provider chain: OpenRouter's free tier, Gemini 2.5 Pro's free quota. Evidence this matters: on identical input, Gemini produced clean working code while Groq (`gpt-oss-120b`) produced three broken generations in a row (duplicate declaration, missing import, malformed string literal). **Model tier is currently the main ceiling on output quality.**
- **GSAP licensing.** The free Standard license prohibits "tools that allow users to build visual animations without code that compete with Webflow's visual animation building capabilities." IntentDraw generates code, so it probably falls outside — but confirm with Webflow before animation becomes a headline paid feature. Swapping engines later is contained to `wrapReactForPreview` + the prompt's allowed-library rule.
- **Parser dependency.** Validating that generated code parses (see Reliability below) needs a parser such as `@babel/parser`. `AGENTS.md` requires asking before dependency-level changes.

---

## Reliability

1. **Validate that generated code actually parses, then retry / fall through.** Today `provider.ts` only checks `code.length > 20` and `includes('export default')`, so syntactically invalid output is returned as `success: true` and the user sees a red error box. This is the single biggest gap against the owner's "no white screens, no console-fatal errors" bar in `AGENTS.md` §5.
2. **Chunked assembly is raw string splicing** (`provider.ts`, `indexOf('export default')` + Set-based import dedup, no AST). Silent-corruption risk exactly where scaling to >12 regions is supposed to help.
3. **Debug file writes on every request.** `intent-classifier.ts` writes `.system_generated/region-intent-debug.json` with no environment gate; it is committed to git and always dirty. Gate it to dev and gitignore it.
4. **`tsconfig.tsbuildinfo` is tracked in git** — a build artifact that will conflict constantly. Needs `git rm --cached tsconfig.tsbuildinfo` plus a gitignore entry.
5. **Pre-existing lint errors** (untouched code): `@typescript-eslint/no-explicit-any` ×5 in `canvas-store.ts` `exportToPng`, and `react-hooks/set-state-in-effect` in the `controls-panel.tsx` NVIDIA-models effect.
6. **No test suite at all.** The diagnostic scripts in `scripts/` are the closest thing. Worth real tests around prompt assembly and geometry→skeleton, which are pure functions and cheap to cover.

## Output quality — "must not look generic" (goal #2)

1. **Replace the 4 random style presets with a curated reference corpus.** Feed the model real, high-quality exemplars rather than abstract token values plus adjectives. Models imitate what they are *shown* far more reliably than what they are *told*. This is the highest-leverage non-model lever.

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

1. **Render the preview at a real desktop viewport, then scale to fit.** Today the iframe is sized to whatever space the panel has, so the generated site sees a narrow viewport and renders its *mobile* layout in a cramped box. The fix is what Figma and Webflow do: give the iframe a fixed logical width (e.g. 1440px), then CSS-`transform: scale()` it down to fit the pane. The site then lays out as a real desktop site and media queries behave correctly, while visually fitting the panel. The existing device toggle (desktop/tablet/mobile) becomes a real viewport switch rather than a resize.
   **This is a prerequisite for judging output quality at all** — "does this look generic" cannot be assessed in a squashed, mis-scaled preview.
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

1. **Make staged generation the primary path, not a >12-region fallback.** Generate the shell first and show it immediately, then fill sections one at a time. Each stage is independently retryable and resumable, so a single failed section doesn't discard minutes of work.
2. **Stream real progress to the UI** — "Generating hero (2/6)…" with partial results rendering as they land. This is what converts a 2-minute wait from "is it broken?" into visible progress.
3. **Quota-aware pacing.** Serial calls with backoff naturally let per-minute free-tier quota replenish between stages. Resume rather than restart on a rate limit.
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
