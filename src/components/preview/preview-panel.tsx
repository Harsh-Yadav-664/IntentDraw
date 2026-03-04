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

    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>IntentDraw Export</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
${previewCode}
</body>
</html>`

    const blob = new Blob([fullHtml], { type: 'text/html' })
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
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Preview
            </CardTitle>
            <CardDescription>Your generated design</CardDescription>
          </div>

          {previewCode && (
            <div className="flex items-center gap-2">
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
                <TabsList className="h-8">
                  <TabsTrigger value="preview" className="text-xs px-2 h-6">
                    <Eye className="h-3 w-3 mr-1" />
                    Preview
                  </TabsTrigger>
                  <TabsTrigger value="code" className="text-xs px-2 h-6">
                    <Code className="h-3 w-3 mr-1" />
                    Code
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={handleOpenFullscreen}
                title="Open in new tab"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>

        {previewCode && viewMode === 'preview' && (
          <div className="flex items-center gap-1 mt-2">
            <Button
              variant={deviceSize === 'desktop' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setDeviceSize('desktop')}
            >
              <Monitor className="h-3.5 w-3.5 mr-1" />
              1280px
            </Button>
            <Button
              variant={deviceSize === 'tablet' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setDeviceSize('tablet')}
            >
              <Tablet className="h-3.5 w-3.5 mr-1" />
              768px
            </Button>
            <Button
              variant={deviceSize === 'mobile' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setDeviceSize('mobile')}
            >
              <Smartphone className="h-3.5 w-3.5 mr-1" />
              375px
            </Button>
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 flex flex-col min-h-0 pb-3">
        <div className="flex-1 border rounded-lg overflow-hidden bg-slate-100">
          {viewMode === 'preview' ? (
            <PreviewFrame 
              code={previewCode} 
              deviceSize={deviceSize}
              className="h-full w-full" 
            />
          ) : (
            <div className="w-full h-full overflow-auto">
              <pre className="p-4 text-xs text-slate-800 whitespace-pre-wrap font-mono bg-slate-50 min-h-full">
                {previewCode || 'No code generated yet.'}
              </pre>
            </div>
          )}
        </div>

        {previewCode && (
          <div className="flex gap-2 mt-3 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={handleCopyCode}
            >
              {copied ? (
                <>
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  Copy
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={handleDownload}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Download
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}