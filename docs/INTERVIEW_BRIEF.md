# IntentDraw interview brief

Written 2026-11-03 from a fresh read of the code on `main` (commit `900e090`). Everything here was checked against the source. Where I'm inferring rather than reading it directly, it says **(inference)**.

Quick facts you can quote: about 158 source files under `src/`, all TypeScript. 31 test files with 271 tests, all passing when I ran `pnpm test` today. 62 commits since February 2026. There are **zero Python files** in the repo.

---

## The short version: what to fix on the resume

| Resume claim | Verdict |
|---|---|
| Bullet 1: hand-drawn sketches → structured frontend component trees | **Partly true** |
| Bullet 2: provider-agnostic interface, Claude and OpenAI | **Partly true.** The interface is real. Claude and OpenAI are **not in the code.** |
| Bullet 3: visual layout → typed machine-readable structures, with validation | **True** (one wording caveat) |
| Tech line: Python | **Not in the code.** Remove it unless it comes from another project. |
| Tech line: Computer Vision | **Misleading.** No OpenCV or classic CV. It uses vision-capable LLMs plus hand-written geometry code. |

Suggested replacement bullets:

- Built an LLM-powered web app that turns a rough wireframe drawn on a canvas, plus an optional text prompt, into a complete React and Tailwind website that renders live in the browser.
- Built a provider-agnostic LLM layer over four interchangeable providers (Google Gemini, Groq, NVIDIA NIM, OpenRouter), with automatic fallback, per-provider timeouts, and per-section routing. Each generated section records which model built it, so outputs can be compared.
- Designed a staged pipeline that measures the drawing's geometry in code, has a multimodal model write a typed design brief, and validates every model output: schema-style normalisation of the JSON, a TSX parse check with one corrective retry, and layout lint.

Suggested tech line: **TypeScript, Next.js / React, LLM APIs (Gemini, Groq, NVIDIA NIM, OpenRouter), multimodal vision models, Supabase.** If you want a phrase where "Computer Vision" was, use "geometric sketch analysis" or "multimodal LLM vision", not "Computer Vision".

---

## 1. Overview

**The problem.** Text-to-website tools make you describe layout in words, and that's painful. "Put a big image on the right, a headline on the left, and three cards under it" is slow to write and the model often ignores it. IntentDraw lets you draw the layout instead.

**The input.** Two things, and both are optional on their own:
- A drawing made on the app's own canvas: rectangles, circles, freehand strokes and arrows. Each shape is stored as a "region" with its position, size, and, for freehand strokes, the actual list of points. You can type a note on any shape, tag it with one click (for example "this is a picture" or "put it behind the content"), and group several shapes under one description.
- A text prompt, like "a portfolio site, dark, green, make region 1 a rotating 3D cube".

It also works with no drawing at all, as a plain prompt-to-website generator. That's a deliberate goal.

**The output.** A complete single-file React website written in TSX with Tailwind classes. It's compiled in the browser and shown live in a sandboxed iframe. Along the way the system also produces a typed "design brief", which is a JSON object saying what it thinks the drawing is and what the site should contain. The user sees that brief as "What I understood" and can correct it.

**Important nuance for bullet 1.** The "sketch" is drawn inside the app, so the system gets vector data (exact coordinates and stroke points), not a photo of a paper drawing. It also exports the drawing as a PNG so a vision model can look at it.

---

## 2. The three bullets, checked

### Bullet 1: "LLM-powered system that converts hand-drawn UI sketches into structured frontend component trees"

**Verdict: partly true.**

What's true:
- It is LLM-powered and takes hand-drawn input. Drawing: `src/components/canvas/drawing-canvas.tsx` (React Konva), stored in `src/store/canvas-store.ts`.
- The output really is a tree of React components. The page shell (`src/lib/ai/page-shell.ts`) writes an `App` component that renders every planned section in order, each wrapped in an error boundary, and the models write each section component. So the result is "App → sections → their own sub-components".

What's off:
- The output is **generated code**, not an abstract component-tree data structure such as a JSON tree of nodes. If an interviewer pictures "sketch → JSON UI tree", that is not what this does. The closest typed structure is the design brief's section plan and element list (`src/lib/ai/brief.ts`).
- "Hand-drawn UI sketches" suggests photos or scans. It is the app's own drawing canvas.

Finished vs in progress:
- Finished and working end to end: draw, understand, build section by section, validate, render, save, rebuild one section.
- In progress by the project's own account (`BACKLOG.md`, `CLAUDE.md`): the drawing layer is still the weakest part. Nothing judges visual quality or taste yet (only a measured layout check). Static sites only, no backend generation.

