'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import Toolbar from '@/components/canvas/toolbar'
import { useCanvasStore } from '@/store/canvas-store'
import useKeyboardShortcuts from '@/hooks/use-keyboard-shortcuts'

// Konva needs `window` and HTML canvas — can't render during SSR.
// dynamic() with ssr:false loads it client-only. Skeleton shows while loading.
const DrawingCanvas = dynamic(
  () => import('@/components/canvas/drawing-canvas'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full rounded-lg border border-slate-200 bg-white flex items-center justify-center" style={{ height: '500px' }}>
        <Skeleton className="w-full h-full rounded-lg" />
      </div>
    ),
  }
)

export default function DashboardPage() {
  useKeyboardShortcuts()

  const regions = useCanvasStore((s) => s.regions)
  const selectedRegionId = useCanvasStore((s) => s.selectedRegionId)
  const selectedRegion = regions.find((r) => r.id === selectedRegionId)

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            <Link href="/" className="text-xl font-bold">
              Intent<span className="text-blue-600">Draw</span>
            </Link>
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-500">10/10 generations</span>
              <Button variant="outline" size="sm" asChild>
                <Link href="/">Home</Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Canvas panel */}
          <div className="lg:col-span-2 space-y-3">
            <Toolbar />
            <DrawingCanvas />
          </div>

          {/* Controls panel */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Controls</CardTitle>
              <CardDescription>Regions & prompt</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-2">Regions ({regions.length})</h4>
                {regions.length === 0 ? (
                  <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center text-slate-400 text-sm">
                    Draw shapes to create regions
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {regions.map((r) => (
                      <div
                        key={r.id}
                        className={`p-2.5 rounded-lg border text-sm cursor-pointer transition-colors ${
                          r.id === selectedRegionId
                            ? 'border-blue-500 bg-blue-50 text-blue-900'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                        onClick={() =>
                          useCanvasStore.getState().selectRegion(
                            r.id === selectedRegionId ? null : r.id
                          )
                        }
                      >
                        <span className="font-medium">Region {r.regionNumber}</span>
                        <span className="text-slate-400 ml-2 text-xs">{r.geometry.type}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedRegion && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                  <p className="font-medium text-blue-900">Region {selectedRegion.regionNumber}</p>
                  <p className="text-blue-700 text-xs mt-1">
                    {selectedRegion.geometry.type} · {Math.round(selectedRegion.geometry.width)}×
                    {Math.round(selectedRegion.geometry.height)}px
                  </p>
                </div>
              )}

              <div>
                <h4 className="text-sm font-medium mb-2">Prompt</h4>
                <textarea
                  className="w-full h-24 p-3 border rounded-lg text-sm resize-none bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder={
                    regions.length > 0
                      ? 'Describe your design...\ne.g., "Region 1 is a hero section with gradient"'
                      : 'Draw shapes first, then describe your design...'
                  }
                  disabled={regions.length === 0}
                />
              </div>

              <Button className="w-full" disabled={regions.length === 0}>
                Generate Design
              </Button>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-blue-800 text-xs">
                  📍 Phase 1 complete. AI generation comes in Phase 2-3.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Preview panel */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Preview</CardTitle>
              <CardDescription>Generated design</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="aspect-[3/4] bg-slate-50 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center">
                <div className="text-center text-slate-400 p-4">
                  <div className="text-4xl mb-3">🎨</div>
                  <p className="text-sm">Preview appears after generation</p>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" size="sm" className="flex-1" disabled>Copy</Button>
                <Button variant="outline" size="sm" className="flex-1" disabled>Export</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 p-4 bg-white rounded-lg border flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm text-slate-600">
            <span className="w-2 h-2 bg-green-500 rounded-full" />
            Ready
          </span>
          <span className="text-sm text-slate-500">
            {regions.length} region{regions.length !== 1 ? 's' : ''} · Phase 1 ✅
          </span>
        </div>
      </div>
    </main>
  )
}