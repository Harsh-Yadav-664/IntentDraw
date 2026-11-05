'use client'

import { useMemo, useRef, useState, useEffect } from 'react'
import { wrapReactForPreview } from '@/lib/utils/sanitize'

interface PreviewFrameProps {
  code: string | null
  deviceSize?: 'desktop' | 'tablet' | 'mobile'
  className?: string
  /** Edit mode (lib/edit/frame-edit.ts): click words to change them, pictures to replace them. */
  editing?: boolean
  /** Every EDIT_* message from THIS frame (never another one). Untrusted: validate it. */
  onEditMessage?: (data: Record<string, unknown>) => void
  /** Changing this reloads the page in place (keeping the edit-mode scroll position). */
  reloadKey?: number
}

export const DEVICE_WIDTHS = {
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

export default function PreviewFrame({ code, deviceSize = 'desktop', className = '', editing = false, onEditMessage, reloadKey = 0 }: PreviewFrameProps) {
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

  // Edit mode lives in the frame; it is told on every load (an edit reloads the
  // page) and on every toggle. The scroll position is carried across reloads so
  // the user stays where they were editing.
  const editingRef = useRef(editing)
  const scrollRef = useRef(0)
  const onEditRef = useRef(onEditMessage)
  useEffect(() => {
    onEditRef.current = onEditMessage
  }, [onEditMessage])
  useEffect(() => {
    editingRef.current = editing
    frameRef.current?.contentWindow?.postMessage({ type: 'EDIT_MODE', on: editing }, '*')
  }, [editing])
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!frameRef.current || e.source !== frameRef.current.contentWindow) return
      const data = e.data as Record<string, unknown> | null
      if (!data || typeof data.type !== 'string') return
      if (data.type === 'IFRAME_HEIGHT') {
        // Loaded. Only an edit session restores the scroll position.
        if (editingRef.current) frameRef.current.contentWindow?.postMessage({ type: 'EDIT_MODE', on: true, scrollY: scrollRef.current }, '*')
        return
      }
      if (data.type === 'EDIT_SCROLL') {
        if (typeof data.y === 'number' && Number.isFinite(data.y)) scrollRef.current = Math.max(0, Math.min(data.y, 200000))
        return
      }
      if (data.type.startsWith('EDIT_')) onEditRef.current?.(data)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  const srcDoc = useMemo(() => {
    if (!code) return null
    return wrapReactForPreview(code)
  }, [code])

  // Setting srcdoc again — even to the same page — runs it afresh.
  useEffect(() => {
    if (reloadKey > 0 && srcDoc) frameRef.current?.setAttribute('srcdoc', srcDoc)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a new key reloads
  }, [reloadKey])

  if (!srcDoc) {
    return (
      <div className={`flex items-center justify-center text-faint ${className}`}>
        <p className="p-4 text-[12px]">Generate a site to see it here.</p>
      </div>
    )
  }

  return (
    <div 
      ref={containerRef} 
      className={`overflow-auto flex justify-center py-4 ${className}`}
    >
      {/* Wrapper element that matches the exact scaled size of the iframe */}
      <div style={{ width: targetWidth * scale, height: frameHeight * scale }}>
        <div
          className="bg-white shadow-plate ring-1 ring-line"
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