Reworded: *"Built an LLM-powered web app that turns a rough wireframe drawn on a canvas, plus an optional prompt, into a complete React and Tailwind website rendered live in the browser."*

### Bullet 2: "Provider-agnostic LLM interface supporting interchangeable providers (Claude, OpenAI) to compare model outputs"

**Verdict: partly true. The interface is real, the named providers are wrong.**

What's true:
- There's one function every part of the pipeline calls, `callProvider()` in `src/lib/ai/provider.ts`. You pass a provider name, a system prompt, a user message and optionally an image, and get text back. Behind it are four providers, each in its own file: `gemini.ts`, `groq.ts`, `nvidia.ts`, `openrouter.ts`.
- They are interchangeable. `buildFallbackChain()` puts the user's choice first and the others after it, so if one fails or times out the next one takes over. Each provider has its own timeout, and errors from every provider are turned into one readable message (`humanizeProviderError()`).
- There's an "auto" mode (`src/lib/ai/provider-choice.ts`) that routes different parts of the page to different providers: Gemini for the hero and content sections, Groq for navigation, footer and forms.
- Each built section saves which provider and model built it and how long it took (the `provider`, `model` and `ms` fields on a section block), and the Sections list shows it on hover.

What's not in the code:
- **No Claude (Anthropic) integration and no OpenAI API integration.** I searched the whole `src/` folder. The only "openai" strings are the name of an open-weight model that Groq hosts (`openai/gpt-oss-120b`) and a comment saying OpenRouter uses an OpenAI-compatible request format. Neither is "supporting OpenAI" in the way the bullet says. Do not claim Claude or OpenAI.
- **"To compare model outputs"** is a stretch. There's no side-by-side comparison tool or evaluation harness. What exists: per-section model tracking, and the "auto" routing rule came from the owner comparing runs by eye (`provider-choice.ts` says so in a comment). The primary purpose of having several providers is **resilience on free tiers**, not comparison.

Reworded: *"Built a provider-agnostic LLM layer over four interchangeable providers (Google Gemini, Groq, NVIDIA NIM, OpenRouter), with automatic fallback, per-provider timeouts and per-section routing. Each section records which model built it."*

If someone asks "why not Claude or OpenAI?": the project runs on free tiers on purpose, and adding a provider is one new file plus one branch in `callProvider()` (see section 8).

### Bullet 3: "Pipeline that maps a sketch's visual layout into typed, machine-readable UI structures, with validation of model output"

**Verdict: true.** This is your strongest bullet.

Evidence, layout to structure:
- Every shape is a typed `Region` with a typed `RegionGeometry` (x, y, width, height, shape type, point list). See `src/types/index.ts`.
- `src/lib/ai/perception.ts` measures strokes in code: is it a circular arc (with a fitted centre and radius), a ridge, a zig-zag, likely handwriting, drawn inside another shape, or one bank of a "river" next to another stroke.
- `src/lib/ai/intent.ts` combines four kinds of evidence about each shape (the user's one-click tag, words in the prompt like "R2 to R4" or "3D cube", the model's reading, and geometry hints like "a strip across the top is probably the nav").
- The model then writes a typed `DesignBrief` (`src/lib/ai/brief.ts`): a section plan, a list of drawing elements each with a role, form, anchor and section, a palette, a brand name, fonts and so on.
- `src/lib/ai/page-shell.ts` converts each drawn element into exact placement: its position as a percent of the screen it was drawn on, written as Tailwind classes like `lg:left-[68.9%] lg:top-[25.2vh]`.

Evidence, validation:
- `normalizeBrief()` in `brief.ts` runs on every brief, from the model or sent back by the browser. It caps string lengths, checks every enum against a fixed list, validates colours as hex, and makes sure every region belongs to exactly one element. If no model produces a usable brief, `fallbackBrief()` builds one from heuristics.
- `parseJsonObject()` in `brief.ts` pulls a JSON object out of a model's answer safely.
- `findSyntaxProblem()` in `src/lib/ai/validate.ts` parses every generated section with `@babel/parser`, the same parser the preview uses. If it fails, the model gets **one** corrective call with the compiler's error. A second failure is reported as a failed section, never passed off as success (`src/lib/ai/staged.ts`).
- `lintLayout()` (`layout-lint.ts`) fixes grid rows whose column spans overflow, and `ai-look.ts` detects "looks AI-generated" patterns and triggers one corrective call for the worst ones.
- In the browser, each block is trial-assembled before being added (`src/hooks/use-ai.ts`), and the rendered page is measured for unreadable text, overflow and overlaps (`src/lib/utils/page-audit.ts`).

