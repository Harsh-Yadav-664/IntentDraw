# IntentDraw — Status, Backlog and Roadmap

**The single place for where the project stands, what's done, and everything planned.** Updated 2026-10-20. It is meant to survive the chat: anything decided or discovered goes here.

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

**Live results on the owner's drawing (2026-10-02, same drawing + prompt, Gemini 2.5-flash — 3.x was overloaded)**
- Run 1: drawing read correctly for the first time, all 7 sections built, name and globe where drawn. Problems → fixed: the box drawn under the hero got its own empty screen; nav and hero invented different names; globe spun its drawing away; no side gutters; design lens leaked into copy.
- Run 2: all fixes held (one name, everything on page 1 in the hero). Problems → fixed: model split the globe into a blank sphere + 8 flat lines; huge name collided with the stats band; "// LABEL" and ALL-CAPS chrome.
- Run 3: correct reading, globe with all marks, Fraunces/Hanken palette unlike runs 1–2 (no-repeat works). It died on an unloaded `ScrollToPlugin` → runtime now loads the common GSAP plugins and turns any unsupported import into a harmless stand-in; re-rendered fine. Stats strip sat just below the fold → drawn columns now use modest fixed gaps.
- Each run: ~3.5–6 minutes, ~5 model requests (1 understanding + 4 section batches).

**Intent engine (2026-10-02, evening)** — the owner's cube run ("make region 1 a 3d rotating cube interactive with mouse clicks") built the cube in the wrong section. Now: code parses the prompt, the cube is a code-built object placed at the drawn box, and the nav floats over the first screen. Live re-run: brief read "a 3D cube object on the right side of the first screen", one cube only, rendered at (872, 202) for a box drawn at (882, 201). Users can also tag any shape in one click ("3D object · exactly here") and correct any element in "What I understood".

**New interface (2026-10-03)** — the whole app now wears the owner's chosen design: design A's landing page with design B's sketch-to-site slider, and design B's dashboard, editor, settings and sign-in. Everything on screen is wired to what the app really does; unbuilt things say "Coming soon". Checked live: landing (desktop + phone), dashboard on 28 real projects, editor (select, draw, undo, zoom, tags, layers), a real build started from the café example — live per-section status, **Stop** mid-run (kept the built section, listed the rest), **rebuild one section** (22s), and a reload that restored the page, the section list and the reading. Production build passes; in production `/dashboard` redirects to sign-in and the APIs return 401. Details in CLAUDE.md → "The app's own interface".

**Known weak spots right now**
- **Free-tier capacity.** On 2026-10-02 Gemini 3.x was overloaded all afternoon; generations ran on 2.5-flash. Quality follows the model that answered.
- **Only a measured visual check of the result.** Since 2026-10-20 the layout audit measures the rendered page (contrast, overflow, overlap, empty screens) — but nothing yet judges *taste* (hierarchy, rhythm, whether it impresses); that needs the VLM critic (R7, paid tier). Since 2026-10-03 every build is *compile*-checked, so a page can no longer arrive as a compile error — but a section can still come out sparse, low-contrast or with an empty panel, and nothing catches that. This is now the main gap between "builds" and "impresses".
- **Text contrast on plain dark backgrounds** is not checked. Text over the drawn art is (2026-10-20: a halo is added below 3:1); a dark-grey name on a near-black section is still possible.
- **Light theme** exists (Settings → Appearance) but has only been spot-checked; the editor canvas in light mode needs a proper look.
- **Dashboard cards show the drawing, not the built site.** A real screenshot of each site would sell the result better (see §3).

**How to see what the pipeline does without spending quota**
- `npx tsx scripts/diagnose-staged.ts <project.json> [brief.json] [--prompts]` — shell, batches, per-section drawing instructions, full prompts.
- `npx tsx scripts/diagnose-scene.ts <project.json> [brief.json]` — the rendered `<IntentScene />` as SVG.
- `npx tsx scripts/diagnose-prompt.ts curves|circles` — older single-call prompt view.

