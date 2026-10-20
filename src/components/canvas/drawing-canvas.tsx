'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Stage, Layer, Rect, Ellipse, Line, Arrow as KonvaArrow, Transformer, Group, Text as KonvaText } from 'react-konva'
import type Konva from 'konva'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowUpRight,
  Circle,
  Copy,
  Eye,
  EyeOff,
  Layers,
  Maximize,
  MousePointer2,
  Pencil,
  Plus,
  Redo2,
  Square,
  Trash2,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useCanvasStore, regionColor } from '@/store/canvas-store'
import { useWorkflowStore } from '@/store/workflow-store'
import { wrapReactForPreview } from '@/lib/utils/sanitize'
import { PAGE_CONFIG, pageCountFor } from '@/lib/canvas/pages'
import { cssVar, useTheme } from '@/lib/theme'
import { Button, Dialog, cx } from '@/components/kit/kit'
import { KIND_OPTIONS } from '@/components/controls/region-intent-chips'
import PageRail from '@/components/canvas/page-rail'
import type { CanvasTool, IntentKind, Region, RegionGeometry } from '@/types'

/* --------------------------------------------------------------------------
   One continuous drawing surface. Pages are guides, not walls: a stroke can
   start in the hero and run down into the next section.

   The Konva stage is only as big as the visible window and follows the
   scroll, so a tall drawing at a high zoom never allocates a giant canvas.
   Everything that has to stay crisp — region labels, the selection bar, page
   labels — is HTML laid over it.
   -------------------------------------------------------------------------- */

const BASE_WIDTH = PAGE_CONFIG.pageWidth // must equal the preview's 1280 logical width
const PAGE_H = PAGE_CONFIG.pageHeight
const GUTTER = 88 // room for page labels on the left
const TOP_PAD = 40
const MIN_ZOOM = 50
const MAX_ZOOM = 200
const MIN_SHAPE_SIZE = 10
// Skip freeform points closer than ~3 units to the previous one — fewer state
// updates and re-renders during a freehand stroke.
const FREEFORM_MIN_DIST_SQ = 9

const TOOLS: Array<{ value: CanvasTool; label: string; key: string; icon: React.ReactNode }> = [
  { value: 'select', label: 'Select', key: 'V', icon: <MousePointer2 size={15} /> },
  { value: 'rectangle', label: 'Rectangle', key: 'R', icon: <Square size={15} /> },
  { value: 'circle', label: 'Circle', key: 'O', icon: <Circle size={15} /> },
  { value: 'freeform', label: 'Pencil', key: 'P', icon: <Pencil size={15} /> },
  { value: 'arrow', label: 'Arrow', key: 'A', icon: <ArrowUpRight size={15} /> },
]

type Gesture =
  | { kind: 'draw'; tool: Exclude<CanvasTool, 'select'>; startX: number; startY: number; currentX: number; currentY: number; points: number[]; square: boolean }
  | { kind: 'marquee'; x0: number; y0: number; x1: number; y1: number; additive: string[] }

interface Box {
  x: number
  y: number
  w: number
  h: number
}

const boxOf = (r: Region): Box => ({ x: r.geometry.x, y: r.geometry.y, w: r.geometry.width, h: r.geometry.height })
const unionBox = (boxes: Box[]): Box | null => {
  if (boxes.length === 0) return null
  const x = Math.min(...boxes.map((b) => b.x))
  const y = Math.min(...boxes.map((b) => b.y))
  return { x, y, w: Math.max(...boxes.map((b) => b.x + b.w)) - x, h: Math.max(...boxes.map((b) => b.y + b.h)) - y }
}

/** Geometry for a finished stroke or shape, or null if it is too small to keep. */
function geometryFor(g: Extract<Gesture, { kind: 'draw' }>): RegionGeometry | null {
  const { startX, startY, currentX, currentY, points } = g
  if (g.tool === 'rectangle' || g.tool === 'circle') {
    let w = currentX - startX
    let h = currentY - startY
    if (g.square) {
      const m = Math.max(Math.abs(w), Math.abs(h))
      w = Math.sign(w || 1) * m
      h = Math.sign(h || 1) * m
    }
    if (Math.abs(w) < MIN_SHAPE_SIZE || Math.abs(h) < MIN_SHAPE_SIZE) return null
    return { type: g.tool, x: Math.min(startX, startX + w), y: Math.min(startY, startY + h), width: Math.abs(w), height: Math.abs(h) }
  }
  if (g.tool === 'freeform') {
    if (points.length < 4) return null
    const xs: number[] = []
    const ys: number[] = []
    for (let i = 0; i < points.length; i += 2) {
      xs.push(points[i])
      ys.push(points[i + 1])
    }
    const minX = Math.min(...xs)
    const minY = Math.min(...ys)
    const path: Array<{ x: number; y: number }> = []
    for (let i = 0; i < points.length; i += 2) path.push({ x: points[i] - minX, y: points[i + 1] - minY })
    // x/y is the bounding-box top-left (not the stroke start), so layout and
    // intent code can treat a stroke like any other region.
    return { type: 'freeform', x: startX + minX, y: startY + minY, width: Math.max(1, Math.max(...xs) - minX), height: Math.max(1, Math.max(...ys) - minY), path }
  }
  const dx = currentX - startX
  const dy = currentY - startY
  if (Math.hypot(dx, dy) < MIN_SHAPE_SIZE) return null
  const minX = Math.min(startX, currentX)
  const minY = Math.min(startY, currentY)
  return {
    type: 'arrow',
    x: minX,
    y: minY,
    width: Math.max(1, Math.abs(dx)),
    height: Math.max(1, Math.abs(dy)),
    path: [
      { x: startX - minX, y: startY - minY },
      { x: currentX - minX, y: currentY - minY },
    ],
  }
}

