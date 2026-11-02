'use client'

import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'

/**
 * IntentDraw's own interface kit: buttons, chips, segmented controls, dialogs,
 * menus and fields, all drawn from the colour roles in globals.css. Everything
 * in the app uses these rather than restyling a library per screen.
 */

export function cx(...parts: Array<unknown>) {
  return parts.filter((p): p is string => typeof p === 'string' && p.length > 0).join(' ')
}

const subscribeNothing = () => () => {}
/** True once running in the browser — portals need `document.body`. */
export function useMounted() {
  return useSyncExternalStore(subscribeNothing, () => true, () => false)
}

/* ---------------------------------- Button --------------------------------- */

type Variant = 'primary' | 'outline' | 'quiet' | 'danger' | 'ghost'
type Size = 'xs' | 'sm' | 'md' | 'lg'

const SIZES: Record<Size, string> = {
  xs: 'h-7 px-2.5 text-[11.5px] gap-1.5 rounded-[6px]',
  sm: 'h-8 px-3 text-[12px] gap-1.5 rounded-[8px]',
  md: 'h-9 px-4 text-[13px] gap-2 rounded-[10px]',
  lg: 'h-11 px-5 text-[14px] gap-2 rounded-[10px]',
}
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-onaccent font-medium hover:bg-accent2 active:translate-y-[0.5px] border border-transparent',
  outline: 'border border-line2 text-ink bg-transparent hover:bg-surface2 active:translate-y-[0.5px]',
  quiet: 'text-muted hover:text-ink hover:bg-surface2 border border-transparent',
  ghost: 'text-muted hover:text-ink border border-transparent',
  danger: 'border border-line2 text-danger bg-transparent hover:bg-danger hover:text-white hover:border-transparent',
}

export function buttonClasses(variant: Variant = 'outline', size: Size = 'md', className?: string) {
  return cx(
    'inline-flex select-none items-center justify-center whitespace-nowrap transition-[background-color,color,border-color,transform] duration-150 disabled:cursor-not-allowed disabled:opacity-40',
    SIZES[size],
    VARIANTS[variant],
    className,
  )
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; icon?: ReactNode }

export function Button({ variant = 'outline', size = 'md', icon, className, children, type = 'button', ...rest }: BtnProps) {
  return (
    <button {...rest} type={type} className={buttonClasses(variant, size, className)}>
      {icon}
      {children}
    </button>
  )
}

export function ButtonLink({
  href,
  variant = 'outline',
  size = 'md',
  icon,
  className,
  children,
  ...rest
}: Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { href: string; variant?: Variant; size?: Size; icon?: ReactNode }) {
  return (
    <Link href={href} {...rest} className={buttonClasses(variant, size, className)}>
      {icon}
      {children}
    </Link>
  )
}

export function IconButton({
  label,
  children,
  active,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      aria-label={label}
      title={label}
      className={cx(
        'grid h-8 w-8 shrink-0 place-items-center rounded-[8px] border transition-colors duration-150 disabled:opacity-35',
        active ? 'border-accent/60 bg-accent/12 text-accent' : 'border-transparent text-muted hover:bg-surface2 hover:text-ink',
        className,
      )}
    >
      {children}
    </button>
  )
}

/* ----------------------------------- Chip ---------------------------------- */

const TONES = {
  neutral: 'bg-surface2 text-muted border-line',
  accent: 'bg-accent/12 text-accent border-accent/35',
  outline: 'border-line2 text-ink bg-transparent',
  ok: 'bg-ok/12 text-ok border-ok/30',
  warn: 'bg-warn/12 text-warn border-warn/30',
  danger: 'bg-danger/12 text-danger border-danger/30',
} as const

export function Chip({
  children,
  tone = 'neutral',
  className,
  onClick,
  active,
  title,
}: {
  children: ReactNode
  tone?: keyof typeof TONES
  className?: string
  onClick?: () => void
  active?: boolean
  title?: string
}) {
  const classes = cx(
    'inline-flex h-[22px] items-center gap-1.5 rounded-full border px-2.5 text-[11px] leading-none transition-colors duration-150',
    TONES[tone],
    active && 'ring-1 ring-accent',
    onClick && 'hover:border-line2 cursor-pointer',
    className,
  )
  if (onClick) {
    return (
      <button type="button" onClick={onClick} title={title} aria-pressed={active} className={classes}>
        {children}
      </button>
    )
  }
  return (
    <span title={title} className={classes}>
      {children}
    </span>
  )
}

/* --------------------------------- Segmented -------------------------------- */

