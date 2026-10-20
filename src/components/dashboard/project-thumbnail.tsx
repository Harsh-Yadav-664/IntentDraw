import type { ProjectThumbnail as Thumbnail } from '@/lib/projects/thumbnail'
import { regionColor } from '@/store/canvas-store'
import { PAGE_CONFIG } from '@/lib/canvas/pages'

/**
 * A project's drawing on its card, in the same colours as the canvas — the
 * drawing is how you recognise a project. With no drawing, the prompt stands
 * in for it.
 */
export function ProjectThumbnail({ thumbnail, prompt, hasOutput }: { thumbnail: Thumbnail | null; prompt: string | null; hasOutput: boolean }) {
  if (!thumbnail) {
    return (
      <div className="sketch-field flex h-full w-full flex-col justify-end p-5">
        {prompt?.trim() ? (
          <>
            <div className="mono-label mb-2.5 text-faint">{hasOutput ? 'Built from a sentence' : 'Prompt'}</div>
            <p className="line-clamp-3 font-display text-[19px] leading-[1.25] text-ink/85">&ldquo;{prompt.trim()}&rdquo;</p>
          </>
        ) : (
          <div className="mono-label text-faint">Empty canvas · nothing built yet</div>
        )}
      </div>
    )
  }

  // Show the first page (and a little of the next): the top of a site is how
  // people remember it.
  const width = PAGE_CONFIG.pageWidth
  const height = Math.max(PAGE_CONFIG.pageHeight * 0.75, Math.min(thumbnail.bottom + 40, PAGE_CONFIG.pageHeight * 1.2))

  return (
    <div className="sketch-field h-full w-full">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMin slice" className="h-full w-full" aria-label={`Drawing with ${thumbnail.total} shapes`}>
        {thumbnail.shapes.map((s, i) => {
          const color = regionColor(s.n)
          const stroke = { stroke: color, strokeWidth: 4, vectorEffect: 'non-scaling-stroke' as const, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
          if (s.points && s.points.length >= 2) {
            const d = s.points.map(([x, y], j) => `${j === 0 ? 'M' : 'L'}${x} ${y}`).join(' ')
            return <path key={i} d={d} {...stroke} strokeWidth={2.2} />
          }
          if (s.type === 'circle') {
            return <ellipse key={i} cx={s.x + s.w / 2} cy={s.y + s.h / 2} rx={s.w / 2} ry={s.h / 2} {...stroke} strokeWidth={1.6} fill={`${color}1a`} />
          }
          return <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={10} {...stroke} strokeWidth={1.6} fill={`${color}14`} />
        })}
        {/* the fold */}
        <line x1={0} x2={width} y1={PAGE_CONFIG.pageHeight} y2={PAGE_CONFIG.pageHeight} stroke="var(--c-line2)" strokeDasharray="10 10" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  )
}
