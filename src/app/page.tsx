import Link from 'next/link'
import { ArrowRight, ArrowUpRight, Check, ChevronDown, Clock, PenLine } from 'lucide-react'
import { authBypassed } from '@/lib/auth/bypass'
import { EXAMPLES, EXAMPLE_IDS } from '@/lib/examples'
import { PLANS } from '@/lib/plans'
import { BeforeAfter } from '@/components/marketing/before-after'
import { Brand, Reveal, SiteThumbnail } from '@/components/marketing/landing-bits'
import './landing.css'

/**
 * The marketing page. Its job is to show, in the first screen, the one thing no
 * other site generator does: read a drawing — as layout and as a picture — and
 * build around it. Everything it claims is something the app does today; what
 * is planned says so.
 */

const FAQ: Array<[string, string]> = [
  ['Do I have to draw?', 'Not at all. A sentence is enough to make a complete site. Drawing gives you more control over the layout and the artwork when you want it.'],
  ['Can I change just one part of my site?', 'Yes. Pick a section, say what to change, and rebuild only that section. Everything else stays as you left it.'],
  ['What do I get when I export?', 'A standalone HTML website that runs anywhere, or the React source to take into your own project. Your work remains yours.'],
  ['Will other people see my drawing or prompt?', 'No. A shared link shows only the finished site. Your drawing and your instructions stay in your private workspace.'],
  ['Will two of my sites look the same?', 'No. Each site gets its own typefaces, colours, corners and first screen, and IntentDraw avoids repeating the look of your recent sites.'],
]

