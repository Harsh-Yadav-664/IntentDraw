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
import { useCanvasStore, REGION_COLORS } from '@/store/canvas-store'
import type { Region, RegionGeometry, CanvasTool } from '@/types'

const MIN_SHAPE_SIZE = 10

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

  const regions = useCanvasStore((s) => s.regions)
  const activeTool = useCanvasStore((s) => s.activeTool)
  const selectedRegionId = useCanvasStore((s) => s.selectedRegionId)
  const visibility = useCanvasStore((s) => s.visibility)
  const addRegion = useCanvasStore((s) => s.addRegion)
  const updateRegionGeometry = useCanvasStore((s) => s.updateRegionGeometry)
  const selectRegion = useCanvasStore((s) => s.selectRegion)
  const setStageInstance = useCanvasStore((s) => s.setStageInstance)

  // Opacity logic - Photoshop-like focus
  const getShapeOpacity = useCallback((regionId: string): number => {
    // Hidden shapes
    if (visibility[regionId] === false) return 0
    
    // No selection - all slightly visible
    if (!selectedRegionId) return 0.85
    
    // Selected shape - full opacity
    if (regionId === selectedRegionId) return 1.0
    
    // Other shapes when something is selected - dimmed
    return 0.25
  }, [selectedRegionId, visibility])

  // Get color for region based on index
  const getRegionColor = useCallback((regionIndex: number): string => {
    return REGION_COLORS[regionIndex % REGION_COLORS.length]
  }, [])

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

  useEffect(() => {
    if (stageRef.current) setStageInstance(stageRef.current)
    return () => setStageInstance(null)
  }, [setStageInstance])

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

  const getPointerPos = useCallback((): { x: number; y: number } | null => {
    return stageRef.current?.getPointerPosition() ?? null
  }, [])

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

  const handleShapeClick = useCallback(
    (regionId: string) => {
      if (activeTool === 'select') selectRegion(regionId)
    },
    [activeTool, selectRegion]
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
    const isSelected = id === selectedRegionId
    const isVisible = visibility[id] !== false
    const regionColor = getRegionColor(index)
    const opacity = getShapeOpacity(id)
    const isDraggable = activeTool === 'select' && isVisible

    // Don't render invisible shapes
    if (!isVisible) return null

    const commonProps = {
      onClick: () => handleShapeClick(id),
      onTap: () => handleShapeClick(id),
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
          <Rect
            x={0}
            y={0}
            width={stageSize.width}
            height={stageSize.height}
            fill="#FFFFFF"
            listening={false}
          />

          {regions.map((region, index) => renderRegion(region, index))}
          {renderDrawingPreview()}
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
  )
}