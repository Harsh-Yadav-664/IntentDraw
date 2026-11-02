'use client'

import { Check, Clock } from 'lucide-react'
import { Button, Chip, Dialog, cx } from '@/components/kit/kit'
import { PLANS } from '@/lib/plans'

/**
 * The plans, honestly: Free is what everyone has today; paid plans are on the
 * way and say so. There is no checkout to send anyone to yet.
 */
export function UpgradeDialog({ open, onClose, usage }: { open: boolean; onClose: () => void; usage?: { used: number; limit: number } | null }) {
  const uncapped = !!usage && usage.limit >= 100_000
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Plans"
      eyebrow={usage && !uncapped ? `Today · ${usage.used} of ${usage.limit} generations used` : 'Early access'}
      width="max-w-[860px]"
      footer={
        <Button variant="quiet" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {PLANS.map((plan) => (
          <div key={plan.name} className={cx('flex flex-col rounded-[12px] border p-5', plan.name === 'Pro' ? 'border-accent bg-accent/8' : 'border-line bg-surface2')}>
            <div className="flex items-center justify-between">
              <span className="text-[15px] text-ink">{plan.name}</span>
              {plan.available ? <Chip tone="ok">Your plan</Chip> : <Chip tone="warn">Coming soon</Chip>}
            </div>
            <div className="mt-4 flex items-baseline gap-1.5">
              <span className="tab-num text-[32px] leading-none text-ink">{plan.price}</span>
            </div>
            <div className="mono-label mt-2 text-faint">{plan.per ?? 'pricing to come'}</div>
            <ul className="mt-5 flex-1 space-y-2.5">
              {plan.lines.map((l) => (
                <li key={l.text} className={cx('flex items-start gap-2 text-[11.5px] leading-[1.6]', l.soon ? 'text-muted' : 'text-ink')}>
                  {l.soon ? <Clock size={11} className="mt-1 shrink-0 text-faint" /> : <Check size={11} className="mt-1 shrink-0 text-accent" />}
                  {l.text}
                </li>
              ))}
            </ul>
            <Button variant={plan.available ? 'quiet' : 'outline'} size="sm" className="mt-6 w-full" disabled>
              {plan.available ? 'Current plan' : 'Not on sale yet'}
            </Button>
          </div>
        ))}
      </div>
      <p className="mt-5 text-[11.5px] leading-[1.7] text-faint">
        {uncapped
          ? 'Development mode: generations are not limited.'
          : 'Free generations reset every day at midnight UTC. Rebuilding a single section never counts against the limit.'}{' '}
        Paid plans aren&apos;t on sale yet, and prices may change before they are.
      </p>
    </Dialog>
  )
}