The one caveat: validation is **hand-written TypeScript validators**, not a schema library. Zod is installed but used only for login and signup forms (`src/lib/validations/auth.ts`). Say "schema-style validation" or "normalisation", not "Zod schemas".

---

## 3. Architecture and data flow, end to end

1. **Draw.** The user draws on a React Konva canvas (`components/canvas/drawing-canvas.tsx`). Shapes live as `Region` objects in a Zustand store (`store/canvas-store.ts`), which also handles undo, groups and exporting the drawing to a PNG.
2. **Start a run.** The browser hook `hooks/use-ai.ts` drives the whole run as several short requests, not one long one.
3. **Understand.** `POST /api/generate/understand` → `lib/ai/understand.ts`. It builds a message with the prompt, each region's geometry, the simplified stroke paths (`lib/ai/shape-path.ts`, Ramer-Douglas-Peucker simplification), the measured facts (`perception.ts`) and the intent signals (`intent.ts`), plus the PNG. It tries providers that can see images first. The answer is parsed and normalised into a `DesignBrief` (`brief.ts`).
4. **Show the reading.** The brief appears in the editor as "What I understood". The user can correct how a shape was read.
5. **Build the shell in code.** `POST /api/generate/shell` → `lib/ai/staged.ts` → `lib/ai/page-shell.ts`. **No model call here.** Code writes the `App` component: every planned section in order, each in an error boundary, any 3D object (`lib/ai/objects.ts`) placed at its drawn position, and a font marker. Drawn pictures (mountains, a sun, a globe) are rendered in code into an `<IntentScene />` component (`lib/ai/scene.ts`, `lib/ai/scene-render.ts`). This request also checks and uses up the user's one generation from the rate limit (`lib/middleware/rate-limit.ts`). It returns the list of section batches to build.
6. **Build sections.** For each batch, `POST /api/generate/section` → `generateSectionStage()` in `staged.ts`. The prompt (`lib/ai/prompts.ts`) includes the brief, the design rules, one or two structural reference sketches (`references.ts`) and exactly what was drawn in that section. Then: call the provider chain, extract the code, make safe repairs (`repair.ts`), enforce the site's design choices (`site-design.ts`), parse check with one retry (`validate.ts`), lint (`layout-lint.ts`), check for AI-look patterns (`ai-look.ts`). Batches assigned to different providers run side by side, within a five-minute limit.
7. **Images.** While the next section builds, `POST /api/generate/images` creates pictures with Cloudflare Workers AI (FLUX.1 schnell) and stores them in Supabase Storage. Without keys, it falls back to art drawn in code in the site's palette (`lib/utils/image-art.ts`).
8. **Assemble.** In the browser, `lib/ai/assemble.ts` merges the pieces into one file: merges imports, drops duplicate declarations (first one wins), renames imports that collide with a section's name.
9. **Render.** `components/preview/preview-frame.tsx` and `wrapReactForPreview()` in `lib/utils/sanitize.ts` run the code in a sandboxed iframe (scripts allowed, same-origin not allowed) using Babel Standalone and React 18 from a CDN, rewriting imports into browser globals. Errors and the layout audit are posted back to the editor (`components/editor/issue.tsx`).
10. **Save and rebuild.** The project is saved to Supabase as one JSON blob (`canvas_data`, which includes the build parts). One weak section can be rebuilt with a single call (`lib/ai/page-parts.ts`).

---

## 4. A real example

This is a real run saved as a test fixture: `src/lib/ai/__fixtures__/cube-portfolio.json`. I ran it through `scripts/diagnose-staged.ts` today, which makes zero API calls.

