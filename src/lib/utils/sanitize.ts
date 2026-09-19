import { normalizeImports } from '@/lib/ai/assemble'
import { softenSceneOverlays } from '@/lib/ai/repair'
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
 * `options.freeze` renders the page once and then stops it moving: every GSAP
 * and WAAPI animation is jumped to its end state and paused, and CSS animations
 * and transitions are disabled. It exists for the Design-canvas backdrop, which
 * must show the generated site behind the drawing surface without spending the
 * main thread on animation the user isn't looking at.
 *
 * This replaced an html2canvas self-screenshot that could never have worked: the
 * preview iframe is `sandbox="allow-scripts"` with no `allow-same-origin`, so its
 * origin is opaque, and html2canvas renders into a nested iframe whose document
 * it must then read — blocked as cross-origin every single time. The snapshot
 * therefore never arrived, and the "frozen bitmap" backdrop the parent waited for
 * left a live, fully animating iframe mounted behind the canvas forever.
 * Granting `allow-same-origin` would fix html2canvas and destroy the sandbox that
 * makes running model-written code safe, so freezing in place is the right trade.
 */
export function wrapReactForPreview(tsxCode: string, options?: { freeze?: boolean }): string {
  // Remove markdown formatting if somehow it slipped through
  let code = tsxCode;
  if (code.startsWith('```')) {
    const lines = code.split('\n');
    lines.shift();
    if (lines[lines.length - 1].startsWith('```')) lines.pop();
    code = lines.join('\n');
  }

  // A name bound twice across imports is a fatal compile error. Assembly
  // prevents it for new generations; this repairs files saved before it did.
  code = normalizeImports(code);
  // Full-bleed "scrims" that would wash out the user's drawing — see repair.ts.
  code = softenSceneOverlays(code);

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
    // Reported once on load only. A ResizeObserver here used to re-post on every
    // body resize, which — combined with a parent that sized the frame from this
    // number — grew the page without bound and pegged the main thread. No parent
    // resizes itself from this any more; it is informational.
    window.addEventListener('load', reportHeight);

    // LoremFlickr matches ALL keywords by default and answers "no match" with one
    // stock photo (a cat statue), so cards asking for "textile,scarf,linen" all
    // showed the same unrelated picture. One keyword always matches something on
    // topic. Rewritten as React sets the attribute, because the URL is often
    // built at runtime from data the code-level rewrite can't see.
    function __fixImageUrl(u) {
      var m = /^(https?:\\/\\/loremflickr\\.com\\/\\d+\\/\\d+\\/)([^\\/?#]+)(.*)$/.exec(u);
      if (!m) return u;
      var first = decodeURIComponent(m[2]).split(',')[0].trim();
      return m[1] + encodeURIComponent(first) + m[3].replace(/^\\/(all|any)(?=[?#]|$)/, '');
    }
    (function() {
      // Both routes: React assigns the src *property* for images; other code
      // uses setAttribute.
      var setAttribute = Element.prototype.setAttribute;
      Element.prototype.setAttribute = function(name, value) {
        if (name === 'src' && this.tagName === 'IMG' && typeof value === 'string') value = __fixImageUrl(value);
        return setAttribute.call(this, name, value);
      };
      var srcProp = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
      if (srcProp && srcProp.set) {
        Object.defineProperty(HTMLImageElement.prototype, 'src', {
          configurable: true,
          enumerable: srcProp.enumerable,
          get: srcProp.get,
          set: function(value) { srcProp.set.call(this, typeof value === 'string' ? __fixImageUrl(value) : value); },
        });
      }
    })();

    // A photo that fails to load becomes a quiet, labelled tile instead of a
    // broken-image icon — one dead URL shouldn't make the whole page look broken.
    window.addEventListener('error', function(e) {
      var img = e.target;
      if (!img || img.tagName !== 'IMG' || img.getAttribute('data-fallback')) return;
      img.setAttribute('data-fallback', '1');
      var label = (img.getAttribute('alt') || '').replace(/[<>&"]/g, '').slice(0, 48);
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice">' +
        '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#cfc6b8"/><stop offset="1" stop-color="#a99d8b"/></linearGradient></defs>' +
        '<rect width="400" height="300" fill="url(#g)"/>' +
        '<text x="200" y="156" font-family="system-ui,sans-serif" font-size="15" fill="#4a4238" fill-opacity=".75" text-anchor="middle">' + label + '</text></svg>';
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }, true);

    // A URL built from a missing field ("…/undefined?lock=undefined") doesn't
    // fail — the image service answers it with one stock photo, so every such
    // card showed the same unrelated picture. Treat it as the failure it is.
    function __replaceUndefinedImages() {
      document.querySelectorAll('img').forEach(function(img) {
        var src = img.getAttribute('src') || '';
        if (/\\/(undefined|null)(\\/|\\?|$)|=(undefined|null)(&|$)/.test(src) && !img.getAttribute('data-fallback')) {
          img.dispatchEvent(new Event('error'));
        }
      });
    }
    window.addEventListener('load', function(){ __replaceUndefinedImages(); setTimeout(__replaceUndefinedImages, 1500); });
  `;

  // Freezing the backdrop: finish and pause everything that would keep painting.
  // No CDN script is needed, and nothing is read back across the sandbox boundary.
  const captureScriptTag = '';
  const snapshotScript = options?.freeze
    ? `
    function __freeze() {
      try { if (window.gsap) { window.gsap.globalTimeline.progress(1); window.gsap.globalTimeline.pause(); } } catch (e) {}
      try {
        if (window.ScrollTrigger && window.ScrollTrigger.getAll) {
          window.ScrollTrigger.getAll().forEach(function(t){ try { t.kill(); } catch (e) {} });
        }
      } catch (e) {}
      try {
        if (document.getAnimations) {
          document.getAnimations().forEach(function(a){ try { a.finish(); } catch (e) {} });
        }
      } catch (e) {}
      // CSS animations and transitions have no JS handle, so stop them in CSS.
      try {
        var style = document.createElement('style');
        style.textContent = '*,*::before,*::after{animation-play-state:paused !important;transition:none !important;}';
        document.head.appendChild(style);
      } catch (e) {}
      try { window.parent.postMessage({ type: 'IFRAME_FROZEN' }, '*'); } catch (e) {}
    }
    // After load, plus a beat for Tailwind's JIT styles and entrance animations.
    window.addEventListener('load', function(){ setTimeout(__freeze, 1200); });
    window.addEventListener('error', function(e){
      try {
        window.parent.postMessage({
          type: 'IFRAME_ERROR',
          message: (e && e.message) || 'unknown error',
        }, '*');
      } catch (err) {}
    });
  `
    : '';

  // Imports are rewritten to the UMD globals loaded above. Anything not in this
  // map is stripped, which is why an unsupported library fails as
  // "X is not defined" at runtime rather than as a compile error.
  const babelScript = `
    const originalCode = \`${code.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`;

    // Module specifier -> the window property holding its exports.
    // null means the exports sit directly on window (GSAP's UMD builds).
    const MODULE_GLOBALS = {
      'lucide-react': 'lucide',
      'gsap': null,
      'gsap/all': null,
      'gsap/MotionPathPlugin': null,
      'gsap/ScrollTrigger': null
    };

    // Register custom Babel plugin to handle imports/exports robustly via AST
    Babel.registerPlugin('intentdraw-transform', function(babel) {
      const t = babel.types;
      return {
        visitor: {
          ImportDeclaration(path) {
            const source = path.node.source.value;
            if (!(source in MODULE_GLOBALS)) { path.remove(); return; }

            const globalName = MODULE_GLOBALS[source];
            const namespace = globalName
              ? t.memberExpression(t.identifier('window'), t.identifier(globalName))
              : t.identifier('window');

            const named = [];
            const declarators = [];

            path.node.specifiers.forEach(function(spec) {
              if (t.isImportSpecifier(spec)) {
                const importedName = spec.imported.type === 'StringLiteral' ? spec.imported.value : spec.imported.name;
                named.push(t.objectProperty(t.identifier(importedName), t.identifier(spec.local.name), false, importedName === spec.local.name));
              } else if (t.isImportDefaultSpecifier(spec) || t.isImportNamespaceSpecifier(spec)) {
                // import gsap from 'gsap' -> const gsap = window.gsap
                declarators.push(t.variableDeclarator(
                  t.identifier(spec.local.name),
                  globalName ? namespace : t.memberExpression(t.identifier('window'), t.identifier(spec.local.name))
                ));
              }
            });

            if (named.length > 0) {
              declarators.unshift(t.variableDeclarator(t.objectPattern(named), namespace));
            }

            if (declarators.length > 0) {
              path.replaceWith(t.variableDeclaration('const', declarators));
            } else {
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
        // The TypeScript preset refuses to run without a filename when Babel is
        // called directly (it needs the extension to pick its syntax mode).
        filename: 'generated.tsx',
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
  <!-- Pinned: an unpinned @babel/standalone silently broke every preview once
       when the TypeScript preset started demanding a filename. -->
  <script src="https://unpkg.com/@babel/standalone@7.29.9/babel.min.js"></script>

  <!-- Animation runtime. Plugins self-register and must load after gsap core.
       GSAP writes inline styles on real nodes, so unlike CSS keyframes its
       output survives the html2canvas snapshot used by the Design canvas. -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.15.0/gsap.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.15.0/MotionPathPlugin.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.15.0/ScrollTrigger.min.js"></script>

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
  <!-- Maps lucide-react imports to React components backed by the lucide UMD's
       icon data. The UMD exposes each icon as an array of [tag, attrs] SVG
       children, which we render inline — so icons participate in React
       reconciliation instead of needing a post-mount createIcons() pass. -->
  <script>
    (function () {
      // Capture the real library before shadowing the global with the proxy.
      var lib = window.lucide || {};
      var iconData = lib.icons || lib;

      // Icon data uses SVG attribute names; React needs the camelCase form.
      function toReactAttrs(attrs) {
        var out = {};
        for (var key in attrs) {
          var reactKey = key.replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); });
          out[reactKey] = attrs[key];
        }
        return out;
      }

      window.lucide = new Proxy({}, {
        get: function (target, prop) {
          var children = iconData[String(prop)];
          return function LucideIcon(props) {
            props = props || {};
            if (!children) return null;
            var size = props.size || 24;
            var rest = Object.assign({}, props);
            delete rest.size; delete rest.color; delete rest.strokeWidth;
            return React.createElement(
              'svg',
              Object.assign({
                xmlns: 'http://www.w3.org/2000/svg',
                width: size,
                height: size,
                viewBox: '0 0 24 24',
                fill: 'none',
                stroke: props.color || 'currentColor',
                strokeWidth: props.strokeWidth || 2,
                strokeLinecap: 'round',
                strokeLinejoin: 'round'
              }, rest),
              children.map(function (child, i) {
                return React.createElement(child[0], Object.assign({ key: i }, toReactAttrs(child[1])));
              })
            );
          };
        }
      });

      // Models frequently use an icon without importing it, which would crash
      // the whole preview with "X is not defined". Every icon is already here,
      // so expose them as globals — the same trick used for React's hooks.
      // Never shadow an existing global (Image, Menu, History, ...): a local
      // const in the generated code still takes precedence over these.
      try {
        Object.keys(iconData).forEach(function (name) {
          if (window[name] === undefined) window[name] = window.lucide[name];
        });
      } catch (e) {}
    })();
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