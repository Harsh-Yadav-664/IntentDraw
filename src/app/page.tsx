import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowRight, Sparkles, Layers, PenTool } from 'lucide-react'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background relative overflow-hidden">
      {/* Dynamic Background Effects */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] mix-blend-screen animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-amber-900/10 rounded-full blur-[150px] mix-blend-screen" />
      </div>

      <nav className="glass-panel sticky top-4 z-50 mx-4 mt-4 mb-16 max-w-7xl md:mx-auto px-6 py-3 rounded-full flex justify-between items-center">
        <div className="text-2xl font-display font-bold tracking-tight glow-text">
          Intent<span className="text-primary">Draw</span>
        </div>
        <div className="flex gap-4 items-center">
          <Button variant="ghost" className="hover:text-primary transition-colors hidden sm:inline-flex" asChild>
            <Link href="/login">Sign In</Link>
          </Button>
          <Button className="rounded-full font-medium shadow-[0_0_15px_rgba(200,150,50,0.3)] hover:shadow-[0_0_25px_rgba(200,150,50,0.5)] transition-shadow" asChild>
            <Link href="/dashboard">Get Started</Link>
          </Button>
        </div>
      </nav>

      <section className="relative z-10 pt-16 pb-32 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/10 text-primary text-sm font-medium mb-8 hover-lift">
            <Sparkles className="w-4 h-4" />
            <span>The future of spatial design</span>
          </div>
          
          <h1 className="text-6xl sm:text-7xl font-display font-bold text-foreground mb-8 leading-[1.1] tracking-tight">
            Design with <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-amber-400 to-primary">Intent.</span>
            <br />
            Let AI do the rest.
          </h1>

          <p className="text-xl sm:text-2xl text-muted-foreground mb-12 max-w-3xl mx-auto font-light leading-relaxed">
            Draw your layout visually. Describe your vision in plain text. Watch as AI translates your spatial map into stunning, production-ready code.
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
            <Button size="lg" className="h-14 px-8 text-lg rounded-full shadow-[0_0_20px_rgba(200,150,50,0.4)] hover:shadow-[0_0_35px_rgba(200,150,50,0.6)] hover-lift" asChild>
              <Link href="/dashboard">
                Start Designing Free
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="relative z-10 py-32 bg-black/20 border-y border-white/5 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-6">How IntentDraw Works</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">No generic templates. No rigid grids. Just draw what you want, where you want it.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connecting line for desktop */}
            <div className="hidden md:block absolute top-12 left-[20%] right-[20%] h-[1px] bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

            {[
              { icon: PenTool, title: '1. Draw Regions', desc: 'Sketch rough shapes to define your layout zones directly on the infinite canvas.' },
              { icon: Layers, title: '2. Assign Intent', desc: 'Tell the AI what each drawn region means. A box could be a hero section, a pricing table, or a video player.' },
              { icon: Sparkles, title: '3. Generate', desc: 'Get bespoke, high-quality HTML & Tailwind CSS that perfectly matches your spatial layout and intent.' },
            ].map((step, i) => (
              <div key={step.title} className="glass-panel p-8 rounded-3xl hover-lift relative group">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-300">
                  <step.icon className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-2xl font-display font-semibold mb-4 text-foreground/90">{step.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      
      <footer className="relative z-10 py-12 text-center text-muted-foreground text-sm">
        <p>© 2026 IntentDraw. Design freely.</p>
      </footer>
    </main>
  )
}