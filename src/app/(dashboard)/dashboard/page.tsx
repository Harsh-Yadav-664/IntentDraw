import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function DashboardPage() {
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
          {/* Canvas */}
          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Canvas</CardTitle>
                <CardDescription>Draw shapes to define layout</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="aspect-[4/3] bg-white border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center">
                  <div className="text-center text-slate-400 p-8">
                    <div className="text-5xl mb-4">✏️</div>
                    <p className="font-medium">Canvas — Phase 1</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-4 p-2 bg-slate-50 rounded-lg">
                  {['Select', 'Rectangle', 'Circle', 'Draw', 'Arrow'].map((tool) => (
                    <Button key={tool} variant="outline" size="sm" disabled className="flex-1">
                      {tool}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Controls */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-2">Regions</h4>
                <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center text-slate-400 text-sm">
                  Draw to create regions
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2">Prompt</h4>
                <textarea
                  className="w-full h-24 p-3 border rounded-lg text-sm resize-none bg-slate-50"
                  placeholder="Describe your design..."
                  disabled
                />
              </div>
              <Button className="w-full" disabled>Generate</Button>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-blue-800 text-xs">
                  📍 Phase 0 complete. Next: Canvas System
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="aspect-[3/4] bg-slate-50 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center">
                <div className="text-center text-slate-400 p-4">
                  <div className="text-4xl mb-3">🎨</div>
                  <p className="text-sm">Preview appears here</p>
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
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            Ready
          </span>
          <span className="text-sm text-slate-500">Phase 0 ✅</span>
        </div>
      </div>
    </main>
  )
}