'use client'

import { useCanvasStore, REGION_COLORS } from '@/store/canvas-store'
import { useWorkflowStore } from '@/store/workflow-store'
import { useAI } from '@/hooks/use-ai'
import { PromptComposer } from './prompt-composer'
import { BriefCard } from './brief-card'
import { SectionList } from './section-list'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Wand2, AlertCircle, Eye, EyeOff, Layers, Trash2, Square, Circle, PenTool, Navigation, Group, Ungroup } from 'lucide-react'

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
  const updateRegionIntent = useCanvasStore((s) => s.updateRegionIntent)
  const groups = useCanvasStore((s) => s.groups)
  const groupSelection = useCanvasStore((s) => s.groupSelection)
  const ungroup = useCanvasStore((s) => s.ungroup)
  const updateGroupIntent = useCanvasStore((s) => s.updateGroupIntent)
  const renameGroup = useCanvasStore((s) => s.renameGroup)

  const groupMembers = (groupId: string) => regions.filter((r) => r.groupId === groupId)

  // A group is "active" when the whole selection sits inside it, so clicking a
  // group chip (or marquee-selecting its shapes) opens that group's editor.
  const activeGroup = (() => {
    if (selectedRegionIds.length === 0) return null
    const selected = regions.filter((r) => selectedRegionIds.includes(r.id))
    const groupId = selected[0]?.groupId
    if (!groupId || !selected.every((r) => r.groupId === groupId)) return null
    return groups.find((g) => g.id === groupId) ?? null
  })()

  const ungroupedRegions = regions.filter((r) => !r.groupId)

  // The prompt, model picker and Generate button live in <PromptComposer />, so
  // typing no longer re-renders this panel's layer list on every keystroke.
  const errorMessage = useWorkflowStore((s) => s.error)
  const clearError = () => useWorkflowStore.getState().setError(null)

  const { isGenerating } = useAI()
  const isLoading = isGenerating

  return (
    <Card className="h-full flex flex-col glass-panel border-white/10 bg-card/40">
      {/* The header used to read "Controls / Layers & prompt" — two lines that
          named the panel you were already looking at. The vertical space is
          better spent on the layer list. */}
      <CardContent className="flex-1 flex flex-col space-y-4 overflow-y-auto overflow-x-hidden pt-5 pb-6">
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
            <div className="rounded-xl border border-dashed border-white/10 bg-black/20 px-4 py-5 text-center">
              <Wand2 className="mx-auto mb-2 h-5 w-5 text-primary/40" />
              <p className="text-sm text-muted-foreground">Draw shapes to place things precisely.</p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                Optional — a prompt alone works too.
              </p>
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

        {/* Selected Region Info + Intent */}
        {selectedRegionIds.length === 1 && (() => {
          const selectedRegion = regions.find(r => r.id === selectedRegionIds[0])
          if (!selectedRegion) return null
          return (
            <div
              className="flex-shrink-0 p-3 rounded-xl border border-white/10 bg-black/20"
            >
              <p className="font-medium text-sm text-primary">
                Region {selectedRegion.regionNumber} selected
              </p>
              <p className="text-xs mt-1 text-muted-foreground">
                {selectedRegion.geometry.type} · {Math.round(selectedRegion.geometry.width)}×
                {Math.round(selectedRegion.geometry.height)}px
              </p>
              {/* Per-region intent: what this specific shape represents */}
              <Textarea
                value={selectedRegion.intent}
                onChange={(e) => updateRegionIntent(selectedRegion.id, e.target.value)}
                placeholder={`What is Region ${selectedRegion.regionNumber}? e.g. "hero section", "pricing table", "this is the background"`}
                className="mt-2 min-h-[54px] resize-none text-xs bg-black/20 border-white/10 focus:border-primary/50 focus:ring-primary/20 placeholder:text-muted-foreground/50"
                disabled={isLoading}
              />
              <p className="text-xs mt-1.5 text-muted-foreground/70">
                Tip: You can also reference &quot;Region {selectedRegion.regionNumber}&quot; in the main prompt below.
              </p>
            </div>
          )
        })()}
        {selectedRegionIds.length > 1 && (
          <div
            className="flex-shrink-0 p-3 rounded-xl border border-white/10 bg-black/20"
          >
            <p className="font-medium text-sm text-primary">
              {selectedRegionIds.length} regions selected
            </p>
            <p className="text-xs mt-1 text-muted-foreground">
              {activeGroup
                ? `All in "${activeGroup.name}"`
                : 'Group them to describe all of them with one prompt'}
            </p>
            {!activeGroup && (
              <Button
                variant="outline"
                size="sm"
                className="mt-2 w-full text-xs h-7 border-primary/30 hover:bg-primary/10 text-primary/90"
                onClick={() => groupSelection()}
                disabled={isLoading}
              >
                <Group className="h-3 w-3 mr-1.5" />
                Group {selectedRegionIds.length} shapes
              </Button>
            )}
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

        {/* Group editor — one description for every shape in the group */}
        {activeGroup && (
          <div className="flex-shrink-0 p-3 rounded-xl border border-primary/20 bg-primary/5">
            <div className="flex items-center gap-2">
              <Group className="h-4 w-4 text-primary flex-shrink-0" />
              <Input
                value={activeGroup.name}
                onChange={(e) => renameGroup(activeGroup.id, e.target.value)}
                className="h-7 text-sm bg-black/20 border-white/10 focus:border-primary/50"
                disabled={isLoading}
              />
            </div>
            <p className="text-xs mt-1.5 text-muted-foreground">
              {groupMembers(activeGroup.id).map(r => `R${r.regionNumber}`).join(', ')}
            </p>
            <Textarea
              value={activeGroup.intent}
              onChange={(e) => updateGroupIntent(activeGroup.id, e.target.value)}
              placeholder={`What is this group? Describe all ${groupMembers(activeGroup.id).length} shapes at once — e.g. "an animated neon background", "the pricing table"`}
              className="mt-2 min-h-[64px] resize-none text-xs bg-black/20 border-white/10 focus:border-primary/50 focus:ring-primary/20 placeholder:text-muted-foreground/50"
              disabled={isLoading}
            />
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 w-full text-xs h-7 text-muted-foreground hover:text-foreground"
              onClick={() => ungroup(activeGroup.id)}
              disabled={isLoading}
            >
              <Ungroup className="h-3 w-3 mr-1.5" />
              Ungroup
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

        {/* Chips: click a group or region to describe it on its own, instead of
            writing "region 3 is ..." into the main prompt. */}
        {regions.length > 0 && (
          <div className="flex-shrink-0">
            <h4 className="text-sm font-medium mb-2 text-foreground/90">
              Describe a part
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {groups.map((group) => {
                const members = groupMembers(group.id)
                if (members.length === 0) return null
                const isActive = activeGroup?.id === group.id
                return (
                  <button
                    key={group.id}
                    onClick={() => selectRegions(members.map((r) => r.id))}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition-colors ${
                      isActive
                        ? 'border-primary/50 bg-primary/15 text-primary'
                        : 'border-white/10 bg-black/20 text-foreground/70 hover:bg-white/5'
                    }`}
                  >
                    <Group className="h-3 w-3" />
                    {group.name}
                    <span className="opacity-60">{members.length}</span>
                    {group.intent.trim() && <span className="text-primary">•</span>}
                  </button>
                )
              })}

              {ungroupedRegions.map((region) => {
                const isActive =
                  selectedRegionIds.length === 1 && selectedRegionIds[0] === region.id
                return (
                  <button
                    key={region.id}
                    onClick={() => selectRegions([region.id])}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition-colors ${
                      isActive
                        ? 'border-primary/50 bg-primary/15 text-primary'
                        : 'border-white/10 bg-black/20 text-foreground/70 hover:bg-white/5'
                    }`}
                  >
                    R{region.regionNumber}
                    {region.intent.trim() && <span className="text-primary">•</span>}
                  </button>
                )
              })}
            </div>
            <p className="text-xs mt-1.5 text-muted-foreground/70">
              Select several shapes on the canvas to group them and describe them together.
            </p>
          </div>
        )}

        <PromptComposer />
        <SectionList />
        <BriefCard />
      </CardContent>
    </Card>
  )
}