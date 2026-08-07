# IntentDraw

IntentDraw is an AI-powered web design tool that bridges the gap between low-fidelity sketching and high-fidelity code. 

**The core concept: Spatial Intent**
Unlike text-only AI generators (like v0 or Lovable), IntentDraw understands *spatial intent*. Users can draw a rough wireframe directly on a canvas, defining the exact layout, dimensions, and overlaps of various regions. When paired with a text prompt describing those shapes (e.g., "Region 1 is a hero section, Region 2 is a pricing table"), the AI interprets both the text and the spatial coordinates. This gives users absolute control over the structure and layout of the generated React application, without writing any code.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Tech Stack
- **Framework:** Next.js (App Router), React, Tailwind CSS
- **State Management:** Zustand
- **Canvas:** React Konva (shapes tracked in canvas-store)
- **Database/Auth:** Supabase
- **AI Providers:** Swappable (Gemini, Groq, NVIDIA NIM)
- **Rendering Pipeline:** Custom Babel Standalone + React UMD setup inside a sandboxed iframe
