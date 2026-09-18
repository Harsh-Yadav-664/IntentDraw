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
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [scale, setScale] = useState(1)
  const [frameHeight, setFrameHeight] = useState(DEVICE_HEIGHTS[deviceSize])

  const targetWidth = DEVICE_WIDTHS[deviceSize]
  const minHeight = DEVICE_HEIGHTS[deviceSize]

  // The iframe is a real browser viewport: fixed height, page scrolls inside it.
  // Its height comes from the panel and NEVER from the page's own reported
  // height — that creates a feedback loop, because `min-h-screen` inside the
  // iframe resolves against whatever height we just set, so every measurement
  // grows the page and the preview runs away into an empty void.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const measure = () => {
      const rect = container.getBoundingClientRect()
      const nextScale = Math.min(1, (rect.width - 32) / targetWidth)
      setScale(nextScale)
      // Fill the panel vertically at that scale, so a tall window shows more of
      // the site instead of letterboxing a fixed 800px viewport.
      setFrameHeight(Math.max(minHeight, Math.round((rect.height - 32) / (nextScale || 1))))
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    return () => observer.disconnect()
  }, [targetWidth, minHeight])

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
      <div style={{ width: targetWidth * scale, height: frameHeight * scale }}>
        <div
          className="bg-white shadow-md ring-1 ring-black/5"
          style={{
            width: targetWidth,
            height: frameHeight,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          <iframe
            ref={frameRef}
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