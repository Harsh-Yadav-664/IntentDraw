# IntentDraw — Status, Backlog and Roadmap

**The single place for where the project stands, what's done, and everything planned.** Updated 2026-10-02. It is meant to survive the chat: anything decided or discovered goes here.

> **Note for Claude:** `AGENTS.md` §6 says "no persistent issues log needed." That rule is superseded for this file — the owner explicitly asked for it (2026-09-18, again 2026-10-02). Do not delete it citing that rule.

> **Standing instruction for Claude: at the start of a session, if the owner has not said what to work on, remind them this backlog exists and ask which item to pick up.** The owner asked to be reminded so neither side forgets.

---

## 0. Where we are (read this first)

**Goal (owner, 2026-10-02):** a sketch-to-site tool that beats Lovable/v0/Bolt on control and uniqueness — "people should want to buy it and forget all web-design and web-dev worries." The USP is the drawing, deeper customisation, and sites that never look AI-made or alike. It must work on **free models** for testing and free users; paid plans can fund stronger models later.

**What works now**
- Staged generation: understand → page shell (built in code, no model) → sections (one call each for drawn sections, others in pairs). Every planned section is always rendered.
- Understanding reads drawings as layout, handwritten text, pictures, decoration, motion and arrows, with measured facts (ridges, arcs, zig-zags, bands, wraps-around, **handwriting**, **"drawn inside"**). Each drawn element is assigned to the section/screen it was drawn on, and that section gets exact desktop placement classes.
- Pictures are rendered in code (`<IntentScene />`): landscapes, discs/suns with rays, bands/rivers, closed shapes, lines, **decorations**, and a **live 3D sphere** (a circle with marks inside, turning with pointer/touch/scroll).
- Every site designs its own look: two fonts from 48 curated Google Fonts (actually loaded), corners, surfaces, density, headings; banned classes enforced in code; recent designs not repeated; a random "design lens" per request; the "generic version" named and avoided.
- Providers: Gemini model chain that skips overloaded models in seconds, Groq vision fallback (`qwen3.8-27b`), OpenRouter with current free models, NVIDIA last.
- Export (.html/.tsx), share links (sandboxed), rebuild one section with a note, page rail, landing page, production auth, dev mode without sign-in or limits, route warm-up for a fast dev server.

**Known weak spots right now**
- **Free-tier capacity.** On 2026-10-02 Gemini 3.x was overloaded all afternoon; generations ran on 2.5-flash. Quality follows the model that answered.
- **No visual check of the result.** Nothing looks at the rendered page before the user does (see R7 below).
- **Text contrast over drawn art and dark backgrounds** is not checked (a dark-grey name on near-black shipped once).
- **The app's own UI** is still the old one; the owner's new UI design is in `Downloads/intentdraw-ui-design-brief.zip` (see §3).

**How to see what the pipeline does without spending quota**
- `npx tsx scripts/diagnose-staged.ts <project.json> [brief.json] [--prompts]` — shell, batches, per-section drawing instructions, full prompts.
- `npx tsx scripts/diagnose-scene.ts <project.json> [brief.json]` — the rendered `<IntentScene />` as SVG.
- `npx tsx scripts/diagnose-prompt.ts curves|circles` — older single-call prompt view.

---

## 1. Owner actions — only you can do these

1. ~~`PEXELS_API_KEY`~~ — **done** (set in `.env.local`).
2. ~~`OPENROUTER_API_KEY`~~ — **done**. Free tier is 50 requests/day at $0; a one-time $10 credit raises it to 1000/day (no subscription).
3. **Supabase Auth settings for the production domain** (only at deploy time) — Authentication → URL Configuration: Site URL = deployed domain; add `https://<domain>/auth/callback` (and `http://localhost:3000/auth/callback`) to Redirect URLs. Decide whether email confirmation is required. Free projects pause after 7 days idle.
4. **Vercel project** (only at deploy time) — import the repo, set every variable from `.env.example`, do NOT set `NEXT_PUBLIC_AUTH_BYPASS`. Generation routes request `maxDuration = 300`; Hobby caps lower — Pro ($20/mo) if stages get killed.
5. **GSAP licensing.** The free Standard license prohibits "tools that allow users to build visual animations without code that compete with Webflow's visual animation building capabilities." IntentDraw generates code, so it probably falls outside — confirm with Webflow before animation is a headline paid feature.
6. **Pricing.** Suggested shape (market: v0 $20, Lovable ~$25, Bolt $20): Free (BYO key or small daily cap, badge on shared sites) / Pro ~$20 (credits on our key, AI hero images, custom domain, no badge) / Studio ~$50. Recurring value is hosting + custom domains, not only generations. Billing waits on this decision.

