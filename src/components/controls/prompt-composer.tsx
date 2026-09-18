'use client'

import { useEffect, useRef, useState } from 'react'
import { useWorkflowStore } from '@/store/workflow-store'
import { useAI } from '@/hooks/use-ai'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Sparkles, ChevronDown } from 'lucide-react'
import type { AIProvider } from '@/types'

/**
 * The prompt, the model choice, and the Generate button.
 *
 * Split out of `ControlsPanel` for one concrete reason: the prompt lives in the
 * workflow store, so every keystroke re-rendered the entire panel — the layer
 * list, the group chips, every region row. The draft is local here and pushed to
 * the store on a debounce, so typing only re-renders this component.
 */

const PROVIDERS: Array<{ value: AIProvider; label: string; hint: string }> = [
  { value: 'gemini', label: 'Gemini 2.5 Flash', hint: 'Best quality · reads your drawing' },
  { value: 'openrouter', label: 'OpenRouter', hint: 'Stronger free coding models' },
  { value: 'groq', label: 'Groq GPT-OSS 120B', hint: 'Fastest · text-only' },
  { value: 'nvidia', label: 'NVIDIA Nemotron 3.5', hint: 'Backup · slowest' },
]

// Long enough that a burst of typing is one update, short enough that hitting
// Generate immediately after typing still sends what's on screen.
const PROMPT_DEBOUNCE_MS = 200

