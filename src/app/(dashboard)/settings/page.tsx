'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Check, Clock, KeyRound, Link2, LogOut } from 'lucide-react'
import { Button, Chip, Field, Meter, Segmented, StatusDot, cx } from '@/components/kit/kit'
import { Wordmark } from '@/components/kit/sketch'
import { useAuth } from '@/hooks/use-auth'
import { useUsage, formatResetTime } from '@/hooks/use-usage'
import { useTheme } from '@/lib/theme'
import { authBypassed } from '@/lib/auth/bypass'
import { createBrowserClient } from '@/lib/supabase'
import { displayName, initialsOf } from '@/lib/people'
import { PLANS } from '@/lib/plans'

const TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'plan', label: 'Plan' },
  { id: 'usage', label: 'Usage' },
  { id: 'models', label: 'Models & keys' },
  { id: 'domains', label: 'Domains' },
] as const
type Tab = (typeof TABS)[number]['id']

function Heading({ title, sub, soon }: { title: string; sub: string; soon?: boolean }) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <h1 className="text-[30px] leading-tight text-ink">{title}</h1>
        {soon && <Chip tone="warn">Coming soon</Chip>}
      </div>
      <p className="mt-2 max-w-[60ch] text-[13px] leading-[1.7] text-muted">{sub}</p>
    </div>
  )
}

