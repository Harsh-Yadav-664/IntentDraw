import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowRight, Brain, Download, PenTool, RefreshCw, Share2, Sparkles } from 'lucide-react'
import { HeroDemo } from '@/components/marketing/hero-demo'
import { authBypassed } from '@/lib/auth/bypass'

/**
 * The marketing page. Its job is to show, in the first screen, the one thing
 * no other site generator does: read a drawing — as layout AND as a picture —
 * and build around it. The demo is real output, not a mock-up.
 *
 * Deliberately free of blur and blend layers: the editor lagged badly from
 * exactly those, and a landing page that stutters is the worst possible advert
 * for a design tool.
 */

const STEPS = [
  {
    icon: PenTool,
    title: 'Draw, if you like',
    body: 'Boxes place sections exactly. Strokes become pictures — two ridges and a river become mountains and a river. Or skip it: a prompt alone works.',
  },
  {
    icon: Brain,
    title: 'It works out what you meant',
    body: 'Before building anything it writes a brief: who the site is for, what it needs, what your drawing depicts, and a concept of its own — and shows it to you.',
  },
  {
    icon: Sparkles,
    title: 'You get a real site',
    body: 'A complete, animated page with its own palette and structure, built section by section while you watch.',
  },
]

const DIFFERENT = [
  {
    icon: PenTool,
    title: 'Your drawing is read, not traced',
    body: 'Strokes are measured — ridges, arcs, the two banks of a river — and rendered as finished art, so what you sketch is what appears.',
  },
  {
    icon: RefreshCw,
    title: 'Fix one part, keep the rest',
    body: 'Rebuild a single section with a note like “make it a comparison table” instead of regenerating the whole page.',
  },
  {
    icon: Download,
    title: 'It’s yours',
    body: 'Download a single HTML file that runs anywhere, or the React source for your own project.',
  },
  {
    icon: Share2,
    title: 'Share it in one click',
    body: 'Publish a link to the finished site. Your drawing and prompt stay private.',
  },
]

export default function HomePage() {
  // In development there is no sign-in (lib/auth/bypass.ts), so every call to
  // action opens the app directly. Production sends people to sign up.
  const signIn = authBypassed() ? '/dashboard' : '/login'
  const signUp = authBypassed() ? '/dashboard' : '/signup'

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0A0A0B]">
      {/* Static light — a gradient, not a blurred element, so it costs nothing to paint. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(900px circle at 50% -10%, rgba(250,204,21,0.10), transparent 60%),' +
            'radial-gradient(700px circle at 100% 40%, rgba(250,204,21,0.04), transparent 60%)',
        }}
      />

      <nav className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="font-display text-xl font-bold tracking-tight">
          Intent<span className="text-primary">Draw</span>
        </span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" className="hidden sm:inline-flex" asChild>
            <Link href={signIn}>Sign in</Link>
          </Button>
          <Button className="rounded-full" asChild>
            <Link href={signUp}>Start free</Link>
          </Button>
        </div>
      </nav>

      <section className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 px-6 pb-24 pt-10 lg:grid-cols-[0.85fr_1.25fr] lg:pt-16">
        <div>
          <p className="mb-5 text-sm font-medium text-primary">Sketch-to-site, for people who think visually</p>
          <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
            Sketch what you mean.
            <br />
            <span className="text-primary">Get the site you meant.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Draw a rough layout — or a picture — and describe it in a sentence. IntentDraw understands both and builds
            a complete website around them. Draw two mountains and a river; get a site with two mountains and a river.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Button size="lg" className="h-12 rounded-full px-7 text-base" asChild>
              <Link href={signUp}>
                Start designing free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <span className="text-sm text-muted-foreground">No drawing skills needed. A prompt alone works too.</span>
          </div>
        </div>

        <HeroDemo />
      </section>

      <section className="relative z-10 border-y border-white/5 bg-white/[0.02]">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">How it works</h2>
          <ol className="mt-10 grid gap-8 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="relative">
                <span className="font-display text-sm font-semibold text-primary">0{i + 1}</span>
                <div className="mt-3 flex items-center gap-2.5">
                  <step.icon className="h-5 w-5 text-foreground/70" />
                  <h3 className="text-lg font-semibold">{step.title}</h3>
                </div>
                <p className="mt-2 leading-relaxed text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-6 py-20">
        <h2 className="max-w-2xl font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Built for the part other generators skip.
        </h2>
        <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2">
          {DIFFERENT.map(item => (
            <div key={item.title} className="bg-[#0D0D0F] p-7">
              <item.icon className="h-5 w-5 text-primary" />
              <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
              <p className="mt-2 leading-relaxed text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
        <div className="flex flex-col items-start justify-between gap-6 rounded-2xl border border-primary/20 bg-primary/[0.06] p-10 md:flex-row md:items-center">
          <div>
            <h2 className="font-display text-2xl font-bold sm:text-3xl">Your next site starts as a sketch.</h2>
            <p className="mt-2 text-muted-foreground">Free to start. Your first site takes a few minutes.</p>
          </div>
          <Button size="lg" className="h-12 rounded-full px-7 text-base" asChild>
            <Link href={signUp}>
              Start designing free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/5">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 text-sm text-muted-foreground">
          <span className="font-display font-semibold text-foreground/80">
            Intent<span className="text-primary">Draw</span>
          </span>
          <div className="flex gap-5">
            <Link href={signIn} className="hover:text-foreground">Sign in</Link>
            <Link href={signUp} className="hover:text-foreground">Create account</Link>
          </div>
        </div>
      </footer>
    </main>
  )
}