---

## 1. Owner actions — only you can do these

0. ~~Models for hosting (#10, #11)~~ — **decided 2026-10-20:** the first hosted version is for feedback; visitors bring their own key (as many providers as possible, aggregators included). Our keys are never served. "Pay to use" shows as Coming soon, on a step after sign-in (production only). No self-hosted model; build a configurable provider layer; collect data with consent. Build plans are on the two issues — to be done at the hosting step.

1. **Cloudflare keys for generated images (2026-10-20)** — free account at dash.cloudflare.com; Account ID from Workers AI; My Profile → API Tokens → Create Token → "Workers AI" template. Put `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` in `.env.local`. Until then, pictures stay drawn in code. Before charging money: re-read BFL's terms linked from Cloudflare's FLUX.1 [schnell] page (the weights are Apache-2.0).
   ~~`PEXELS_API_KEY`~~ — set, now only used by the old `NEXT_PUBLIC_IMAGE_SOURCE=photos` path.
2. ~~`OPENROUTER_API_KEY`~~ — **done**. Free tier is 50 requests/day at $0; a one-time $10 credit raises it to 1000/day (no subscription).
3. **Supabase Auth settings for the production domain** (only at deploy time) — Authentication → URL Configuration: Site URL = deployed domain; add `https://<domain>/auth/callback` (and `http://localhost:3000/auth/callback`) to Redirect URLs. Decide whether email confirmation is required. Free projects pause after 7 days idle.
4. **Vercel project** (only at deploy time) — import the repo, set every variable from `.env.example`, do NOT set `NEXT_PUBLIC_AUTH_BYPASS`. Generation routes request `maxDuration = 300`; Hobby caps lower — Pro ($20/mo) if stages get killed.
5. **GSAP licensing.** The free Standard license prohibits "tools that allow users to build visual animations without code that compete with Webflow's visual animation building capabilities." IntentDraw generates code, so it probably falls outside — confirm with Webflow before animation is a headline paid feature.
6. **Pricing — confirm what the site now says.** The landing page, upgrade dialog and Settings show Free ($0, 10 generations a day) · Pro ($20/month, "coming soon") · Studio ("Later"), all from `src/lib/plans.ts`. Pro's listed benefits (premium models, more generations, licensed photos, custom domain) are marked planned. Change that one file to change all three places. Suggested shape (market: v0 $20, Lovable ~$25, Bolt $20): Free (BYO key or small daily cap, badge on shared sites) / Pro ~$20 (credits on our key, AI hero images, custom domain, no badge) / Studio ~$50. Recurring value is hosting + custom domains, not only generations. Billing waits on this decision.

---

## 2. Generation quality — next, in order

Items marked **(R#)** come from the 2026-10-02 research (§5); the full evidence is in `D:\CODE\PROJECTS\intentdraw-research\REPORT.md`.

1. **Self-healing compile errors (R6).** The preview reports `IFRAME_ERROR`. Map the error to the section that declares the offending name and rebuild that one section with the error text as the note (one call, only on failure) — show "fixing automatically" instead of a red box. Saves whole regenerations.
2. ~~Anti-AI-design scanner (R1)~~ — **done 2026-10-20** (`ai-look.ts`). Not yet covered: ALL-CAPS tracked eyebrows and reflex glassmorphism need a judgement call, so they belong to the visual critic.
3. **Contrast enforcement — half done.** Text over the drawn art gets a halo below 3:1 (`__legibleOverArt` in the preview runtime). Extend the same walk to every text node against its computed background (4.5:1 body, 3:1 large).
4. **Clarifying questions (R3).** The brief may return up to two `questions: [{text, options[]}]` when the agent is genuinely unsure ("R3–R4: river or road?"); shown as chips in "What I understood"; the build proceeds with the best guess unless answered. Experts strongly preferred this in the Sketch2Code study.
5. **Pick a design direction (R4).** Understanding returns 2–3 directions (concept + fonts + palette + corners/surfaces) as text; the card shows each in its own fonts and colours; the user picks (or the first is used after ~10s); only that one is built. Cheapest "variants" possible, and it makes uniqueness visible.
6. **Brief correction — half done.** "Edit reading" lets the user retag every element and build again; the tags win on the next run. Still missing: rebuilding from the corrected reading *without* re-running understanding (saves a model call).
7. ~~Show the saved brief on reopen~~ — **done** (restored from the saved page parts).
8. **Speed on paid keys.** Run section batches 2–3 at a time when the provider allows it (`use-ai.ts` is the only place to change). Free tiers stay serial.
9. **Guard drawn irregularities (R11).** Models "correct" one bigger/offset element back to the repeated pattern 70–96% of the time (Pattern over Pixels). State deliberate irregularities explicitly in the section's drawing block ("R5 is intentionally 1.6× wider than R4 and R6 — keep it").
10. **Images — generated (owner decision revised 2026-10-20: ready-to-launch sites, nothing that needs a credit line).** Built: FLUX.1 [schnell] on Cloudflare per picture, described by its alt / data item, styled by the brief's `imagery`, stored in Supabase Storage (`site-images`), made while the next section builds (see CLAUDE.md "Images are generated"). Next: (a) hosted visitors — our Cloudflare account must not pay (`IMAGE_GENERATION_HOSTED` stays off); BYOK image providers (Gemini/OpenRouter image models, the user's own Cloudflare) join the provider layer of #11; (b) users replacing pictures themselves → edit mode, #17; (c) a free-tier budget guard (≈170 images/day: count per day, fall back to drawn art when spent).

**Intent engine — next steps**
1. **More code-built objects:** pyramid, ring/torus, floating card stack, extruded logo from a drawn outline; "3D tilt" for any content box the user calls 3D.
2. **Words that point without numbers:** "the circle", "the box on the right", "the big one" → resolve to shapes by type, position and size.
3. **Ask when unsure (R3):** when the model and the priors disagree with low confidence, show the question as tag chips in "What I understood" before building (or build with the best guess and highlight it).
4. **Learn from corrections:** every tag the user changes after a generation is a labelled example of a misread — log them (R15) to tune priors and the prompt.
5. **Mobile placement for objects** is a centred 16rem square under the section; let the drawing's relative position steer it.

## 3. The app's own UI

Done 2026-10-03: the new interface (landing, sign-in, dashboard, editor, settings), region chips + on-canvas description, the canvas overhaul (corner handles, marquee, multi-drag, duplicate, nudge, zoom, pan, auto-added pages), first-run examples. What's left:

1. **Click to edit in Output (R8).** Inject `data-oid` attributes in the preview's Babel plugin (`intentdraw-transform` in `sanitize.ts`), like Onlook (Apache-2.0, `packages/parser/src/ids.ts`): click a heading to edit its text with zero model calls; click a block → "change this" → scoped section rebuild with the element as locator. (Shown as "Coming soon" in the app.)
2. **Draw to edit (R9).** In edit mode, strokes drawn over the frozen backdrop of an existing section become a scoped rebuild of that section (make-real's idea: the code is the source of truth, the drawing is the change). No competitor does sketch-based editing.
3. **Real site thumbnails on the dashboard.** Cards show the drawing (or the prompt). A picture of the built site is stronger, but a sandboxed frame can't screenshot itself and a live frame per card is heavy — same blocker as the visual critic (§4.4). Options: one lazily mounted frozen frame for the hovered card, or a server-side render at save time.
4. **Light theme pass.** Walk every screen in light mode, the editor canvas especially (ghost backdrop opacity, region colours on paper).
5. **Editor on small screens.** Below 1024px the editor shows "best on a desktop". A read-only view of the built site there would be better than a dead end.
6. **OG image** for shared links and the landing page; a favicon in the new mark.
7. **Empty prompt + drawing.** The owner's rule is "a short prompt, or none, must be enough", but Generate still requires a sentence. Let a drawing with tags/descriptions build on its own.
8. **Bring-your-own-key, version history, several screens per project, custom domains, billing** — all shown as "Coming soon" in the app; each is a real feature to build (see §4), not a UI task.

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

1. Remaining lint errors: `no-explicit-any` in `api/models/route.ts` (1) and `require()` in the root debug script `test-limits.js` (2).
1a. Unused dependencies after the UI port: `radix-ui`, `class-variance-authority`, `shadcn`, `tw-animate-css` (and its import in `globals.css`). Remove them.
1b. Next 16 prints that `middleware.ts` should be renamed `proxy.ts` — do it when convenient.
2. Unused DB tables `regions` and `generation_history` (full RLS, zero application code). Use them or drop them.
3. `viewMode: 'split'` is unreachable — no UI sets it, no render branch.
4. The legacy single-call route `POST /api/generate` still runs the old intent classifier and style presets. Nothing in the UI uses it; retire it.
5. Preview runtime pins: `react@18` and `lucide@latest` load unpinned from unpkg — pin them (an unpinned Babel already broke every preview once).
6. Gemini's "unavailable model" memory is per module instance; in dev, hot reload resets it. Fine in production; consider a shared store if multiple instances matter.

---

## Done (kept briefly so nothing is re-investigated)

**2026-10-20 (later) — output quality pass, one commit each**
- **Generated images** (above, #10 in §2). Openverse unreachable from the owner's network; Commons rejected (credit lines); Gemini image models limit 0 on the free key; Pollinations free tier drew the wrong dish with a watermark.
- **One fact sheet** in the brief (address, phone, email, hours) used by every section; plan rule against overlapping sections (one "Visit", not Locations + Reservations + Contact).
- **Template headlines** ("Welcome to …", "Discover …", "Where X meets Y") are a P0 → one corrective call.
- **Contrast fixed in code**: a className whose own background and text colour fail AA gets the palette's ink (white-on-orange buttons, 2.6:1, were on every button of a real run).
- **Layout check acts**: right after a run, up to two sections with text-on-text, overflow or a collapsed stretch are rebuilt once with the check's note, inside the 5-minute budget.
- **'Auto' models** (default): Gemini for the first screen and content, Groq for navigation, footer and forms.
- **Speed: provider lanes side by side + a hard 5-minute limit.** Same kind of prompt-only run: 648s before → 118s after (Gemini lane 3 at once, 44–55s each; Groq lane 6s). Sections still building at 4.5 min become placeholders.
- **Still weak (seen in the 118s run):** the palette landed in a banned AI cluster (near-black + acid-green) despite the prompt rule — enforce in code on the brief's palette next; the hero's picture is drawn placeholder art until the Cloudflare keys are in; a button inherited dark-on-dark text the className contrast fix can't see (parent background) — the audit flags it.
- `scripts/render-project.ts` screenshots any saved site with zero API calls.

**2026-10-20 — the drawing looks right, and broken pieces stay contained (GitHub #3–#8, #14, #15)**
- **The travel run's drawing** (fixture `travel-scenery.json`): a circle drawn among hills is split off as a sun *behind* them (`splitRoundBodies`); "background of the whole page" in the prompt fixes the scenery behind the whole page (`scope: 'page'`), and sections over it are told to stay translucent.
- **Scene styles** follow the site's surfaces — painterly, papercut, line-art, flat — with atmospheric depth (nearest land ≥3:1), a gentle intro, scroll parallax, grain; all motion is frame-driven so a hidden or frozen frame never sticks half-faded; reduced motion respected.
- **Text over the drawing stays readable:** sections are given the right ink colour (`textOverArt`), and the preview adds a soft halo to any text still under 3:1 against the scene.
- **Layout lint** (`layout-lint.ts`, AST): a grid row whose spans add up to more columns than the grid is fixed in code.
- **Dates and photos:** every prompt carries today's date (no "© 2024"); `grayscale` on photos is stripped unless the site is meant to be monochrome.
- **One crashing section no longer hides the page:** each section is wrapped in an error boundary in the code-built shell; the rest of the site stays on screen and the notice names the section to rebuild.
- **AI-look scanner** (`ai-look.ts`, ideas from the MIT avoid-ai-design catalogue): gradient text and bouncy easing fixed in code; purple-to-blue gradients and placeholder names ("Jane Doe") get one corrective call; anything left is saved with the section, and its Rebuild opens with that note filled in. Each section also records which provider built it.
- **Compile fix:** the preview embedded the page in a template literal without escaping backslashes — any `\"` in generated code broke. Also fixed: four regexes in `gemini.ts` had been saved with a backspace byte instead of the regex word boundary, so quota/overload errors were never recognised.
- **Layout audit on the rendered page** (`page-audit.ts`, zero tokens, the free stand-in for the R7 critic): unreadable text, sideways overflow, overlapping text, empty screens — per section, offered as that section's rebuild note. On the Wilder House run it found the double navigation, a 3.2:1 button and a section whose photo had collapsed to 0px; the last is now also fixed in code (`layout-lint.ts`), and sections are told the site header already exists.
- **Images drawn in code** in the site's palette instead of stock photos (owner's decision); photos still available with `NEXT_PUBLIC_IMAGE_SOURCE=photos`.
- **Models (GitHub #12):** catalogues re-checked; the dead OpenRouter vision entry replaced by `nvidia/nemotron-3.5-super-vl:free` (probed: read a test drawing in <1s). Each section now records the model that built it and how long it took.
- Tools: `scripts/scene-gallery.ts` (every scene style from a project, no API calls) and `scripts/shoot.mjs` (headless-Chrome screenshots of any page).

**2026-10-03 — no more compile errors where the site should be**
- Root cause of the owner's "Duplicate declaration Navigation": one section imported the lucide icon `Navigation` while another section *is* the component `Navigation`; assembly merged both into one file. Any section named like an icon (Navigation, Menu, Contact, Map, Gallery…) could hit it. Assembly now aliases the import in the block that imported it (`Navigation as NavigationIcon`) and points that block's uses at the alias.
- **Nothing that doesn't compile reaches the preview** — three layers: the section route parses every answer and asks the model once more with the compiler's message if it fails (`validate.ts`, same parser as the preview's Babel); the browser tries each block against the page before adding it (a block that would break the page becomes a failed section to rebuild); the editor checks the page on load.
- **Issue UI**: a persistent notice, an "issue" button in the top bar that reopens the details after the notice is closed, a details dialog (where, what kind, the technical message, copy), a one-click fix (rebuild the section at fault — one model call, no generation used), and a clean empty state in the Output view. The canvas no longer shows a broken page behind the drawing.
- Pages saved before the fix repair themselves on open from their saved parts — no rebuild, no model call.
- **Data-loss hole closed**: a save used to drop a project's build parts whenever the session couldn't read them (it happened to the owner's project mid-session; restored from a copy). A save now writes unread parts back untouched.

**2026-10-03 — the app's own interface**
- Ported the owner's two designs: A's landing page (with B's before/after slider), B's dashboard, editor, settings, sign-in. One design system (`globals.css` colour roles + `components/kit`), dark and light. shadcn components removed.
- Editor: live section status during a build, **Stop** (keeps what's built), limit / failed / offline states, "What I understood" restored after reload, "Edit reading", share dialog, export menu, usage chip.
- Canvas: viewport-sized Konva stage (no giant canvas at high zoom), zoom + pan, corner handles, multi-shape drag as one undo step, duplicate (Ctrl+D), nudge, select-all, group from the selection bar, describe/tag a shape on the canvas, pages added as you draw past the bottom. The vision-model export is zoom-independent and still carries the R-number labels.
- Dashboard: real projects with drawing thumbnails (strokes included), search, sort, rename, duplicate, delete, usage meter, account menu, start-from-example. Settings: profile, appearance, plan, usage, which providers have keys, domains (coming soon).
- **Security fixes found on the way:** "Open in new tab" ran generated code with the app's own origin (blob URL) — now sandboxed; `?redirect=` after sign-in accepted any URL (open redirect) — now same-site paths only.
- Bugs fixed on the way: opening a project with no drawing kept the previous project's shapes; resizing a circle or a stroke corrupted its geometry; signup always jumped to the dashboard even when email confirmation was pending.

**2026-10-02 — making it work on free models, and the drawing actually used**
- **Root cause of the "one section, drawing ignored" run:** Gemini 3.x overloaded → 4-minute waits → text-only Groq wrote everything; both OpenRouter models had left the free catalogue; the section plan reached the shell only when the drawing had no layout box; the placement text named a literal `<FirstSection />`; sections never received drawing geometry; the understanding prompt's only examples were mountains/suns/rivers.
- **Providers:** overloaded Gemini models skipped in seconds, last-good first, one deadline; Groq vision `qwen3.8-27b`; OpenRouter current models as a `models` list (max 3); NVIDIA last.
- **Page shell built in code** (`page-shell.ts`), every planned section rendered; drawn elements assigned to their section/page with exact placement classes; one drawn page stays in one section; batches: drawn sections alone and first, nav+footer together.
- **Understanding rewritten** (no anchoring examples, handwriting, enclosure, section assignment, research items R2) and **perception** extended; code corrects weak models (handwriting → content, 3D circle → sphere).
- **3D sphere** scene form; decorations painted; scene framed on the drawn page.
- **Per-site design** (fonts actually loaded, corners/surfaces/density/headings, enforced classes, no repeats) and the owner's product principle in every agent prompt.
- Multi-line imports no longer leave duplicate declarations (the `Terminal` crash); `pnpm dev` warms every route (8–13s first clicks → ~0.06s); dev mode skips sign-in pages.
- Research: 18 repos + 33 papers downloaded and reviewed (§5).
- **Drawing intent engine** (`intent.ts`): tags → prompt parsed in code → model → geometry priors; role `object` + `anchor`; code-built interactive 3D cube/sphere placed by the shell; nav over the first screen; one-click tags (Layers panel) and corrections ("What I understood").
- **Fingerprints:** hero composition per site (not repeated), recent names/accents fed back.
- Preview runtime: common GSAP plugins loaded; unsupported imports become stand-ins; framer-motion shimmed (a missing plugin used to blank the page).
- Drawn content grouped into columns that keep their drawn position but stack in normal flow (no collisions); marks inside a sphere's circle merged into the sphere; "// LABEL" and ALL-CAPS body text stripped.

**2026-09-19 — shipping pieces**
- Export (.html / .tsx), share links (`/p/<id>`, sandboxed), rebuild one section, page rail, landing page from real output, sign-in pages in the app's look.
- Gemini model chain 3.8 → 2.5-flash with per-model quota handling. Drawing image cropped to the drawn area (306 KB → 65 KB). Shared "is generating" state.

**2026-09-19 — understanding and pictures**
- Understanding stage (`brief.ts`, `understand.ts`), perception (`perception.ts`), pictures rendered in code (`scene.ts`, `scene-render.ts`).
- Staged-path image bug (data-URL prefix → Gemini 400 → drawings read blind). Assembly collisions (`import gsap, { gsap }`, relative imports, trailing comments). Washed-out scrims. Images via `/api/image` (Pexels when configured).
- Production auth decided in one place (`lib/auth/bypass.ts`); `/auth/callback`, `/reset-password`. `pnpm build` passes.

**2026-09-19 — earlier**
- Lag (runaway canvas height, impossible html2canvas snapshot, fetch loop, blur layers); project naming/renaming; pending states; undo leaking across projects; dashboard thumbnails; prompt box re-render; OpenRouter provider; structural references; quota-aware section retries; vitest suite.
