import { useState, useCallback } from 'react'
import { useCanvasStore } from '@/store/canvas-store'
import { useWorkflowStore } from '@/store/workflow-store'
import { assembleProgressive } from '@/lib/ai/assemble'

/**
 * Hook for AI operations: generate code and regenerate regions.
 * Handles loading states, errors, and store updates.
 *
 * Note: shape geometry comes directly from the Konva canvas store
 * (exact, since the user drew it) — no separate vision "analyze" step.
 * The drawing image is sent along with generation so the AI can read
 * the visual character of decorative strokes.
 */
export function useAI() {
  const [isGenerating, setIsGenerating] = useState(false)

  const regions = useCanvasStore((s) => s.regions)
  const groups = useCanvasStore((s) => s.groups)
  const exportToPng = useCanvasStore((s) => s.exportToPng)

  const prompt = useWorkflowStore((s) => s.prompt)
  const globalTheme = useWorkflowStore((s) => s.globalTheme)
  const setStatus = useWorkflowStore((s) => s.setStatus)
  const setError = useWorkflowStore((s) => s.setError)
  const setPreviewCode = useWorkflowStore((s) => s.setPreviewCode)
  const setGenerationProgress = useWorkflowStore((s) => s.setGenerationProgress)
  const aiProvider = useWorkflowStore((s) => s.aiProvider)
  const nvidiaModelId = useWorkflowStore((s) => s.nvidiaModelId)

  /**
   * Generates React TSX from regions and user prompt.
   */
  const generateCode = useCallback(async (): Promise<boolean> => {
    if (!prompt.trim()) {
      setError('Please enter a prompt describing your design.')
      return false
    }

    setIsGenerating(true)
    setStatus('generating')
    setGenerationProgress({ label: 'Designing the page structure', done: 0, total: 1 })

    try {
      // Only capture/send the canvas image when something was drawn
      const imageData = regions.length > 0 ? exportToPng() : null
      const shared = {
        regions,
        groups,
        prompt: prompt.trim(),
        globalTheme: globalTheme.trim() || undefined,
        provider: aiProvider,
        nvidiaModelId,
      }

      // Stage 1 — the shell. Short enough to survive a serverless timeout, and
      // it tells us what sections still need building.
      const shellRes = await fetch('/api/generate/shell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...shared, imageData }),
      })
      const shellResult = await shellRes.json()

      if (!shellResult.success) {
        setError(shellResult.error || 'Generation failed. Please try again.')
        return false
      }

      const { shellCode, batches, tokenId, regions: classifiedRegions, prompt: resolvedPrompt } =
        shellResult.data as {
          shellCode: string
          sections: string[]
          batches: string[][]
          tokenId: string
          regions: typeof regions
          prompt: string
        }

      const totalStages = 1 + batches.length
      let pending = batches.flat()
      const completed: string[] = []

      // Show the page immediately, with unbuilt sections as placeholders, so the
      // wait is visibly productive rather than a blank screen.
      const firstPass = assembleProgressive(shellCode, completed, pending)
      if (firstPass.code) setPreviewCode(firstPass.code)
      setGenerationProgress({ label: 'Building sections', done: 1, total: totalStages })

      const failed: string[] = []

      // Serial on purpose: a burst of parallel calls is what trips free-tier
      // rate limits, and spacing them lets per-minute quota recover.
      for (let i = 0; i < batches.length; i++) {
        const sectionNames = batches[i]
        setGenerationProgress({
          label: `Building ${sectionNames.join(' & ')}`,
          done: 1 + i,
          total: totalStages,
        })

        try {
          const sectionRes = await fetch('/api/generate/section', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...shared,
              regions: classifiedRegions ?? regions,
              prompt: resolvedPrompt ?? shared.prompt,
              sectionNames,
              shellCode,
              tokenId,
            }),
          })
          const sectionResult = await sectionRes.json()

          if (sectionResult.success && sectionResult.data?.code) {
            completed.push(sectionResult.data.code)
            pending = pending.filter(name => !sectionNames.includes(name))
          } else {
            failed.push(...sectionNames)
          }
        } catch {
          failed.push(...sectionNames)
        }

        // Repaint after every batch — this is the progressive fill.
        const pass = assembleProgressive(shellCode, completed, pending)
        if (pass.code) setPreviewCode(pass.code)
      }

      setStatus('preview_ready')

      // A partial page still renders; say which pieces didn't make it rather
      // than throwing away everything that did.
      if (failed.length > 0) {
        setError(`Generated, but these sections failed and are placeholders: ${failed.join(', ')}. Try regenerating.`)
      }
      return true
    } catch (error) {
      console.error('[useAI] Generation error:', error)
      setError('Network error. Please check your connection and try again.')
      return false
    } finally {
      setIsGenerating(false)
      setGenerationProgress(null)
    }
  }, [regions, groups, prompt, globalTheme, aiProvider, nvidiaModelId, exportToPng, setStatus, setError, setPreviewCode, setGenerationProgress])

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
          provider: aiProvider,
          nvidiaModelId,
        }),
      })

      const result = await response.json()

      if (!result.success) {
        setError(result.error || 'Regeneration failed. Please try again.')
        return false
      }

      setPreviewCode(result.data.code)
      return true
    } catch (error) {
      console.error('[useAI] Regeneration error:', error)
      setError('Network error. Please check your connection and try again.')
      return false
    } finally {
      setIsGenerating(false)
    }
  }, [regions, aiProvider, nvidiaModelId, setStatus, setError, setPreviewCode])

  return {
    isGenerating,
    generateCode,
    regenerateRegion,
  }
}
