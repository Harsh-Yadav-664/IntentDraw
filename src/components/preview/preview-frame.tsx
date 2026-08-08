'use client'

import { useMemo, useRef, useState, useEffect } from 'react'
import { wrapReactForPreview } from '@/lib/utils/sanitize'

interface PreviewFrameProps {
  code: string | null
  deviceSize?: 'desktop' | 'tablet' | 'mobile'
  className?: string
}

const DEVICE_WIDTHS = {
  desktop: 1280,
  tablet: 768,
  mobile: 375,
}

// Typical viewport heights to simulate real browser windows
const DEVICE_HEIGHTS = {
  desktop: 800,
  tablet: 1024,
  mobile: 812,
}

export default function PreviewFrame({ code, deviceSize = 'desktop', className = '' }: PreviewFrameProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  const targetWidth = DEVICE_WIDTHS[deviceSize]
  const targetHeight = DEVICE_HEIGHTS[deviceSize]

  // Calculate scale to fit in container width
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateScale = () => {
      const rect = container.getBoundingClientRect()
      
      // Scale down to fit, but never scale up
      // 32px padding for the container
      const newScale = Math.min(1, (rect.width - 32) / targetWidth)
      setScale(newScale)
    }

    updateScale()
    const observer = new ResizeObserver(updateScale)
    observer.observe(container)
    return () => observer.disconnect()
  }, [targetWidth])

  const srcDoc = useMemo(() => {
    if (!code) return null
    return wrapReactForPreview(code)
  }, [code])

  if (!srcDoc) {
    return (
      <div className={`flex items-center justify-center bg-slate-50 text-slate-400 ${className}`}>
        <div className="text-center p-4">
          <div className="text-4xl mb-3">🎨</div>
          <p className="text-sm">Generate a design to see preview</p>
        </div>
      </div>
    )
  }

  return (
    <div 
      ref={containerRef} 
      className={`overflow-auto bg-slate-100 flex justify-center py-4 ${className}`}
    >
      {/* Wrapper element that matches the exact scaled size of the iframe */}
      <div style={{ width: targetWidth * scale, height: targetHeight * scale }}>
        <div 
          className="bg-white shadow-md ring-1 ring-black/5"
          style={{
            width: targetWidth,
            height: targetHeight,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          <iframe
            srcDoc={srcDoc}
            sandbox="allow-scripts"
            title="Design Preview"
            className="w-full h-full border-0"
          />
        </div>
      </div>
    </div>
  )
}