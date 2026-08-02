'use client'

import { useState } from 'react'
import { useWorkflowStore } from '@/store/workflow-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import PreviewFrame from './preview-frame'
import { 
  Monitor, 
  Tablet, 
  Smartphone, 
  Copy, 
  Download,
  Code,
  Eye,
  Check,
  Maximize2
} from 'lucide-react'

type ViewMode = 'preview' | 'code'
type DeviceSize = 'desktop' | 'tablet' | 'mobile'

export default function PreviewPanel() {
  const previewCode = useWorkflowStore((s) => s.previewCode)
  const [viewMode, setViewMode] = useState<ViewMode>('preview')
  const [deviceSize, setDeviceSize] = useState<DeviceSize>('desktop')
  const [copied, setCopied] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const handleCopyCode = async () => {
    if (!previewCode) return

    try {
      await navigator.clipboard.writeText(previewCode)
      setCopied(true)
      toast.success('Code copied to clipboard!')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy code')
    }
  }

  const handleDownload = () => {
  if (!previewCode) return

  // The previewCode is now a complete HTML document
  // Just ensure it's sanitized
  const sanitized = previewCode.trim()
  
  // Check if it's already a complete document
  const isComplete = sanitized.toLowerCase().startsWith('<!doctype') || 
                     sanitized.toLowerCase().startsWith('<html')

  let finalHtml: string

  if (isComplete) {
    // Already complete, just use as-is
    finalHtml = sanitized
  } else {
    // Wrap fragment (fallback)
    finalHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>IntentDraw Export</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
${sanitized}
</body>
</html>`
  }

  const blob = new Blob([finalHtml], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'intentdraw-export.html'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  toast.success('HTML file downloaded!')
}

  const handleOpenFullscreen = () => {
    if (!previewCode) return
    
    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview - IntentDraw</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
${previewCode}
</body>
</html>`

    const blob = new Blob([fullHtml], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
  }

  return (
    <div className="w-full h-full flex flex-col rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-[#1e1e1e] ring-1 ring-black/50">
      
      {/* Browser Title Bar */}
      <div className="h-12 bg-black/40 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-4 flex-shrink-0">
        
        {/* Left spacing to balance the layout */}
        <div className="w-32"></div>

        {/* Center: Device Toggles (if preview code exists) */}
        <div className="flex items-center justify-center flex-1">
          {previewCode && viewMode === 'preview' && (
            <div className="flex items-center gap-1 bg-black/20 p-1 rounded-md border border-white/5">
              <Button
                variant={deviceSize === 'desktop' ? 'default' : 'ghost'}
                size="sm"
                className={`h-6 px-3 text-xs rounded ${deviceSize === 'desktop' ? 'bg-white/10 text-white' : 'text-muted-foreground hover:text-white hover:bg-white/5'}`}
                onClick={() => setDeviceSize('desktop')}
              >
                <Monitor className="h-3 w-3 mr-1.5" />
                Desktop
              </Button>
              <Button
                variant={deviceSize === 'tablet' ? 'default' : 'ghost'}
                size="sm"
                className={`h-6 px-3 text-xs rounded ${deviceSize === 'tablet' ? 'bg-white/10 text-white' : 'text-muted-foreground hover:text-white hover:bg-white/5'}`}
                onClick={() => setDeviceSize('tablet')}
              >
                <Tablet className="h-3 w-3 mr-1.5" />
                Tablet
              </Button>
              <Button
                variant={deviceSize === 'mobile' ? 'default' : 'ghost'}
                size="sm"
                className={`h-6 px-3 text-xs rounded ${deviceSize === 'mobile' ? 'bg-white/10 text-white' : 'text-muted-foreground hover:text-white hover:bg-white/5'}`}
                onClick={() => setDeviceSize('mobile')}
              >
                <Smartphone className="h-3 w-3 mr-1.5" />
                Mobile
              </Button>
            </div>
          )}
          {!previewCode && (
             <span className="text-xs text-muted-foreground font-medium">Output Preview</span>
          )}
        </div>

        {/* Right: View Toggles & Actions */}
        <div className="flex items-center justify-end gap-2 w-32">
          {previewCode && (
            <>
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
                <TabsList className="h-7 bg-black/20 border border-white/5">
                  <TabsTrigger value="preview" className="text-[10px] px-2 h-5 data-[state=active]:bg-white/10 data-[state=active]:text-white">
                    <Eye className="h-3 w-3" />
                  </TabsTrigger>
                  <TabsTrigger value="code" className="text-[10px] px-2 h-5 data-[state=active]:bg-white/10 data-[state=active]:text-white">
                    <Code className="h-3 w-3" />
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-md hover:bg-white/10 text-muted-foreground hover:text-white"
                onClick={handleOpenFullscreen}
                title="Open in new tab"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Browser Content Area */}
      <div className="flex-1 min-h-0 bg-white relative">
        {!previewCode ? (
           <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#121214]">
              <div className="h-16 w-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 shadow-xl">
                 <Eye className="h-8 w-8 text-primary/50" />
              </div>
              <p className="text-sm text-muted-foreground font-medium">No output generated yet.</p>
           </div>
        ) : viewMode === 'preview' ? (
          <PreviewFrame 
            code={previewCode} 
            deviceSize={deviceSize}
            className="h-full w-full" 
          />
        ) : (
          <div className="w-full h-full overflow-auto bg-[#1e1e1e]">
            <div className="sticky top-0 right-0 p-2 flex justify-end bg-gradient-to-b from-[#1e1e1e] to-transparent">
              <Button
                variant="outline"
                size="sm"
                className="h-8 bg-black/40 border-white/10 text-xs hover:bg-white/10 hover:text-white"
                onClick={handleCopyCode}
              >
                {copied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy Code'}
              </Button>
            </div>
            <pre className="p-4 pt-0 text-sm text-gray-300 whitespace-pre-wrap font-mono min-h-full">
              {previewCode}
            </pre>
          </div>
        )}
      </div>

    </div>
  )
}