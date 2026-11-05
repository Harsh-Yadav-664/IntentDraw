/**
 * Edit mode inside the preview frame (issue #17).
 *
 * Embedded into the preview runtime as source text (`editModeRuntime.toString()`),
 * so it must stay self-contained: no imports, no module helpers, plain loops
 * (no iterator spreads a compiler could turn into a helper call).
 *
 * The frame stays `sandbox="allow-scripts"` with no same-origin access. The
 * editor turns edit mode on with a message; the frame outlines what can be
 * changed, lets words be edited in place, and reports each change back as a
 * message. The editor decides what to do with it (lib/edit/edits.ts) — nothing
 * here touches the page's code.
 *
 *   in:  { type: 'EDIT_MODE', on: boolean, scrollY?: number }   (from the parent only)
 *   out: { type: 'EDIT_TEXT', section, changes: [{ before, after, occurrence }] }
 *        { type: 'EDIT_TEXT_REQUEST', section, before }          words animated letter by letter
 *        { type: 'EDIT_PICK_IMAGE', section, src, alt, width, height }
 *        { type: 'EDIT_PICK_SECTION', section, snippet }             "Change this section" pill
 *        { type: 'EDIT_SCROLL', y }
 *        { type: 'EDIT_EXIT' }                                    Escape with nothing being edited
 */
