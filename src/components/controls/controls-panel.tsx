'use client'

import { useState, useEffect } from 'react'

import { useCanvasStore, REGION_COLORS } from '@/store/canvas-store'
import { useWorkflowStore } from '@/store/workflow-store'
import { useAI } from '@/hooks/use-ai'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Sparkles, Wand2, AlertCircle, Eye, EyeOff, Layers, Trash2, Square, Circle, PenTool, Navigation } from 'lucide-react'

// Helper to get shape icon
const getShapeIcon = (type: string, color: string) => {
  const props = { className: "h-4 w-4", style: { color } }
  switch (type) {
    case 'rectangle': return <Square {...props} />
    case 'circle': return <Circle {...props} />
    case 'freeform': return <PenTool {...props} />
    case 'arrow': return <Navigation {...props} />
    default: return <Square {...props} />
  }
}

export default function ControlsPanel() {
  const regions = useCanvasStore((s) => s.regions)
  const selectedRegionIds = useCanvasStore((s) => s.selectedRegionIds)
  const selectRegions = useCanvasStore((s) => s.selectRegions)
  const toggleRegionSelection = useCanvasStore((s) => s.toggleRegionSelection)
  const visibility = useCanvasStore((s) => s.visibility)
  const toggleVisibility = useCanvasStore((s) => s.toggleVisibility)
  const deleteRegions = useCanvasStore((s) => s.deleteRegions)

  const prompt = useWorkflowStore((s) => s.prompt)
  const setPrompt = useWorkflowStore((s) => s.setPrompt)
  const status = useWorkflowStore((s) => s.status)
  const errorMessage = useWorkflowStore((s) => s.error)
  const clearError = () => useWorkflowStore.getState().setError(null)
  
  const aiProvider = useWorkflowStore((s) => s.aiProvider)
  const setAiProvider = useWorkflowStore((s) => s.setAiProvider)
  const nvidiaModelId = useWorkflowStore((s) => s.nvidiaModelId)
  const setNvidiaModelId = useWorkflowStore((s) => s.setNvidiaModelId)

  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [isLoadingModels, setIsLoadingModels] = useState(false)

  // Fetch NVIDIA models dynamically
  useEffect(() => {
    if (aiProvider === 'nvidia' && availableModels.length === 0 && !isLoadingModels) {
      setIsLoadingModels(true)
      fetch('/api/models')
        .then(r => r.json())
        .then(data => {
          if (data.success && data.models) {
            setAvailableModels(data.models)
          }
        })
        .catch(console.error)
        .finally(() => setIsLoadingModels(false))
    }
  }, [aiProvider, availableModels.length, isLoadingModels])

  const { isAnalyzing, isGenerating, generateCode } = useAI()

  const isLoading = isAnalyzing || isGenerating
  const canGenerate = prompt.trim().length > 0 && !isLoading

  const handleGenerate = async () => {
    clearError()
    await generateCode()
  }

  return (
    <Card className="h-full flex flex-col glass-panel border-white/10 bg-card/40 backdrop-blur-md">
      <CardHeader className="pb-3 border-b border-white/5">
        <CardTitle className="text-lg flex items-center gap-2 font-display">
          <Wand2 className="h-5 w-5 text-primary" />
          Controls
        </CardTitle>
        <CardDescription>Layers & prompt</CardDescription>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col space-y-4 overflow-y-auto overflow-x-hidden pt-4 pb-6">
        {/* Layer Panel */}
        <div className="flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium flex items-center gap-1.5 text-foreground/90">
              <Layers className="h-4 w-4 text-primary/70" />
              Layers
            </h4>
            <Badge variant="secondary" className="text-xs bg-primary/20 text-primary border-0">
              {regions.length}
            </Badge>
          </div>

          {regions.length === 0 ? (
            <div className="border-2 border-dashed border-white/10 rounded-xl p-4 text-center text-muted-foreground text-sm bg-black/20">
              Draw shapes on the canvas to create layers.
              <br />
              <span className="text-xs mt-1 block opacity-70">Or just write a prompt!</span>
            </div>
          ) : (
            <div className="border border-white/10 rounded-xl overflow-hidden bg-black/20">
              <div className="max-h-40 overflow-y-auto">
                {/* Reverse to show top layer first (like Photoshop) */}
                {[...regions].reverse().map((region, reverseIndex) => {
                  const actualIndex = regions.length - 1 - reverseIndex
                  const isSelected = selectedRegionIds.includes(region.id)
                  const isVisible = visibility[region.id] !== false
                  const color = REGION_COLORS[actualIndex % REGION_COLORS.length]

                  return (
                    <div
                      key={region.id}
                      className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors border-b border-white/5 last:border-b-0 ${
                        isSelected
                          ? 'bg-primary/15'
                          : 'hover:bg-white/5'
                      } ${!isVisible ? 'opacity-50' : ''}`}
                      onClick={(e) => {
                        if (e.shiftKey) {
                          toggleRegionSelection(region.id)
                        } else {
                          selectRegions([region.id])
                        }
                      }}
                    >
                      {/* Shape icon */}
                      <div className="flex-shrink-0 flex items-center justify-center opacity-80 shadow-[0_0_8px_currentColor] rounded-full p-1 bg-black/20" style={{ color: color }}>
                        {getShapeIcon(region.geometry.type, color)}
                      </div>

                      {/* Layer name */}
                      <span className={`flex-1 text-sm truncate ${isSelected ? 'font-medium text-primary' : 'text-foreground/80'}`}>
                        Region {region.regionNumber}
                      </span>

                      {/* Visibility toggle */}
                      <button
                        className="p-1 hover:bg-white/10 rounded transition-colors"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleVisibility(region.id)
                        }}
                      >
                        {isVisible ? (
                          <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <EyeOff className="h-3.5 w-3.5 text-muted-foreground/50" />
                        )}
                      </button>

                      {/* Delete button (only show on hover/selected) */}
                      {isSelected && (
                        <button
                          className="p-1 hover:bg-destructive/20 rounded transition-colors"
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteRegions([region.id])
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
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
        {selectedRegionIds.length === 1 && (
          <div 
            className="flex-shrink-0 p-3 rounded-xl border border-white/10 bg-black/20"
          >
            <p className="font-medium text-sm text-primary">
              Region {regions.find(r => r.id === selectedRegionIds[0])?.regionNumber} selected
            </p>
            <p className="text-xs mt-1 text-muted-foreground">
              {regions.find(r => r.id === selectedRegionIds[0])?.geometry.type} · {Math.round(regions.find(r => r.id === selectedRegionIds[0])?.geometry.width || 0)}×
              {Math.round(regions.find(r => r.id === selectedRegionIds[0])?.geometry.height || 0)}px
            </p>
            <p className="text-xs mt-2 text-muted-foreground/70">
              Tip: Reference as &quot;Region {regions.find(r => r.id === selectedRegionIds[0])?.regionNumber}&quot; in your prompt
            </p>
          </div>
        )}
        {selectedRegionIds.length > 1 && (
          <div 
            className="flex-shrink-0 p-3 rounded-xl border border-white/10 bg-black/20"
          >
            <p className="font-medium text-sm text-primary">
              {selectedRegionIds.length} regions selected
            </p>
            <p className="text-xs mt-1 text-muted-foreground">
              Multiple shapes selected
            </p>
            <Button 
              variant="outline" 
              size="sm"
              className="mt-2 w-full text-xs h-7 border-destructive/30 hover:bg-destructive/10 hover:text-destructive text-destructive/80"
              onClick={() => deleteRegions(selectedRegionIds)}
            >
              <Trash2 className="h-3 w-3 mr-1.5" />
              Delete {selectedRegionIds.length} regions
            </Button>
          </div>
        )}

        {/* Error Message */}
        {errorMessage && (
          <div className="flex-shrink-0 p-3 bg-destructive/10 border border-destructive/30 rounded-xl flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-destructive-foreground text-sm">{errorMessage}</p>
              <button
                onClick={clearError}
                className="text-destructive/80 hover:text-destructive text-xs underline mt-1"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        <Separator className="bg-white/5" />

        {/* Prompt Input */}
        <div className="flex-1 flex flex-col min-h-0">
          <h4 className="text-sm font-medium mb-2 text-foreground/90">Prompt</h4>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
              regions.length > 0
                ? `Describe your design...\n\nExamples:\n• "Region 1 is a hero with gradient"\n• "Create a landing page with my layout"\n• "Region 2 has feature cards"`
                : `Describe your design...\n\nExamples:\n• "Create a SaaS landing page"\n• "Build a portfolio site"\n• "Design a signup form"`
            }
            className="flex-1 min-h-[100px] resize-none text-sm bg-black/20 border-white/10 focus:border-primary/50 focus:ring-primary/20 placeholder:text-muted-foreground/50"
            disabled={isLoading}
          />
        </div>

        {/* AI Provider Selection */}
        <div className="flex-shrink-0 pt-2">
          <Select value={aiProvider} onValueChange={(v) => setAiProvider(v as 'gemini' | 'groq' | 'nvidia')}>
            <SelectTrigger className="w-full bg-black/20 border-white/10 text-sm h-10">
              <SelectValue placeholder="Select AI Provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gemini">Gemini Pro (Google)</SelectItem>
              <SelectItem value="groq">Llama 3 (Groq)</SelectItem>
              <SelectItem value="nvidia">NIM Llama 3.1 (NVIDIA)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* NVIDIA Specific Model Selection */}
        {aiProvider === 'nvidia' && (
          <div className="flex-shrink-0 pt-2">
            <Select value={nvidiaModelId} onValueChange={setNvidiaModelId}>
              <SelectTrigger className="w-full bg-black/20 border-white/10 text-xs h-9">
                <SelectValue placeholder={isLoadingModels ? "Loading models..." : "Select NIM Model"} />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {availableModels.length === 0 ? (
                  <SelectItem value="meta/llama-3.1-70b-instruct">meta/llama-3.1-70b-instruct</SelectItem>
                ) : (
                  availableModels.map(model => (
                    <SelectItem key={model} value={model}>{model}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Generate Button */}
        <div className="flex-shrink-0 space-y-2 pt-2">
          <Button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className={`w-full h-12 rounded-xl transition-all duration-300 font-medium ${
              canGenerate 
                ? 'shadow-[0_0_20px_rgba(200,150,50,0.4)] hover:shadow-[0_0_35px_rgba(200,150,50,0.6)] hover-lift bg-primary text-primary-foreground' 
                : 'opacity-50'
            }`}
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
                <Sparkles className="mr-2 h-5 w-5" />
                Generate Design
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}