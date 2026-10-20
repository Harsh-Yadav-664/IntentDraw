'use client'

import { motion } from 'framer-motion'
import { Plus } from 'lucide-react'
import { cx } from '@/components/kit/kit'

/**
 * Page numbers down the side of the canvas. Clicking N scrolls to page N; the
 * page in view is marked. The canvas owns scrolling and tells the rail which
 * page is current, so the rail itself does no measuring.
 */
export default function PageRail({
  pageCount,
  current,
  canAddPage,
  onSelect,
  onAddPage,
}: {
  pageCount: number
  /** 0-based page in view. */
  current: number
  canAddPage: boolean
  onSelect: (index: number) => void
  onAddPage: () => void
}) {
  return (
    <nav aria-label="Canvas pages" className="flex w-[52px] shrink-0 flex-col items-center gap-1.5 overflow-y-auto border-r border-line bg-bg2 py-3">
      <span className="mono-label mb-1 text-faint">Page</span>
      {Array.from({ length: pageCount }, (_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onSelect(i)}
          aria-label={`Go to page ${i + 1}`}
          aria-current={current === i ? 'page' : undefined}
          className={cx(
            'relative grid h-8 w-8 shrink-0 place-items-center rounded-[8px] text-[11.5px] transition-colors duration-150',
            current === i ? 'bg-accent/14 text-accent' : 'text-faint hover:bg-surface2 hover:text-ink',
          )}
        >
          {current === i && <motion.span layoutId="page-marker" className="absolute -left-[10px] h-4 w-[2px] rounded-full bg-accent" />}
          <span className="tab-num">{i + 1}</span>
        </button>
      ))}
      {canAddPage && (
        <button
          type="button"
          onClick={onAddPage}
          aria-label="Add page"
          title="Add a page below"
          className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-[8px] border border-dashed border-line2 text-faint transition-colors duration-150 hover:border-accent hover:text-accent"
        >
          <Plus size={13} />
        </button>
      )}
    </nav>
  )
}