export function editModeRuntime(): void {
  const w = window as unknown as Record<string, unknown>
  let on = false
  let styleEl: HTMLStyleElement | null = null
  let hovered: Element | null = null
  let editing: HTMLElement | null = null
  let original: Array<{ node: Text; value: string; occurrence: number }> = []
  let single = false
  let lastScroll = 0
  // "Change this section": a pill that follows the section under the pointer.
  let pill: HTMLButtonElement | null = null
  let pillSection: string | null = null

  const post = (message: Record<string, unknown>) => {
    try {
      window.parent.postMessage(message, '*')
    } catch {
      // the editor is gone
    }
  }
  const norm = (t: string | null) => String(t || '').replace(/\s+/g, ' ').trim()
  const sectionOf = (el: Element) => {
    const s = el.closest('[data-section]')
    return s ? s.getAttribute('data-section') : null
  }
  const ownText = (el: Element): Text[] => {
    const out: Text[] = []
    for (let i = 0; i < el.childNodes.length; i++) {
      const n = el.childNodes[i]
      if (n.nodeType === 3 && norm(n.nodeValue).length > 0) out.push(n as Text)
    }
    return out
  }
  // GSAP SplitText puts each letter in an aria-hidden element and the words on
  // an aria-label of the element it split: that label is the text to change.
  const splitLabel = (el: Element): Element | null => {
    const hidden = el.closest('[aria-hidden="true"]')
    if (!hidden || !hidden.parentElement) return null
    const labelled = hidden.parentElement.closest('[aria-label]')
    return labelled && norm(labelled.getAttribute('aria-label')).length > 0 ? labelled : null
  }
  const target = (e: MouseEvent): Element | null => {
    const start = e.target instanceof Element ? e.target : null
    if (!start || start.closest('.intent-scene')) return null
    if (start.tagName === 'IMG') return start
    for (let n: Element | null = start; n && n !== document.body; n = n.parentElement) {
      const label = splitLabel(n)
      if (label) return label
      if (ownText(n).length > 0) return n
    }
    // An overlay over a picture (a gradient, a caption box) — the picture under it.
    const under = document.elementsFromPoint ? document.elementsFromPoint(e.clientX, e.clientY) : []
    for (let i = 0; i < under.length; i++) if (under[i].tagName === 'IMG' && !under[i].closest('.intent-scene')) return under[i]
    return null
  }
  /** Which of the equal words on the page this text node is, in reading order. */
  const occurrenceOf = (node: Text, scope: Element) => {
    const want = norm(node.nodeValue)
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT)
    let index = 0
    for (let t = walker.nextNode(); t; t = walker.nextNode()) {
      if (t === node) return index
      if (norm(t.nodeValue) === want) index++
    }
    return 0
  }

  const setHover = (el: Element | null) => {
    if (hovered === el) return
    if (hovered) hovered.removeAttribute('data-intentdraw-hover')
    hovered = el
    if (el) el.setAttribute('data-intentdraw-hover', '')
  }

  const finish = (commit: boolean) => {
    const el = editing
    if (!el) return
    editing = null
    el.removeAttribute('contenteditable')
    el.removeAttribute('data-intentdraw-editing')
    el.removeEventListener('keydown', onKey, true)
    el.removeEventListener('blur', onBlur)
    const changes: Array<{ before: string; after: string; occurrence: number }> = []
    if (single && original.length === 1) {
      const after = el.textContent || ''
      if (norm(after) !== norm(original[0].value)) changes.push({ before: original[0].value, after, occurrence: original[0].occurrence })
      if (!commit) el.textContent = original[0].value
    } else {
      for (let i = 0; i < original.length; i++) {
        const o = original[i]
        if (!o.node.isConnected) continue
        if (!commit) o.node.nodeValue = o.value
        else if (norm(o.node.nodeValue) !== norm(o.value)) changes.push({ before: o.value, after: o.node.nodeValue || '', occurrence: o.occurrence })
      }
    }
    original = []
    if (commit && changes.length > 0) post({ type: 'EDIT_TEXT', section: sectionOf(el), changes })
  }
  function onKey(e: KeyboardEvent) {
    e.stopPropagation()
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      finish(true)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      finish(false)
    }
  }
  function onBlur() {
    finish(true)
  }

  const startEdit = (el: HTMLElement) => {
    const scope = el.closest('[data-section]') || document.body
    const nodes = ownText(el)
    single = nodes.length === 1 && el.children.length === 0
    original = []
    for (let i = 0; i < nodes.length; i++) original.push({ node: nodes[i], value: nodes[i].nodeValue || '', occurrence: occurrenceOf(nodes[i], scope) })
    editing = el
    setHover(null)
    el.setAttribute('data-intentdraw-editing', '')
    el.setAttribute('contenteditable', 'plaintext-only')
    if (el.contentEditable !== 'plaintext-only') el.setAttribute('contenteditable', 'true')
    el.addEventListener('keydown', onKey, true)
    el.addEventListener('blur', onBlur)
    el.focus()
    try {
      const range = document.createRange()
      range.selectNodeContents(el)
      const sel = window.getSelection()
      if (sel) {
        sel.removeAllRanges()
        sel.addRange(range)
      }
    } catch {
      // selection is a convenience
    }
  }

  /** The box a section occupies (its marker is display: contents, so measure its children). */
  const sectionBox = (marker: Element) => {
    let top = Infinity, left = Infinity, right = -Infinity, bottom = -Infinity
    for (let i = 0; i < marker.children.length; i++) {
      const r = marker.children[i].getBoundingClientRect()
      if (r.width === 0 && r.height === 0) continue
      top = Math.min(top, r.top); left = Math.min(left, r.left); right = Math.max(right, r.right); bottom = Math.max(bottom, r.bottom)
    }
    return bottom > top ? { top: top, left: left, right: right, bottom: bottom } : null
  }
  const showPill = (marker: Element | null) => {
    const name = marker ? marker.getAttribute('data-section') : null
    if (!marker || !name) {
      if (pill) pill.style.display = 'none'
      pillSection = null
      return
    }
    const box = sectionBox(marker)
    if (!box) return
    if (!pill) {
      pill = document.createElement('button')
      pill.setAttribute('data-intentdraw-pill', '')
      // An editor control, not part of the page: the layout audit and contrast fixer skip it.
      pill.setAttribute('aria-hidden', 'true')
      pill.type = 'button'
      pill.style.cssText = 'position:absolute;z-index:2147483647;padding:7px 12px;border-radius:999px;border:0;background:#E8A33D;color:#14110A;font:600 12px/1 system-ui,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.25);cursor:pointer;'
      document.body.appendChild(pill)
    }
    pillSection = name
    pill.textContent = 'Change ' + name
    pill.style.display = 'block'
    // Top-right of the section, kept inside the window.
    const top = Math.max(box.top, 8) + window.scrollY + 10
    pill.style.top = top + 'px'
    pill.style.left = Math.max(8, Math.min(box.right, window.innerWidth) - 10 - pill.offsetWidth) + window.scrollX + 'px'
  }
  const onOver = (e: MouseEvent) => {
    if (e.target instanceof Element && e.target.closest('[data-intentdraw-pill]')) return
    if (!editing) setHover(target(e))
    const marker = e.target instanceof Element ? e.target.closest('[data-section]') : null
    if (marker && marker.getAttribute('data-section') !== pillSection) showPill(marker)
  }
  const onClick = (e: MouseEvent) => {
    // Clicks inside the words being edited place the caret.
    if (editing && e.target instanceof Node && editing.contains(e.target)) return
    e.preventDefault()
    e.stopPropagation()
    if (e.target instanceof Element && e.target.closest('[data-intentdraw-pill]')) {
      if (editing) finish(true)
      const marker = pillSection ? document.querySelector('[data-section="' + pillSection.replace(/"/g, '') + '"]') : null
      const snippet = marker ? norm(marker.textContent).slice(0, 120) : ''
      if (pillSection) post({ type: 'EDIT_PICK_SECTION', section: pillSection, snippet: snippet })
      return
    }
    if (editing) finish(true)
    const el = target(e)
    if (!el) return
    if (el.tagName === 'IMG') {
      const img = el as HTMLImageElement
      const origins = w.__intentdrawOrigSrc as WeakMap<Element, string> | undefined
      const src = (origins && origins.get(img)) || img.getAttribute('src') || ''
      post({ type: 'EDIT_PICK_IMAGE', section: sectionOf(img), src, alt: img.getAttribute('alt') || '', width: img.naturalWidth || img.width, height: img.naturalHeight || img.height })
      return
    }
    if (el.hasAttribute('aria-label') && splitLabel(e.target as Element) === el) {
      post({ type: 'EDIT_TEXT_REQUEST', section: sectionOf(el), before: el.getAttribute('aria-label') })
      return
    }
    startEdit(el as HTMLElement)
  }
  // Nothing on the page reacts while it is being edited: no menus, no carousels, no links.
  const swallow = (e: Event) => {
    if (editing && e.target instanceof Node && editing.contains(e.target)) return
    e.stopPropagation()
  }
  const onKeyAnywhere = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && !editing) post({ type: 'EDIT_EXIT' })
  }
  const onScroll = () => {
    const now = Date.now()
    if (now - lastScroll < 150) return
    lastScroll = now
    post({ type: 'EDIT_SCROLL', y: Math.round(window.scrollY || 0) })
  }

  const setOn = (next: boolean) => {
    if (next === on) return
    on = next
    const method = next ? 'addEventListener' : 'removeEventListener'
    document[method]('mouseover', onOver as EventListener, true)
    window[method]('click', onClick as EventListener, true)
    window[method]('pointerdown', swallow, true)
    window[method]('mousedown', swallow, true)
    window[method]('keydown', onKeyAnywhere as EventListener, true)
    window[method]('scroll', onScroll, { passive: true } as AddEventListenerOptions)
    if (next) {
      styleEl = document.createElement('style')
      styleEl.textContent =
        '[data-intentdraw-hover]{outline:2px dashed #E8A33D !important;outline-offset:3px !important;cursor:text !important}' +
        'img[data-intentdraw-hover]{cursor:pointer !important;outline-style:solid !important}' +
        '[data-intentdraw-editing]{outline:2px solid #E8A33D !important;outline-offset:3px !important;cursor:text !important;-webkit-user-select:text !important;user-select:text !important}'
      document.head.appendChild(styleEl)
    } else {
      finish(true)
      setHover(null)
      showPill(null)
      if (styleEl) styleEl.remove()
      styleEl = null
    }
  }

  window.addEventListener('message', (e: MessageEvent) => {
    if (e.source !== window.parent) return
    const data = e.data as { type?: unknown; on?: unknown; scrollY?: unknown } | null
    if (!data || data.type !== 'EDIT_MODE') return
    setOn(data.on === true)
    // The page may still be rendering (and too short to scroll) when this arrives.
    const y = data.scrollY
    if (typeof y === 'number' && y > 0) {
      window.scrollTo(0, y)
      setTimeout(() => window.scrollTo(0, y), 250)
      setTimeout(() => window.scrollTo(0, y), 900)
    }
  })
}
