import { useCallback } from 'react'
import { useCanvasStore } from '@/store/canvas-store'
import { useWorkflowStore, type PlannedSection } from '@/store/workflow-store'
import { assembleProgressive } from '@/lib/ai/assemble'
import { assembleParts, cleanMeta, replaceSection, SCENE_NAME, type PageParts, type SectionBlock } from '@/lib/ai/page-parts'
import type { DesignBrief } from '@/lib/ai/brief'

/**
 * Hook for AI operations: generate a page, stop a generation, and rebuild one
 * of its sections. Handles loading states, errors, and store updates.
 *
 * Note: shape geometry comes directly from the canvas store (exact, since the
 * user drew it) — no separate vision "analyze" step. The drawing image is sent
 * along with generation so the AI can read the visual character of strokes.
 */

// One run at a time across every component that calls useAI(). Stopping it
// aborts the request in flight; sections already built are kept.
let activeRun: AbortController | null = null

const isAbort = (error: unknown) => error instanceof DOMException && error.name === 'AbortError'

/**
 * The check the preview's compiler will make, run first. A block is only added
 * to the page if the page still compiles with it — so one bad section is a
 * placeholder to rebuild, never a page that shows an error instead of a site.
 * The parser is loaded on demand; it is large and only builds need it.
 */
