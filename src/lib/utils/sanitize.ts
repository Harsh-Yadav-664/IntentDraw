// NOTE: <form> and <input> are intentionally NOT stripped — generated UIs
// legitimately contain them, and the preview iframe is sandboxed
// (allow-scripts only, no allow-same-origin), so submissions cannot reach
// anywhere. Embedding tags are still removed as defense in depth.
const DANGEROUS_TAGS = [
  'iframe', 'object', 'embed',
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
 * Wraps React TSX code for preview rendering using Babel standalone.
 *
 * When `options.captureSnapshot` is set, the iframe screenshots itself once
 * (via html2canvas) after it finishes rendering and posts the PNG data URL to
 * the parent as `{ type: 'IFRAME_SNAPSHOT', dataUrl }`. The parent uses that
 * frozen bitmap as the Design-canvas backdrop instead of keeping a live,
 * continuously-compiling iframe behind the drawing surface.
 */
export function wrapReactForPreview(tsxCode: string, options?: { captureSnapshot?: boolean }): string {
  // Remove markdown formatting if somehow it slipped through
  let code = tsxCode;
  if (code.startsWith('```')) {
    const lines = code.split('\n');
    lines.shift();
    if (lines[lines.length - 1].startsWith('```')) lines.pop();
    code = lines.join('\n');
  }

  // Navigation and height reporting script
  const systemScript = `
    document.addEventListener('click', function(e) {
      const link = e.target.closest('a');
      if (link) { e.preventDefault(); e.stopPropagation(); }
    }, true);
    document.addEventListener('submit', function(e) {
      e.preventDefault(); e.stopPropagation();
    }, true);

    function reportHeight() {
      if (document.documentElement && document.documentElement.scrollHeight) {
        window.parent.postMessage({ type: 'IFRAME_HEIGHT', height: document.documentElement.scrollHeight }, '*');
      }
    }
    window.addEventListener('load', reportHeight);
    if (typeof ResizeObserver !== 'undefined') {
      // Wait for body to be available
      const ro = new ResizeObserver(reportHeight);
      const observeBody = () => {
        if (document.body) ro.observe(document.body);
        else setTimeout(observeBody, 50);
      };
      observeBody();
    }
  `;

  // Optional one-time self-screenshot. Runs only when captureSnapshot is set
  // (the Design-canvas backdrop). Output-mode / download previews skip it, so
  // they don't pay for html2canvas. Guarded + retried in case the CDN script
  // hasn't loaded yet; failures are swallowed (parent just keeps the live frame).
  const captureScriptTag = options?.captureSnapshot
    ? '<script src="https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js"></script>'
    : '';
  const snapshotScript = options?.captureSnapshot
    ? `
    function __captureSnapshot() {
      if (window.__snapshotDone) return;
      if (typeof html2canvas === 'undefined') { setTimeout(__captureSnapshot, 300); return; }
      window.__snapshotDone = true;
      try {
        html2canvas(document.body, { backgroundColor: '#ffffff', scale: 1, logging: false, useCORS: true })
          .then(function(canvas){
            try { window.parent.postMessage({ type: 'IFRAME_SNAPSHOT', dataUrl: canvas.toDataURL('image/png') }, '*'); } catch (e) {}
          })
          .catch(function(){});
      } catch (e) {}
    }
    // Wait a beat after load so Tailwind's JIT styles and lucide icons settle.
    window.addEventListener('load', function(){ setTimeout(__captureSnapshot, 900); });
  `
    : '';

  // We rewrite lucide-react imports to use the global window.lucide
  const babelScript = `
    const originalCode = \`${code.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`;
    
    // Register custom Babel plugin to handle imports/exports robustly via AST
    Babel.registerPlugin('intentdraw-transform', function(babel) {
      const t = babel.types;
      return {
        visitor: {
          ImportDeclaration(path) {
            if (path.node.source.value === 'lucide-react') {
              // Convert import { X } from 'lucide-react' to const { X } = window.lucide
              const specifiers = path.node.specifiers.filter(spec => t.isImportSpecifier(spec)).map(spec => {
                const importedName = spec.imported.type === 'StringLiteral' ? spec.imported.value : spec.imported.name;
                return t.objectProperty(t.identifier(importedName), t.identifier(spec.local.name), false, importedName === spec.local.name);
              });
              if (specifiers.length > 0) {
                path.replaceWith(
                  t.variableDeclaration('const', [
                    t.variableDeclarator(
                      t.objectPattern(specifiers),
                      t.memberExpression(t.identifier('window'), t.identifier('lucide'))
                    )
                  ])
                );
              } else {
                path.remove();
              }
            } else {
              // Strip all other imports
              path.remove();
            }
          },
          ExportDefaultDeclaration(path) {
            const decl = path.node.declaration;
            let expr = decl;
            if (t.isFunctionDeclaration(decl)) {
              expr = t.functionExpression(decl.id, decl.params, decl.body, decl.generator, decl.async);
            } else if (t.isClassDeclaration(decl)) {
              expr = t.classExpression(decl.id, decl.superClass, decl.body, decl.decorators);
            }
            
            // Assign the default export to window.__RenderComponent
            path.replaceWith(
              t.expressionStatement(
                t.assignmentExpression(
                  '=',
                  t.memberExpression(t.identifier('window'), t.identifier('__RenderComponent')),
                  expr
                )
              )
            );
          },
          ExportNamedDeclaration(path) {
            if (path.node.declaration) {
              path.replaceWith(path.node.declaration);
            } else {
              path.remove();
            }
          }
        }
      };
    });

    // React UMD only exposes the \`React\` and \`ReactDOM\` globals. Our transform
    // strips the \`import { useState, ... } from 'react'\` line, so bare hook
    // references in the generated code (useState, useEffect, useRef, ...) would
    // be undefined at runtime ("useState is not defined"). Re-expose every React
    // export as a window global so those bare references resolve during eval.
    [
      'useState','useEffect','useRef','useMemo','useCallback','useReducer',
      'useContext','useLayoutEffect','useImperativeHandle','useId','useTransition',
      'useDeferredValue','useSyncExternalStore','useInsertionEffect','useDebugValue',
      'forwardRef','memo','createContext','Fragment','Suspense','StrictMode',
      'cloneElement','createElement','isValidElement','Children','lazy','startTransition'
    ].forEach(function(k){ if (React && React[k] !== undefined) window[k] = React[k]; });

    try {
      let compiled = Babel.transform(originalCode, {
        presets: [['react', { runtime: 'classic' }], 'typescript'],
        plugins: ['intentdraw-transform']
      }).code;
      
      // Mount the app with an Error Boundary
      compiled += \`

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return React.createElement('div', {style: {color: 'red', padding: '20px', fontFamily: 'sans-serif'}}, 
        React.createElement('b', null, 'Runtime Error:'), 
        React.createElement('br'), 
        this.state.error.message
      );
    }
    return this.props.children;
  }
}

const root = ReactDOM.createRoot(document.getElementById("root"));
if (typeof window.__RenderComponent !== "undefined") {
  root.render(React.createElement(ErrorBoundary, null, React.createElement(window.__RenderComponent)));
} else if (typeof App !== "undefined") {
  root.render(React.createElement(ErrorBoundary, null, React.createElement(App)));
} else {
  document.getElementById("root").innerHTML = "<div style='color:red;padding:20px;font-family:sans-serif;'><b>Error:</b> No default export found to render. Make sure the code uses 'export default function Component()'.</div>";
}\`;
      
      eval(compiled);
    } catch (e) {
      document.getElementById('root').innerHTML = '<div style="color:red;padding:20px;font-family:sans-serif;"><b>Compilation Error:</b><br/>' + e.message + '</div>';
    }
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  
  <!-- Use Lucide UMD -->
  <script src="https://unpkg.com/lucide@latest"></script>
  ${captureScriptTag}

  <style>
    body { margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }
    #root { min-height: 100vh; }
  </style>
  <script>${systemScript}${snapshotScript}</script>
</head>
<body>
  <div id="root"></div>
  <!-- Lucide React wrapper (mock) to map window.lucide primitives to React components -->
  <script>
    window.lucide = new Proxy({}, {
      get: function(target, prop) {
        return function(props) {
          // A tiny React component that renders the lucide SVG via data-lucide
          props = props || {};
          return React.createElement('i', {
            'data-lucide': String(prop).replace(/[A-Z]/g, m => '-' + m.toLowerCase()).replace(/^-/, ''),
            className: props.className,
            style: { width: props.size || 24, height: props.size || 24, color: props.color || 'currentColor', display: 'inline-block' },
            ref: (node) => { if (node && window.lucideIcons && lucide.createIcons) lucide.createIcons({ root: node.parentNode }) }
          });
        };
      }
    });
  </script>
  <script type="text/javascript">${babelScript}</script>
</body>
</html>`;
}

export function isHtmlSafe(html: string): boolean {
  if (/\son\w+\s*=/i.test(html)) return false
  if (/javascript\s*:/i.test(html)) return false
  if (/(src|href)\s*=\s*["']?\s*data:/i.test(html)) return false
  return true
}