export function Segmented<T extends string>({
  items,
  value,
  onChange,
  size = 'md',
  className,
  label,
}: {
  items: Array<{ value: T; label: ReactNode; icon?: ReactNode; disabled?: boolean }>
  value: T
  onChange: (v: T) => void
  size?: 'sm' | 'md'
  className?: string
  label?: string
}) {
  const id = useId()
  return (
    <div role="tablist" aria-label={label} className={cx('inline-flex items-center gap-0.5 rounded-[10px] border border-line bg-surface2 p-0.5', className)}>
      {items.map((it) => {
        const on = it.value === value
        return (
          <button
            key={it.value}
            type="button"
            role="tab"
            aria-selected={on}
            disabled={it.disabled}
            onClick={() => onChange(it.value)}
            className={cx(
              'relative inline-flex items-center gap-1.5 rounded-[7px] font-medium transition-colors duration-150 disabled:opacity-40',
              size === 'sm' ? 'h-6 px-2.5 text-[11px]' : 'h-7 px-3 text-[12px]',
              on ? 'text-onaccent' : 'text-muted hover:text-ink',
            )}
          >
            {on && (
              <motion.span
                layoutId={`seg-${id}`}
                transition={{ type: 'spring', stiffness: 480, damping: 38 }}
                className="absolute inset-0 rounded-[7px] bg-accent"
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              {it.icon}
              {it.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/* -------------------------------- StatusDot -------------------------------- */

export type DotStatus = 'built' | 'building' | 'failed' | 'queued'

export function StatusDot({ status, label }: { status: DotStatus; label?: string }) {
  const map = {
    built: 'var(--c-ok)',
    building: 'var(--c-accent)',
    failed: 'var(--c-danger)',
    queued: 'var(--c-faint)',
  } as const
  return (
    <span className="inline-flex items-center gap-2">
      <span className={cx('h-1.5 w-1.5 shrink-0 rounded-full', status === 'building' && 'pulse-dot')} style={{ background: map[status] }} />
      {label && <span className="text-[11.5px] text-muted">{label}</span>}
    </span>
  )
}

/* ---------------------------------- Dialog --------------------------------- */

export function Dialog({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
  width = 'max-w-[520px]',
}: {
  open: boolean
  onClose: () => void
  title: string
  eyebrow?: string
  children: ReactNode
  footer?: ReactNode
  width?: string
}) {
  const mounted = useMounted()
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    if (open) window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])

  if (!mounted) return null
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/70"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 12, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.99 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className={cx('relative flex max-h-[88vh] w-full flex-col overflow-hidden rounded-[14px] border border-line2 bg-surface shadow-plate', width)}
          >
            <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
              <div>
                {eyebrow && <div className="mono-label mb-1.5 text-faint">{eyebrow}</div>}
                <h2 className="text-[21px] leading-tight text-ink">{title}</h2>
              </div>
              <IconButton label="Close" onClick={onClose}>
                <X size={15} />
              </IconButton>
            </div>
            <div className="overflow-y-auto px-6 py-5">{children}</div>
            {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-6 py-4">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/* ---------------------------------- Fields --------------------------------- */

export function Field({
  label,
  hint,
  error,
  icon,
  className,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string; icon?: ReactNode }) {
  return (
    <label className={cx('block', className)}>
      <span className="mono-label mb-2 block text-faint">{label}</span>
      <span className="relative block">
        {icon && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint">{icon}</span>}
        <input
          {...rest}
          aria-invalid={!!error || undefined}
          className={cx(
            'h-10 w-full rounded-[10px] border bg-surface2 px-3 text-[13px] text-ink transition-colors duration-150 placeholder:text-faint disabled:opacity-60',
            icon && 'pl-9',
            error ? 'border-danger' : 'border-line focus:border-accent',
          )}
        />
      </span>
      {error ? (
        <span className="mt-1.5 block text-[11.5px] text-danger">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-[11.5px] text-faint">{hint}</span>
      ) : null}
    </label>
  )
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative h-[22px] w-[38px] shrink-0 rounded-full border transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-45',
        checked ? 'border-accent bg-accent' : 'border-line2 bg-surface2',
      )}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 520, damping: 34 }}
        className={cx('absolute top-[2px] h-[16px] w-[16px] rounded-full', checked ? 'left-[19px] bg-onaccent' : 'left-[2px] bg-faint')}
      />
    </button>
  )
}

export function Meter({ value, max, tone = 'accent' }: { value: number; max: number; tone?: 'accent' | 'warn' }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0
  return (
    <div className="h-[3px] w-full overflow-hidden rounded-full bg-surface3">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="h-full rounded-full"
        style={{ background: tone === 'warn' ? 'var(--c-warn)' : 'var(--c-accent)' }}
      />
    </div>
  )
}

/* ------------------------------ Popover & menus ----------------------------- */

/** Outside-click popover used for menus (export, account). */
export function Popover({
  trigger,
  children,
  align = 'right',
  width = 'w-[240px]',
  up = false,
}: {
  trigger: (p: { open: boolean; toggle: () => void }) => ReactNode
  children: (p: { close: () => void }) => ReactNode
  align?: 'left' | 'right'
  width?: string
  up?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', h)
    document.addEventListener('keydown', k)
    return () => {
      document.removeEventListener('mousedown', h)
      document.removeEventListener('keydown', k)
    }
  }, [open])
  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -4, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.99 }}
            transition={{ duration: 0.15 }}
            className={cx(
              'absolute z-50 overflow-hidden rounded-[10px] border border-line2 bg-surface p-1 shadow-plate',
              up ? 'bottom-full mb-2' : 'mt-2',
              width,
              align === 'right' ? 'right-0' : 'left-0',
            )}
          >
            {children({ close: () => setOpen(false) })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function MenuItem({
  icon,
  children,
  onClick,
  danger,
  hint,
  disabled,
}: {
  icon?: ReactNode
  children: ReactNode
  onClick?: () => void
  danger?: boolean
  hint?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        'flex w-full items-center gap-2.5 rounded-[6px] px-2.5 py-2 text-left text-[12px] transition-colors duration-150 disabled:pointer-events-none disabled:opacity-45',
        danger ? 'text-danger hover:bg-danger/12' : 'text-ink hover:bg-surface2',
      )}
    >
      {icon && <span className="text-faint">{icon}</span>}
      <span className="flex-1">{children}</span>
      {hint && <span className="mono-label text-faint">{hint}</span>}
    </button>
  )
}

/** A panel section: mono label, optional meta and action, content below. */
export function Block({ title, meta, action, children }: { title: string; meta?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-b border-line px-4 py-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="mono-label text-faint">{title}</span>
        <span className="flex items-center gap-2">
          {meta}
          {action}
        </span>
      </div>
      {children}
    </section>
  )
}
