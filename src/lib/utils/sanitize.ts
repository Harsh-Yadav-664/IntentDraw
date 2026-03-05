const DANGEROUS_TAGS = [
  'iframe', 'object', 'embed', 'form', 'input',
]

const DANGEROUS_ATTRIBUTES = [
  'onclick', 'ondblclick', 'onmousedown', 'onmouseup', 'onmouseover',
  'onmousemove', 'onmouseout', 'onmouseenter', 'onmouseleave',
  'onkeydown', 'onkeypress', 'onkeyup', 'onload', 'onerror', 'onabort',
  'onfocus', 'onblur', 'onchange', 'onsubmit', 'onreset', 'onscroll',
  'oncopy', 'oncut', 'onpaste', 'ondrag', 'ondragend', 'ondragenter',
  'ondragleave', 'ondragover', 'ondragstart', 'ondrop',
  'onanimationstart', 'onanimationend', 'ontransitionend',
  'formaction', 'xlink:href',
]

export function sanitizeHtml(html: string): string {
  let sanitized = html

  for (const tag of DANGEROUS_TAGS) {
    const tagRegex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi')
    sanitized = sanitized.replace(tagRegex, '')
    const selfClosingRegex = new RegExp(`<${tag}[^>]*\\/?>`, 'gi')
    sanitized = sanitized.replace(selfClosingRegex, '')
  }

  for (const attr of DANGEROUS_ATTRIBUTES) {
    const attrRegex = new RegExp(`\\s*${attr}\\s*=\\s*["'][^"']*["']`, 'gi')
    sanitized = sanitized.replace(attrRegex, '')
    const unquotedRegex = new RegExp(`\\s*${attr}\\s*=\\s*[^\\s>]+`, 'gi')
    sanitized = sanitized.replace(unquotedRegex, '')
  }

  sanitized = sanitized.replace(/javascript\s*:/gi, 'blocked:')
  sanitized = sanitized.replace(/vbscript\s*:/gi, 'blocked:')

  return sanitized
}

/**
 * Wraps HTML for preview rendering.
 * If the HTML is already a complete document (has <!DOCTYPE>), adds navigation blocking.
 * If it's a fragment, wraps it in a complete document with Tailwind CDN.
 */
export function wrapHtmlForPreview(html: string): string {
  const sanitized = sanitizeHtml(html)
  const trimmed = sanitized.trim()
  
  // Check if it's already a complete HTML document
  const isCompleteDocument = trimmed.toLowerCase().startsWith('<!doctype') || 
                             trimmed.toLowerCase().startsWith('<html')

  // Navigation blocking script
  const blockingScript = `
<script>
  document.addEventListener('click', function(e) {
    const link = e.target.closest('a');
    if (link) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  document.addEventListener('submit', function(e) {
    e.preventDefault(); e.stopPropagation();
  }, true);
</script>`

  if (isCompleteDocument) {
    // Insert blocking script before </body> or </html>
    if (trimmed.includes('</body>')) {
      return trimmed.replace('</body>', `${blockingScript}</body>`)
    } else if (trimmed.includes('</html>')) {
      return trimmed.replace('</html>', `${blockingScript}</html>`)
    }
    return trimmed + blockingScript
  }

  // Wrap fragment in complete document (fallback for old-style fragments)
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-white">
${sanitized}
${blockingScript}
</body>
</html>`
}

export function isHtmlSafe(html: string): boolean {
  if (/\son\w+\s*=/i.test(html)) return false
  if (/javascript\s*:/i.test(html)) return false
  if (/(src|href)\s*=\s*["']?\s*data:/i.test(html)) return false
  return true
}