export default function HomePage() {
  // In development there is no sign-in (lib/auth/bypass.ts), so every call to
  // action opens the app directly. Production sends people to sign up.
  const signIn = authBypassed() ? '/dashboard' : '/login'
  const signUp = authBypassed() ? '/dashboard' : '/signup'

  return (
    <div className="landing-page" data-theme="dark">
      <header className="marketing-header">
        <Brand />
        <nav aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#examples">Examples</a>
          <a href="#pricing">Pricing</a>
        </nav>
        <div className="marketing-header-actions">
          <Link className="marketing-signin" href={signIn}>
            Sign in
          </Link>
          <Link className="header-start" href={signUp}>
            Start free <ArrowUpRight size={15} />
          </Link>
        </div>
      </header>

      <main>
        <section className="landing-hero" aria-labelledby="hero-heading">
          <div className="hero-heading-row">
            <Reveal onLoad y={24}>
              <h1 id="hero-heading">
                <span className="hero-brand-name">
                  IntentDraw
                  <svg viewBox="0 0 520 24" preserveAspectRatio="none" aria-hidden="true">
                    <path d="M5 16C115 7 214 8 320 13c69 3 134 1 195-7" />
                  </svg>
                </span>
                <span className="hero-tagline">
                  Sketch what you mean.
                  <br />
                  <em>Get the site you meant.</em>
                </span>
              </h1>
            </Reveal>
            <Reveal onLoad delay={0.18} y={18} className="hero-aside">
              <p>Draw the idea, or just say it. We turn what you have in mind into a website that actually feels like yours.</p>
              <Link href={signUp} className="hero-cta">
                Start creating <ArrowUpRight size={19} />
              </Link>
              <span className="hero-note">No drawing skills needed. A sentence works too.</span>
            </Reveal>
          </div>

          <div className="hero-compare">
            <BeforeAfter />
            <div className="hero-compare-caption">
              <span>Drag the stroke — the mountains you draw are the mountains that ship.</span>
              <span className="fig">FIG. 01 · SKETCH → SITE</span>
            </div>
          </div>
        </section>

        <section className="how-section section-pad" id="how-it-works">
          <div className="section-heading">
            <span className="section-eyebrow">01 / HOW IT WORKS</span>
            <h2>
              From thought <em>to thing.</em>
            </h2>
            <p>Not a template to fill in. A way to show the AI what you see, before it starts building.</p>
          </div>
          <Reveal className="steps-grid">
            <div className="step-item">
              <span className="step-number">01</span>
              <div className="step-icon">
                <PenLine size={25} strokeWidth={1.5} />
              </div>
              <h3>Draw it, if you like.</h3>
              <p>Place sections with boxes. Sketch a scene with strokes. Or skip the canvas and write a sentence.</p>
            </div>
            <div className="step-item">
              <span className="step-number">02</span>
              <div className="step-icon">
                <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true">
                  <path d="m4 18 8-10 6 13 5-6 7 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="23" cy="7" r="3" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </div>
              <h3>See what it understood.</h3>
              <p>Before the build, see the concept, the colours, the typefaces and what each mark means — and correct any of it in one click.</p>
            </div>
            <div className="step-item">
              <span className="step-number">03</span>
              <div className="step-icon">
                <ArrowUpRight size={27} strokeWidth={1.5} />
              </div>
              <h3>Watch it come together.</h3>
              <p>A real site takes shape, section by section. Keep what works. Rebuild only what doesn&apos;t.</p>
            </div>
          </Reveal>
        </section>

        <section className="understood-section section-pad">
          <div className="understood-copy">
            <span className="section-eyebrow">02 / THE DIFFERENCE</span>
            <h2>
              Your drawing is <em>read,</em>
              <br />
              not traced.
            </h2>
            <p>
              A circle isn&apos;t just a circle. It could be a rising sun, a spinning 3D object, or a place for your logo. IntentDraw
              works out what you meant — where it goes, what it is, whether it moves — then builds around it.
            </p>
            <Link href={signUp} className="text-link">
              See what yours becomes <ArrowUpRight size={17} />
            </Link>
          </div>
          <Reveal className="understood-demo" y={26}>
            <div className="demo-top">
              <span className="demo-led" /> WHAT I UNDERSTOOD <span>01 / 04</span>
            </div>
            <div className="demo-summary">
              A place to disappear
              <br />
              <em>for a while.</em>
            </div>
            <div className="demo-read">
              <span>YOUR DRAWING</span>
              <p>Two mountains at daybreak, a sun between the peaks, and a river leading you in.</p>
            </div>
            <div className="demo-detail">
              <span>CONCEPT</span>
              <strong>A slower kind of escape</strong>
            </div>
            <div className="demo-detail demo-colors">
              <span>PALETTE</span>
              <div>
                <i style={{ background: '#263d32' }} />
                <i style={{ background: '#a5a68f' }} />
                <i style={{ background: '#e6d4a7' }} />
                <i style={{ background: '#eeeae0' }} />
              </div>
            </div>
            <div className="demo-bottom">
              HERO <ArrowRight size={13} /> STORY <ArrowRight size={13} /> THE STAY <ArrowRight size={13} /> CONTACT
            </div>
          </Reveal>
        </section>

        <section className="unique-section section-pad">
          <div className="section-heading unique-heading">
            <span className="section-eyebrow">03 / NEVER A TEMPLATE</span>
            <h2>
              No two ideas <em>look alike.</em>
            </h2>
            <p>Different concepts deserve different type, colours, corners and character. There is no default theme to fall back on.</p>
          </div>
          <Reveal className="unique-strip" y={25}>
            {EXAMPLE_IDS.slice(0, 3).map((variant) => (
              <div className="unique-site" key={variant}>
                <SiteThumbnail variant={variant} />
                <span>
                  {EXAMPLES[variant].category} / {EXAMPLES[variant].name}
                </span>
              </div>
            ))}
          </Reveal>
          <div className="feature-lines">
            <div>
              <span>01 / REFINE</span>
              <h3>
                Fix one section.
                <br />
                Keep the rest.
              </h3>
              <p>Change a detail without watching the whole site become something else.</p>
            </div>
            <div>
              <span>02 / OWN</span>
              <h3>
                Your site.
                <br />
                Your source code.
              </h3>
              <p>Download a standalone HTML file or take the React source with you.</p>
            </div>
            <div>
              <span>03 / SEND</span>
              <h3>
                Ready to show?
                <br />
                One link.
              </h3>
              <p>Publish your work without making your drawing or prompt public.</p>
            </div>
          </div>
        </section>

        <section className="examples-section section-pad" id="examples">
          <div className="section-heading examples-heading">
            <span className="section-eyebrow">04 / START FROM AN EXAMPLE</span>
            <h2>
              A few places <em>to begin.</em>
            </h2>
            <p>The sketch in the corner is the drawing each one starts from. Open one to get its drawing and prompt in your own project, then make it yours.</p>
          </div>
          <div className="examples-grid">
            {EXAMPLE_IDS.map((variant, index) => (
              <Link className="example-item" key={variant} href={`/dashboard?example=${variant}`} aria-label={`Start from the ${EXAMPLES[variant].name} example`}>
                <SiteThumbnail variant={variant} sketchInset />
                <div className="example-caption">
                  <span>
                    <b>{EXAMPLES[variant].name}</b>
                    <small>{EXAMPLES[variant].category}</small>
                  </span>
                  <span className="example-index">
                    0{index + 1} <ArrowUpRight size={18} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="pricing-section section-pad" id="pricing">
          <div className="section-heading pricing-heading">
            <span className="section-eyebrow">05 / PRICING</span>
            <h2>
              Make more. <em>Worry less.</em>
            </h2>
            <p>Start for free — everything on the free plan works today. Paid plans are on the way.</p>
          </div>
          <div className="pricing-grid">
            {PLANS.map((plan) => (
              <div className={`pricing-column ${plan.name === 'Pro' ? 'pricing-featured' : ''}`} key={plan.name}>
                <div className="pricing-plan-top">
                  <span>{plan.name}</span>
                  {!plan.available && <small>COMING SOON</small>}
                </div>
                <div className="pricing-price">
                  {plan.price}
                  {plan.per && <span> / {plan.per === 'forever' ? 'forever' : 'month'}</span>}
                </div>
                <p>{plan.blurb}</p>
                <Link className={`pricing-action ${plan.name === 'Pro' ? 'featured' : ''}`} href={signUp}>
                  {plan.available ? 'Start free' : 'Start free today'} <ArrowUpRight size={17} />
                </Link>
                <ul>
                  {plan.lines.map((line) => (
                    <li key={line.text} className={line.soon ? 'soon' : undefined}>
                      {line.soon ? <Clock size={14} /> : <Check size={15} />}
                      {line.text}
                      {line.soon ? ' · soon' : ''}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="pricing-footnote">IntentDraw is in early access. Paid plans aren&apos;t on sale yet, and prices may change before they are.</p>
        </section>

        <section className="faq-section section-pad">
          <div className="section-heading faq-heading">
            <span className="section-eyebrow">06 / GOOD QUESTIONS</span>
            <h2>
              Before you <em>begin.</em>
            </h2>
          </div>
          <div className="faq-list">
            {FAQ.map(([question, answer], index) => (
              <details key={question} className="faq-item">
                <summary>
                  <span>0{index + 1}</span>
                  <strong>{question}</strong>
                  <ChevronDown size={19} />
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="final-cta section-pad">
          <span className="section-eyebrow">YOU ALREADY HAVE THE IDEA</span>
          <h2>
            Let&apos;s make it <em>real.</em>
          </h2>
          <p>The next great website doesn&apos;t start with a template. It starts with you.</p>
          <Link className="final-button" href={signUp}>
            Start creating <ArrowUpRight size={19} />
          </Link>
          <svg viewBox="0 0 700 70" preserveAspectRatio="none" aria-hidden="true">
            <path d="M5 43c132-39 268-16 384-8 121 9 217-3 306-27" />
          </svg>
        </section>
      </main>

      <footer className="marketing-footer">
        <div>
          <Brand />
          <p>A better way to show what you mean.</p>
        </div>
        <div className="footer-links">
          <a href="#how-it-works">How it works</a>
          <a href="#examples">Examples</a>
          <a href="#pricing">Pricing</a>
          <Link href={signIn}>Sign in</Link>
        </div>
        <span>&copy; {new Date().getFullYear()} IntentDraw. Made with intention.</span>
      </footer>
    </div>
  )
}
