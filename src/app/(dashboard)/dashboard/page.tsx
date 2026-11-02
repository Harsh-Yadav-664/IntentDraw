'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Copy, LogOut, Moon, Pencil, Plus, Search, Settings, Sun, Trash2, Zap } from 'lucide-react'
import { Button, Chip, Dialog, IconButton, MenuItem, Meter, Popover, Segmented, cx } from '@/components/kit/kit'
import { SketchEmptyState, Wordmark } from '@/components/kit/sketch'
import { ProjectThumbnail } from '@/components/dashboard/project-thumbnail'
import { UpgradeDialog } from '@/components/editor/upgrade-dialog'
import { useUsage } from '@/hooks/use-usage'
import { useAuth } from '@/hooks/use-auth'
import { useTheme } from '@/lib/theme'
import { authBypassed } from '@/lib/auth/bypass'
import { EXAMPLES, EXAMPLE_IDS, exampleCanvas, isExampleId, type ExampleId } from '@/lib/examples'
import { generateUUID } from '@/lib/utils'
import { displayName, initialsOf } from '@/lib/people'
import type { ProjectThumbnail as Thumbnail } from '@/lib/projects/thumbnail'

interface Project {
  id: string
  name: string
  prompt: string | null
  created_at: string
  updated_at: string
  is_public: boolean
  hasOutput: boolean
  sectionCount: number
  thumbnail: Thumbnail | null
}

