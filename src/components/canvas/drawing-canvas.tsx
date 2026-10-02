'use client'

import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import {
  Stage,
  Layer,
  Rect,
  Ellipse,
  Line,
  Arrow as KonvaArrow,
  Transformer,
  Group,
  Text as KonvaText,
} from 'react-konva'
import type Konva from 'konva'
import { useCanvasStore, REGION_COLORS } from '@/store/canvas-store'
import { useWorkflowStore } from '@/store/workflow-store'
import { wrapReactForPreview } from '@/lib/utils/sanitize'
import { PAGE_CONFIG, pageCountFor } from '@/lib/canvas/pages'
import PageRail from '@/components/canvas/page-rail'
import { Wand2 } from 'lucide-react'
import type { Region, RegionGeometry, CanvasTool } from '@/types'

const MIN_SHAPE_SIZE = 10

// Skip freeform points closer than ~3px (logical) to the previous one — cuts
// per-mousemove state updates and re-renders during a freehand stroke.
const FREEFORM_MIN_DIST_SQ = 9

const CURSOR_MAP: Record<CanvasTool, string> = {
  select: 'default',
  rectangle: 'crosshair',
  circle: 'crosshair',
  freeform: 'crosshair',
  arrow: 'crosshair',
}

interface DrawingState {
  startX: number
  startY: number
  currentX: number
  currentY: number
  points: number[]
}

