'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'
import { Plus } from 'lucide-react'

interface PageRailProps {
  /** The canvas's scroll container (`overflow-y-auto`). */
  scrollRef: RefObject<HTMLDivElement | null>
  pageCount: number
  /** One page's height in physical (on-screen) pixels: pageHeight * scale. */
  pageHeightPx: number
  canAddPage: boolean
  onAddPage: () => void
}

/**
 * Page numbers down the side of the canvas. Clicking N scrolls to page N;
 * the page in view is highlighted.
 *
 * Scroll tracking costs nothing per frame: one passive listener coalesced to
 * at most one read per animation frame (plus a `scrollend` settle), and a
 * React update only when the active page actually changes — never on every
 * scroll event. The Konva stage is not involved at all.
 */
export default function PageRail({ scrollRef, pageCount, pageHeightPx, canAddPage, onAddPage }: PageRailProps) {
  const [active, setActive] = useState(0)
  const activeRef = useRef(0)
  const pendingScrollTo = useRef<number | null>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (!el || pageHeightPx <= 0) return
    let frame = 0

    const measure = () => {
      frame = 0
      // The page owning a point 40% down the viewport — reads naturally when a
      // boundary is mid-screen, and reaches the last page at the bottom.
      const probe = el.scrollTop + el.clientHeight * 0.4
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 2
      const next = atBottom
        ? pageCount - 1
        : Math.max(0, Math.min(pageCount - 1, Math.floor(probe / pageHeightPx)))
      if (next !== activeRef.current) {
        activeRef.current = next
        setActive(next)
      }
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    // Once per gesture: settles the final page even when rAF is throttled
    // (background tab, busy main thread).
    const onScrollEnd = () => {
      if (frame) cancelAnimationFrame(frame)
      measure()
    }

    measure()
    el.addEventListener('scroll', onScroll, { passive: true })
    el.addEventListener('scrollend', onScrollEnd, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      el.removeEventListener('scrollend', onScrollEnd)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [scrollRef, pageCount, pageHeightPx])

  const scrollToPage = (index: number) => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: Math.round(index * pageHeightPx), behavior: 'smooth' })
  }

  // "Add page" scrolls to the new page once it exists (next render).
  useEffect(() => {
    const target = pendingScrollTo.current
    if (target !== null && target < pageCount) {
      pendingScrollTo.current = null
      scrollToPage(target)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageCount])

  return (
    <nav
      aria-label="Canvas pages"
      className="w-11 flex-shrink-0 h-full bg-[#0D0D0F] border-r border-white/10 flex flex-col items-center gap-1 py-3 overflow-y-auto"
    >
      {Array.from({ length: pageCount }, (_, i) => {
        const isActive = i === active
        return (
          <button
            key={i}
            type="button"
            onClick={() => scrollToPage(i)}
            aria-label={`Go to page ${i + 1}`}
            aria-current={isActive ? 'page' : undefined}
            title={`Page ${i + 1}`}
            className={`h-7 w-7 flex-shrink-0 rounded-lg text-[11px] font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-white hover:bg-white/10'
            }`}
          >
            {i + 1}
          </button>
        )
      })}
      {canAddPage && (
        <button
          type="button"
          onClick={() => {
            pendingScrollTo.current = pageCount
            onAddPage()
          }}
          aria-label="Add page"
          title="Add page"
          className="mt-1 h-7 w-7 flex-shrink-0 rounded-lg border border-dashed border-white/15 text-muted-foreground hover:text-white hover:border-white/30 hover:bg-white/5 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      )}
    </nav>
  )
}
