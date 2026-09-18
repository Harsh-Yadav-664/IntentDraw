import type { ProjectThumbnail } from '@/app/api/projects/route'

/**
 * A wireframe of the project's drawing, rendered from normalised geometry.
 *
 * A project list where every card looks the same is the wrong list for a
 * drawing tool — the drawing *is* how you recognise the project. The API sends
 * only normalised boxes (no intent text, no generated code), so this costs
 * almost nothing to ship or to draw.
 */
export function ProjectThumbnail({
  thumbnail,
  hasOutput,
}: {
  thumbnail: ProjectThumbnail | null
  hasOutput: boolean
}) {
  if (!thumbnail) {
    return (
      <div className="flex h-24 w-full items-center justify-center rounded-lg border border-dashed border-white/8 bg-black/20">
        <span className="text-[11px] text-muted-foreground/40">
          {hasOutput ? 'Generated from a prompt' : 'No drawing yet'}
        </span>
      </div>
    )
  }

  return (
    <div className="relative h-24 w-full overflow-hidden rounded-lg border border-white/8 bg-black/30">
      <svg
        viewBox="0 0 100 78"
        preserveAspectRatio="none"
        className="h-full w-full"
        aria-label={`Wireframe of ${thumbnail.total} shapes`}
      >
        {thumbnail.shapes.map((s, i) => {
          const x = s.x * 100
          const y = s.y * 78
          const w = Math.max(s.w * 100, 1)
          const h = Math.max(s.h * 78, 1)

          if (s.type === 'circle') {
            return (
              <ellipse
                key={i}
                cx={x + w / 2}
                cy={y + h / 2}
                rx={w / 2}
                ry={h / 2}
                className="fill-primary/10 stroke-primary/50"
                strokeWidth={0.5}
              />
            )
          }
          // Freeform and arrow strokes carry a real path, but the card is far
          // too small to read one — their bounding box in a lighter weight
          // conveys "something is here" without turning into noise.
          const decorative = s.type === 'freeform' || s.type === 'arrow'
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={w}
              height={h}
              rx={1}
              className={
                decorative ? 'fill-primary/5 stroke-primary/25' : 'fill-primary/10 stroke-primary/50'
              }
              strokeWidth={0.5}
              strokeDasharray={decorative ? '1.5 1.5' : undefined}
            />
          )
        })}
      </svg>
      {hasOutput && (
        <span className="absolute bottom-1.5 right-1.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-medium text-primary">
          Built
        </span>
      )}
    </div>
  )
}