export default function DrawingCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  const shapeRefs = useRef<Record<string, Konva.Node>>({})

  const [stageSize, setStageSize] = useState({ width: 800, height: 500 })
  const [drawing, setDrawing] = useState<DrawingState | null>(null)
  // Backdrop only — see the IFRAME_HEIGHT note in the message handler.
  const [backdropHeight, setBackdropHeight] = useState<number | null>(null)
  const acceptedHeight = useRef(false)

  const regions = useCanvasStore((s) => s.regions)
  const activeTool = useCanvasStore((s) => s.activeTool)
  const selectedRegionIds = useCanvasStore((s) => s.selectedRegionIds)
  const visibility = useCanvasStore((s) => s.visibility)
  const addRegion = useCanvasStore((s) => s.addRegion)
  const updateRegionGeometry = useCanvasStore((s) => s.updateRegionGeometry)
  const selectRegions = useCanvasStore((s) => s.selectRegions)
  const toggleRegionSelection = useCanvasStore((s) => s.toggleRegionSelection)
  const setStageInstance = useCanvasStore((s) => s.setStageInstance)
  const previewCode = useWorkflowStore((s) => s.previewCode)
  const isGenerating = useWorkflowStore((s) => s.status === 'generating' || s.status === 'analyzing')

  // Pages the user added explicitly with the rail's "Add page" (session only —
  // anything drawn there keeps the page alive through `pageCountFor`).
  const [requestedPages, setRequestedPages] = useState(0)

  const [selectionBox, setSelectionBox] = useState<{ startX: number; startY: number; currentX: number; currentY: number; active: boolean } | null>(null)

  // Opacity logic - Photoshop-like focus
  const getShapeOpacity = useCallback((regionId: string): number => {
    // Hidden shapes
    if (visibility[regionId] === false) return 0
    
    // No selection - all slightly visible
    if (selectedRegionIds.length === 0) return 0.85
    
    // Selected shape - full opacity
    if (selectedRegionIds.includes(regionId)) return 1.0
    
    // Other shapes when something is selected - dimmed
    return 0.25
  }, [selectedRegionIds, visibility])

  // Get color for region based on index
  const getRegionColor = useCallback((regionIndex: number): string => {
    return REGION_COLORS[regionIndex % REGION_COLORS.length]
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const updateSize = () => {
      setStageSize({ width: container.clientWidth, height: container.clientHeight })
    }
    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(container)

    const handleMessage = (e: MessageEvent) => {
      // The FIRST height report per backdrop, and only to trim the backdrop —
      // never the Konva stage, whose height comes from the drawing alone.
      //
      // This is the loop that produced "I scrolled for ten seconds through empty
      // background": `min-h-screen` inside the generated page resolves against
      // the frame, so sizing the frame from the page's own height grows the page,
      // which regrows the frame, forever. It is safe here only because the
      // runtime posts the height once on load (the ResizeObserver that re-posted
      // on every body resize is gone) and because `acceptedHeight` latches.
      if (e.data?.type === 'IFRAME_HEIGHT' && typeof e.data.height === 'number') {
        if (!acceptedHeight.current) {
          acceptedHeight.current = true
          setBackdropHeight(Math.max(400, Math.round(e.data.height)))
        }
        return
      }
      if (e.data && e.data.type === 'IFRAME_ERROR') {
        console.warn(`[preview backdrop] ${e.data.message}`)
      }
    }
    window.addEventListener('message', handleMessage)

    return () => {
      observer.disconnect()
      window.removeEventListener('message', handleMessage)
    }
  }, [])

  useEffect(() => {
    if (stageRef.current) setStageInstance(stageRef.current)
    return () => setStageInstance(null)
  }, [setStageInstance])

  useEffect(() => {
    const tr = transformerRef.current
    if (!tr) return

    // Konva Transformer supports multiple nodes naturally
    const selectedNodes = selectedRegionIds
      .map(id => shapeRefs.current[id])
      .filter(Boolean)

    tr.nodes(selectedNodes)
    tr.getLayer()?.batchDraw()
  }, [selectedRegionIds, regions])

  // Must equal the preview's 1280 logical width — see PAGE_CONFIG.
  const BASE_WIDTH = PAGE_CONFIG.pageWidth
  const scale = stageSize.width > 0 ? stageSize.width / BASE_WIDTH : 1

  // Height follows the drawing only — never the backdrop iframe (see above).
  // It is a whole number of pages: at least the default, the lowest shape's
  // page plus one spare, capped at maxPages.
  const pageCount = useMemo(() => pageCountFor(regions, requestedPages), [regions, requestedPages])
  const logicalHeight = pageCount * PAGE_CONFIG.pageHeight
  const physicalStageHeight = Math.max(stageSize.height, logicalHeight * scale)
  const addPage = useCallback(() => {
    setRequestedPages(Math.min(PAGE_CONFIG.maxPages, pageCount + 1))
  }, [pageCount])

  // Page boundaries as non-interactive guides, drawn beneath every shape.
  // A dark under-stroke plus a light dash keeps them readable over both the
  // empty canvas and the generated-site backdrop. Rebuilt only when the page
  // count or the canvas size changes — scrolling never touches the stage.
  const pageGuides = useMemo(() => {
    const H = PAGE_CONFIG.pageHeight
    const inv = scale > 0 ? 1 / scale : 1
    const guides = []
    for (let i = 0; i < pageCount; i++) {
      const y = i * H
      guides.push(
        <Group key={`page-${i}`} y={y}>
          {i > 0 && (
            <>
              <Line points={[0, 0, BASE_WIDTH, 0]} stroke="rgba(0,0,0,0.45)" strokeWidth={3} strokeScaleEnabled={false} />
              <Line points={[0, 0, BASE_WIDTH, 0]} stroke="rgba(250,204,21,0.7)" strokeWidth={1} dash={[10, 8]} strokeScaleEnabled={false} />
            </>
          )}
          {/* Label sized in screen pixels (÷ scale) so it stays legible when
              the canvas is scaled down in a narrow panel. */}
          <Group x={8 * inv} y={8 * inv} scaleX={inv} scaleY={inv}>
            <Rect width={54} height={20} fill="rgba(13,13,15,0.8)" stroke="rgba(255,255,255,0.14)" strokeWidth={1} cornerRadius={5} />
            <KonvaText
              width={54}
              height={20}
              text={`Page ${i + 1}`}
              fontSize={11}
              fontFamily="Inter, system-ui, sans-serif"
              fontStyle="600"
              fill="rgba(250,204,21,0.92)"
              align="center"
              verticalAlign="middle"
            />
          </Group>
        </Group>
      )
    }
    return guides
  }, [pageCount, BASE_WIDTH, scale])

  const srcDoc = useMemo(() => {
    if (!previewCode) return null
    // Staged generation pushes new code after every batch. Rebuilding this
    // backdrop each time meant a full CDN + Babel run per stage, on the same
    // thread as the canvas — for something behind the drawing that nobody is
    // looking at mid-run. Only the Output preview repaints live.
    if (isGenerating) return null
    // freeze: render once, then stop every animation so sitting behind the
    // canvas costs nothing per frame.
    return wrapReactForPreview(previewCode, { freeze: true })
  }, [previewCode, isGenerating])

  // A new backdrop gets to report its height once.
  useEffect(() => {
    acceptedHeight.current = false
  }, [srcDoc])

  const getPointerPos = useCallback((): { x: number; y: number } | null => {
    const pos = stageRef.current?.getPointerPosition()
    if (!pos) return null
    return {
      x: pos.x / scale,
      y: pos.y / scale
    }
  }, [scale])

  const startDrawing = useCallback(() => {
    const pos = getPointerPos()
    if (!pos) return
    if (activeTool === 'select') {
      setSelectionBox({
        startX: pos.x,
        startY: pos.y,
        currentX: pos.x,
        currentY: pos.y,
        active: true
      })
      return
    }
    setDrawing({
      startX: pos.x,
      startY: pos.y,
      currentX: pos.x,
      currentY: pos.y,
      points: activeTool === 'freeform' ? [0, 0] : [],
    })
  }, [activeTool, getPointerPos])

  const continueDrawing = useCallback(() => {
    const pos = getPointerPos()
    if (!pos) return

    if (activeTool === 'select' && selectionBox?.active) {
      setSelectionBox(prev => prev ? { ...prev, currentX: pos.x, currentY: pos.y } : null)
      return
    }

    if (!drawing) return

    if (activeTool === 'freeform') {
      setDrawing((prev) => {
        if (!prev) return prev
        const relX = pos.x - prev.startX
        const relY = pos.y - prev.startY
        const n = prev.points.length
        if (n >= 2) {
          const dx = relX - prev.points[n - 2]
          const dy = relY - prev.points[n - 1]
          // Too close to the last point — bail out unchanged so React skips
          // the re-render entirely (the freeform preview only reads `points`).
          if (dx * dx + dy * dy < FREEFORM_MIN_DIST_SQ) return prev
        }
        return {
          ...prev,
          currentX: pos.x,
          currentY: pos.y,
          points: [...prev.points, relX, relY],
        }
      })
    } else {
      setDrawing((prev) => (prev ? { ...prev, currentX: pos.x, currentY: pos.y } : null))
    }
  }, [drawing, selectionBox, activeTool, getPointerPos])

  const finishDrawing = useCallback(() => {
    if (activeTool === 'select' && selectionBox?.active) {
      const { startX, startY, currentX, currentY } = selectionBox
      
      const x1 = Math.min(startX, currentX)
      const y1 = Math.min(startY, currentY)
      const x2 = Math.max(startX, currentX)
      const y2 = Math.max(startY, currentY)
      
      if (x2 - x1 >= MIN_SHAPE_SIZE && y2 - y1 >= MIN_SHAPE_SIZE) {
        // Find all intersecting shapes
        const intersectingIds = regions.filter(r => {
          const node = shapeRefs.current[r.id]
          if (!node || visibility[r.id] === false) return false
          const box = node.getClientRect()
          const boxX1 = box.x / scale
          const boxY1 = box.y / scale
          const boxX2 = (box.x + box.width) / scale
          const boxY2 = (box.y + box.height) / scale
          
          return !(boxX2 < x1 || boxX1 > x2 || boxY2 < y1 || boxY1 > y2)
        }).map(r => r.id)
        
        selectRegions(intersectingIds)
      }
      
      setSelectionBox(null)
      return
    }

    if (!drawing) return

    const { startX, startY, currentX, currentY, points } = drawing
    let geometry: RegionGeometry | null = null

    switch (activeTool) {
      case 'rectangle': {
        const w = Math.abs(currentX - startX)
        const h = Math.abs(currentY - startY)
        if (w >= MIN_SHAPE_SIZE && h >= MIN_SHAPE_SIZE) {
          geometry = {
            type: 'rectangle',
            x: Math.min(startX, currentX),
            y: Math.min(startY, currentY),
            width: w,
            height: h,
          }
        }
        break
      }
      case 'circle': {
        const w = Math.abs(currentX - startX)
        const h = Math.abs(currentY - startY)
        if (w >= MIN_SHAPE_SIZE && h >= MIN_SHAPE_SIZE) {
          geometry = {
            type: 'circle',
            x: Math.min(startX, currentX),
            y: Math.min(startY, currentY),
            width: w,
            height: h,
          }
        }
        break
      }
      case 'freeform': {
        if (points.length >= 4) {
          const xs: number[] = []
          const ys: number[] = []
          for (let i = 0; i < points.length; i += 2) xs.push(points[i])
          for (let i = 1; i < points.length; i += 2) ys.push(points[i])
          const minX = Math.min(...xs)
          const minY = Math.min(...ys)
          const path: Array<{ x: number; y: number }> = []
          for (let i = 0; i < points.length; i += 2) {
            path.push({ x: points[i] - minX, y: points[i + 1] - minY })
          }
          geometry = {
            type: 'freeform',
            // x/y is the bounding-box top-left (not the stroke start),
            // so layout/intent code can treat it like any other region.
            x: startX + minX,
            y: startY + minY,
            width: Math.max(1, Math.max(...xs) - minX),
            height: Math.max(1, Math.max(...ys) - minY),
            path,
          }
        }
        break
      }
      case 'arrow': {
        const dx = currentX - startX
        const dy = currentY - startY
        if (Math.sqrt(dx * dx + dy * dy) >= MIN_SHAPE_SIZE) {
          const minX = Math.min(startX, currentX)
          const minY = Math.min(startY, currentY)
          geometry = {
            type: 'arrow',
            // x/y is the bounding-box top-left; path is relative to it.
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
        break
      }
    }

    if (geometry) addRegion(geometry)
    setDrawing(null)
  }, [drawing, selectionBox, activeTool, addRegion, regions, visibility, scale, selectRegions])

  const handleShapeClick = useCallback(
    (e: any, regionId: string) => {
      if (activeTool === 'select') {
        if (e.evt.shiftKey) {
          toggleRegionSelection(regionId)
        } else {
          selectRegions([regionId])
        }
      }
    },
    [activeTool, selectRegions, toggleRegionSelection]
  )

  const handleDragEnd = useCallback(
    (regionId: string, geometryType: string, geoWidth: number, geoHeight: number) => {
      const node = shapeRefs.current[regionId]
      if (!node) return

      if (geometryType === 'circle') {
        updateRegionGeometry(regionId, {
          x: node.x() - geoWidth / 2,
          y: node.y() - geoHeight / 2,
        })
      } else {
        updateRegionGeometry(regionId, {
          x: node.x(),
          y: node.y(),
        })
      }
    },
    [updateRegionGeometry]
  )

  const handleTransformEnd = useCallback(
    (regionId: string) => {
      const node = shapeRefs.current[regionId]
      if (!node) return

      const sx = node.scaleX()
      const sy = node.scaleY()
      node.scaleX(1)
      node.scaleY(1)

      updateRegionGeometry(regionId, {
        x: node.x(),
        y: node.y(),
        width: Math.max(MIN_SHAPE_SIZE, node.width() * sx),
        height: Math.max(MIN_SHAPE_SIZE, node.height() * sy),
      })
    },
    [updateRegionGeometry]
  )

  const renderRegion = (region: Region, index: number) => {
    const { geometry, id } = region
    const isSelected = selectedRegionIds.includes(id)
    const isVisible = visibility[id] !== false
    const regionColor = getRegionColor(index)
    const opacity = getShapeOpacity(id)
    const isDraggable = activeTool === 'select' && isVisible

    // Don't render invisible shapes
    if (!isVisible) return null

    const commonProps = {
      onClick: (e: any) => handleShapeClick(e, id),
      onTap: (e: any) => handleShapeClick(e, id),
      onDragEnd: () => handleDragEnd(id, geometry.type, geometry.width, geometry.height),
      onTransformEnd: () => handleTransformEnd(id),
      draggable: isDraggable,
    }

    const strokeWidth = isSelected ? 3 : 2
    const fillOpacity = isSelected ? 0.15 : 0.08

    const renderShape = () => {
      switch (geometry.type) {
        case 'rectangle':
          return (
            <Rect
              ref={(node) => { if (node) shapeRefs.current[id] = node }}
              x={geometry.x}
              y={geometry.y}
              width={geometry.width}
              height={geometry.height}
              stroke={regionColor}
              strokeWidth={strokeWidth}
              fill={regionColor}
              fillEnabled={true}
              opacity={fillOpacity}
              cornerRadius={3}
              {...commonProps}
            />
          )

        case 'circle':
          return (
            <Ellipse
              ref={(node) => { if (node) shapeRefs.current[id] = node }}
              x={geometry.x + geometry.width / 2}
              y={geometry.y + geometry.height / 2}
              radiusX={geometry.width / 2}
              radiusY={geometry.height / 2}
              stroke={regionColor}
              strokeWidth={strokeWidth}
              fill={regionColor}
              fillEnabled={true}
              opacity={fillOpacity}
              {...commonProps}
            />
          )

        case 'freeform':
          return (
            <Line
              ref={(node) => { if (node) shapeRefs.current[id] = node }}
              x={geometry.x}
              y={geometry.y}
              points={geometry.path?.flatMap((p) => [p.x, p.y]) ?? []}
              stroke={regionColor}
              strokeWidth={strokeWidth}
              lineCap="round"
              lineJoin="round"
              tension={0.4}
              {...commonProps}
            />
          )

        case 'arrow':
          return (
            <KonvaArrow
              ref={(node) => { if (node) shapeRefs.current[id] = node }}
              x={geometry.x}
              y={geometry.y}
              points={geometry.path?.flatMap((p) => [p.x, p.y]) ?? []}
              stroke={regionColor}
              strokeWidth={strokeWidth}
              fill={regionColor}
              pointerLength={12}
              pointerWidth={10}
              {...commonProps}
            />
          )

        default:
          return null
      }
    }

    return (
      <Group key={id} opacity={opacity}>
        {renderShape()}
      </Group>
    )
  }

  const renderLabel = (region: Region, index: number) => {
    const { geometry, regionNumber, id } = region
    const isVisible = visibility[id] !== false
    
    if (!isVisible) return null
    
    const opacity = getShapeOpacity(id)
    const regionColor = getRegionColor(index)
    const text = `R${regionNumber}`
    const w = 28
    const h = 18

    let lx = geometry.x
    let ly = geometry.y - h - 4
    if (ly < 0) ly = geometry.y + 4
    if (lx < 0) lx = 0

    return (
      <Group key={`label-${id}`} x={lx} y={ly} opacity={opacity} listening={false}>
        <Rect
          width={w}
          height={h}
          fill={regionColor}
          cornerRadius={4}
          shadowColor="rgba(0,0,0,0.15)"
          shadowBlur={4}
          shadowOffsetY={1}
        />
        <KonvaText
          text={text}
          fontSize={11}
          fontFamily="Inter, system-ui, sans-serif"
          fontStyle="bold"
          fill="#FFFFFF"
          width={w}
          height={h}
          align="center"
          verticalAlign="middle"
        />
      </Group>
    )
  }

  const renderDrawingPreview = () => {
    if (!drawing) return null
    const { startX, startY, currentX, currentY, points } = drawing
    const previewColor = REGION_COLORS[regions.length % REGION_COLORS.length]

    switch (activeTool) {
      case 'rectangle':
        return (
          <Rect
            x={Math.min(startX, currentX)}
            y={Math.min(startY, currentY)}
            width={Math.abs(currentX - startX)}
            height={Math.abs(currentY - startY)}
            stroke={previewColor}
            strokeWidth={2}
            fill={previewColor}
            opacity={0.15}
            dash={[6, 3]}
            cornerRadius={3}
          />
        )
      case 'circle':
        return (
          <Ellipse
            x={(startX + currentX) / 2}
            y={(startY + currentY) / 2}
            radiusX={Math.abs(currentX - startX) / 2}
            radiusY={Math.abs(currentY - startY) / 2}
            stroke={previewColor}
            strokeWidth={2}
            fill={previewColor}
            opacity={0.15}
            dash={[6, 3]}
          />
        )
      case 'freeform':
        return (
          <Line
            x={startX}
            y={startY}
            points={points}
            stroke={previewColor}
            strokeWidth={2}
            lineCap="round"
            lineJoin="round"
            tension={0.4}
          />
        )
      case 'arrow':
        return (
          <KonvaArrow
            x={startX}
            y={startY}
            points={[0, 0, currentX - startX, currentY - startY]}
            stroke={previewColor}
            strokeWidth={2}
            fill={previewColor}
            pointerLength={12}
            pointerWidth={10}
            dash={[6, 3]}
          />
        )
      default:
        return null
    }
  }

  const renderSelectionBox = () => {
    if (!selectionBox || !selectionBox.active) return null
    const { startX, startY, currentX, currentY } = selectionBox
    return (
      <Rect
        x={Math.min(startX, currentX)}
        y={Math.min(startY, currentY)}
        width={Math.abs(currentX - startX)}
        height={Math.abs(currentY - startY)}
        fill="rgba(58, 123, 255, 0.2)"
        stroke="#3A7BFF"
        strokeWidth={1}
        listening={false}
      />
    )
  }

  return (
    <div className="w-full h-full flex">
    <PageRail
      scrollRef={containerRef}
      pageCount={pageCount}
      pageHeightPx={PAGE_CONFIG.pageHeight * scale}
      canAddPage={pageCount < PAGE_CONFIG.maxPages}
      onAddPage={addPage}
    />
    <div
      ref={containerRef}
      className="flex-1 min-w-0 h-full overflow-y-auto overflow-x-hidden relative"
      style={{ cursor: CURSOR_MAP[activeTool] }}
    >
      {/* Background layer: Generated Website or Empty State.
          Clipped to the page canvas: the backdrop iframe is sized from the
          generated page's own height and would otherwise stretch the scroll
          area past the last page — the canvas's extent comes from the pages. */}
      <div
        className="absolute top-0 left-0 bg-[#0A0A0B] overflow-hidden"
        style={{
          width: BASE_WIDTH,
          height: physicalStageHeight / scale,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          zIndex: 0,
        }}
      >
        {previewCode ? (
          // The generated site, rendered once and then frozen (see
          // `wrapReactForPreview`'s `freeze`). It is a real frame rather than a
          // bitmap because a sandboxed opaque-origin iframe cannot screenshot
          // itself; freezing gets the same "costs nothing to sit there" result.
          // `key` on the code keeps React from reusing the frame across changes.
          <iframe
            key={srcDoc ? 'backdrop' : 'none'}
            srcDoc={srcDoc || ''}
            sandbox="allow-scripts"
            tabIndex={-1}
            aria-hidden="true"
            style={{ height: backdropHeight ?? '100%' }}
            className="w-full border-0 bg-transparent pointer-events-none"
          />
        ) : regions.length === 0 ? (
          // Centred on the first page, not the whole multi-page canvas.
          <div
            className="w-full flex flex-col items-center justify-center border border-white/5 border-dashed"
            style={{ height: PAGE_CONFIG.pageHeight }}
          >
            <div className="h-16 w-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 shadow-xl">
               <Wand2 className="h-8 w-8 text-primary/50" />
            </div>
            <p className="text-xl font-medium text-foreground/90">Your canvas is empty</p>
            <p className="text-sm text-muted-foreground mt-2 max-w-md text-center">
              Draw shapes here to give the AI a layout to follow, or just write a prompt in the controls panel to generate a website instantly!
            </p>
          </div>
        ) : null}
      </div>

      <Stage
        ref={stageRef}
        width={Math.max(1, stageSize.width)}
        height={Math.max(1, physicalStageHeight)}
        style={{ position: 'absolute', top: 0, left: 0, zIndex: 10 }}
        onMouseDown={(e) => {
          if (activeTool === 'select') {
            if (e.target === stageRef.current) {
              selectRegions([])
              startDrawing() // This will now start the selection box
            }
            return
          }
          startDrawing()
        }}
        onMouseMove={continueDrawing}
        onMouseUp={finishDrawing}
        onMouseLeave={() => { if (drawing || selectionBox?.active) finishDrawing() }}
        onTouchStart={(e) => {
          if (activeTool === 'select') {
            if (e.target === stageRef.current) {
              selectRegions([])
              startDrawing()
            }
            return
          }
          startDrawing()
        }}
        onTouchMove={continueDrawing}
        onTouchEnd={finishDrawing}
      >
        <Layer scaleX={scale} scaleY={scale}>
          {/* We rely on the parent container's transparent/dark background now instead of a white rect */}

          <Group listening={false}>{pageGuides}</Group>

          {regions.map((region, index) => renderRegion(region, index))}
          {renderDrawingPreview()}
          {renderSelectionBox()}
          {regions.map((region, index) => renderLabel(region, index))}

          {activeTool === 'select' && (
            <Transformer
              ref={transformerRef}
              borderStroke="#3A7BFF"
              borderStrokeWidth={1.5}
              anchorStroke="#3A7BFF"
              anchorFill="#FFFFFF"
              anchorSize={8}
              anchorCornerRadius={2}
              rotateEnabled={false}
              keepRatio={false}
              boundBoxFunc={(_oldBox, newBox) => {
                if (
                  Math.abs(newBox.width) < MIN_SHAPE_SIZE ||
                  Math.abs(newBox.height) < MIN_SHAPE_SIZE
                ) {
                  return _oldBox
                }
                return newBox
              }}
            />
          )}
        </Layer>
      </Stage>
    </div>
    </div>
  )
}