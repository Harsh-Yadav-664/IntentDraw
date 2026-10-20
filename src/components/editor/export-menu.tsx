'use client'

import { toast } from 'sonner'
import { Copy, Download, FileCode2 } from 'lucide-react'
import { Button, MenuItem, Popover } from '@/components/kit/kit'
import { useWorkflowStore } from '@/store/workflow-store'
import { downloadFile, exportHtml, exportSource, slugify } from '@/lib/export'

/** Take the site away: one HTML file, the React source, or the code on the clipboard. */
export function ExportMenu({ variant = 'outline' }: { variant?: 'outline' | 'primary' }) {
  const previewCode = useWorkflowStore((s) => s.previewCode)
  const projectName = useWorkflowStore((s) => s.projectName)
  const has = previewCode.length > 0

  const html = () => {
    downloadFile(`${slugify(projectName)}.html`, exportHtml(previewCode, projectName), 'text/html')
    toast.success('Website downloaded — open it in any browser, or upload it to any static host.')
  }
  const source = () => {
    downloadFile(`${slugify(projectName)}.tsx`, exportSource(previewCode, projectName), 'text/plain')
    toast.success('Source downloaded — one React component, styled with Tailwind.')
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(exportSource(previewCode, projectName))
      toast.success('Code copied to the clipboard')
    } catch {
      toast.error('Could not copy the code')
    }
  }

  return (
    <Popover
      width="w-[252px]"
      trigger={({ toggle }) => (
        <Button size="sm" variant={variant} icon={<Download size={12} />} onClick={toggle} disabled={!has} title={has ? 'Export your site' : 'Generate a site before exporting'}>
          Export
        </Button>
      )}
    >
      {({ close }) => (
        <div>
          <MenuItem icon={<Download size={13} />} hint=".html" onClick={() => { close(); html() }}>
            Website — runs anywhere
          </MenuItem>
          <MenuItem icon={<FileCode2 size={13} />} hint=".tsx" onClick={() => { close(); source() }}>
            Source — for your project
          </MenuItem>
          <MenuItem icon={<Copy size={13} />} onClick={() => { close(); void copy() }}>
            Copy code
          </MenuItem>
        </div>
      )}
    </Popover>
  )
}