---

## 2. Generation quality — next, in order

Items marked **(R#)** come from the 2026-10-02 research (§5); the full evidence is in `D:\CODE\PROJECTS\intentdraw-research\REPORT.md`.

1. **Self-healing compile errors (R6).** The preview reports `IFRAME_ERROR`. Map the error to the section that declares the offending name and rebuild that one section with the error text as the note (one call, only on failure) — show "fixing automatically" instead of a red box. Saves whole regenerations.
2. **Anti-AI-design scanner on every section (R1).** Port the code-certain tells from `avoid-ai-design/scripts/detect.mjs` (MIT, keep the notice) to TypeScript: gradient headline text, purple/indigo gradients, ALL-CAPS tracked eyebrows, "→" stapled to buttons, decorative 01/02/03, `rounded-2xl shadow-lg` everywhere, icon-in-tinted-square, glassmorphism by reflex. Auto-fix the mechanical ones in `enforceDesign`; send the rest back as a rebuild note for that section. 0 tokens. Closes the old "automated genericness signal" item.
3. **Contrast enforcement.** A render-time check in the preview (computed text vs background colour) that lifts text below 4.5:1 — the dark-on-dark headline case.
4. **Clarifying questions (R3).** The brief may return up to two `questions: [{text, options[]}]` when the agent is genuinely unsure ("R3–R4: river or road?"); shown as chips in "What I understood"; the build proceeds with the best guess unless answered. Experts strongly preferred this in the Sketch2Code study.
5. **Pick a design direction (R4).** Understanding returns 2–3 directions (concept + fonts + palette + corners/surfaces) as text; the card shows each in its own fonts and colours; the user picks (or the first is used after ~10s); only that one is built. Cheapest "variants" possible, and it makes uniqueness visible.
6. **Brief correction.** Edit the reading (retag an element, change its form/section) and "rebuild with this reading" without re-running understanding. The data model supports it.
7. **Show the saved brief on reopen.** It's saved in page parts; the card starts empty after reload.
8. **Speed on paid keys.** Run section batches 2–3 at a time when the provider allows it (`use-ai.ts` is the only place to change). Free tiers stay serial.
9. **Guard drawn irregularities (R11).** Models "correct" one bigger/offset element back to the repeated pattern 70–96% of the time (Pattern over Pixels). State deliberate irregularities explicitly in the section's drawing block ("R5 is intentionally 1.6× wider than R4 and R6 — keep it").
10. **Images:** search Pexels with the brief's concept and pass the chosen photo *into* the section prompt so palette and layout are built around a real image (R from the monetisation discussion). Later, paid tier: 1–2 AI-generated hero images conditioned on the palette.

## 3. The app's own UI

1. **Port the owner's new UI** (`Downloads/intentdraw-ui-design-brief.zip`, a Vite + React app: Landing, Auth, Dashboard, Editor, Settings, Share, Upgrade, Public share page, `design-tokens.css`, ~120 KB of CSS). Port screen by screen into the Next.js app, keeping all existing behaviour and wiring (stores, routes, auth, generation). Generated from `IntentDraw-UI-prompt.md` (sent to the owner 2026-10-02).
2. **Click to edit in Output (R8).** Inject `data-oid` attributes in the preview's Babel plugin (`intentdraw-transform` in `sanitize.ts`), like Onlook (Apache-2.0, `packages/parser/src/ids.ts`): click a heading to edit its text with zero model calls; click a block → "change this" → scoped section rebuild with the element as locator.
3. **Draw to edit (R9).** In edit mode, strokes drawn over the frozen backdrop of an existing section become a scoped rebuild of that section (make-real's idea: the code is the source of truth, the drawing is the change). No competitor does sketch-based editing.
4. **Region chips above the prompt** — click a region or group and write its own instruction (owner's planned feature).
5. **Canvas UX audit** — selection, resizing, labelling, marquee → group, keyboard shortcuts. Merge the region intent editor and the chip strip.
6. **First-run examples** (like Dyad's inspiration prompts) and an OG image for shared links.

## 4. Product — beyond one landing page

1. **Multi-screen generation (login, dashboard, …).** One file exporting several screen components plus a small injected router, with a screen switcher. Lock one design contract across screens (R13 — "design-system drift" is a known AI tell): reuse the first screen's `design`, palette, nav and footer verbatim.
2. **Motion primitives (R14).** Arrows → transitions/reveals, drawn curves → scroll-linked motion, from a small library of primitives the model composes (reveal, parallax, marquee, path-follow). Research (Animation2Code) shows models are poor at free-form temporal code. One orchestrated motion moment per page, not fade-up on every section.
3. **Richer drawn forms.** Trees and clouds (wobbly closed outlines → organic fills), skylines (flat-topped ridges → buildings with windows), waves (repeated crests), figures; extruded/tilting 3D for non-round shapes the user asks to be 3D.
4. **Visual critic, paid tier (R7).** One VLM call per finished page with a fixed rubric and coordinate rulers on the screenshot (UICrit: +55% critique quality), section-level verdicts, targeted rebuilds kept only if a *relative* comparison says they're better (WebGen-Agent, UI2Code^N). Blocker: capturing a screenshot of the sandboxed (opaque-origin) frame — spike an in-frame rasteriser (SVG foreignObject) or a server-side headless render.
5. **Brand import (R12).** "Paste your current site": fetch it server-side, read CSS variables, font families, logo/og:image and tone → they become the brief's palette and fonts.
6. **Backend story.** Database/auth integration for generated sites (owner: "in future … database connection or smth proper").
7. **3D beyond spheres (later).** Three.js via UMD pins to ~r147; modern three is ESM-only — needs multi-file output.
8. **Own model (R15, later).** Small fine-tuned models can win on aesthetics (AesCoder-4B, UI2Code^N 9B). Not now — but start logging the free preference data: which design direction users pick, which sections they rebuild and their notes, which sites get published.

## 5. Research index (2026-10-02)

Folder: `D:\CODE\PROJECTS\intentdraw-research` — `repos/` (18 shallow clones, text only), `papers/` (33 arXiv PDFs by topic + `ABSTRACTS.md`), `REPORT.md` (ranked adoption list with evidence and file pointers).

| # | Idea | Source | Status |
|---|---|---|---|
| R1 | Zero-token AI-design scanner | avoid-ai-design (MIT) | §2.2 |
| R2 | Name the generic version, then differ; ordinary-persona "design lens"; ban the 5 AI clusters | frontend-design (Apache-2.0), arXiv 2602.20408 | **done** (brief prompt) |
| R3 | Ask up to two clarifying questions | Sketch2Code (NAACL 2025), arXiv 2603.13036 | §2.4 |
| R4 | Choose between 2–3 design directions | screenshot-to-code variants, UI2Code^N | §2.5 |
| R5 | Cache-friendly prompt order | arXiv 2601.06007, 2607.12161 | **done** (section prompts) |
| R6 | Self-healing from execution errors | open-lovable, 1D-Bench | §2.1 |
| R7 | Visual critic + keep-best | WebGen-Agent, UICrit, Agentic DRS, UI2Code^N | §4.4 |
| R8 | Click-to-edit via `data-oid` | Onlook (Apache-2.0) | §3.2 |
| R9 | Draw on the result to edit it | tldraw make-real (ideas only) | §3.3 |
| R10 | Small edits as exact replacements | screenshot-to-code, aider, open-lovable edit-intent router | §2 follow-up to section rebuild |
| R11 | Guard deliberate irregularities | Pattern over Pixels (arXiv 2608.03691) | §2.9 |
| R12 | Brand import from a URL | open-lovable | §4.5 |
| R13 | One locked design contract across screens | avoid-ai-design X1 / DESIGN.md | §4.1 |
| R14 | Motion from primitives | Animation2Code | §4.2 |
| R15 | Own model later; log preference data now | AesCoder, UI2Code^N | §4.8 |

**Do not:** compress prompts (raises cost — arXiv 2607.12161); trust absolute 1–10 model scores alone; let models write free-form animation; generate N whole sites as variants on free tiers; copy anything from make-real, DCGen, WebGen-Agent (no licence) or Dyad's `src/pro` (FSL); use leaked proprietary system prompts.

## 6. Housekeeping

1. Remaining lint errors: `no-explicit-any` in `api/models/route.ts` (1) and `drawing-canvas.tsx` (3).
2. Unused DB tables `regions` and `generation_history` (full RLS, zero application code). Use them or drop them.
3. `viewMode: 'split'` is unreachable — no UI sets it, no render branch.
4. The legacy single-call route `POST /api/generate` still runs the old intent classifier and style presets. Nothing in the UI uses it; retire it.
5. Preview runtime pins: `react@18` and `lucide@latest` load unpinned from unpkg — pin them (an unpinned Babel already broke every preview once).
6. Gemini's "unavailable model" memory is per module instance; in dev, hot reload resets it. Fine in production; consider a shared store if multiple instances matter.

---

## Done (kept briefly so nothing is re-investigated)

**2026-10-02 — making it work on free models, and the drawing actually used**
- **Root cause of the "one section, drawing ignored" run:** Gemini 3.x overloaded → 4-minute waits → text-only Groq wrote everything; both OpenRouter models had left the free catalogue; the section plan reached the shell only when the drawing had no layout box; the placement text named a literal `<FirstSection />`; sections never received drawing geometry; the understanding prompt's only examples were mountains/suns/rivers.
- **Providers:** overloaded Gemini models skipped in seconds, last-good first, one deadline; Groq vision `qwen3.8-27b`; OpenRouter current models as a `models` list (max 3); NVIDIA last.
- **Page shell built in code** (`page-shell.ts`), every planned section rendered; drawn elements assigned to their section/page with exact placement classes; one drawn page stays in one section; batches: drawn sections alone and first, nav+footer together.
- **Understanding rewritten** (no anchoring examples, handwriting, enclosure, section assignment, research items R2) and **perception** extended; code corrects weak models (handwriting → content, 3D circle → sphere).
- **3D sphere** scene form; decorations painted; scene framed on the drawn page.
- **Per-site design** (fonts actually loaded, corners/surfaces/density/headings, enforced classes, no repeats) and the owner's product principle in every agent prompt.
- Multi-line imports no longer leave duplicate declarations (the `Terminal` crash); `pnpm dev` warms every route (8–13s first clicks → ~0.06s); dev mode skips sign-in pages.
- Research: 18 repos + 33 papers downloaded and reviewed (§5).

**2026-09-19 — shipping pieces**
- Export (.html / .tsx), share links (`/p/<id>`, sandboxed), rebuild one section, page rail, landing page from real output, sign-in pages in the app's look.
- Gemini model chain 3.8 → 2.5-flash with per-model quota handling. Drawing image cropped to the drawn area (306 KB → 65 KB). Shared "is generating" state.

**2026-09-19 — understanding and pictures**
- Understanding stage (`brief.ts`, `understand.ts`), perception (`perception.ts`), pictures rendered in code (`scene.ts`, `scene-render.ts`).
- Staged-path image bug (data-URL prefix → Gemini 400 → drawings read blind). Assembly collisions (`import gsap, { gsap }`, relative imports, trailing comments). Washed-out scrims. Images via `/api/image` (Pexels when configured).
- Production auth decided in one place (`lib/auth/bypass.ts`); `/auth/callback`, `/reset-password`. `pnpm build` passes.

**2026-09-19 — earlier**
- Lag (runaway canvas height, impossible html2canvas snapshot, fetch loop, blur layers); project naming/renaming; pending states; undo leaking across projects; dashboard thumbnails; prompt box re-render; OpenRouter provider; structural references; quota-aware section retries; vitest suite.