**Input.**
- Prompt (typos are the user's): *"make a portfolio website dark theme prmium, glass finish and make sure the colour theme is green with 3d animations like the region 1, make it a 3d rotating cube interactive with mouse clicks and movements"*
- Drawing: one rectangle, region 1, at about x 882, y 201, size 269 by 253, on a 1280-pixel-wide page.

**The brief the model wrote (shape, abridged).**
- brand: "Kaelen Vane"; tone: avant-garde, futuristic, tactile, luminous
- design: display font Syne, body font Plus Jakarta Sans, soft corners, glass surfaces, dense, uppercase headings
- palette: five hex colours (near-black, dark green, pale green text, bright green accent, deep green)
- sections: Navigation, Hero, SelectedWorks, InteractiveExhibits, TechStackCapabilities, ClientTestimonials, ContactFooter
- drawing elements: "3D Interactive Emerald Glass Cube", regions [1], role "illustration", form "shape"

**What the code did with it.**
- The model filed the cube as a flat painted shape. The code corrected it: the prompt says "3d … cube" about region 1, so it became role **object**, form **cube**, in section **Hero**. This exact mistake is why the fixture exists.
- The shell (built in code) puts the navigation over the top of the hero, renders all seven sections in order, and places the cube component at `lg:left-[68.9%] lg:top-[25.2vh] lg:w-[21%] lg:h-[31.7vh]`. 882 divided by 1280 is 68.9%, so it lands where it was drawn.
- Build batches: `[Hero]`, then `[Navigation, ContactFooter]`, then the rest in pairs.
- The Hero's model call is told: the cube is built and placed by IntentDraw at left 68.9%, top 25.2%; don't build it; keep that area clear.

The final output is one TSX file: a font and palette marker comment, the `App` shell above, the cube component, and the seven section components.

---

## 5. Key design decisions, and why

- **Several short calls instead of one big one.** Understand, shell, then one call per section batch. Why: the user sees progress, each call fits a serverless time limit, a failed section doesn't throw away the good ones, and spacing calls out respects free-tier rate limits. The old single-call path (`POST /api/generate`, `generateCode()`) still exists; this replaced it in the UI.
- **An "understanding" step before building.** Earlier versions only knew "layout box" or "decorative line", so a drawing of mountains came out as random streaks. Now a model first writes down what the drawing is a picture of, and the user can see and fix that reading.
- **Measure geometry in code, don't rely only on the vision model.** Circle fitting, handwriting detection, containment and so on are computed in `perception.ts`. Why: when Gemini was down, understanding fell back to a text-only model, and it still read the drawing correctly from these facts alone. Facts are stated only when the geometry is clear, because a wrong "measured" fact gets trusted over a correct visual read.
- **The page shell is built by code, not by a model.** A real run planned five sections and rendered one, because the shell model copied an example literally. Which sections exist and where drawn things go were already decided in the brief, so code writes them down. It also saves a call and about a minute.
- **3D objects and drawn pictures are rendered by code, never by a model.** Models kept putting the sun in front of the mountains or building the cube in the wrong section.
- **Validate with the same parser the preview uses**, with exactly one corrective retry. Alternative considered: endless repair rules. Rejected as whack-a-mole against model quality.
- **Free providers with fallback.** It runs on free tiers, so outages and quotas are normal. The chain walks to the next model or provider in seconds instead of waiting.
- **Security boundary is the sandboxed iframe.** Model-written code never runs with the app's origin. An old HTML sanitiser was removed from this path because it corrupted JSX. "Open in new tab" was also changed to stay sandboxed.
- **In-browser compile with Babel Standalone.** Alternative tried: Sandpack, removed because it didn't work with React 19. html2canvas snapshots were also tried and removed, because they can't read a sandboxed cross-origin frame.
- **A small hand-written brace scanner for assembly** instead of a full parser dependency. It only needs to handle the code these models write.

---

## 6. Known limitations and what I'd do next

Limitations the code and docs admit:
- **The drawing layer is still the weakest part**, by the project's own notes. Complicated drawings can still be misread.
- **Quality is capped by free models.** Different providers write noticeably different code quality, and Groq's output has had syntax errors that Gemini's didn't.
- **Nothing judges taste.** The layout audit measures contrast, overflow and overlap, but nothing scores whether the design is good. The planned fix is a vision-model critic (listed in `BACKLOG.md` as R7).
- **No evaluation harness.** The tests cover pure logic (271 tests), not model output quality. There's no benchmark dataset of sketches and expected results.
- **Assembly is string-based**, not a full AST merge. It's tested, but fragile by nature.
- **Heuristics have thresholds** (for example, what counts as handwriting) tuned on a few real drawings, not on a dataset.
- **Static sites only.** No backend generation. No billing.
- **Input is the in-app canvas**, not photos of paper sketches.
- **Some dead code** remains: the old single-call path, unused UI libraries, an unused `split` view mode.

What I'd improve next:
1. An evaluation set: 20 to 50 saved drawings with expected section plans and placements, scored automatically, so model or prompt changes are measured rather than eyeballed.
2. The vision-model critic that screenshots the result and asks for one targeted rebuild.
3. Photo input: let someone upload a paper sketch and convert it to regions. That's where real computer vision (contour detection) would come in.
4. A paid provider tier (Claude, GPT) behind the same interface, compared on the eval set.
5. Replace string assembly with an AST merge if it keeps causing bugs.

---

## 7. The technologies it really uses

- **Language:** TypeScript only. **No Python anywhere.**
- **App:** Next.js 16 (App Router), React 19, Tailwind CSS 4, Zustand for state, React Konva for the canvas, framer-motion for the app's own UI motion.
- **Backend and data:** Next.js API routes, Supabase (Postgres, auth, storage).
- **LLM APIs:** Google Gemini (`@google/generative-ai`), Groq (`groq-sdk`), NVIDIA NIM (plain fetch), OpenRouter (plain fetch, OpenAI-compatible format).
- **Vision:** multimodal LLMs looking at a PNG of the drawing: Gemini, a Qwen vision model on Groq, and a vision model on OpenRouter.
- **Images:** Cloudflare Workers AI, FLUX.1 schnell.
- **Code handling:** `@babel/parser` on the server for validation, Babel Standalone in the browser to compile, React 18 UMD inside the preview iframe, GSAP for generated-site animation.
- **Testing:** Vitest.

**Classic CV or LLM only?** No classic computer vision. No OpenCV, no image processing library, no trained vision model of its own. Image understanding comes from multimodal LLMs. On top of that there's hand-written geometry on the stroke points: circle fitting (the Kåsa method), Ramer-Douglas-Peucker line simplification, and heuristics for arcs, zig-zags, handwriting and containment. That's computational geometry on vector data, not CV on pixels.

**Accurate label:** "Multimodal LLMs (vision)" and, if you want, "geometric sketch analysis". Avoid plain "Computer Vision", because an interviewer will reasonably expect OpenCV, CNNs or image processing.

---

## 8. Likely questions, with short answers

**1. What does it do, in one sentence?**
You draw a rough layout and type a prompt, and it builds a real React website that matches where you drew things.

**2. Why drawing at all? Why not just text?**
Describing layout in words is slow and models ignore it. A drawing says "this goes here, this big" exactly. But drawing is optional; it also works from a prompt alone.

**3. What's the input format the model actually sees?**
A text message with the prompt, each region's position and size, simplified stroke paths as SVG path strings, facts measured in code, plus a PNG of the drawing when the model can see images.

**4. What's the output?**
First a typed JSON design brief: sections, drawing elements, palette, fonts. Then one TSX file with an App shell and one component per section, compiled and rendered in a sandboxed iframe.

**5. How do you get structured output from the model reliably?**
I ask for JSON, extract the object, then normalise it in code: every enum checked against a fixed list, lengths capped, colours validated, every region assigned. If it's unusable I try the next provider, and in the end fall back to a heuristic brief.

**6. How do you handle a model returning code that doesn't compile?**
I parse it with the same Babel parser the preview uses. If it fails, the model gets one retry with the exact compiler error. If that fails too, the section is marked failed and shows a placeholder, and the user can rebuild just that section.

**7. How does the provider abstraction work?**
One function takes a provider name, prompts and an optional image, and returns text. Each provider has its own adapter file and timeout. A fallback chain puts the user's choice first, and errors from all providers are combined into one readable message.

**8. Why several calls instead of one?**
Progress the user can see, each call fits a serverless timeout, one failure doesn't lose everything, and free-tier rate limits.

**9. How do you make the result match where things were drawn?**
Positions are converted to percentages of the screen they were drawn on and written as Tailwind classes. Things like a 3D cube are placed by code, and the section's model is told to keep that area clear.

**10. How is generated code kept safe?**
It runs in an iframe with scripts allowed but no same-origin access, so it can't touch the app's storage, cookies or APIs. "Open in new tab" uses the same sandbox.

**11. What was the hardest bug?**
Pick one you can tell well. Good options: (a) the canvas sent a data URL prefix that Gemini rejected, so every drawing silently fell back to a text-only model that never saw it; (b) the shell model copied a literal example and rendered one section out of five, which is why the shell is now built in code; (c) a hidden iframe reported zero width and the globe's rotation became NaN forever.

**12. How do you test something whose output is non-deterministic?**
I test the deterministic parts: prompt assembly, brief normalisation, geometry, assembly, validation and layout lint, with real saved drawings as fixtures. There are scripts that print the exact prompt a drawing produces with zero API calls. What I don't have yet is an automated quality evaluation of model output.

### Three tricky ones where "I haven't done that, but…" is the honest answer

**A. "How did you compare Claude and OpenAI outputs?"**
"I haven't integrated Claude or OpenAI. The project runs on free tiers, so it uses Gemini, Groq, NVIDIA and OpenRouter. But the interface is built for it: adding a provider is one adapter file and one branch in the dispatch function. Every section already records which model built it, so the next step would be a fixed set of test drawings scored across providers."

**B. "What classic computer vision did you use? OpenCV? A CNN?"**
"None. The drawing comes from my own canvas, so I already have exact vector coordinates and don't need to detect shapes from pixels. I do geometry on the points, like circle fitting and line simplification, and use multimodal LLMs for the visual read. If I supported photos of paper sketches, that's where I'd add OpenCV contour detection to turn the photo into regions."

**C. "How do you measure whether the output is good? What's your eval?"**
"I don't have a formal evaluation set yet. What exists is automated checks after rendering, for contrast, overflow, overlapping text and empty screens, plus regression fixtures from real failures. Next I'd build a small labelled set of drawings with expected sections and placements, and add a vision-model critic for visual quality."

**Also be ready for (inference):** "How much of this did you write yourself?" The git history shows many commits co-authored with Claude, and the repo has a `CLAUDE.md` file, so an interviewer reading GitHub will see AI coding help. Be upfront: you directed the design, made the decisions, tested real runs and debugged failures, and used an AI coding assistant to write a lot of the code. Then show you understand it, which is what this brief is for.

---

## 9. Pitches

### 60-second pitch

"IntentDraw is a web app where you draw a rough layout and type a short prompt, and it builds a real React website that matches your drawing. I built it because describing layout in words to tools like v0 is painful.

It works in stages. First, code measures the drawing: which strokes are circles, which look like handwriting, what's inside what. A vision-capable model then writes a typed design brief: the sections, what each shape is, the colours and fonts. My code validates that brief and builds the page skeleton itself, placing drawn things at their exact positions. Then each section is generated separately, checked with a real parser, and retried once if it doesn't compile.

It runs on four interchangeable LLM providers, Gemini, Groq, NVIDIA and OpenRouter, behind one interface with automatic fallback. The result is rendered live in a sandboxed iframe. It's all TypeScript on Next.js and Supabase, with about 270 unit tests on the pipeline logic."

### 3-minute walkthrough

**The problem (20 seconds).** "Text-to-website tools are good, but you can't tell them where things go without writing paragraphs. I wanted the drawing to be the instructions, while still working perfectly well with no drawing."

**Input (20 seconds).** "The user draws on a canvas I built with React Konva: boxes, circles, freehand lines, arrows. Each shape is stored as a typed region with its coordinates and stroke points. They can add a note or a one-click tag to a shape, or group shapes and describe them once."

**Step one, understand (40 seconds).** "Before building anything, the system works out what the user meant. Code measures the strokes first, because I found models trust their own visual read too much, and when the vision provider was down the text-only fallback still got it right from the measurements. The prompt is also parsed in code, so 'make region 1 a 3D cube' is enforced even if the model misses it. The model returns a design brief as JSON, and I normalise every field: enums, lengths, hex colours, and each region assigned to exactly one element. The user sees this brief as 'What I understood'."

**Step two, the shell (30 seconds).** "The page skeleton is written by code, not a model. It lists every section in order, wraps each in an error boundary, and places drawn objects at their exact percentages. I moved this out of the model after a run where it rendered one section out of five."

**Step three, sections (40 seconds).** "Each section is generated in its own call, told exactly what was drawn in it and where. The answer is parsed with Babel. If it doesn't compile, the model gets one retry with the compiler error. Then there's a layout lint and a check for generic AI-looking patterns. Sections on different providers run side by side, with a five-minute cap. Calls go through one provider interface: Gemini, Groq, NVIDIA or OpenRouter, with fallback when one is down or out of quota."

**Rendering and safety (20 seconds).** "The browser merges the pieces into one file, fixing duplicate imports and name collisions, and compiles it with Babel Standalone in a sandboxed iframe that can't reach the app's origin. If one section crashes, only that section disappears and the user can rebuild it with one click."

**What's next (10 seconds).** "The gaps I'd close next are an evaluation set so changes are measured, a vision critic for visual quality, and supporting photos of paper sketches."
