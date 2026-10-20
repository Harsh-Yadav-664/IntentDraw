/**
 * Shown while the editor route loads.
 *
 * Opening a project pulls in the canvas bundle, which is slow enough that
 * without this the app renders nothing at all after the click — the exact
 * reason a project card felt like a dead button.
 */
export default function ProjectLoading() {
  return (
    <div className="flex h-screen w-full flex-col bg-bg">
      <div className="flex h-[50px] items-center gap-2 border-b border-line bg-bg2 px-4">
        <div className="shimmer h-3 w-40 rounded-full" />
      </div>
      <div className="flex flex-1 items-center justify-center">
        <span className="mono-label pulse-dot text-faint">Opening project…</span>
      </div>
    </div>
  )
}
