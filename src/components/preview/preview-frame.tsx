'use client'

import { useMemo, useRef, useState, useEffect } from 'react'
import { wrapHtmlForPreview } from '@/lib/utils/sanitize'

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

export default function PreviewFrame({ code, deviceSize = 'desktop', className = '' }: PreviewFrameProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [containerWidth, setContainerWidth] = useState(0)

  const targetWidth = DEVICE_WIDTHS[deviceSize]

  // Calculate scale to fit iframe in container
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateScale = () => {
      const rect = container.getBoundingClientRect()
      setContainerWidth(rect.width)
      
      // Scale down to fit, but never scale up
      const newScale = Math.min(1, (rect.width - 20) / targetWidth)
      setScale(newScale)
    }

    updateScale()
    const observer = new ResizeObserver(updateScale)
    observer.observe(container)
    return () => observer.disconnect()
  }, [targetWidth])

  const srcDoc = useMemo(() => {
    if (!code) return null
    return wrapHtmlForPreview(code)
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

  const scaledHeight = 800 / scale // Maintain aspect ratio

  return (
    <div 
      ref={containerRef} 
      className={`overflow-auto bg-slate-100 ${className}`}
    >
      <div 
        className="origin-top-left bg-white shadow-sm mx-auto"
        style={{
          width: targetWidth,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        <iframe
          srcDoc={srcDoc}
          sandbox="allow-scripts"
          title="Design Preview"
          className="w-full border-0"
          style={{ 
            width: targetWidth,
            height: scaledHeight,
            minHeight: '600px',
          }}
        />
      </div>
    </div>
  )
}