function edited(dateStr: string): string {
  const diffMins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (diffMins < 1) return 'edited just now'
  if (diffMins < 60) return `edited ${diffMins}m ago`
  const hours = Math.floor(diffMins / 60)
  if (hours < 24) return `edited ${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'edited yesterday'
  if (days < 7) return `edited ${days} days ago`
  return `edited ${new Date(dateStr).toLocaleDateString()}`
}

/* --------------------------------- usage ---------------------------------- */

function UsageMeter({ onUpgrade }: { onUpgrade: () => void }) {
  const { stats } = useUsage()
  if (!stats) return <div className="hidden h-[46px] w-[290px] rounded-[10px] border border-line md:block" />
  const uncapped = stats.limit >= 100_000
  const low = !uncapped && stats.remaining <= 3
  return (
    <div className="hidden items-center gap-3 rounded-[10px] border border-line px-3 py-2 md:flex">
      <div className="w-[128px]">
        <div className="flex items-baseline justify-between">
          <span className="mono-label text-faint">Today</span>
          <span className="tab-num text-[11px] text-muted">{uncapped ? '∞' : `${stats.remaining}/${stats.limit}`}</span>
        </div>
        <div className="mt-1.5">
          <Meter value={uncapped ? stats.limit : stats.remaining} max={stats.limit} tone={low ? 'warn' : 'accent'} />
        </div>
      </div>
      {low ? (
        <button type="button" onClick={onUpgrade} className="flex items-center gap-1.5 rounded-[6px] bg-accent px-2.5 py-1.5 text-[11px] font-medium text-onaccent transition-colors duration-150 hover:bg-accent2">
          <Zap size={11} /> {stats.remaining} left — see plans
        </button>
      ) : (
        <button type="button" onClick={onUpgrade} className="text-left text-[11.5px] text-muted hover:text-ink">
          {uncapped ? 'Development — no daily limit' : `${stats.remaining} of ${stats.limit} generations left today`}
        </button>
      )}
    </div>
  )
}

/* ------------------------------ project card ------------------------------ */

function ProjectCard({
  p,
  opening,
  onOpen,
  onRename,
  onDuplicate,
  onDelete,
}: {
  p: Project
  opening: boolean
  onOpen: () => void
  onRename: (name: string) => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(p.name)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  const commit = () => {
    setEditing(false)
    const next = draft.trim().slice(0, 100)
    if (next && next !== p.name) onRename(next)
    else setDraft(p.name)
  }

  const meta = [p.sectionCount > 0 ? `${p.sectionCount} sections` : p.hasOutput ? 'built' : 'not built yet', p.thumbnail ? `${p.thumbnail.total} ${p.thumbnail.total === 1 ? 'shape' : 'shapes'}` : null]
    .filter(Boolean)
    .join(' · ')

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={cx('group overflow-hidden rounded-[14px] border bg-surface transition-colors duration-200', opening ? 'border-accent/60' : 'border-line hover:border-line2')}
    >
      <div className="relative h-[196px] cursor-pointer overflow-hidden border-b border-line" onClick={onOpen}>
        <ProjectThumbnail thumbnail={p.thumbnail} prompt={p.prompt} hasOutput={p.hasOutput} />
        <div className="absolute inset-0 bg-black/0 transition-colors duration-200 group-hover:bg-black/35" />
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 p-3 opacity-0 transition-opacity duration-200 focus-within:opacity-100 group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
          <Button size="xs" variant="primary" onClick={onOpen}>
            Open
          </Button>
          <IconButton label="Rename" className="bg-bg/80 text-ink" onClick={() => setEditing(true)}>
            <Pencil size={13} />
          </IconButton>
          <IconButton label="Duplicate" className="bg-bg/80 text-ink" onClick={onDuplicate}>
            <Copy size={13} />
          </IconButton>
          <IconButton label="Delete" className="bg-bg/80 !text-danger" onClick={onDelete}>
            <Trash2 size={13} />
          </IconButton>
        </div>
        <div className="absolute right-3 top-3 flex gap-1.5">
          {p.hasOutput && <Chip tone="neutral">Built</Chip>}
          {p.is_public && (
            <Chip tone="ok">
              <span className="h-1.5 w-1.5 rounded-full bg-ok" /> Published
            </Chip>
          )}
        </div>
        {opening && (
          <div className="absolute inset-0 grid place-items-center bg-bg/70">
            <span className="mono-label pulse-dot text-accent">Opening…</span>
          </div>
        )}
      </div>

      <div className="px-4 py-3.5">
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            maxLength={100}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit()
              if (e.key === 'Escape') {
                setDraft(p.name)
                setEditing(false)
              }
            }}
            aria-label="Project name"
            className="w-full rounded-[6px] border border-accent bg-surface2 px-2 py-1 text-[13px] text-ink"
          />
        ) : (
          <div onDoubleClick={() => setEditing(true)} title="Double-click to rename" className="truncate text-[13px] text-ink">
            {p.name}
          </div>
        )}
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-[11px] text-faint">{edited(p.updated_at)}</span>
          <span className="mono-label truncate text-faint">{meta}</span>
        </div>
      </div>
    </motion.article>
  )
}

function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-[14px] border border-line bg-surface">
      <div className="shimmer h-[196px] w-full opacity-50" />
      <div className="space-y-2.5 px-4 py-4">
        <div className="shimmer h-3 w-[72%] rounded-full" />
        <div className="shimmer h-2.5 w-[42%] rounded-full opacity-60" />
      </div>
    </div>
  )
}

/* ---------------------------------- page ---------------------------------- */

function Dashboard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, signOut } = useAuth()
  const [theme, , toggleTheme] = useTheme()

  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'recent' | 'name'>('recent')
  const [confirm, setConfirm] = useState<Project | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [upgrade, setUpgrade] = useState(false)
  const [creating, setCreating] = useState<string | null>(null)

  // Opening a project compiles a route and loads the canvas bundle, which takes
  // long enough that a click with no feedback reads as "the button is broken".
  const [isNavigating, startNavigation] = useTransition()
  const [openingId, setOpeningId] = useState<string | null>(null)
  const open = useCallback(
    (id: string) => {
      if (openingId) return
      setOpeningId(id)
      startNavigation(() => router.push(`/project/${id}`))
    },
    [openingId, router],
  )

  const name = displayName(user)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/projects')
      const json = await res.json()
      if (json.success) setProjects(json.data.projects)
      else toast.error('Could not load your projects')
    } catch {
      toast.error('Could not load your projects')
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const create = useCallback(
    async (body: Record<string, unknown>, label: string) => {
      if (creating) return
      setCreating(label)
      try {
        const res = await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        const json = await res.json()
        if (!json.success) throw new Error(json.error)
        setOpeningId(json.data.project.id)
        startNavigation(() => router.push(`/project/${json.data.project.id}`))
      } catch {
        toast.error('Could not create the project')
        setCreating(null)
      }
    },
    [creating, router],
  )

  const newProject = () => create({ name: 'Untitled project' }, 'new')
  const fromExample = useCallback(
    (id: ExampleId) => create({ name: EXAMPLES[id].name, prompt: EXAMPLES[id].prompt, canvas_data: exampleCanvas(id, generateUUID) }, id),
    [create],
  )

  // Arriving from a landing-page example: start that project straight away.
  const exampleHandled = useRef(false)
  useEffect(() => {
    const example = searchParams.get('example')
    if (exampleHandled.current || !isExampleId(example)) return
    exampleHandled.current = true
    router.replace('/dashboard')
    void fromExample(example)
  }, [searchParams, router, fromExample])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = projects.filter((p) => p.name.toLowerCase().includes(q) || (p.prompt ?? '').toLowerCase().includes(q))
    return sort === 'name' ? [...list].sort((a, b) => a.name.localeCompare(b.name)) : list
  }, [projects, query, sort])

  const rename = async (p: Project, next: string) => {
    setProjects((all) => all.map((x) => (x.id === p.id ? { ...x, name: next } : x)))
    try {
      const res = await fetch(`/api/projects/${p.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: next }) })
      if (!res.ok) throw new Error()
      toast.success('Project renamed')
    } catch {
      setProjects((all) => all.map((x) => (x.id === p.id ? { ...x, name: p.name } : x)))
      toast.error('Could not rename the project')
    }
  }

  const duplicate = async (p: Project) => {
    try {
      const res = await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ duplicateOf: p.id }) })
      const json = await res.json()
      if (!json.success) throw new Error()
      toast.success('Project duplicated — the copy is private')
      await load()
    } catch {
      toast.error('Could not duplicate the project')
    }
  }

  const remove = async () => {
    if (!confirm) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/projects/${confirm.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setProjects((all) => all.filter((x) => x.id !== confirm.id))
      toast.success('Project deleted')
      setConfirm(null)
    } catch {
      toast.error('Could not delete the project')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-40 border-b border-line bg-bg/95">
        <div className="mx-auto flex h-[60px] max-w-[1320px] items-center gap-5 px-6 lg:px-10">
          <Wordmark />
          <div className="relative ml-2 hidden max-w-[300px] flex-1 sm:block">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects…"
              aria-label="Search projects"
              className="h-9 w-full rounded-[10px] border border-line bg-surface2 pl-9 pr-3 text-[12.5px] text-ink placeholder:text-faint focus:border-accent"
            />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <UsageMeter onUpgrade={() => setUpgrade(true)} />
            <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={newProject} disabled={!!creating || isNavigating}>
              {creating === 'new' ? 'Creating…' : 'New project'}
            </Button>
            <Popover
              width="w-[230px]"
              trigger={({ toggle }) => (
                <button
                  type="button"
                  onClick={toggle}
                  aria-label="Account menu"
                  className="grid h-9 w-9 place-items-center rounded-full border border-line2 bg-surface2 text-[11px] text-ink transition-colors duration-150 hover:border-accent"
                >
                  {initialsOf(name)}
                </button>
              )}
            >
              {({ close }) => (
                <div>
                  <div className="border-b border-line px-2.5 py-2.5">
                    <div className="truncate text-[12px] text-ink">{name}</div>
                    {user?.email && user.email !== name && <div className="truncate text-[11px] text-faint">{user.email}</div>}
                  </div>
                  <MenuItem icon={<Settings size={12} />} onClick={() => { close(); router.push('/settings') }}>
                    Settings
                  </MenuItem>
                  <MenuItem icon={<Zap size={12} />} onClick={() => { close(); setUpgrade(true) }}>
                    Plans
                  </MenuItem>
                  <MenuItem icon={theme === 'dark' ? <Sun size={12} /> : <Moon size={12} />} onClick={() => { close(); toggleTheme() }}>
                    {theme === 'dark' ? 'Light theme' : 'Dark theme'}
                  </MenuItem>
                  {authBypassed() ? (
                    <MenuItem icon={<LogOut size={12} />} disabled hint="dev">
                      Sign-in is off in development
                    </MenuItem>
                  ) : (
                    <MenuItem danger icon={<LogOut size={12} />} onClick={() => { close(); void signOut() }}>
                      Sign out
                    </MenuItem>
                  )}
                </div>
              )}
            </Popover>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1320px] px-6 py-12 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="mono-label mb-4 text-faint">Workspace · {name}</div>
            <h1 className="leading-[1.02]" style={{ fontSize: 'clamp(2.1rem, 3.4vw, 2.9rem)' }}>
              Your projects
            </h1>
            <p className="mt-3 max-w-[52ch] text-[14px] leading-[1.7] text-muted">
              Every project keeps its drawing, its reading and its sections. Open one to keep drawing, or rebuild a single section.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="mono-label text-faint">Sort</span>
            <Segmented
              size="sm"
              label="Sort projects"
              value={sort}
              onChange={setSort}
              items={[
                { value: 'recent', label: 'Recent' },
                { value: 'name', label: 'Name' },
              ]}
            />
          </div>
        </div>

        <div className="mt-10">
          {loading ? (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center rounded-[14px] border border-dashed border-line2 px-6 py-16 text-center">
              <SketchEmptyState className="h-[150px] w-[240px]" />
              <h2 className="mt-8 text-[26px] text-ink">Your first site starts here.</h2>
              <p className="mt-3 max-w-[46ch] text-[13.5px] leading-[1.7] text-muted">
                Start from a blank canvas — a sentence is enough to get a full site, and the drawing can come later — or open one of the examples and make it yours.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
                <Button variant="primary" icon={<Plus size={14} />} onClick={newProject} disabled={!!creating}>
                  New project
                </Button>
                {EXAMPLE_IDS.map((id) => (
                  <Button key={id} variant="outline" onClick={() => fromExample(id)} disabled={!!creating}>
                    {creating === id ? 'Opening…' : EXAMPLES[id].name}
                  </Button>
                ))}
              </div>
            </div>
          ) : shown.length === 0 ? (
            <div className="flex flex-col items-center rounded-[14px] border border-dashed border-line2 px-6 py-20 text-center">
              <SketchEmptyState className="h-[150px] w-[240px]" />
              <h2 className="mt-8 text-[24px] text-ink">No project matches &ldquo;{query}&rdquo;.</h2>
              <p className="mt-3 max-w-[42ch] text-[13.5px] leading-[1.7] text-muted">Try a different search, or start a new one — a sentence is enough to get a full site.</p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
                <Button variant="primary" icon={<Plus size={14} />} onClick={newProject} disabled={!!creating}>
                  New project
                </Button>
                <Button variant="outline" onClick={() => setQuery('')}>
                  Clear search
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {shown.map((p) => (
                <ProjectCard
                  key={p.id}
                  p={p}
                  opening={openingId === p.id}
                  onOpen={() => open(p.id)}
                  onRename={(next) => void rename(p, next)}
                  onDuplicate={() => void duplicate(p)}
                  onDelete={() => setConfirm(p)}
                />
              ))}
            </div>
          )}
        </div>

        {projects.length > 0 && (
          <div className="mt-14 flex flex-wrap items-center gap-2">
            <span className="mono-label mr-2 text-faint">Start from an example</span>
            {EXAMPLE_IDS.map((id) => (
              <Chip key={id} onClick={() => fromExample(id)}>
                {creating === id ? 'Opening…' : `${EXAMPLES[id].name} · ${EXAMPLES[id].category}`}
              </Chip>
            ))}
          </div>
        )}

        <div className="mt-10 grid grid-cols-1 gap-5 rounded-[14px] border border-line bg-bg2 p-8 md:grid-cols-3">
          {[
            ['Several screens per project', 'Home, sign-in and dashboard as tabs inside one project, each with its own canvas.'],
            ['Version history', 'Every build kept on a timeline, with a one-click restore.'],
            ['Click the site to edit it', 'Point at any part of the built site and say what to change — or draw over it.'],
          ].map(([t, d]) => (
            <div key={t}>
              <div className="flex items-center gap-2">
                <span className="mono-label text-faint">Coming soon</span>
                <span className="h-1 w-1 rounded-full bg-faint" />
              </div>
              <h3 className="mt-3 text-[18px] text-ink">{t}</h3>
              <p className="mt-2 text-[13px] leading-[1.7] text-muted">{d}</p>
            </div>
          ))}
        </div>
      </main>

      <Dialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={`Delete “${confirm?.name ?? ''}”`}
        eyebrow="This cannot be undone"
        footer={
          <>
            <Button variant="quiet" onClick={() => setConfirm(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" icon={<Trash2 size={13} />} onClick={remove} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete project'}
            </Button>
          </>
        }
      >
        <p className="text-[13.5px] leading-[1.75] text-muted">
          The drawing, the reading{confirm?.sectionCount ? `, all ${confirm.sectionCount} sections` : ''} and {confirm?.is_public ? 'the published link' : 'the generated site'} will be removed. Files you already exported are unaffected.
        </p>
      </Dialog>

      <UpgradeDialog open={upgrade} onClose={() => setUpgrade(false)} />
    </div>
  )
}

export default function DashboardPage() {
  // useSearchParams needs a Suspense boundary.
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg" />}>
      <Dashboard />
    </Suspense>
  )
}
