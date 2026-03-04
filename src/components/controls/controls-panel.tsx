'use client'

import { useCanvasStore } from '@/store/canvas-store'
import { useWorkflowStore } from '@/store/workflow-store'
import { useAI } from '@/hooks/use-ai'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Sparkles, Wand2, AlertCircle } from 'lucide-react'

export default function ControlsPanel() {
  const regions = useCanvasStore((s) => s.regions)
  const selectedRegionId = useCanvasStore((s) => s.selectedRegionId)
  const selectRegion = useCanvasStore((s) => s.selectRegion)

  const prompt = useWorkflowStore((s) => s.prompt)
  const setPrompt = useWorkflowStore((s) => s.setPrompt)
  const status = useWorkflowStore((s) => s.status)
  const errorMessage = useWorkflowStore((s) => s.errorMessage)
  const clearError = useWorkflowStore((s) => s.clearError)
  const lastProvider = useWorkflowStore((s) => s.lastProvider)

  const { isAnalyzing, isGenerating, generateCode } = useAI()

  const selectedRegion = regions.find((r) => r.id === selectedRegionId)
  const isLoading = isAnalyzing || isGenerating
  const canGenerate = prompt.trim().length > 0 && !isLoading

  const handleGenerate = async () => {
    clearError()
    await generateCode()
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Wand2 className="h-5 w-5" />
          Controls
        </CardTitle>
        <CardDescription>Describe your design</CardDescription>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col space-y-4 overflow-hidden">
        {/* Region List */}
        <div className="flex-shrink-0">
          <h4 className="text-sm font-medium mb-2 flex items-center justify-between">
            <span>Regions</span>
            <Badge variant="secondary" className="text-xs">
              {regions.length}
            </Badge>
          </h4>

          {regions.length === 0 ? (
            <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center text-slate-400 text-sm">
              Draw shapes on the canvas to define regions.
              <br />
              <span className="text-xs mt-1 block">Or just write a prompt — regions are optional!</span>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
              {regions.map((r) => (
                <div
                  key={r.id}
                  onClick={() => selectRegion(r.id === selectedRegionId ? null : r.id)}
                  className={`p-2 rounded-lg border text-sm cursor-pointer transition-all ${
                    r.id === selectedRegionId
                      ? 'border-blue-500 bg-blue-50 text-blue-900 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Region {r.regionNumber}</span>
                    <Badge variant="outline" className="text-xs capitalize">
                      {r.geometry.type}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected Region Info */}
        {selectedRegion && (
          <div className="flex-shrink-0 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="font-medium text-blue-900 text-sm">
              Region {selectedRegion.regionNumber} selected
            </p>
            <p className="text-blue-700 text-xs mt-1">
              {selectedRegion.geometry.type} · {Math.round(selectedRegion.geometry.width)}×
              {Math.round(selectedRegion.geometry.height)}px
            </p>
            <p className="text-blue-600 text-xs mt-2">
              Tip: Reference this region in your prompt, e.g., &quot;Region {selectedRegion.regionNumber} is a hero section&quot;
            </p>
          </div>
        )}

        {/* Error Message */}
        {errorMessage && (
          <div className="flex-shrink-0 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-800 text-sm">{errorMessage}</p>
              <button
                onClick={clearError}
                className="text-red-600 text-xs underline mt-1"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Prompt Input */}
        <div className="flex-1 flex flex-col min-h-0">
          <h4 className="text-sm font-medium mb-2">Prompt</h4>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
              regions.length > 0
                ? `Describe your design...\n\nExamples:\n• "Region 1 is a hero with a gradient flowing in the arrow direction"\n• "Create a landing page with the layout I drew"\n• "Region 2 should have feature cards with icons"`
                : `Describe your design...\n\nExamples:\n• "Create a SaaS landing page with hero, features, and pricing"\n• "Build a portfolio site with a minimal dark theme"\n• "Design a signup form with social login buttons"`
            }
            className="flex-1 min-h-[120px] resize-none text-sm"
            disabled={isLoading}
          />
        </div>

        {/* Generate Button */}
        <div className="flex-shrink-0 space-y-3">
          <Button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="w-full h-11"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : isAnalyzing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Design
              </>
            )}
          </Button>

          {/* Status indicator */}
          {lastProvider && status === 'preview_ready' && (
            <p className="text-xs text-center text-slate-500">
              Generated with {lastProvider === 'gemini' ? 'Gemini' : 'Groq'}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}