function Profile() {
  const { user, signOut } = useAuth()
  const [theme, setTheme] = useTheme()
  const supabase = useMemo(() => createBrowserClient(), [])
  const bypass = authBypassed()
  const current = typeof user?.user_metadata?.name === 'string' ? user.user_metadata.name : ''
  const [name, setName] = useState(current)
  const [saving, setSaving] = useState(false)
  const since = user?.created_at ? new Date(user.created_at).toLocaleDateString([], { month: 'long', year: 'numeric' }) : null

  const save = async () => {
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ data: { name: name.trim().slice(0, 50) } })
    setSaving(false)
    if (error) toast.error('Could not save your name')
    else toast.success('Profile saved')
  }

  return (
    <section className="space-y-6">
      <Heading title="Profile" sub="How IntentDraw knows you, and how it looks to you." />
      <div className="rounded-[14px] border border-line bg-surface p-6">
        <div className="flex items-center gap-5">
          <div className="grid h-16 w-16 place-items-center rounded-full border border-line2 bg-surface2 text-[18px] text-ink">{initialsOf(displayName(user))}</div>
          <div>
            <div className="text-[13px] text-ink">{displayName(user)}</div>
            <div className="mt-1 text-[11.5px] text-faint">
              {since ? `Member since ${since} · ` : ''}Free plan
            </div>
          </div>
        </div>
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field
            label="Display name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={50}
            disabled={bypass}
            hint={bypass ? 'Sign-in is off in development, so there is no account to update.' : undefined}
          />
          <Field label="Email" value={user?.email ?? ''} disabled hint="Your sign-in address." readOnly />
        </div>
        <div className="mt-6 flex items-center gap-3">
          <Button variant="primary" onClick={save} disabled={bypass || saving || name.trim() === current.trim()}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
          {!bypass && (
            <Button variant="quiet" icon={<LogOut size={13} />} onClick={() => void signOut()}>
              Sign out
            </Button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[14px] border border-line bg-surface p-5">
        <div>
          <div className="text-[13px] text-ink">Appearance</div>
          <div className="mt-1 text-[11.5px] text-muted">The app&apos;s theme. Your generated sites always keep their own look.</div>
        </div>
        <Segmented
          size="sm"
          label="Theme"
          value={theme}
          onChange={setTheme}
          items={[
            { value: 'dark', label: 'Dark' },
            { value: 'light', label: 'Light' },
          ]}
        />
      </div>
    </section>
  )
}

function Plan() {
  return (
    <section className="space-y-6">
      <Heading title="Plan" sub="You're on Free. Paid plans aren't on sale yet — when they are, they'll appear here." />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {PLANS.map((plan) => (
          <div key={plan.name} className={cx('flex flex-col rounded-[14px] border p-6', plan.available ? 'border-accent bg-surface' : 'border-line bg-bg2')}>
            <div className="flex items-center justify-between">
              <span className="text-[18px] text-ink">{plan.name}</span>
              {plan.available ? <Chip tone="accent">Current plan</Chip> : <Chip tone="warn">Coming soon</Chip>}
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="tab-num text-[30px] text-ink">{plan.price}</span>
              {plan.per && <span className="mono-label text-faint">{plan.per}</span>}
            </div>
            <ul className="mt-5 space-y-2.5">
              {plan.lines.map((l) => (
                <li key={l.text} className={cx('flex items-start gap-2 text-[12px] leading-[1.6]', l.soon ? 'text-muted' : 'text-ink')}>
                  {l.soon ? <Clock size={12} className="mt-0.5 shrink-0 text-faint" /> : <Check size={12} className="mt-0.5 shrink-0 text-accent" />}
                  {l.text}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}

function Usage() {
  const { stats } = useUsage()
  const [projects, setProjects] = useState<{ total: number; published: number; built: number } | null>(null)
  useEffect(() => {
    fetch('/api/projects')
      .then((r) => r.json())
      .then((json) => {
        const list = (json?.data?.projects ?? []) as Array<{ is_public: boolean; hasOutput: boolean }>
        setProjects({ total: list.length, published: list.filter((p) => p.is_public).length, built: list.filter((p) => p.hasOutput).length })
      })
      .catch(() => setProjects(null))
  }, [])
  const uncapped = !!stats && stats.limit >= 100_000

  return (
    <section className="space-y-6">
      <Heading title="Usage" sub="Generations today, and what you have built. Rebuilding a single section never counts." />
      <div className="rounded-[14px] border border-line bg-surface p-6">
        <div className="mono-label text-faint">Generations · today</div>
        {stats ? (
          <>
            <div className="mt-3 flex items-baseline gap-3">
              <span className="tab-num text-[38px] leading-none text-ink">{stats.used}</span>
              <span className="text-[12px] text-muted">{uncapped ? 'no daily limit in development' : `of ${stats.limit} · resets in ${formatResetTime(stats.resetAt)}`}</span>
            </div>
            {!uncapped && (
              <div className="mt-5 max-w-[420px]">
                <Meter value={stats.used} max={stats.limit} tone={stats.remaining <= 3 ? 'warn' : 'accent'} />
              </div>
            )}
          </>
        ) : (
          <div className="shimmer mt-4 h-8 w-40 rounded-full" />
        )}
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {(
          [
            ['Projects', projects?.total],
            ['Built', projects?.built],
            ['Published', projects?.published],
          ] as const
        ).map(([k, v]) => (
          <div key={k} className="rounded-[14px] border border-line bg-surface p-5">
            <div className="mono-label text-faint">{k}</div>
            <div className="tab-num mt-3 text-[22px] text-ink">{v ?? '—'}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

function Models() {
  const [providers, setProviders] = useState<Record<string, boolean> | null>(null)
  useEffect(() => {
    fetch('/api/providers')
      .then((r) => r.json())
      .then((json) => setProviders(json?.success ? json.data : null))
      .catch(() => setProviders(null))
  }, [])

  const rows: Array<[string, string, string]> = [
    ['gemini', 'Gemini', 'First choice — reads your drawing; falls back through newer Gemini models'],
    ['groq', 'Groq', 'Fast, and reads drawings with Qwen'],
    ['openrouter', 'OpenRouter', 'Stronger free coding models'],
    ['nvidia', 'NVIDIA', 'Last resort — slowest'],
  ]

  return (
    <section className="space-y-6">
      <Heading title="Models & keys" sub="IntentDraw tries these providers in turn, so a busy model never stops a build. Pick the one to try first in the editor's Build panel." />
      <div className="overflow-hidden rounded-[14px] border border-line bg-surface">
        {rows.map(([id, label, hint]) => {
          const on = providers?.[id]
          return (
            <div key={id} className="flex items-center justify-between gap-4 border-b border-line px-6 py-4 last:border-0">
              <div className="flex items-center gap-3">
                <KeyRound size={14} className="text-faint" />
                <div>
                  <div className="text-[13px] text-ink">{label}</div>
                  <div className="mt-1 text-[11px] text-faint">{hint}</div>
                </div>
              </div>
              {providers === null ? <span className="shimmer h-3 w-20 rounded-full" /> : <StatusDot status={on ? 'built' : 'queued'} label={on ? 'Connected on this server' : 'No key on this server'} />}
            </div>
          )
        })}
      </div>
      <div className="flex items-center justify-between gap-6 rounded-[14px] border border-dashed border-line2 bg-bg2 p-5">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-[13px] text-ink">Bring your own API key</span>
            <Chip tone="warn">Coming soon</Chip>
          </div>
          <div className="mt-1 text-[11.5px] text-muted">Use your own Gemini, OpenRouter or Groq key for your builds. Keys will be stored encrypted and never appear in exported code.</div>
        </div>
      </div>
    </section>
  )
}

function Domains() {
  return (
    <section className="space-y-6">
      <Heading title="Domains" soon sub="Connect your own domain to a published site. Until then, every published site has its own link — turn it on from Share in the editor." />
      <div className="rounded-[14px] border border-line bg-surface p-6">
        <Field label="Domain" placeholder="studio.example.com" disabled hint="Not available yet." />
        <div className="mt-6 rounded-[10px] border border-dashed border-line2 p-5">
          <div className="mono-label text-faint">Preview · what it will look like</div>
          <div className="mt-3 flex items-center gap-2 rounded-[8px] border border-line bg-surface2 px-3 py-2.5">
            <Link2 size={12} className="text-faint" />
            <span className="tab-num text-[12px] text-ink">studio.example.com</span>
            <span className="ml-auto text-[11px] text-faint">HTTPS set up for you</span>
          </div>
        </div>
      </div>
    </section>
  )
}

function SettingsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const requested = searchParams.get('tab')
  const tab: Tab = TABS.some((t) => t.id === requested) ? (requested as Tab) : 'profile'
  const setTab = (t: Tab) => router.replace(`/settings?tab=${t}`, { scroll: false })

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-40 border-b border-line bg-bg/95">
        <div className="mx-auto flex h-[60px] max-w-[1180px] items-center gap-5 px-6 lg:px-10">
          <Wordmark />
          <Link href="/dashboard" className="ml-2 flex items-center gap-1.5 text-[12px] text-muted transition-colors duration-150 hover:text-ink">
            <ArrowLeft size={13} /> Projects
          </Link>
          <div className="mono-label ml-auto text-faint">Settings</div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1180px] grid-cols-12 gap-10 px-6 py-14 lg:px-10">
        <aside className="col-span-12 lg:col-span-3">
          <nav className="sticky top-[92px] space-y-1" aria-label="Settings sections">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-current={tab === t.id ? 'page' : undefined}
                className={cx(
                  'flex w-full items-center justify-between rounded-[10px] px-3.5 py-2.5 text-left text-[13px] transition-colors duration-150',
                  tab === t.id ? 'bg-surface2 text-ink' : 'text-muted hover:text-ink',
                )}
              >
                {t.label}
                {tab === t.id && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
              </button>
            ))}
          </nav>
        </aside>
        <main className="col-span-12 lg:col-span-9">
          {tab === 'profile' && <Profile />}
          {tab === 'plan' && <Plan />}
          {tab === 'usage' && <Usage />}
          {tab === 'models' && <Models />}
          {tab === 'domains' && <Domains />}
        </main>
      </div>
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg" />}>
      <SettingsPage />
    </Suspense>
  )
}
