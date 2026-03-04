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
  sanitized = sanitized.replace(/data\s*:[^"'\s>]+/gi, 'blocked:')
  sanitized = sanitized.replace(/vbscript\s*:/gi, 'blocked:')

  return sanitized
}

export function wrapHtmlForPreview(html: string): string {
  const sanitized = sanitizeHtml(html)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <base target="_blank">
  <style>
    /* Disable all link/button navigation within preview */
    a, button { cursor: pointer; }
    a[href] { pointer-events: auto; }
  </style>
  <script>
    // Block all navigation attempts within the preview
    document.addEventListener('click', function(e) {
      const link = e.target.closest('a');
      if (link) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);
    
    // Block form submissions
    document.addEventListener('submit', function(e) {
      e.preventDefault();
      e.stopPropagation();
    }, true);
  </script>
</head>
<body class="bg-white">
${sanitized}
</body>
</html>`
}

export function isHtmlSafe(html: string): boolean {
  if (/<script/i.test(html)) return false
  if (/\son\w+\s*=/i.test(html)) return false
  if (/javascript\s*:/i.test(html)) return false
  if (/(src|href)\s*=\s*["']?\s*data:/i.test(html)) return false
  return true
}