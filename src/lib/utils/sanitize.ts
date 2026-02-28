// =============================================================================
// HTML Sanitization for AI-Generated Content
// AI-generated HTML is UNTRUSTED. This removes dangerous elements/attributes.
// =============================================================================

const DANGEROUS_TAGS = [
  'script', 'iframe', 'object', 'embed', 'link', 'meta', 'base', 'form', 'input',
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

/**
 * Sanitizes HTML by removing dangerous elements and attributes.
 */
export function sanitizeHtml(html: string): string {
  let sanitized = html

  // Remove dangerous tags and their content
  for (const tag of DANGEROUS_TAGS) {
    const tagRegex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi')
    sanitized = sanitized.replace(tagRegex, '')
    const selfClosingRegex = new RegExp(`<${tag}[^>]*\\/?>`, 'gi')
    sanitized = sanitized.replace(selfClosingRegex, '')
  }

  // Remove dangerous attributes
  for (const attr of DANGEROUS_ATTRIBUTES) {
    const attrRegex = new RegExp(`\\s*${attr}\\s*=\\s*["'][^"']*["']`, 'gi')
    sanitized = sanitized.replace(attrRegex, '')
    const unquotedRegex = new RegExp(`\\s*${attr}\\s*=\\s*[^\\s>]+`, 'gi')
    sanitized = sanitized.replace(unquotedRegex, '')
  }

  // Remove dangerous URL protocols
  sanitized = sanitized.replace(/javascript\s*:/gi, 'blocked:')
  sanitized = sanitized.replace(/data\s*:[^"'\s>]+/gi, 'blocked:')
  sanitized = sanitized.replace(/vbscript\s*:/gi, 'blocked:')

  return sanitized
}

// IMPORTANT: Call sanitizeHtml() BEFORE calling wrapHtmlForPreview().
// The wrapper adds a legitimate <script> tag for Tailwind CDN.
// If you sanitize AFTER wrapping, the Tailwind script gets stripped.

// NOTE: This HTML must ONLY be rendered inside sandbox="allow-scripts" iframe.
// Never inject this HTML directly into the DOM.
export function wrapHtmlForPreview(html: string): string {
  const sanitized = sanitizeHtml(html)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
${sanitized}
</body>
</html>`
}

/**
 * Quick check if HTML appears safe (for validation before processing).
 */
export function isHtmlSafe(html: string): boolean {
  if (/<script/i.test(html)) return false
  if (/\son\w+\s*=/i.test(html)) return false
  if (/javascript\s*:/i.test(html)) return false
  if (/(src|href)\s*=\s*["']?\s*data:/i.test(html)) return false
  return true
}