export function PromptComposer() {
  const prompt = useWorkflowStore((s) => s.prompt)
  const setPrompt = useWorkflowStore((s) => s.setPrompt)
  const generationProgress = useWorkflowStore((s) => s.generationProgress)
  const aiProvider = useWorkflowStore((s) => s.aiProvider)
  const setAiProvider = useWorkflowStore((s) => s.setAiProvider)
  const nvidiaModelId = useWorkflowStore((s) => s.nvidiaModelId)
  const setNvidiaModelId = useWorkflowStore((s) => s.setNvidiaModelId)

  const [draft, setDraft] = useState(prompt)
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [availableModels, setAvailableModels] = useState<string[]>([])

  // One attempt only: /api/models returns success:false when the NVIDIA key is
  // absent, so a "list is empty, try again" condition never stops firing.
  const modelsRequested = useRef(false)

  // Adopt external changes (loading a project) without clobbering live typing.
  // Compared during render rather than in an effect — React's documented
  // "adjusting state when a value changes" pattern, which re-renders this
  // component before painting instead of cascading a second commit.
  const [syncedPrompt, setSyncedPrompt] = useState(prompt)
  if (prompt !== syncedPrompt) {
    setSyncedPrompt(prompt)
    setDraft(prompt)
  }

  useEffect(() => {
    if (draft === prompt) return
    const timer = setTimeout(() => setPrompt(draft), PROMPT_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [draft, prompt, setPrompt])

  useEffect(() => {
    if (!showModelPicker || modelsRequested.current) return
    modelsRequested.current = true
    fetch('/api/models')
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.models) setAvailableModels(data.models)
      })
      .catch(console.error)
  }, [showModelPicker])

  const { isGenerating, generateCode } = useAI()
  const canGenerate = draft.trim().length > 0 && !isGenerating

  const handleGenerate = async () => {
    // Flush the draft first — otherwise a click within the debounce window
    // generates from the previous prompt. Zustand's set is synchronous, so the
    // generation call below reads the flushed value.
    if (draft !== prompt) setPrompt(draft)
    useWorkflowStore.getState().setError(null)
    await generateCode()
  }

  const activeProvider = PROVIDERS.find((p) => p.value === aiProvider) ?? PROVIDERS[0]
  const percent = generationProgress
    ? Math.round((generationProgress.done / Math.max(1, generationProgress.total)) * 100)
    : 0

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h4 className="text-sm font-medium text-foreground/90">Prompt</h4>
        <span className="text-[11px] tabular-nums text-muted-foreground/60">
          {draft.trim().length > 0 ? `${draft.trim().length} chars` : 'required'}
        </span>
      </div>

      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          // Cmd/Ctrl+Enter generates — the shortcut every tool in this category has.
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canGenerate) {
            e.preventDefault()
            handleGenerate()
          }
        }}
        placeholder={
          'Describe the site you want.\n\ne.g. "A tile manufacturer selling imported stone — show the full catalogue and the custom-finishing tech."'
        }
        className="min-h-[150px] max-h-[340px] resize-y rounded-xl border-white/10 bg-black/25 text-sm leading-relaxed placeholder:text-muted-foreground/40 focus-visible:border-primary/50 focus-visible:ring-primary/20"
        disabled={isGenerating}
      />

      {/* Model selection, de-emphasised: it's a setting, not a step. */}
      <div className="rounded-xl border border-white/8 bg-black/20">
        <Select value={aiProvider} onValueChange={(v) => setAiProvider(v as AIProvider)}>
          <SelectTrigger className="h-auto w-full border-0 bg-transparent px-3 py-2.5 shadow-none focus:ring-0">
            <div className="flex flex-col items-start gap-0.5 text-left">
              <span className="text-xs font-medium text-foreground/90">{activeProvider.label}</span>
              <span className="text-[11px] text-muted-foreground/60">{activeProvider.hint}</span>
            </div>
          </SelectTrigger>
          <SelectContent>
            {PROVIDERS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                <div className="flex flex-col gap-0.5">
                  <span>{p.label}</span>
                  <span className="text-[11px] text-muted-foreground">{p.hint}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {aiProvider === 'nvidia' && (
          <div className="border-t border-white/5 px-3 pb-2.5 pt-2">
            <button
              onClick={() => setShowModelPicker((v) => !v)}
              className="flex w-full items-center justify-between text-[11px] text-muted-foreground/70 transition-colors hover:text-foreground/80"
            >
              <span className="truncate">{nvidiaModelId || 'Default NIM model'}</span>
              <ChevronDown
                className={`h-3.5 w-3.5 flex-shrink-0 transition-transform ${showModelPicker ? 'rotate-180' : ''}`}
              />
            </button>
            {showModelPicker && (
              <Select value={nvidiaModelId} onValueChange={setNvidiaModelId}>
                <SelectTrigger className="mt-2 h-8 border-white/10 bg-black/30 text-[11px]">
                  <SelectValue placeholder="Choose a NIM model" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {(availableModels.length > 0
                    ? availableModels
                    : ['nvidia/nemotron-3.5-lightning-30b-a3b']
                  ).map((model) => (
                    <SelectItem key={model} value={model} className="text-[11px]">
                      {model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}
      </div>

      {/* Staged generation reports what it's doing, so a long run reads as
          progress rather than a stall. */}
      {generationProgress && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-primary/90">{generationProgress.label}…</span>
            <span className="tabular-nums text-muted-foreground">
              {generationProgress.done}/{generationProgress.total}
            </span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground/70">
            Sections fill in as they finish — switch to Output to watch it build.
          </p>
        </div>
      )}

      <Button
        onClick={handleGenerate}
        disabled={!canGenerate}
        size="lg"
        className={`h-12 w-full rounded-xl font-medium transition-all duration-300 ${
          canGenerate
            ? 'bg-primary text-primary-foreground shadow-[0_0_20px_rgba(200,150,50,0.35)] hover:shadow-[0_0_35px_rgba(200,150,50,0.55)]'
            : 'opacity-40'
        }`}
      >
        {isGenerating ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {generationProgress?.label ?? 'Generating'}…
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-5 w-5" />
            Generate
          </>
        )}
      </Button>
      <p className="text-center text-[11px] text-muted-foreground/50">
        <kbd className="rounded border border-white/10 bg-white/5 px-1 py-0.5 font-sans">Ctrl</kbd>
        {' + '}
        <kbd className="rounded border border-white/10 bg-white/5 px-1 py-0.5 font-sans">Enter</kbd>
        {' to generate'}
      </p>
    </div>
  )
}
