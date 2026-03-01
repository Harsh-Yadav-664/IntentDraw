'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
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
import { useCanvasStore } from '@/store/canvas-store'
import type { Region, RegionGeometry, CanvasTool } from '@/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_SHAPE_SIZE = 10

const COLORS = {
  default: { stroke: '#3B82F6', fill: 'rgba(59,130,246,0.08)' },
  selected: { stroke: '#2563EB', fill: 'rgba(37,99,235,0.15)' },
  drawing: { stroke: '#93C5FD', fill: 'rgba(147,197,253,0.15)' },
  label: { bg: '#FFFFFF', text: '#1E40AF', border: '#93C5FD' },
}

const CURSOR_MAP: Record<CanvasTool, string> = {
  select: 'default',
  rectangle: 'crosshair',
  circle: 'crosshair',
  freeform: 'crosshair',
  arrow: 'crosshair',
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DrawingState {
  startX: number
  startY: number
  currentX: number
  currentY: number
  points: number[]
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DrawingCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  const shapeRefs = useRef<Record<string, Konva.Node>>({})

  const [stageSize, setStageSize] = useState({ width: 800, height: 500 })
  const [drawing, setDrawing] = useState<DrawingState | null>(null)

  // Store selectors — each subscribes only to what it reads
  const regions = useCanvasStore((s) => s.regions)
  const activeTool = useCanvasStore((s) => s.activeTool)
  const selectedRegionId = useCanvasStore((s) => s.selectedRegionId)
  const addRegion = useCanvasStore((s) => s.addRegion)
  const updateRegionGeometry = useCanvasStore((s) => s.updateRegionGeometry)
  const selectRegion = useCanvasStore((s) => s.selectRegion)
  const setStageInstance = useCanvasStore((s) => s.setStageInstance)

  // -------------------------------------------------------------------------
  // Canvas sizing — watches container width and maintains 16:10 aspect ratio
  // -------------------------------------------------------------------------
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const updateSize = () => {
      const { width } = container.getBoundingClientRect()
      setStageSize({ width, height: Math.round(width * 0.625) })
    }
    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // Store the Stage reference so store.exportToPng() works from anywhere
  useEffect(() => {
    if (stageRef.current) setStageInstance(stageRef.current)
    return () => setStageInstance(null)
  }, [setStageInstance])

  // -------------------------------------------------------------------------
  // Sync Transformer handles to the currently selected rectangle
  // -------------------------------------------------------------------------
  useEffect(() => {
    const tr = transformerRef.current
    if (!tr) return

    const selected = regions.find((r) => r.id === selectedRegionId)
    const selectedNode = selected ? shapeRefs.current[selected.id] : undefined

    if (selected && selected.geometry.type === 'rectangle' && selectedNode) {
      tr.nodes([selectedNode])
    } else {
      tr.nodes([])
    }
    tr.getLayer()?.batchDraw()
  }, [selectedRegionId, regions])

  // -------------------------------------------------------------------------
  // Pointer position from Konva stage
  // -------------------------------------------------------------------------
  const getPointerPos = useCallback((): { x: number; y: number } | null => {
    return stageRef.current?.getPointerPosition() ?? null
  }, [])

  // -------------------------------------------------------------------------
  // Drawing lifecycle — three functions with no event params
  // -------------------------------------------------------------------------

  // Begin a new shape at the current pointer position
  const startDrawing = useCallback(() => {
    const pos = getPointerPos()
    if (!pos) return
    setDrawing({
      startX: pos.x,
      startY: pos.y,
      currentX: pos.x,
      currentY: pos.y,
      points: activeTool === 'freeform' ? [0, 0] : [],
    })
  }, [activeTool, getPointerPos])

  // Update the temporary shape as the pointer moves
  const continueDrawing = useCallback(() => {
    if (!drawing) return
    const pos = getPointerPos()
    if (!pos) return

    if (activeTool === 'freeform') {
      setDrawing((prev) =>
        prev
          ? {
              ...prev,
              currentX: pos.x,
              currentY: pos.y,
              points: [...prev.points, pos.x - prev.startX, pos.y - prev.startY],
            }
          : null
      )
    } else {
      setDrawing((prev) => (prev ? { ...prev, currentX: pos.x, currentY: pos.y } : null))
    }
  }, [drawing, activeTool, getPointerPos])

  // Finalize the shape — convert to Region and add to store if big enough
  const finishDrawing = useCallback(() => {
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
          const path = []
          for (let i = 0; i < points.length; i += 2) {
            path.push({ x: points[i], y: points[i + 1] })
          }
          geometry = {
            type: 'freeform',
            x: startX,
            y: startY,
            width: Math.max(1, Math.max(...xs) - Math.min(...xs)),
            height: Math.max(1, Math.max(...ys) - Math.min(...ys)),
            path,
          }
        }
        break
      }
      case 'arrow': {
        const dx = currentX - startX
        const dy = currentY - startY
        if (Math.sqrt(dx * dx + dy * dy) >= MIN_SHAPE_SIZE) {
          geometry = {
            type: 'arrow',
            x: startX,
            y: startY,
            width: Math.max(1, Math.abs(dx)),
            height: Math.max(1, Math.abs(dy)),
            path: [
              { x: 0, y: 0 },
              { x: dx, y: dy },
            ],
          }
        }
        break
      }
    }

    if (geometry) addRegion(geometry)
    setDrawing(null)
  }, [drawing, activeTool, addRegion])

  // -------------------------------------------------------------------------
  // Shape interaction helpers — read position from shapeRefs, not events
  // -------------------------------------------------------------------------

  const handleShapeClick = useCallback(
    (regionId: string) => {
      if (activeTool === 'select') selectRegion(regionId)
    },
    [activeTool, selectRegion]
  )

  // Called after Konva finishes a drag. Reads new position from the node ref.
  const handleDragEnd = useCallback(
    (regionId: string, geometryType: string, geoWidth: number, geoHeight: number) => {
      const node = shapeRefs.current[regionId]
      if (!node) return

      if (geometryType === 'circle') {
        // Konva positions Ellipse at center; convert back to top-left
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

  // Called after Transformer finishes. Reads scale, computes real px size, resets scale to 1.
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

  // -------------------------------------------------------------------------
  // Render a stored region as the correct Konva shape
  // -------------------------------------------------------------------------
  const renderRegion = (region: Region) => {
    const { geometry, id } = region
    const isSelected = id === selectedRegionId
    const colors = isSelected ? COLORS.selected : COLORS.default
    const isDraggable = activeTool === 'select'

    // Shared props for every shape type
    const commonProps = {
      onClick: () => handleShapeClick(id),
      onTap: () => handleShapeClick(id),
      onDragEnd: () => handleDragEnd(id, geometry.type, geometry.width, geometry.height),
      onTransformEnd: () => handleTransformEnd(id),
      draggable: isDraggable,
    }

    switch (geometry.type) {
      case 'rectangle':
        return (
          <Rect
            key={id}
            ref={(node) => { if (node) shapeRefs.current[id] = node }}
            x={geometry.x}
            y={geometry.y}
            width={geometry.width}
            height={geometry.height}
            stroke={colors.stroke}
            strokeWidth={isSelected ? 2.5 : 2}
            fill={colors.fill}
            cornerRadius={2}
            {...commonProps}
          />
        )

      case 'circle':
        return (
          <Ellipse
            key={id}
            ref={(node) => { if (node) shapeRefs.current[id] = node }}
            x={geometry.x + geometry.width / 2}
            y={geometry.y + geometry.height / 2}
            radiusX={geometry.width / 2}
            radiusY={geometry.height / 2}
            stroke={colors.stroke}
            strokeWidth={isSelected ? 2.5 : 2}
            fill={colors.fill}
            {...commonProps}
          />
        )

      case 'freeform':
        return (
          <Line
            key={id}
            ref={(node) => { if (node) shapeRefs.current[id] = node }}
            x={geometry.x}
            y={geometry.y}
            points={geometry.path?.flatMap((p) => [p.x, p.y]) ?? []}
            stroke={colors.stroke}
            strokeWidth={isSelected ? 3 : 2}
            lineCap="round"
            lineJoin="round"
            tension={0.4}
            {...commonProps}
          />
        )

      case 'arrow':
        return (
          <KonvaArrow
            key={id}
            ref={(node) => { if (node) shapeRefs.current[id] = node }}
            x={geometry.x}
            y={geometry.y}
            points={geometry.path?.flatMap((p) => [p.x, p.y]) ?? []}
            stroke={colors.stroke}
            strokeWidth={isSelected ? 3 : 2}
            fill={colors.stroke}
            pointerLength={12}
            pointerWidth={10}
            {...commonProps}
          />
        )

      default:
        return null
    }
  }

  // -------------------------------------------------------------------------
  // Render the dashed preview shape while the user is drawing
  // -------------------------------------------------------------------------
  const renderDrawingPreview = () => {
    if (!drawing) return null
    const { startX, startY, currentX, currentY, points } = drawing
    const c = COLORS.drawing

    switch (activeTool) {
      case 'rectangle':
        return (
          <Rect
            x={Math.min(startX, currentX)}
            y={Math.min(startY, currentY)}
            width={Math.abs(currentX - startX)}
            height={Math.abs(currentY - startY)}
            stroke={c.stroke}
            strokeWidth={2}
            fill={c.fill}
            dash={[6, 3]}
            cornerRadius={2}
          />
        )
      case 'circle':
        return (
          <Ellipse
            x={(startX + currentX) / 2}
            y={(startY + currentY) / 2}
            radiusX={Math.abs(currentX - startX) / 2}
            radiusY={Math.abs(currentY - startY) / 2}
            stroke={c.stroke}
            strokeWidth={2}
            fill={c.fill}
            dash={[6, 3]}
          />
        )
      case 'freeform':
        return (
          <Line
            x={startX}
            y={startY}
            points={points}
            stroke={c.stroke}
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
            stroke={c.stroke}
            strokeWidth={2}
            fill={c.stroke}
            pointerLength={12}
            pointerWidth={10}
            dash={[6, 3]}
          />
        )
      default:
        return null
    }
  }

  // -------------------------------------------------------------------------
  // Render region number label above each shape
  // -------------------------------------------------------------------------
  const renderLabel = (region: Region) => {
    const { geometry, regionNumber } = region
    const text = `R${regionNumber}`
    const w = 30
    const h = 20

    let lx = geometry.x
    let ly = geometry.y - h - 4
    if (ly < 0) ly = geometry.y + 4
    if (lx < 0) lx = 0

    return (
      <Group key={`label-${region.id}`} x={lx} y={ly} listening={false}>
        <Rect
          width={w}
          height={h}
          fill={COLORS.label.bg}
          stroke={COLORS.label.border}
          strokeWidth={1}
          cornerRadius={4}
          shadowColor="rgba(0,0,0,0.08)"
          shadowBlur={4}
          shadowOffsetY={1}
        />
        <KonvaText
          text={text}
          fontSize={11}
          fontFamily="Inter, system-ui, sans-serif"
          fontStyle="bold"
          fill={COLORS.label.text}
          width={w}
          height={h}
          align="center"
          verticalAlign="middle"
        />
      </Group>
    )
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div
      ref={containerRef}
      className="w-full rounded-lg border border-slate-200 overflow-hidden bg-white"
      style={{ cursor: CURSOR_MAP[activeTool] }}
    >
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        onMouseDown={(e) => {
          // Select tool: click empty area (stage background) to deselect
          if (activeTool === 'select') {
            if (e.target === stageRef.current) selectRegion(null)
            return
          }
          startDrawing()
        }}
        onMouseMove={continueDrawing}
        onMouseUp={finishDrawing}
        onMouseLeave={() => { if (drawing) finishDrawing() }}
        onTouchStart={() => {
          if (activeTool !== 'select') startDrawing()
        }}
        onTouchMove={continueDrawing}
        onTouchEnd={finishDrawing}
      >
        <Layer>
          {/* White background — listening={false} so clicks pass to Stage */}
          <Rect
            x={0}
            y={0}
            width={stageSize.width}
            height={stageSize.height}
            fill="#FFFFFF"
            listening={false}
          />

          {regions.map(renderRegion)}
          {renderDrawingPreview()}
          {regions.map(renderLabel)}

          {activeTool === 'select' && (
            <Transformer
              ref={transformerRef}
              borderStroke="#2563EB"
              borderStrokeWidth={1.5}
              anchorStroke="#2563EB"
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
  )
}