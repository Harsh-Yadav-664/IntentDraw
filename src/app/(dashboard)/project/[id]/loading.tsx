/**
 * Shown while the editor route loads.
 *
 * Opening a project pulls in Konva and the canvas bundle, which is slow enough
 * that without this the app renders nothing at all after the click — the exact
 * reason a project card felt like a dead button.
 */
export default function ProjectLoading() {
  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-[#0A0A0B] gap-4">
      <div className="h-10 w-10 rounded-xl border-2 border-primary/30 border-t-primary animate-spin" />
      <p className="text-sm text-muted-foreground">Opening project…</p>
    </div>
  )
}
