# IntentDraw — Backlog

Everything known-but-not-done, as of the 2026-09-19 session.

> **Note for Claude:** `AGENTS.md` §6 says "no persistent issues log needed."
> That rule is superseded for this file — the owner explicitly asked for it on
> 2026-09-18. Do not delete it citing that rule.

> **Standing instruction for Claude: at the start of a session, if the owner has
> not said what to work on, remind them this backlog exists and ask which item to
> pick up.** The owner asked to be reminded so neither side forgets.

The owner's goal as of 2026-09-19: **a project that is readily deployable and
can earn money.** The sections below are ordered by that goal.

---

## 1. Owner actions — only you can do these

None of these block local development. All of them block a real launch.

1. **`PEXELS_API_KEY`** (recommended, free: https://www.pexels.com/api/). Photos in generated sites come from `/api/image`. Without the key they fall back to LoremFlickr: mixed Creative Commons licences (some non-commercial — a real problem for sites users sell) and poor tagging (a real run returned a snowy road for "pottery").
2. **`OPENROUTER_API_KEY`** (recommended, free: https://openrouter.ai/keys). More free capacity and a fallback when Gemini is overloaded. Gemini's free tier is 20 requests/day *per model*; the app now walks five Gemini models, but a generation still costs ~5 requests, so heavy testing runs out.
3. **Supabase Auth settings for the production domain** — in the Supabase dashboard → Authentication → URL Configuration: set *Site URL* to the deployed domain and add `https://<domain>/auth/callback` to *Redirect URLs*. Without this, sign-up confirmation and password-reset emails point at localhost. Decide whether email confirmation is required.
4. **Vercel project** — import the repo, set every variable from `.env.example`. Generation routes request `maxDuration = 300`; confirm the plan in use allows that (stages run 20–70s).
5. **GSAP licensing.** The free Standard license prohibits "tools that allow users to build visual animations without code that compete with Webflow's visual animation building capabilities." IntentDraw generates code, so it probably falls outside — confirm with Webflow before animation is a headline paid feature. Swapping engines is contained to `wrapReactForPreview` and the prompt's allowed-library rule.
6. **Pricing.** What is free, what is paid, and at what price. Engineering is ready to design for it (page count is already a config value, `src/lib/canvas/pages.ts`) but billing needs this decision first.

## 2. To launch and charge — engineering, in order

1. ~~**Export**~~ — **done**: Website (.html) and Source (.tsx) from the preview's Export menu. Open follow-up: exported pages load photos through this app's `/api/image`, so a downloaded site depends on the app being up; resolve them to final URLs at export time.
2. **Billing (after the pricing decision).** Stripe Checkout + webhook → a `plan` on the user, read by the rate limiter (daily generations) and by `PAGE_CONFIG.maxPages`. Keep plan limits in one object.
3. ~~**Public share page `/p/[id]`**~~ — **done**, served under a sandbox CSP so generated code gets an opaque origin (verified: no access to the app's cookies or storage).
4. ~~**Landing page**~~ — **done**: the hero is a real drawing becoming a real site. Still open: a one-click example project for new users (first-run), and an OG image for shared links.
5. **Brief correction.** The "What I understood" card shows the reading of the drawing, but a user can't fix a misread (e.g. retag R2 from rays to a mountain) and rebuild. The data model already supports it — `DesignBrief.drawing.elements` — it needs an editor and a "rebuild with this reading" action that skips the understanding call.
6. **Self-healing compile errors.** The preview reports runtime errors to the parent (`IFRAME_ERROR`). Feed a compile error back as an automatic rebuild of the failing section — the section-rebuild path now exists (`page-parts.ts`, one model call) — instead of showing a red box. This also closes the old "validate that generated code parses" item without adding a parser dependency.
7. **Speed.** A full generation is ~4 minutes on free Gemini (understanding ~30–50s, shell ~50s, ~30–60s per section batch, run serially to respect free-tier limits). On a paid key, run section batches 2–3 at a time; the orchestration in `use-ai.ts` is the only place to change.
8. **Show the saved brief on reopen.** The brief is now saved inside the project's page parts (with the section-rebuild work), but the "What I understood" card still starts empty when a project is reopened. Restore it from the saved parts, and let "rebuild with this reading" skip the understanding call.
9. **Contrast enforcement for text over the scene.** The scene itself holds a 3:1 contrast floor in code, but text the model places over it is not checked; a live run produced a dim heading on a translucent orange panel. A render-time check (computed colours in the preview) could flag or fix it, the same way full-bleed scrims are softened today.

## 3. Product — beyond one landing page

1. **Multi-screen generation (login, dashboard, …).** Cheapest path that keeps the current runtime: ONE file exporting several screen components plus a small injected `useState` router, with a screen switcher in the preview. True multi-file apps with a backend need a different runtime (WebContainers or containers) — a separate track, not an increment. Multiple screens multiply generation size, so staged generation and section rebuilds are prerequisites (both done).
2. **Animation as the wedge.** The runtime is in place (GSAP + MotionPathPlugin + ScrollTrigger), and drawn pictures already animate where the brief says so (sun glow, water glint, motion-path markers). Still to build: arrows → transitions/reveals, drawn curves → scroll-linked motion, and a small library of motion primitives the model composes (scroll-reveal, parallax, marquee, path-follow) rather than inventing motion from scratch.
3. **Richer pictures from drawings.** `scene.ts` handles silhouettes, bands, discs, rays, closed shapes and lines. Natural next forms: trees and clouds (closed wobbly outlines → organic fills), skylines (flat-topped ridges → buildings with windows), waves (repeated crests → layered water), and simple figures.
4. **3D (later).** Three.js via UMD pins to ~r147; modern three is ESM-only and the eval-based mount can't host it. Needs multi-file output — separate track.
5. **An automated "does this look generic" signal.** Quality is still judged by eye. A second-pass critique of a rendered screenshot would let quality work proceed without manual review every time.

## 4. Canvas and editor

1. **Drawing UX audit** — selection, resizing, labelling, marquee behaviour. The owner reported the canvas as clunky; untouched so far.
2. ~~**Page sections + page-number rail**~~ — **done** (`src/lib/canvas/pages.ts`, `page-rail.tsx`); page count is config-driven for plan tiers. Pages added with "+" aren't saved yet.
3. **Grouping from the canvas** — today it requires multi-select in the Layers panel. Add marquee → group and a keyboard shortcut.
4. **Region intent editor vs. chip strip** — both exist and overlap. Merge into one place.

## 5. Housekeeping

1. Remaining lint errors: `no-explicit-any` in `api/models/route.ts` (1) and `drawing-canvas.tsx` (3). (`canvas-store.ts` and `preview-panel.tsx` are clean.)
2. Unused DB tables `regions` and `generation_history` (full RLS, zero application code). Use them or drop them.
3. `viewMode: 'split'` is unreachable — no UI sets it, no render branch.
4. The legacy single-call route `POST /api/generate` still runs the old intent classifier and style-preset call. Nothing in the UI uses it; retire it once nothing external depends on it.

---

## Done (kept briefly so nothing is re-investigated)

**2026-09-19 — shipping pieces**
- **Export** (.html / .tsx), **share links** (`/p/<id>`, sandboxed), **rebuild one section** (1 model call instead of 5, saved with the project), **page rail**, new **landing page** from real output, **sign-in pages** in the app's look.
- **Gemini model chain**: 3.8 → 3.7 → 3.6 → 3.5 → 2.5-flash with per-model quota handling; the old pin was on a model generation already being retired.
- **Drawing image** cropped to the drawn area at 1x (306 KB → 65 KB per image, sent twice per generation).
- **Shared "is generating" state** — the controls panel used to miss generations started from the prompt box.

**2026-09-19 — understanding and pictures**
- **Understanding stage** (`brief.ts`, `understand.ts`): every generation first writes a design brief — what the drawing depicts, what the site needs, what makes it unlike a template. It replaced two older auxiliary calls, so generation makes fewer model calls than before. Shown to the user in "What I understood".
- **Perception** (`perception.ts`): strokes are measured in code (ridge, arc, zig-zag, band edges, wraps-around). On the test drawing a text-only fallback model read it perfectly from these facts alone.
- **Pictures rendered in code** (`scene.ts`, `scene-render.ts`): `<IntentScene />` — computed geometry, fixed layering, depth shading, contrast floor, motion only where asked. Models kept mangling the picture when asked to paint it.
- **Staged path image bug:** the canvas exports a data URL and Gemini rejected it (400), so every drawing generation fell through to text-only providers that never saw the drawing. Fixed in `callProvider`.
- **Assembly collisions:** `import gsap, { gsap }`; relative imports (`./Hero`); imports with trailing comments. All handled, and repaired at render time for saved pages.
- **Washed-out pictures:** full-bleed translucent "scrims" are forbidden in the prompt and softened to radial scrims at render time.
- **Images:** keyword URLs through `/api/image` (Pexels when configured), with labelled tiles for failures.
- **Gemini 503** is retried rather than dropping to a weaker model; the dev "uncapped" limit no longer overflows Postgres.
- **Production auth:** the dev bypass is decided in one place and can never run in production; `/auth/callback` and `/reset-password` added. Verified on a production build: pages redirect to `/login`, APIs return 401.
- `pnpm build` passes; generation routes declare `maxDuration`; `.env.example` lists every variable.

**2026-09-19 — earlier**
- **Lag**: canvas height fed back from its own iframe (runaway); an html2canvas snapshot that could never succeed in an opaque-origin sandbox kept a live frame mounted forever; `/api/models` fetch loop; stacked blur + blend layers. Measured after: zero long tasks at idle.
- Dev generation cap removed; project naming and renaming; pending state on project cards; undo leaking across projects; dashboard wireframe thumbnails; prompt box overlap and per-keystroke re-render; clear-canvas confirmation.
- OpenRouter provider; structural reference corpus (`references.ts`) with checkable vertical-rhythm rules; quota-aware section retries; vitest suite.
