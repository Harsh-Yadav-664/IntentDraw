import { useState, useCallback } from 'react'
import { useCanvasStore } from '@/store/canvas-store'
import { useWorkflowStore } from '@/store/workflow-store'
import type { Region, AnalysisResponse } from '@/types'

/**
 * Hook for AI operations: analyze drawing and generate code.
 * Handles loading states, errors, and store updates.
 */
export function useAI() {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  const regions = useCanvasStore((s) => s.regions)
  const exportToPng = useCanvasStore((s) => s.exportToPng)
  
  const prompt = useWorkflowStore((s) => s.prompt)
  const globalTheme = useWorkflowStore((s) => s.globalTheme)
  const setStatus = useWorkflowStore((s) => s.setStatus)
  const setError = useWorkflowStore((s) => s.setError)
  const setPreviewCode = useWorkflowStore((s) => s.setPreviewCode)

  /**
   * Analyzes the canvas drawing using Gemini Vision.
   * Returns detected regions from AI, or falls back to local region data.
   */
  const analyzeDrawing = useCallback(async (): Promise<AnalysisResponse['regions'] | null> => {
    setIsAnalyzing(true)
    setStatus('analyzing')

    try {
      const imageData = exportToPng()
      
      if (!imageData) {
        // No canvas data — use local regions directly
        console.log('[useAI] No canvas image, using local regions')
        setStatus('regions_ready')
        return null
      }

      const response = await fetch('/api/analyze-drawing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData }),
      })

      const result = await response.json()

      if (!result.success) {
        // AI analysis failed — fall back to local regions
        console.warn('[useAI] Vision analysis failed, using local regions:', result.error)
        setStatus('regions_ready')
        return null
      }

      setStatus('regions_ready')
      return result.data?.regions || null
    } catch (error) {
      console.error('[useAI] Analysis error:', error)
      // Don't show error to user — just use local regions
      setStatus('regions_ready')
      return null
    } finally {
      setIsAnalyzing(false)
    }
  }, [exportToPng, setStatus])

  /**
   * Generates HTML/CSS from regions and user prompt.
   */
  const generateCode = useCallback(async (): Promise<boolean> => {
    if (!prompt.trim()) {
      setError('Please enter a prompt describing your design.')
      return false
    }

    setIsGenerating(true)
    setStatus('generating')

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          regions,
          prompt: prompt.trim(),
          globalTheme: globalTheme.trim() || undefined,
        }),
      })

      const result = await response.json()

      if (!result.success) {
        setError(result.error || 'Generation failed. Please try again.')
        return false
      }

      setPreviewCode(result.data.code, result.data.provider)
      return true
    } catch (error) {
      console.error('[useAI] Generation error:', error)
      setError('Network error. Please check your connection and try again.')
      return false
    } finally {
      setIsGenerating(false)
    }
  }, [regions, prompt, globalTheme, setStatus, setError, setPreviewCode])

  /**
   * Regenerates a single region while keeping others intact.
   */
  const regenerateRegion = useCallback(async (
    regionNumber: number,
    regionPrompt: string,
    existingCode: string
  ): Promise<boolean> => {
    if (!regionPrompt.trim()) {
      setError('Please enter a prompt for this region.')
      return false
    }

    setIsGenerating(true)
    setStatus('generating')

    try {
      const response = await fetch('/api/regenerate-region', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          regionNumber,
          prompt: regionPrompt.trim(),
          existingCode,
          regions,
        }),
      })

      const result = await response.json()

      if (!result.success) {
        setError(result.error || 'Regeneration failed. Please try again.')
        return false
      }

      setPreviewCode(result.data.code, result.data.provider)
      return true
    } catch (error) {
      console.error('[useAI] Regeneration error:', error)
      setError('Network error. Please check your connection and try again.')
      return false
    } finally {
      setIsGenerating(false)
    }
  }, [regions, setStatus, setError, setPreviewCode])

  return {
    isAnalyzing,
    isGenerating,
    analyzeDrawing,
    generateCode,
    regenerateRegion,
  }
}