import { useCallback } from 'react'
import { useCanvasStore } from '@/store/canvas-store'
import { useWorkflowStore } from '@/store/workflow-store'
import { assembleProgressive } from '@/lib/ai/assemble'
import { assembleParts, replaceSection, SCENE_NAME, type PageParts, type SectionBlock } from '@/lib/ai/page-parts'
import type { DesignBrief } from '@/lib/ai/brief'

/**
 * Hook for AI operations: generate a page, and rebuild one of its sections.
 * Handles loading states, errors, and store updates.
 *
 * Note: shape geometry comes directly from the Konva canvas store
 * (exact, since the user drew it) — no separate vision "analyze" step.
 * The drawing image is sent along with generation so the AI can read
 * the visual character of decorative strokes.
 */
export function useAI() {
  // From the shared store, not local state: several components call useAI(),
  // and a local flag only knew about generations started through that same
  // component — the controls panel never saw one started from the prompt box,
  // so layers stayed editable mid-run.
  const isGenerating = useWorkflowStore((s) => s.status === 'generating')

  const regions = useCanvasStore((s) => s.regions)
  const groups = useCanvasStore((s) => s.groups)
  const exportToPng = useCanvasStore((s) => s.exportToPng)

  const globalTheme = useWorkflowStore((s) => s.globalTheme)
  const setStatus = useWorkflowStore((s) => s.setStatus)
  const setError = useWorkflowStore((s) => s.setError)
  const setPreviewCode = useWorkflowStore((s) => s.setPreviewCode)
  const setGenerationProgress = useWorkflowStore((s) => s.setGenerationProgress)
  const setBrief = useWorkflowStore((s) => s.setBrief)
  const setPageParts = useWorkflowStore((s) => s.setPageParts)
  const setRebuild = useWorkflowStore((s) => s.setRebuild)
  const aiProvider = useWorkflowStore((s) => s.aiProvider)
  const nvidiaModelId = useWorkflowStore((s) => s.nvidiaModelId)

  /**
   * Generates React TSX from regions and user prompt.
   */
  const generateCode = useCallback(async (): Promise<boolean> => {
    // Read at call time, not from this render's closure: the prompt composer
    // flushes its debounced draft into the store and calls this in the same
    // tick, so the closure's `prompt` would still be the previous text.
    const prompt = useWorkflowStore.getState().prompt
    if (!prompt.trim()) {
      setError('Please enter a prompt describing your design.')
      return false
    }

    setStatus('generating')
    setBrief(null)
    // The previous page's parts no longer describe what will be on screen.
    setPageParts(null)
    setRebuild(null)
    setGenerationProgress({
      label: regions.length > 0 ? 'Reading your drawing and prompt' : 'Understanding your idea',
      done: 0,
      total: 2,
    })

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

      // Stage 0 — understanding. What the user wants, what the drawing depicts,
      // and what will make this site unlike a template. Shown to the user as
      // soon as it lands, so the rest of the wait has a visible purpose.
      const understandRes = await fetch('/api/generate/understand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...shared, imageData }),
      })
      const understood = await understandRes.json()
      if (!understood.success) {
        setError(understood.error || 'Could not read the request. Please try again.')
        return false
      }
      const brief = understood.data.brief as DesignBrief
      setBrief(brief)
      setGenerationProgress({ label: 'Designing the page structure', done: 1, total: 2 })

      // Stage 1 — the shell. Short enough to survive a serverless timeout, and
      // it tells us what sections still need building.
      const shellRes = await fetch('/api/generate/shell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...shared, imageData, brief }),
      })
      const shellResult = await shellRes.json()

      if (!shellResult.success) {
        setError(shellResult.error || 'Generation failed. Please try again.')
        return false
      }

      const { shellCode, sceneCode, batches, tokenId, regions: classifiedRegions, prompt: resolvedPrompt } =
        shellResult.data as {
          shellCode: string
          sceneCode: string | null
          sections: string[]
          batches: string[][]
          tokenId: string
          regions: typeof regions
          prompt: string
        }

      const totalStages = 2 + batches.length
      let pending = batches.flat()
      // The drawing, rendered in code, goes in first: assembly keeps the first
      // definition of a name, so no section can replace the user's picture.
      const completed: string[] = sceneCode ? [sceneCode] : []

      // Show the page immediately, with unbuilt sections as placeholders, so the
      // wait is visibly productive rather than a blank screen.
      const firstPass = assembleProgressive(shellCode, completed, pending)
      if (firstPass.code) setPreviewCode(firstPass.code)
      setGenerationProgress({ label: 'Building sections', done: 2, total: totalStages })

      const failed: string[] = []
      // Kept so a single section can be rebuilt later without a full run.
      const blocks: SectionBlock[] = []

      // Serial on purpose: a burst of parallel calls is what trips free-tier
      // rate limits, and spacing them lets per-minute quota recover.
      for (let i = 0; i < batches.length; i++) {
        const sectionNames = batches[i]
        setGenerationProgress({
          label: `Building ${sectionNames.join(' & ')}`,
          done: 2 + i,
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
              brief,
            }),
          })
          const sectionResult = await sectionRes.json()

          if (sectionResult.success && sectionResult.data?.code) {
            completed.push(sectionResult.data.code)
            blocks.push({ sections: sectionNames, code: sectionResult.data.code })
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

      const parts: PageParts = {
        shellCode,
        sceneCode: sceneCode ?? null,
        tokenId,
        brief,
        regions: classifiedRegions ?? regions,
        groups,
        prompt: resolvedPrompt ?? shared.prompt,
        sections: batches.flat().filter(name => name !== SCENE_NAME),
        blocks,
        failed,
      }
      // Assembled from the parts themselves, so the saved page and the saved
      // parts always agree — that is what lets a reload restore them.
      const finalPass = assembleParts(parts)
      if (finalPass.code) {
        setPageParts(parts)
        setPreviewCode(finalPass.code)
      }

      setStatus('preview_ready')

      // A partial page still renders; say which pieces didn't make it rather
      // than throwing away everything that did.
      if (failed.length > 0) {
        setError(`Generated, but these sections failed and are placeholders: ${failed.join(', ')}. Rebuild them from the Sections list.`)
      }
      return true
    } catch (error) {
      console.error('[useAI] Generation error:', error)
      setError('Network error. Please check your connection and try again.')
      return false
    } finally {
      // Every exit leaves "generating" — an early return without an error
      // would otherwise lock the UI in a run that already ended.
      if (useWorkflowStore.getState().status === 'generating') setStatus('idle')
      setGenerationProgress(null)
    }
  }, [regions, groups, globalTheme, aiProvider, nvidiaModelId, exportToPng, setStatus, setError, setPreviewCode, setGenerationProgress, setBrief, setPageParts, setRebuild])

  /**
   * Rebuilds ONE section of the last generated page — a single model call
   * instead of a full run. The rest of the page, and the user's drawing, stay
   * exactly as they are; on failure the old section is kept.
   */
  const rebuildSection = useCallback(async (name: string, note?: string): Promise<boolean> => {
    const { pageParts: parts, rebuildingSection, status } = useWorkflowStore.getState()
    if (!parts || rebuildingSection || status === 'generating') return false

    setRebuild(name, null)
    try {
      const res = await fetch('/api/generate/section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          regions: parts.regions,
          groups: parts.groups,
          prompt: parts.prompt,
          globalTheme: globalTheme.trim() || undefined,
          provider: aiProvider,
          nvidiaModelId,
          sectionNames: [name],
          shellCode: parts.shellCode,
          tokenId: parts.tokenId,
          brief: parts.brief ?? undefined,
          note: note?.trim() || undefined,
        }),
      })
      const result = await res.json().catch(() => null)
      if (!result?.success || !result.data?.code) {
        setRebuild(null, { section: name, message: result?.error || `Could not rebuild ${name}. The old version is kept.` })
        return false
      }

      // Re-read: the parts are only swapped if they are still the ones shown.
      const current = useWorkflowStore.getState().pageParts
      if (current !== parts) {
        setRebuild(null)
        return false
      }
      const next = replaceSection(parts, name, result.data.code)
      const assembled = assembleParts(next)
      if (!assembled.code) {
        setRebuild(null, { section: name, message: assembled.error ?? `Could not assemble ${name}.` })
        return false
      }
      setPageParts(next)
      setPreviewCode(assembled.code)
      setRebuild(null)
      // The "these sections failed" banner is stale once none are left failing.
      if (next.failed.length === 0 && useWorkflowStore.getState().error?.startsWith('Generated, but')) setError(null)
      return true
    } catch (error) {
      console.error('[useAI] Section rebuild error:', error)
      setRebuild(null, { section: name, message: 'Network error — the old version is kept.' })
      return false
    }
  }, [globalTheme, aiProvider, nvidiaModelId, setRebuild, setPageParts, setPreviewCode, setError])

  return {
    isGenerating,
    generateCode,
    rebuildSection,
  }
}