/** The geometry a Konva node now describes, after a drag or a transform; resets its scale. */
function geometryFromNode(node: Konva.Node, region: Region): Partial<RegionGeometry> {
  const sx = Math.abs(node.scaleX())
  const sy = Math.abs(node.scaleY())
  node.scaleX(1)
  node.scaleY(1)
  const g = region.geometry
  if (g.type === 'circle') {
    const ellipse = node as Konva.Ellipse
    const rx = Math.max(MIN_SHAPE_SIZE / 2, ellipse.radiusX() * sx)
    const ry = Math.max(MIN_SHAPE_SIZE / 2, ellipse.radiusY() * sy)
    ellipse.radiusX(rx)
    ellipse.radiusY(ry)
    return { x: node.x() - rx, y: node.y() - ry, width: rx * 2, height: ry * 2 }
  }
  if (g.type === 'rectangle') {
    const width = Math.max(MIN_SHAPE_SIZE, node.width() * sx)
    const height = Math.max(MIN_SHAPE_SIZE, node.height() * sy)
    node.width(width)
    node.height(height)
    return { x: node.x(), y: node.y(), width, height }
  }
  // Strokes and arrows: the path is relative to x/y, so scaling scales the path.
  if (sx === 1 && sy === 1) return { x: node.x(), y: node.y() }
  return {
    x: node.x(),
    y: node.y(),
    width: g.width * sx,
    height: g.height * sy,
    path: g.path?.map((p) => ({ x: p.x * sx, y: p.y * sy })),
  }
}

function DockButton({
  label,
  keys,
  onClick,
  active,
  disabled,
  children,
}: {
  label: string
  keys?: string
  onClick: () => void
  active?: boolean
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={keys ? `${label} (${keys})` : label}
      aria-pressed={active}
      className={cx(
        'group relative grid h-9 w-9 place-items-center rounded-[8px] transition-colors duration-150 disabled:opacity-35',
        active ? 'bg-accent text-onaccent' : 'text-muted hover:bg-surface2 hover:text-ink',
      )}
    >
      {children}
      <span className="pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 z-50 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-[6px] border border-line2 bg-surface2 px-2 py-1 text-[11px] text-ink opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        {label}
        {keys && <span className="mono-label text-faint">{keys}</span>}
      </span>
    </button>
  )
}