async function compileProblem(code: string): Promise<string | null> {
  const { findSyntaxProblem, describeProblem } = await import('@/lib/ai/validate')
  const problem = findSyntaxProblem(code)
  return problem ? describeProblem(problem, code) : null
}

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
  const setBuildPlan = useWorkflowStore((s) => s.setBuildPlan)
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
    if (activeRun) return false

    const run = new AbortController()
    activeRun = run
    const { signal } = run
    // Put back if the run is stopped before it builds anything of its own.
    const previous = { parts: useWorkflowStore.getState().pageParts, brief: useWorkflowStore.getState().brief }

    setError(null)
    setStatus('generating')
    setBrief(null)
    // The previous page's parts no longer describe what will be on screen.
    setPageParts(null)
    setRebuild(null)
    setBuildPlan(null)
    setGenerationProgress({
      label: regions.length > 0 ? 'Reading your drawing and prompt' : 'Understanding your idea',
      done: 0,
      total: 2,
    })

    // Filled in as the run goes, so a stopped run can keep what it built.
    let shellCode: string | null = null
    let sceneCode: string | null = null
    let tokenId = ''
    let brief: DesignBrief | null = null
    let classified: typeof regions | null = null
    let resolvedPrompt: string | null = null
    let plannedSections: string[] = []
    const completed: string[] = []
    const blocks: SectionBlock[] = []
    const failed: string[] = []
    let plan: PlannedSection[] = []
    const markPlan = (names: string[], status: PlannedSection['status']) => {
      plan = plan.map((s) => (names.includes(s.name) ? { ...s, status } : s))
      setBuildPlan(plan)
    }

    /** The parts of whatever was built — the whole page, or what a stop left behind. */
    const keepParts = (unbuilt: string[]): boolean => {
      if (!shellCode || !brief) return false
      const parts: PageParts = {
        shellCode,
        sceneCode,
        tokenId,
        brief,
        regions: classified ?? regions,
        groups,
        prompt: resolvedPrompt ?? prompt.trim(),
        sections: plannedSections,
        blocks,
        failed: [...failed, ...unbuilt],
      }
      // Assembled from the parts themselves, so the saved page and the saved
      // parts always agree — that is what lets a reload restore them.
      const assembled = assembleParts(parts)
      if (!assembled.code) return false
      setPageParts(parts)
      setPreviewCode(assembled.code)
      return true
    }

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
        body: JSON.stringify({ ...shared, imageData, projectId: useWorkflowStore.getState().projectId }),
        signal,
      })
      const understood = await understandRes.json()
      if (!understood.success) {
        setError(understood.error || 'Could not read the request. Please try again.', understandRes.status === 429 ? 'quota' : 'failed')
        return false
      }
      brief = understood.data.brief as DesignBrief
      setBrief(brief)
      setGenerationProgress({ label: 'Designing the page structure', done: 1, total: 2 })

      // Stage 1 — the shell. Short enough to survive a serverless timeout, and
      // it tells us what sections still need building. This is the request
      // that counts against the daily limit.
      const shellRes = await fetch('/api/generate/shell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...shared, imageData, brief }),
        signal,
      })
      const shellResult = await shellRes.json()

      if (!shellResult.success) {
        setError(shellResult.error || 'Generation failed. Please try again.', shellRes.status === 429 ? 'quota' : 'failed')
        return false
      }

      const data = shellResult.data as {
        shellCode: string
        sceneCode: string | null
        sections: string[]
        batches: string[][]
        tokenId: string
        regions: typeof regions
        prompt: string
      }
      shellCode = data.shellCode
      sceneCode = data.sceneCode ?? null
      tokenId = data.tokenId
      classified = data.regions ?? null
      resolvedPrompt = data.prompt ?? null
      const { batches } = data

      plannedSections = batches.flat().filter((name) => name !== SCENE_NAME)
      plan = plannedSections.map((name) => ({ name, status: 'queued' as const }))
      setBuildPlan(plan)

      const totalStages = 2 + batches.length
      let pending = batches.flat()
      // The drawing, rendered in code, goes in first: assembly keeps the first
      // definition of a name, so no section can replace the user's picture.
      if (sceneCode) completed.push(sceneCode)

      // Show the page immediately, with unbuilt sections as placeholders, so the
      // wait is visibly productive rather than a blank screen.
      const firstPass = assembleProgressive(shellCode, completed, pending)
      if (firstPass.code) setPreviewCode(firstPass.code)
      setGenerationProgress({ label: 'Building sections', done: 2, total: totalStages })

      // Serial on purpose: a burst of parallel calls is what trips free-tier
      // rate limits, and spacing them lets per-minute quota recover.
      for (let i = 0; i < batches.length; i++) {
        const sectionNames = batches[i]
        setGenerationProgress({
          label: `Building ${sectionNames.join(' & ')}`,
          done: 2 + i,
          total: totalStages,
        })
        markPlan(sectionNames, 'building')

        try {
          const sectionRes = await fetch('/api/generate/section', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...shared,
              regions: classified ?? regions,
              prompt: resolvedPrompt ?? shared.prompt,
              sectionNames,
              shellCode,
              tokenId,
              brief,
            }),
            signal,
          })
          const sectionResult = await sectionRes.json()

          const blockCode: string | null = sectionResult.success && sectionResult.data?.code ? sectionResult.data.code : null
          // Tried against the page as it stands: the server checked the block
          // alone, but only here can it clash with what other calls wrote.
          const trial = blockCode
            ? assembleProgressive(shellCode, [...completed, blockCode], pending.filter((name) => !sectionNames.includes(name)))
            : null
          const problem = trial ? (trial.code ? await compileProblem(trial.code) : trial.error ?? 'could not be assembled') : null
          if (problem) console.warn(`[useAI] ${sectionNames.join(', ')} left out — the page would not compile with it: ${problem}`)

          if (blockCode && !problem) {
            completed.push(blockCode)
            blocks.push({ sections: sectionNames, code: blockCode, ...cleanMeta(sectionResult.data) })
            pending = pending.filter((name) => !sectionNames.includes(name))
            markPlan(sectionNames, 'built')
          } else {
            failed.push(...sectionNames)
            markPlan(sectionNames, 'failed')
          }
        } catch (error) {
          if (isAbort(error)) throw error
          failed.push(...sectionNames)
          markPlan(sectionNames, 'failed')
        }

        // Repaint after every batch — this is the progressive fill.
        const pass = assembleProgressive(shellCode, completed, pending)
        if (pass.code) setPreviewCode(pass.code)
      }

      keepParts([])
      setStatus('preview_ready')

      // A partial page still renders; say which pieces didn't make it rather
      // than throwing away everything that did.
      if (failed.length > 0) {
        setError(`Generated, but these sections failed and are placeholders: ${failed.join(', ')}. Rebuild them from the Sections list.`)
      }
      return true
    } catch (error) {
      if (isAbort(error)) {
        // Stopped by the user. Whatever was built stays; the rest can be
        // rebuilt one section at a time.
        const built = new Set(blocks.flatMap((b) => b.sections))
        const unbuilt = plannedSections.filter((name) => !built.has(name) && !failed.includes(name))
        if (!keepParts(unbuilt)) {
          setPageParts(previous.parts)
          setBrief(previous.brief)
        }
        setStatus('idle')
        return false
      }
      console.error('[useAI] Generation error:', error)
      setError('Network error. Please check your connection and try again.')
      return false
    } finally {
      if (activeRun === run) activeRun = null
      // Every exit leaves "generating" — an early return without an error
      // would otherwise lock the UI in a run that already ended.
      if (useWorkflowStore.getState().status === 'generating') setStatus('idle')
      setGenerationProgress(null)
      setBuildPlan(null)
    }
  }, [regions, groups, globalTheme, aiProvider, nvidiaModelId, exportToPng, setStatus, setError, setPreviewCode, setGenerationProgress, setBuildPlan, setBrief, setPageParts, setRebuild])

  /** Stops the generation in flight. Sections already built are kept. */
  const cancelGeneration = useCallback(() => {
    activeRun?.abort()
  }, [])

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
      const next = replaceSection(parts, name, result.data.code, cleanMeta(result.data))
      const assembled = assembleParts(next)
      if (!assembled.code) {
        setRebuild(null, { section: name, message: assembled.error ?? `Could not assemble ${name}.` })
        return false
      }
      // A rebuild may fix a broken page, but must never break a working one.
      const problem = await compileProblem(assembled.code)
      if (problem && !(await compileProblem(assembleParts(parts).code))) {
        setRebuild(null, { section: name, message: `The new ${name} did not compile (${problem}). The old version is kept.` })
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
    cancelGeneration,
    rebuildSection,
  }
}
