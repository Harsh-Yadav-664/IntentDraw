'use client'

import { useCanvasStore, REGION_COLORS } from '@/store/canvas-store'
import { useWorkflowStore } from '@/store/workflow-store'
import { useAI } from '@/hooks/use-ai'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Loader2, Sparkles, Wand2, AlertCircle, Eye, EyeOff, Layers, Trash2 } from 'lucide-react'

export default function ControlsPanel() {
  const regions = useCanvasStore((s) => s.regions)
  const selectedRegionId = useCanvasStore((s) => s.selectedRegionId)
  const selectRegion = useCanvasStore((s) => s.selectRegion)
  const visibility = useCanvasStore((s) => s.visibility)
  const toggleVisibility = useCanvasStore((s) => s.toggleVisibility)
  const deleteRegion = useCanvasStore((s) => s.deleteRegion)

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
        <CardDescription>Layers & prompt</CardDescription>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col space-y-4 overflow-hidden">
        {/* Layer Panel */}
        <div className="flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium flex items-center gap-1.5">
              <Layers className="h-4 w-4" />
              Layers
            </h4>
            <Badge variant="secondary" className="text-xs">
              {regions.length}
            </Badge>
          </div>

          {regions.length === 0 ? (
            <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center text-slate-400 text-sm">
              Draw shapes on the canvas to create layers.
              <br />
              <span className="text-xs mt-1 block">Or just write a prompt!</span>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden bg-slate-50">
              <div className="max-h-40 overflow-y-auto">
                {/* Reverse to show top layer first (like Photoshop) */}
                {[...regions].reverse().map((region, reverseIndex) => {
                  const actualIndex = regions.length - 1 - reverseIndex
                  const isSelected = region.id === selectedRegionId
                  const isVisible = visibility[region.id] !== false
                  const color = REGION_COLORS[actualIndex % REGION_COLORS.length]

                  return (
                    <div
                      key={region.id}
                      className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors border-b border-slate-200 last:border-b-0 ${
                        isSelected
                          ? 'bg-blue-50'
                          : 'hover:bg-white'
                      } ${!isVisible ? 'opacity-50' : ''}`}
                      onClick={() => selectRegion(isSelected ? null : region.id)}
                    >
                      {/* Color dot */}
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: color }}
                      />

                      {/* Layer name */}
                      <span className={`flex-1 text-sm truncate ${isSelected ? 'font-medium text-blue-900' : 'text-slate-700'}`}>
                        Region {region.regionNumber}
                      </span>

                      {/* Shape type badge */}
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 capitalize">
                        {region.geometry.type}
                      </Badge>

                      {/* Visibility toggle */}
                      <button
                        className="p-1 hover:bg-slate-200 rounded transition-colors"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleVisibility(region.id)
                        }}
                      >
                        {isVisible ? (
                          <Eye className="h-3.5 w-3.5 text-slate-500" />
                        ) : (
                          <EyeOff className="h-3.5 w-3.5 text-slate-400" />
                        )}
                      </button>

                      {/* Delete button (only show on hover/selected) */}
                      {isSelected && (
                        <button
                          className="p-1 hover:bg-red-100 rounded transition-colors"
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteRegion(region.id)
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Selected Region Info */}
        {selectedRegion && (
          <div 
            className="flex-shrink-0 p-3 rounded-lg border"
            style={{ 
              backgroundColor: `${REGION_COLORS[regions.findIndex(r => r.id === selectedRegion.id) % REGION_COLORS.length]}10`,
              borderColor: `${REGION_COLORS[regions.findIndex(r => r.id === selectedRegion.id) % REGION_COLORS.length]}40`
            }}
          >
            <p className="font-medium text-sm">
              Region {selectedRegion.regionNumber} selected
            </p>
            <p className="text-xs mt-1 text-slate-600">
              {selectedRegion.geometry.type} · {Math.round(selectedRegion.geometry.width)}×
              {Math.round(selectedRegion.geometry.height)}px
            </p>
            <p className="text-xs mt-2 text-slate-500">
              Tip: Reference as &quot;Region {selectedRegion.regionNumber}&quot; in your prompt
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

        <Separator />

        {/* Prompt Input */}
        <div className="flex-1 flex flex-col min-h-0">
          <h4 className="text-sm font-medium mb-2">Prompt</h4>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
              regions.length > 0
                ? `Describe your design...\n\nExamples:\n• "Region 1 is a hero with gradient"\n• "Create a landing page with my layout"\n• "Region 2 has feature cards"`
                : `Describe your design...\n\nExamples:\n• "Create a SaaS landing page"\n• "Build a portfolio site"\n• "Design a signup form"`
            }
            className="flex-1 min-h-[100px] resize-none text-sm"
            disabled={isLoading}
          />
        </div>

        {/* Generate Button */}
        <div className="flex-shrink-0 space-y-2">
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