export default function DrawingCanvas() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const holderRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  const shapeRefs = useRef<Record<string, Konva.Node>>({})

  const regions = useCanvasStore((s) => s.regions)
  const groups = useCanvasStore((s) => s.groups)
  const activeTool = useCanvasStore((s) => s.activeTool)
  const setActiveTool = useCanvasStore((s) => s.setActiveTool)
  const selectedRegionIds = useCanvasStore((s) => s.selectedRegionIds)
  const visibility = useCanvasStore((s) => s.visibility)
  const addRegion = useCanvasStore((s) => s.addRegion)
  const setRegionGeometries = useCanvasStore((s) => s.setRegionGeometries)
  const selectRegions = useCanvasStore((s) => s.selectRegions)
  const toggleRegionSelection = useCanvasStore((s) => s.toggleRegionSelection)
  const setStageInstance = useCanvasStore((s) => s.setStageInstance)
  const updateRegionIntent = useCanvasStore((s) => s.updateRegionIntent)
  const setRegionTag = useCanvasStore((s) => s.setRegionTag)
  const deleteRegions = useCanvasStore((s) => s.deleteRegions)
  const duplicateRegions = useCanvasStore((s) => s.duplicateRegions)
  const groupSelection = useCanvasStore((s) => s.groupSelection)
  const clearRegions = useCanvasStore((s) => s.clearRegions)
  const undo = useCanvasStore((s) => s.undo)
  const redo = useCanvasStore((s) => s.redo)
  const canUndo = useCanvasStore((s) => s.canUndo)
  const canRedo = useCanvasStore((s) => s.canRedo)
  const setViewMode = useCanvasStore((s) => s.setViewMode)

  const previewCode = useWorkflowStore((s) => s.previewCode)
  const isGenerating = useWorkflowStore((s) => s.status === 'generating' || s.status === 'analyzing')
  const progress = useWorkflowStore((s) => s.generationProgress)

  const [theme] = useTheme()
  const colors = useMemo(
    () => ({
      accent: cssVar('--c-accent', '#facc15'),
      bg: cssVar('--c-bg', '#0a0a0b'),
      line2: cssVar('--c-line2', 'rgba(255,255,255,0.14)'),
      muted: cssVar('--c-muted', '#a5a099'),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-read when the theme changes
    [theme],
  )

  const [viewport, setViewport] = useState({ w: 1000, h: 700 })
  const [zoom, setZoom] = useState(100)
  const [ghost, setGhost] = useState(true)
  // A page with an error is not shown behind the drawing — the editor explains it instead.
  const pageBroken = useWorkflowStore((s) => s.issue !== null && !s.issue.partial)
  const [requestedPages, setRequestedPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(0)
  const [spaceDown, setSpaceDown] = useState(false)
  const [panning, setPanning] = useState(false)
  const [gesture, setGestureState] = useState<Gesture | null>(null)
  const [busy, setBusy] = useState(false) // dragging or transforming a shape
  const [clearOpen, setClearOpen] = useState(false)
  // Backdrop only — see the IFRAME_HEIGHT note in the message handler.
  const [backdropHeight, setBackdropHeight] = useState<number | null>(null)
  const acceptedHeight = useRef(false)

  const gestureRef = useRef<Gesture | null>(null)
  const setGesture = useCallback((g: Gesture | null) => {
    gestureRef.current = g
    setGestureState(g)
  }, [])

  // Height follows the drawing only — never the backdrop iframe. It is a
  // whole number of pages: at least the default, the lowest shape's page plus
  // one spare, capped at maxPages.
  const pageCount = useMemo(() => pageCountFor(regions, requestedPages), [regions, requestedPages])
  const fitW = Math.max(520, Math.min(1320, viewport.w - GUTTER * 2))
  const canvasW = Math.round((fitW * zoom) / 100)
  const scale = canvasW / BASE_WIDTH
  const pagePx = PAGE_H * scale
  const canvasH = Math.round(pageCount * pagePx)
  const stageW = Math.max(1, Math.min(canvasW, viewport.w))
  const stageH = Math.max(1, Math.min(canvasH, viewport.h))

  // For pointer and scroll handlers, which outlive a render.
  const pageCountRef = useRef(pageCount)
  const scaleRef = useRef(scale)
  useLayoutEffect(() => {
    pageCountRef.current = pageCount
    scaleRef.current = scale
  }, [pageCount, scale])

  /* ------------------------- viewport-sized stage ------------------------- */

  const currentPageRef = useRef(0)
  const reposition = useCallback(() => {
    const el = scrollRef.current
    const wrapper = wrapperRef.current
    const holder = holderRef.current
    const stage = stageRef.current
    if (!el || !wrapper || !holder || !stage) return
    const er = el.getBoundingClientRect()
    const wr = wrapper.getBoundingClientRect()
    const offX = Math.max(0, Math.min(er.left - wr.left, wr.width - stage.width()))
    const offY = Math.max(0, Math.min(er.top - wr.top, wr.height - stage.height()))
    holder.style.transform = `translate(${offX}px, ${offY}px)`
    stage.position({ x: -offX, y: -offY })
    stage.getLayers().forEach((l) => l.batchDraw())

    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 2
    const probe = er.top - wr.top + el.clientHeight * 0.35
    const page = atBottom ? pageCountRef.current - 1 : Math.max(0, Math.min(pageCountRef.current - 1, Math.floor(probe / (PAGE_H * scaleRef.current))))
    if (page !== currentPageRef.current) {
      currentPageRef.current = page
      setCurrentPage(page)
    }
  }, [])

  useLayoutEffect(() => {
    reposition()
  }, [reposition, canvasW, canvasH, stageW, stageH])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const measure = () => setViewport({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (stageRef.current) setStageInstance(stageRef.current)
    return () => setStageInstance(null)
  }, [setStageInstance])

  /* ------------------------------ backdrop ------------------------------ */

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      // The FIRST height report per backdrop, and only to trim the backdrop —
      // never the canvas, whose height comes from the drawing alone.
      //
      // `min-h-screen` inside the generated page resolves against the frame,
      // so sizing the frame from the page's own height grows the page, which
      // regrows the frame, forever. It is safe here only because the runtime
      // posts the height once on load and because `acceptedHeight` latches.
      if (e.data?.type === 'IFRAME_HEIGHT' && typeof e.data.height === 'number') {
        if (!acceptedHeight.current) {
          acceptedHeight.current = true
          setBackdropHeight(Math.max(400, Math.round(e.data.height)))
        }
        return
      }
      // A page that can't compile or crashes is handled by the editor's issue
      // watcher; anything else is an error after render, worth a log line only.
      if (e.data && e.data.type === 'IFRAME_ERROR' && e.data.kind === 'script') console.warn(`[preview backdrop] ${e.data.message}`)
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  const srcDoc = useMemo(() => {
    if (!previewCode || !ghost) return null
    // Staged generation pushes new code after every batch. Rebuilding this
    // backdrop each time meant a full CDN + Babel run per stage, on the same
    // thread as the canvas — for something behind the drawing that nobody is
    // looking at mid-run. Only the Output preview repaints live.
    if (isGenerating) return null
    // freeze: render once, then stop every animation so sitting behind the
    // canvas costs nothing per frame.
    return wrapReactForPreview(previewCode, { freeze: true })
  }, [previewCode, isGenerating, ghost])

  // A new backdrop gets to report its height once.
  useEffect(() => {
    acceptedHeight.current = false
  }, [srcDoc])

  /* ------------------------------ selection ------------------------------ */

  useEffect(() => {
    const tr = transformerRef.current
    if (!tr) return
    const nodes = selectedRegionIds.map((id) => shapeRefs.current[id]).filter(Boolean)
    tr.nodes(nodes)
    tr.getLayer()?.batchDraw()
  }, [selectedRegionIds, regions, activeTool])

  const commitNodes = useCallback(() => {
    const tr = transformerRef.current
    const nodes = tr ? tr.nodes() : []
    const byNode = new Map<Konva.Node, Region>()
    for (const r of useCanvasStore.getState().regions) {
      const node = shapeRefs.current[r.id]
      if (node && nodes.includes(node)) byNode.set(node, r)
    }
    const updates = Array.from(byNode.entries()).map(([node, region]) => ({ id: region.id, geometry: geometryFromNode(node, region) }))
    if (updates.length > 0) setRegionGeometries(updates)
  }, [setRegionGeometries])

  /* ------------------------------- drawing ------------------------------- */

  const toLogical = useCallback((clientX: number, clientY: number) => {
    const r = wrapperRef.current?.getBoundingClientRect()
    if (!r) return { x: 0, y: 0 }
    return { x: (clientX - r.left) / scaleRef.current, y: (clientY - r.top) / scaleRef.current }
  }, [])

  const lastClient = useRef<{ x: number; y: number; shift: boolean } | null>(null)
  const edgeRaf = useRef<number | null>(null)

  const advanceGesture = useCallback(() => {
    const g = gestureRef.current
    const c = lastClient.current
    if (!g || !c) return
    const p = toLogical(c.x, c.y)
    // Drawing past the last page adds one — keep drawing straight through.
    if (p.y > pageCountRef.current * PAGE_H - 24) setRequestedPages((n) => Math.max(n, pageCountRef.current + 1))
    if (g.kind === 'marquee') {
      setGesture({ ...g, x1: p.x, y1: p.y })
      return
    }
    if (g.tool === 'freeform') {
      const relX = p.x - g.startX
      const relY = p.y - g.startY
      const n = g.points.length
      if (n >= 2) {
        const dx = relX - g.points[n - 2]
        const dy = relY - g.points[n - 1]
        if (dx * dx + dy * dy < FREEFORM_MIN_DIST_SQ) return
      }
      setGesture({ ...g, currentX: p.x, currentY: p.y, points: [...g.points, relX, relY] })
      return
    }
    setGesture({ ...g, currentX: p.x, currentY: p.y, square: c.shift })
  }, [toLogical, setGesture])

  const stopEdgeScroll = () => {
    if (edgeRaf.current !== null) cancelAnimationFrame(edgeRaf.current)
    edgeRaf.current = null
  }

  // While a stroke or a marquee nears the top or bottom edge, scroll so it can
  // keep going.
  const startEdgeScroll = useCallback(() => {
    if (edgeRaf.current !== null) return
    const tick = () => {
      const el = scrollRef.current
      const c = lastClient.current
      if (!el || !c || !gestureRef.current) {
        edgeRaf.current = null
        return
      }
      const r = el.getBoundingClientRect()
      const zone = 84
      let step = 0
      if (c.y > r.bottom - zone) step = Math.min(22, 3 + (c.y - (r.bottom - zone)) / 4)
      else if (c.y < r.top + zone) step = -Math.min(22, 3 + (r.top + zone - c.y) / 4)
      if (step !== 0) {
        el.scrollTop += step
        advanceGesture()
      }
      edgeRaf.current = requestAnimationFrame(tick)
    }
    edgeRaf.current = requestAnimationFrame(tick)
  }, [advanceGesture])

  const finishGesture = useCallback(() => {
    const g = gestureRef.current
    stopEdgeScroll()
    lastClient.current = null
    setGesture(null)
    if (!g) return
    if (g.kind === 'marquee') {
      const x = Math.min(g.x0, g.x1)
      const y = Math.min(g.y0, g.y1)
      const w = Math.abs(g.x1 - g.x0)
      const h = Math.abs(g.y1 - g.y0)
      if (w * scaleRef.current < 3 && h * scaleRef.current < 3) return
      const { regions: all, visibility: vis } = useCanvasStore.getState()
      const hits = all
        .filter((r) => vis[r.id] !== false)
        .filter((r) => {
          const b = boxOf(r)
          return b.x < x + w && b.x + b.w > x && b.y < y + h && b.y + b.h > y
        })
        .map((r) => r.id)
      selectRegions(Array.from(new Set([...g.additive, ...hits])))
      return
    }
    const geometry = geometryFor(g)
    if (!geometry) return
    addRegion(geometry)
    const all = useCanvasStore.getState().regions
    selectRegions([all[all.length - 1].id])
  }, [addRegion, selectRegions, setGesture])

  useEffect(() => {
    if (!gesture) return
    const move = (e: PointerEvent) => {
      lastClient.current = { x: e.clientX, y: e.clientY, shift: e.shiftKey }
      advanceGesture()
      startEdgeScroll()
    }
    const up = () => finishGesture()
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
    // Re-binding on every gesture update would drop events; bind per gesture kind.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gesture?.kind, advanceGesture, finishGesture, startEdgeScroll])

  useEffect(() => stopEdgeScroll, [])

  const onStagePointerDown = (e: Konva.KonvaEventObject<PointerEvent>) => {
    const evt = e.evt
    if (evt.button !== 0 || spaceDown || panning) return
    const p = toLogical(evt.clientX, evt.clientY)
    lastClient.current = { x: evt.clientX, y: evt.clientY, shift: evt.shiftKey }
    if (activeTool === 'select') {
      if (e.target !== e.target.getStage()) return
      const additive = evt.shiftKey ? selectedRegionIds : []
      if (!evt.shiftKey) selectRegions([])
      setGesture({ kind: 'marquee', x0: p.x, y0: p.y, x1: p.x, y1: p.y, additive })
      return
    }
    setGesture({
      kind: 'draw',
      tool: activeTool,
      startX: p.x,
      startY: p.y,
      currentX: p.x,
      currentY: p.y,
      points: activeTool === 'freeform' ? [0, 0] : [],
      square: evt.shiftKey,
    })
  }

  const onShapePointerDown = (e: Konva.KonvaEventObject<PointerEvent>, id: string) => {
    if (activeTool !== 'select' || spaceDown) return
    e.cancelBubble = true
    if (e.evt.shiftKey) toggleRegionSelection(id)
    else if (!selectedRegionIds.includes(id)) selectRegions([id])
  }

  /* --------------------------------- pan --------------------------------- */

  const panRef = useRef<{ x: number; y: number; l: number; t: number } | null>(null)
  useEffect(() => {
    const isField = (t: EventTarget | null) => {
      const el = t as HTMLElement | null
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
    }
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || isField(e.target) || (e.target as HTMLElement)?.tagName === 'BUTTON') return
      e.preventDefault()
      setSpaceDown(true)
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceDown(false)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  // Ctrl/Cmd + wheel zooms instead of scrolling.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const h = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      e.preventDefault()
      setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(z - e.deltaY * 0.15))))
    }
    el.addEventListener('wheel', h, { passive: false })
    return () => el.removeEventListener('wheel', h)
  }, [])

  // A shape picked in a panel: select it and bring it into view.
  useEffect(() => {
    const focus = (e: Event) => {
      const id = (e as CustomEvent<{ id: string }>).detail?.id
      const region = useCanvasStore.getState().regions.find((r) => r.id === id)
      const el = scrollRef.current
      const wrapper = wrapperRef.current
      if (!region || !el || !wrapper) return
      useCanvasStore.getState().setActiveTool('select')
      selectRegions([region.id])
      el.scrollTo({ top: wrapper.offsetTop + region.geometry.y * scaleRef.current - 120, behavior: 'smooth' })
    }
    window.addEventListener('intentdraw:focus-region', focus)
    return () => window.removeEventListener('intentdraw:focus-region', focus)
  }, [selectRegions])

  /* ------------------------------- pages -------------------------------- */

  const scrollToPage = (index: number) => {
    const el = scrollRef.current
    const wrapper = wrapperRef.current
    if (!el || !wrapper) return
    el.scrollTo({ top: wrapper.offsetTop + index * pagePx - 16, behavior: 'smooth' })
  }
  const addPage = () => {
    const next = Math.min(PAGE_CONFIG.maxPages, pageCount + 1)
    setRequestedPages(next)
    window.setTimeout(() => scrollToPage(next - 1), 60)
  }

  /* ------------------------------- render -------------------------------- */

  const visible = regions.filter((r) => visibility[r.id] !== false)
  const selected = regions.filter((r) => selectedRegionIds.includes(r.id))
  const single = selected.length === 1 ? selected[0] : null
  const selBox = unionBox(selected.map(boxOf))
  const activeGroups = groups.filter((g) => regions.some((r) => r.groupId === g.id && selectedRegionIds.includes(r.id)))
  const allInOneGroup = selected.length > 1 && !!selected[0].groupId && selected.every((r) => r.groupId === selected[0].groupId)
  const showBar = !!selBox && !busy && !gesture && activeTool === 'select'

  const renderShape = (region: Region) => {
    const { geometry, id } = region
    const color = regionColor(region.regionNumber)
    const draggable = activeTool === 'select' && !spaceDown
    const common = {
      ref: (node: Konva.Node | null) => {
        if (node) shapeRefs.current[id] = node
        else delete shapeRefs.current[id]
      },
      draggable,
      onPointerDown: (e: Konva.KonvaEventObject<PointerEvent>) => onShapePointerDown(e, id),
      onDragStart: () => setBusy(true),
      onDragEnd: () => {
        commitNodes()
        setBusy(false)
      },
      onTransformStart: () => setBusy(true),
      onTransformEnd: () => {
        commitNodes()
        setBusy(false)
      },
      stroke: color,
      strokeWidth: 2,
      strokeScaleEnabled: false,
    }
    switch (geometry.type) {
      case 'rectangle':
        return <Rect key={id} {...common} x={geometry.x} y={geometry.y} width={geometry.width} height={geometry.height} fill={`${color}1a`} cornerRadius={8} />
      case 'circle':
        return (
          <Ellipse
            key={id}
            {...common}
            x={geometry.x + geometry.width / 2}
            y={geometry.y + geometry.height / 2}
            radiusX={geometry.width / 2}
            radiusY={geometry.height / 2}
            fill={`${color}1a`}
          />
        )
      case 'freeform':
        return (
          <Line
            key={id}
            {...common}
            x={geometry.x}
            y={geometry.y}
            points={geometry.path?.flatMap((p) => [p.x, p.y]) ?? []}
            strokeWidth={2.4}
            hitStrokeWidth={14}
            lineCap="round"
            lineJoin="round"
            tension={0.4}
          />
        )
      case 'arrow':
        return (
          <KonvaArrow
            key={id}
            {...common}
            x={geometry.x}
            y={geometry.y}
            points={geometry.path?.flatMap((p) => [p.x, p.y]) ?? []}
            fill={color}
            hitStrokeWidth={14}
            pointerLength={14}
            pointerWidth={11}
          />
        )
      default:
        return null
    }
  }

  const draft = gesture?.kind === 'draw' ? gesture : null
  const draftColor = regionColor(regions.length + 1)
  const renderDraft = () => {
    if (!draft) return null
    const g = geometryFor(draft)
    const dash = [6, 5]
    if (draft.tool === 'freeform') {
      return <Line x={draft.startX} y={draft.startY} points={draft.points} stroke={draftColor} strokeWidth={2.4} strokeScaleEnabled={false} lineCap="round" lineJoin="round" tension={0.4} listening={false} />
    }
    if (draft.tool === 'arrow') {
      return (
        <KonvaArrow
          x={draft.startX}
          y={draft.startY}
          points={[0, 0, draft.currentX - draft.startX, draft.currentY - draft.startY]}
          stroke={draftColor}
          fill={draftColor}
          strokeWidth={2}
          strokeScaleEnabled={false}
          pointerLength={14}
          pointerWidth={11}
          dash={dash}
          listening={false}
        />
      )
    }
    const x = g?.x ?? Math.min(draft.startX, draft.currentX)
    const y = g?.y ?? Math.min(draft.startY, draft.currentY)
    const w = g?.width ?? Math.abs(draft.currentX - draft.startX)
    const h = g?.height ?? Math.abs(draft.currentY - draft.startY)
    return draft.tool === 'circle' ? (
      <Ellipse x={x + w / 2} y={y + h / 2} radiusX={w / 2} radiusY={h / 2} stroke={draftColor} strokeWidth={2} strokeScaleEnabled={false} fill={`${draftColor}14`} dash={dash} listening={false} />
    ) : (
      <Rect x={x} y={y} width={w} height={h} stroke={draftColor} strokeWidth={2} strokeScaleEnabled={false} fill={`${draftColor}14`} cornerRadius={8} dash={dash} listening={false} />
    )
  }

  const marquee = gesture?.kind === 'marquee' ? gesture : null
  const inv = scale > 0 ? 1 / scale : 1

  return (
    <div className="relative flex h-full min-w-0">
      <PageRail pageCount={pageCount} current={currentPage} canAddPage={pageCount < PAGE_CONFIG.maxPages} onSelect={scrollToPage} onAddPage={addPage} />

      <div className="relative min-w-0 flex-1">
        <div
          ref={scrollRef}
          onScroll={reposition}
          onPointerDownCapture={(e) => {
            if (!(spaceDown || e.button === 1)) return
            e.preventDefault()
            e.stopPropagation()
            const el = e.currentTarget
            el.setPointerCapture(e.pointerId)
            panRef.current = { x: e.clientX, y: e.clientY, l: el.scrollLeft, t: el.scrollTop }
            setPanning(true)
          }}
          onPointerMove={(e) => {
            const p = panRef.current
            if (!p) return
            e.currentTarget.scrollLeft = p.l - (e.clientX - p.x)
            e.currentTarget.scrollTop = p.t - (e.clientY - p.y)
          }}
          onPointerUp={() => {
            panRef.current = null
            setPanning(false)
          }}
          // `relative` makes this the canvas's offsetParent, so offsetTop is a scroll position.
          className="relative h-full overflow-auto bg-bg"
          style={{ cursor: panning ? 'grabbing' : spaceDown ? 'grab' : undefined }}
        >
          <div className="mx-auto pb-[140px]" style={{ width: canvasW + GUTTER * 2, paddingTop: TOP_PAD, paddingLeft: GUTTER, paddingRight: GUTTER }}>
            <div ref={wrapperRef} className="dot-grid relative rounded-[10px] bg-bg2 ring-1 ring-line" style={{ width: canvasW, height: canvasH }}>
              {/* The last generated site, frozen, behind the drawing. A real frame
                  rather than a bitmap: a sandboxed opaque-origin iframe cannot
                  screenshot itself, and freezing makes it cost nothing. */}
              {srcDoc && (
                <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[10px]" style={{ opacity: pageBroken ? 0 : 0.38 }}>
                  <div style={{ width: BASE_WIDTH, height: canvasH * inv, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                    <iframe
                      key="backdrop"
                      srcDoc={srcDoc}
                      sandbox="allow-scripts"
                      // A backdrop is never scrolled; without this its scrollbar shows as a pale strip.
                      scrolling="no"
                      tabIndex={-1}
                      aria-hidden="true"
                      title="Your last generated site"
                      style={{ height: backdropHeight ?? '100%' }}
                      className="pointer-events-none w-full border-0 bg-transparent"
                    />
                  </div>
                </div>
              )}

              <div ref={holderRef} className="absolute left-0 top-0 z-10" style={{ width: stageW, height: stageH, cursor: activeTool === 'select' ? 'default' : 'crosshair' }}>
                <Stage ref={stageRef} width={stageW} height={stageH} onPointerDown={onStagePointerDown}>
                  <Layer scaleX={scale} scaleY={scale}>
                    {/* page boundaries */}
                    <Group listening={false}>
                      {Array.from({ length: pageCount - 1 }, (_, i) => (
                        <Line key={i} points={[0, (i + 1) * PAGE_H, BASE_WIDTH, (i + 1) * PAGE_H]} stroke={colors.line2} strokeWidth={1} dash={[7, 7]} strokeScaleEnabled={false} />
                      ))}
                    </Group>

                    {/* group outlines for the selection */}
                    <Group listening={false} name="screen-only">
                      {activeGroups.map((g) => {
                        const b = unionBox(regions.filter((r) => r.groupId === g.id).map(boxOf))
                        if (!b) return null
                        const pad = 14 * inv
                        return <Rect key={g.id} x={b.x - pad} y={b.y - pad} width={b.w + pad * 2} height={b.h + pad * 2} cornerRadius={12} stroke={colors.muted} strokeWidth={1} dash={[2, 5]} strokeScaleEnabled={false} />
                      })}
                    </Group>

                    {visible.map(renderShape)}
                    {renderDraft()}

                    {marquee && (
                      <Rect
                        name="screen-only"
                        x={Math.min(marquee.x0, marquee.x1)}
                        y={Math.min(marquee.y0, marquee.y1)}
                        width={Math.abs(marquee.x1 - marquee.x0)}
                        height={Math.abs(marquee.y1 - marquee.y0)}
                        fill={colors.accent}
                        opacity={0.08}
                        listening={false}
                      />
                    )}
                    {marquee && (
                      <Rect
                        name="screen-only"
                        x={Math.min(marquee.x0, marquee.x1)}
                        y={Math.min(marquee.y0, marquee.y1)}
                        width={Math.abs(marquee.x1 - marquee.x0)}
                        height={Math.abs(marquee.y1 - marquee.y0)}
                        stroke={colors.accent}
                        strokeWidth={1}
                        dash={[4, 4]}
                        strokeScaleEnabled={false}
                        listening={false}
                      />
                    )}

                    {/* Region numbers and page names, drawn into the image a vision
                        model sees (on screen they are crisp HTML instead). */}
                    <Group name="export-only" visible={false} listening={false}>
                      {Array.from({ length: pageCount }, (_, i) => (
                        <Group key={`page-${i}`} x={8} y={i * PAGE_H + 8}>
                          <Rect width={62} height={22} fill="rgba(13,13,15,0.85)" stroke="rgba(255,255,255,0.16)" strokeWidth={1} cornerRadius={5} />
                          <KonvaText width={62} height={22} text={`Page ${i + 1}`} fontSize={12} fontStyle="600" fill="#facc15" align="center" verticalAlign="middle" />
                        </Group>
                      ))}
                      {visible.map((r) => {
                        const ly = r.geometry.y - 24 < 0 ? r.geometry.y + 4 : r.geometry.y - 24
                        return (
                          <Group key={`label-${r.id}`} x={Math.max(0, r.geometry.x)} y={ly}>
                            <Rect width={32} height={20} fill={regionColor(r.regionNumber)} cornerRadius={4} />
                            <KonvaText width={32} height={20} text={`R${r.regionNumber}`} fontSize={12} fontStyle="bold" fill="#14110A" align="center" verticalAlign="middle" />
                          </Group>
                        )
                      })}
                    </Group>

                    {activeTool === 'select' && (
                      <Transformer
                        ref={transformerRef}
                        name="screen-only"
                        rotateEnabled={false}
                        flipEnabled={false}
                        keepRatio={false}
                        resizeEnabled={selectedRegionIds.length === 1}
                        enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
                        padding={5}
                        borderStroke={colors.accent}
                        borderStrokeWidth={1.2}
                        anchorStroke={colors.accent}
                        anchorFill={colors.bg}
                        anchorStrokeWidth={1.5}
                        anchorSize={9}
                        anchorCornerRadius={2}
                        ignoreStroke
                        boundBoxFunc={(oldBox, newBox) => (Math.abs(newBox.width) < MIN_SHAPE_SIZE || Math.abs(newBox.height) < MIN_SHAPE_SIZE ? oldBox : newBox)}
                      />
                    )}
                  </Layer>
                </Stage>
              </div>

              {/* ---------- HTML overlay: crisp at every zoom ---------- */}
              <div className="pointer-events-none absolute inset-0 z-20">
                {Array.from({ length: pageCount }, (_, i) => (
                  <div key={i} className="absolute -left-[64px] flex w-[56px] justify-end" style={{ top: i * pagePx }}>
                    <span className="mono-label mt-[-5px] text-faint">Page {i + 1}</span>
                  </div>
                ))}

                {!busy &&
                  visible.map((r) => (
                    <span
                      key={r.id}
                      className="absolute flex h-[17px] -translate-y-[calc(100%+3px)] items-center rounded-[4px] px-1.5 font-mono text-[9.5px] font-medium tracking-[0.06em] text-[#14110A]"
                      style={{ left: Math.max(0, r.geometry.x * scale), top: Math.max(20, r.geometry.y * scale), background: regionColor(r.regionNumber) }}
                    >
                      R{r.regionNumber}
                    </span>
                  ))}

                {activeGroups.map((g) => {
                  const b = unionBox(regions.filter((r) => r.groupId === g.id).map(boxOf))
                  if (!b) return null
                  return (
                    <span
                      key={g.id}
                      className="mono-label absolute translate-x-[-100%] translate-y-[18px] rounded-full border border-line2 bg-surface px-2 py-1 text-muted"
                      style={{ left: (b.x + b.w) * scale, top: (b.y + b.h) * scale }}
                    >
                      {g.name}
                    </span>
                  )
                })}

                {showBar && selBox && (
                  <div
                    className="pointer-events-auto absolute z-30 flex items-center gap-1 rounded-[10px] border border-line2 bg-surface p-1 shadow-plate"
                    style={{
                      left: Math.max(0, Math.min(selBox.x * scale, canvasW - (single ? 470 : 330))),
                      top: selBox.y * scale,
                      transform: selBox.y * scale > 70 ? 'translateY(calc(-100% - 26px))' : `translateY(${selBox.h * scale + 16}px)`,
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    {single ? (
                      <>
                        <span className="flex h-7 items-center gap-1.5 rounded-[6px] bg-surface2 px-2 font-mono text-[10.5px] text-ink">
                          <span className="h-2 w-2 rounded-full" style={{ background: regionColor(single.regionNumber) }} />R{single.regionNumber}
                        </span>
                        <input
                          value={single.intent}
                          onChange={(e) => updateRegionIntent(single.id, e.target.value)}
                          placeholder="What is this? e.g. navbar with 4 links"
                          aria-label={`Describe R${single.regionNumber}`}
                          disabled={isGenerating}
                          className="h-7 w-[220px] rounded-[6px] border border-transparent bg-transparent px-2 text-[12px] text-ink placeholder:text-faint focus:border-accent focus:bg-surface2"
                        />
                        <select
                          aria-label={`What R${single.regionNumber} is`}
                          title="What is it? Auto lets IntentDraw decide."
                          value={single.tag?.kind ?? ''}
                          disabled={isGenerating}
                          onChange={(e) => setRegionTag([single.regionNumber], { kind: (e.target.value || undefined) as IntentKind | undefined, anchor: single.tag?.anchor })}
                          className="h-7 max-w-[118px] rounded-[6px] border border-line bg-surface2 px-1.5 text-[11px] text-muted hover:text-ink focus:border-accent"
                        >
                          <option value="">Auto</option>
                          {KIND_OPTIONS.map((k) => (
                            <option key={k.value} value={k.value}>
                              {k.label}
                            </option>
                          ))}
                        </select>
                        <button type="button" onClick={() => duplicateRegions([single.id])} aria-label="Duplicate" title="Duplicate (Ctrl+D)" className="grid h-7 w-7 place-items-center rounded-[6px] text-muted transition-colors duration-150 hover:bg-surface2 hover:text-ink">
                          <Copy size={13} />
                        </button>
                        <button type="button" onClick={() => deleteRegions([single.id])} aria-label="Delete" title="Delete (Del)" className="grid h-7 w-7 place-items-center rounded-[6px] text-muted transition-colors duration-150 hover:bg-danger/15 hover:text-danger">
                          <Trash2 size={13} />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="px-2 text-[11.5px] text-muted">
                          <span className="tab-num text-ink">{selected.length}</span> selected
                        </span>
                        {!allInOneGroup && (
                          <button
                            type="button"
                            onClick={() => groupSelection()}
                            disabled={isGenerating}
                            className="flex h-7 items-center gap-1.5 rounded-[6px] bg-accent px-2.5 text-[11.5px] font-medium text-onaccent transition-colors duration-150 hover:bg-accent2 disabled:opacity-40"
                          >
                            <Layers size={12} /> Group {selected.length} shapes
                          </button>
                        )}
                        <button type="button" onClick={() => duplicateRegions(selectedRegionIds)} aria-label="Duplicate" title="Duplicate (Ctrl+D)" className="grid h-7 w-7 place-items-center rounded-[6px] text-muted transition-colors duration-150 hover:bg-surface2 hover:text-ink">
                          <Copy size={13} />
                        </button>
                        <button type="button" onClick={() => deleteRegions(selectedRegionIds)} aria-label="Delete selection" title="Delete (Del)" className="grid h-7 w-7 place-items-center rounded-[6px] text-muted transition-colors duration-150 hover:bg-danger/15 hover:text-danger">
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                )}

                {regions.length === 0 && !gesture && (
                  <div className="absolute inset-x-0 top-0 grid place-items-center" style={{ height: pagePx }}>
                    <div className="max-w-[440px] rounded-[14px] border border-dashed border-line2 bg-bg/80 px-8 py-7 text-center">
                      <div className="mono-label text-faint">Empty canvas · drawing is optional</div>
                      <p className="mt-3 text-[13px] leading-[1.75] text-muted">
                        Draw boxes where sections go, or sketch the picture you want in the hero. It&apos;s one continuous surface — draw straight across the dashed page lines. Or skip it and just write a prompt.
                      </p>
                      <div className="mono-label mt-4 text-accent">R box · O circle · P pencil · A arrow</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {pageCount < PAGE_CONFIG.maxPages && (
              <button type="button" onClick={addPage} className="group mt-4 flex w-full items-center gap-3 text-faint transition-colors duration-150 hover:text-accent">
                <span className="h-px flex-1" style={{ backgroundImage: 'repeating-linear-gradient(90deg, var(--c-line2) 0 6px, transparent 6px 12px)' }} />
                <span className="mono-label flex items-center gap-1.5">
                  <Plus size={11} /> Add page {pageCount + 1}
                </span>
                <span className="h-px flex-1" style={{ backgroundImage: 'repeating-linear-gradient(90deg, var(--c-line2) 0 6px, transparent 6px 12px)' }} />
              </button>
            )}
            <p className="mt-2 text-center text-[11px] text-faint">
              {pageCount < PAGE_CONFIG.maxPages ? 'Or keep drawing past the bottom edge — a page is added for you.' : `${PAGE_CONFIG.maxPages} pages is the most a drawing can have.`}
            </p>
          </div>
        </div>

        {/* where you are + how to move */}
        <div className="pointer-events-none absolute left-4 top-3 z-20 flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-[11px] text-muted">
          <span className="tab-num text-ink">Page {currentPage + 1}</span>
          <span className="text-faint">of {pageCount}</span>
          <span className="h-3 w-px bg-line" />
          <span className="text-faint">{panning ? 'Panning…' : 'Space + drag to pan'}</span>
        </div>

        {/* build status */}
        <AnimatePresence>
          {isGenerating && progress && (
            <motion.button
              type="button"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              onClick={() => setViewMode('preview')}
              className="absolute left-1/2 top-3 z-30 flex -translate-x-1/2 items-center gap-2.5 rounded-full border border-line2 bg-surface px-3.5 py-1.5 text-[11.5px] text-ink shadow-plate transition-colors duration-150 hover:border-accent"
            >
              <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-accent" />
              {progress.label}…
              <span className="tab-num text-faint">{Math.round((progress.done / Math.max(1, progress.total)) * 100)}%</span>
              <span className="text-accent">Watch →</span>
            </motion.button>
          )}
        </AnimatePresence>

        {/* tool dock */}
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-30 flex justify-center">
          <div role="toolbar" aria-label="Drawing tools" className="pointer-events-auto flex items-center gap-0.5 rounded-[12px] border border-line2 bg-surface p-1 shadow-plate">
            {TOOLS.map((t) => (
              <DockButton key={t.value} label={t.label} keys={t.key} active={activeTool === t.value} onClick={() => setActiveTool(t.value)}>
                {t.icon}
              </DockButton>
            ))}
            <span className="mx-1 h-5 w-px bg-line" />
            <DockButton label="Undo" keys="Ctrl Z" onClick={undo} disabled={!canUndo}>
              <Undo2 size={15} />
            </DockButton>
            <DockButton label="Redo" keys="Ctrl ⇧ Z" onClick={redo} disabled={!canRedo}>
              <Redo2 size={15} />
            </DockButton>
            <span className="mx-1 h-5 w-px bg-line" />
            <DockButton label="Delete selection" keys="Del" onClick={() => deleteRegions(selectedRegionIds)} disabled={selectedRegionIds.length === 0}>
              <Trash2 size={15} />
            </DockButton>
            <DockButton label="Clear canvas" onClick={() => setClearOpen(true)} disabled={regions.length === 0}>
              <X size={15} />
            </DockButton>
            <span className="mx-1 h-5 w-px bg-line" />
            <DockButton label="Zoom out" keys="Ctrl wheel" onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - 10))} disabled={zoom <= MIN_ZOOM}>
              <ZoomOut size={15} />
            </DockButton>
            <button type="button" onClick={() => setZoom(100)} title="Fit to width" className="tab-num h-9 w-[46px] rounded-[8px] text-[11px] text-muted transition-colors duration-150 hover:bg-surface2 hover:text-ink">
              {zoom}%
            </button>
            <DockButton label="Zoom in" keys="Ctrl wheel" onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 10))} disabled={zoom >= MAX_ZOOM}>
              <ZoomIn size={15} />
            </DockButton>
            <DockButton label="Fit to width" onClick={() => setZoom(100)}>
              <Maximize size={14} />
            </DockButton>
            <DockButton
              label={!previewCode ? 'Your site shows here once it is built' : ghost ? 'Hide the site behind your drawing' : 'Show the last site behind your drawing'}
              active={ghost && !!previewCode}
              disabled={!previewCode}
              onClick={() => setGhost((g) => !g)}
            >
              {ghost ? <Eye size={15} /> : <EyeOff size={15} />}
            </DockButton>
            <span className="mx-1 h-5 w-px bg-line" />
            <span className="flex h-9 items-center gap-1 whitespace-nowrap px-2 text-[11px] text-muted" title={`${regions.length} regions`}>
              <span className="tab-num text-ink">{regions.length}</span> {regions.length === 1 ? 'region' : 'regions'}
            </span>
          </div>
        </div>
      </div>

      <Dialog
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        title="Clear the canvas?"
        eyebrow="Removes every region on every page"
        footer={
          <>
            <Button variant="quiet" onClick={() => setClearOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                clearRegions()
                setClearOpen(false)
              }}
            >
              Clear canvas
            </Button>
          </>
        }
      >
        <p className="text-[13px] leading-[1.75] text-muted">
          {regions.length} {regions.length === 1 ? 'region' : 'regions'} and {groups.length} {groups.length === 1 ? 'group' : 'groups'} will be removed. Your prompt, the reading and the generated site stay as they are, and Ctrl+Z brings the drawing back.
        </p>
      </Dialog>
    </div>
  )
}
