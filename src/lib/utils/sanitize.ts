import { normalizeImports } from '@/lib/ai/assemble'
import { softenSceneOverlays } from '@/lib/ai/repair'
import { rewriteImageUrl } from './image-url'
import { fontHead } from '@/lib/design/fonts'
import { artImage, keywordImage, NEUTRAL_ART_PALETTE, readPaletteMarker } from './image-art'
import { auditPage, contrastRatio } from './page-audit'
import { imageKey } from '@/lib/images/slots'
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
/**
 * The generated file as the body of a template literal inside an inline
 * <script>. Backslashes are escaped first: without that, every `\n`, `\"` or
 * `\d` the model wrote was silently reinterpreted — a string like "a\"b" became
 * a compile error and a regex like /\d+/ quietly matched the letter d. `</script`
 * would end the script tag early, so it is broken up.
 */
export function embedInTemplate(code: string): string {
  return code
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$')
    .replace(/<\/(script)/gi, '<\\/$1')
}

export function wrapReactForPreview(
  tsxCode: string,
  options?: {
    freeze?: boolean
    /** Overrides the detected origin, e.g. when rendering outside the app. */
    appOrigin?: string
    /** A file the user downloads and publishes, rather than the in-app preview. */
    export?: { title?: string }
    /**
     * What a keyword image becomes: `art` (default) — a composition drawn in
     * code in the site's palette (image-art.ts); `photos` — a stock photo via
     * /api/image. The owner ruled out third-party photos for now (2026-10-19);
     * NEXT_PUBLIC_IMAGE_SOURCE=photos brings them back.
     */
    images?: 'art' | 'photos'
  }
): string {
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

  // The app's own origin, for routing keyword photos through /api/image. Empty
  // when this runs outside a browser (offline scripts), which keeps direct URLs.
  const appOrigin = options?.appOrigin ?? (typeof window !== 'undefined' ? window.location.origin : '');
  const images = options?.images ?? (process.env.NEXT_PUBLIC_IMAGE_SOURCE === 'photos' ? 'photos' : 'art');
  const artPalette = readPaletteMarker(code) ?? NEUTRAL_ART_PALETTE;

  // Navigation and height reporting script
  // The preview blocks navigation so a click can't take the frame away from the
  // generated site; an exported site is a real website, where links must work.
  const navigationGuard = options?.export ? '' : `
    document.addEventListener('click', function(e) {
      const link = e.target.closest('a');
      if (link) { e.preventDefault(); e.stopPropagation(); }
    }, true);
    document.addEventListener('submit', function(e) {
      e.preventDefault(); e.stopPropagation();
    }, true);
  `;
  const title = (options?.export?.title || 'Website').replace(/[<>&"]/g, '').slice(0, 120);

  const systemScript = `
    // Functions below are embedded from the app's own source (fn.toString()).
    // A compiler that keeps function names (esbuild keepNames, as tsx uses)
    // wraps them in an __name() helper that only exists in the module — define
    // a harmless one so the embedded copies run wherever they were compiled.
    var __name = function (target) { return target; };
    ${navigationGuard}

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

    // A page that cannot compile or crashes while rendering shows one quiet
    // line here and tells the editor, which explains it properly and offers a
    // fix. Raw red compiler text over the site area helped nobody.
    window.__intentdrawQuiet = { font: '14px system-ui, sans-serif', color: '#8a8a8a', padding: '64px 24px', textAlign: 'center' };
    window.__intentdrawReport = function(kind, message, stack) {
      try {
        window.parent.postMessage({
          type: 'IFRAME_ERROR',
          kind: kind,
          message: String(message || 'unknown error').slice(0, 4000),
          stack: String(stack || '').slice(0, 2000),
        }, '*');
      } catch (err) {}
    };
    window.__intentdrawFail = function(kind, message) {
      window.__intentdrawReport(kind, message);
      var root = document.getElementById('root');
      if (!root) return;
      root.innerHTML = '';
      var note = document.createElement('div');
      for (var key in window.__intentdrawQuiet) note.style[key] = window.__intentdrawQuiet[key];
      note.textContent = "This page has an error and can't be shown.";
      root.appendChild(note);
    };

    // LoremFlickr matches ALL keywords by default and answers "no match" with one
    // stock photo (a cat statue), so cards asking for "textile,scarf,linen" all
    // showed the same unrelated picture. One keyword always matches something on
    // topic. Rewritten as React sets the attribute, because the URL is often
    // built at runtime from data the code-level rewrite can't see.
    // Inside the app, keyword photos go through /api/image, which serves
    // licensed Pexels photos when configured and otherwise resolves LoremFlickr
    // server-side, skipping its "no match" default. Offline (no origin) the
    // direct URL is kept, reduced to one keyword.
    var __APP_ORIGIN = ${JSON.stringify(appOrigin)};
    var __rewriteImageUrl = (${rewriteImageUrl.toString()});
    // By default no photo is loaded at all: a keyword image — or a stock-photo
    // URL a model invented anyway — is drawn in code in the site's palette.
    var __ART = ${images === 'art'};
    var __ART_PALETTE = ${JSON.stringify(artPalette)};
    var __artImage = (${artImage.toString()});
    var __keywordImage = (${keywordImage.toString()});
    var __STOCK = /^https?:\\/\\/(?:[\\w-]+\\.)*(?:unsplash\\.com|pexels\\.com|picsum\\.photos|placehold\\.co|placeholder\\.com|pixabay\\.com|loremflickr\\.com)\\//i;
    // Images generated for this page: each block carries a map from its
    // keyword URLs to the images made for them (lib/images/slots.ts).
    var __imageKey = (${imageKey.toString()});
    function __fixImageUrl(u) {
      var made = window.__intentdrawImages;
      if (made) {
        var key = __imageKey(u);
        if (key && typeof made[key] === 'string') return made[key];
      }
      if (__ART) {
        var k = __keywordImage(u);
        if (k) return __artImage(k.keyword, k.w, k.h, k.seed, __ART_PALETTE);
        if (__STOCK.test(u)) return __artImage(u, 1200, 800, 0, __ART_PALETTE);
      }
      return __rewriteImageUrl(u, __APP_ORIGIN);
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

    // An image that fails to load is drawn in the site's palette instead of a
    // broken-image icon — one dead URL shouldn't make the whole page look broken.
    window.addEventListener('error', function(e) {
      var img = e.target;
      if (!img || img.tagName !== 'IMG' || img.getAttribute('data-fallback')) return;
      img.setAttribute('data-fallback', '1');
      img.src = __artImage(img.getAttribute('alt') || 'image', img.naturalWidth || 1200, img.naturalHeight || 800, 0, __ART_PALETTE);
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

    // Text straight over the user's drawing must stay readable. The scene lists
    // the colours it is painted in (data-tones); any text that sits over it with
    // no panel of its own, and falls below 3:1 against one of those colours,
    // gets a soft halo in the opposite tone. A halo is invisible where the text
    // already contrasts, so it only shows where it is needed. A real run set its
    // hero headline straight across a pale shape at about 1.5:1.
    function __legibleOverArt() {
      var scene = document.querySelector('.intent-scene[data-tones]');
      if (!scene) return;
      function rgb(c) {
        c = String(c);
        if (c.charAt(0) === '#') {
          var h = c.slice(1); if (h.length === 3) h = h.replace(/./g, '$&$&');
          var n = parseInt(h, 16); return isNaN(n) ? null : [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
        }
        var m = c.match(/[\\d.]+/g);
        if (!m || m.length < 3) return null;
        return [+m[0], +m[1], +m[2], m[3] === undefined ? 1 : +m[3]];
      }
      function lum(c) {
        var v = [c[0], c[1], c[2]].map(function(x) { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
        return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
      }
      function ratio(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
      var tones = (scene.getAttribute('data-tones') || '').split(',').map(rgb).filter(Boolean);
      if (tones.length === 0) return;
      function overArt(el) {
        for (var n = el; n && n !== document.body; n = n.parentElement) {
          if (n !== el && n.querySelector('.intent-scene')) return true;
          var cs = getComputedStyle(n);
          var bg = rgb(cs.backgroundColor);
          if ((bg && bg[3] >= 0.6) || cs.backgroundImage !== 'none' || (cs.backdropFilter && cs.backdropFilter !== 'none')) return false;
        }
        return false;
      }
      var seen = [];
      var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (var t = walker.nextNode(); t; t = walker.nextNode()) {
        var el = t.parentElement;
        if (!el || seen.indexOf(el) >= 0 || !t.nodeValue || t.nodeValue.trim().length < 2) continue;
        seen.push(el);
        if (el.closest('.intent-scene') || !overArt(el)) continue;
        var cs = getComputedStyle(el);
        if (cs.textShadow && cs.textShadow !== 'none') continue;
        var ink = rgb(cs.color);
        if (!ink) continue;
        var worst = Math.min.apply(null, tones.map(function(c) { return ratio(ink, c); }));
        if (worst >= 3) continue;
        var halo = lum(ink) > 0.4 ? '0,0,0' : '255,255,255';
        el.style.textShadow = '0 0 1px rgba(' + halo + ',.55), 0 0 10px rgba(' + halo + ',.45), 0 0 26px rgba(' + halo + ',.35)';
      }
    }
    window.addEventListener('load', function(){ setTimeout(__legibleOverArt, 300); setTimeout(__legibleOverArt, 2500); });
    ${options?.export ? '' : `
    // What a reader would see wrong — unreadable text, sideways scroll, text on
    // text, empty screens — measured on the rendered page (page-audit.ts) and
    // sent to the editor, which offers each section's rebuild with it as a note.
    // After the halo above, so text it already fixed isn't reported.
    var __contrastRatio = (${contrastRatio.toString()});
    var __auditPage = (${auditPage.toString()});
    window.addEventListener('load', function(){ setTimeout(function() {
      try { window.parent.postMessage({ type: 'IFRAME_AUDIT', findings: __auditPage(__contrastRatio) }, '*'); } catch (e) {}
    }, 3200); });`}
  `;

  // Freezing the backdrop: finish and pause everything that would keep painting.
  // No CDN script is needed, and nothing is read back across the sandbox boundary.
  const captureScriptTag = '';
  const snapshotScript = options?.freeze
    ? `
    function __freeze() {
      // Read by animation loops the runtime renders itself (IntentScene spheres).
      window.__intentdrawFrozen = true;
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
        // An uncaught error after the page rendered (an effect, a handler):
        // logged by the editor, not treated as a broken page.
        window.parent.postMessage({
          type: 'IFRAME_ERROR',
          kind: 'script',
          message: (e && e.message) || 'unknown error',
        }, '*');
      } catch (err) {}
    });
  `
    : '';

  // Imports are rewritten to the UMD globals loaded above. Anything not in this
  // map becomes a harmless stand-in (window.__intentdrawStub), so an
  // unsupported library costs one effect, never the whole page.
  const babelScript = `
    const originalCode = \`${embedInTemplate(code)}\`;

    // Module specifier -> the window property holding its exports.
    // null means the exports sit directly on window (GSAP's UMD builds).
    const MODULE_GLOBALS = {
      'lucide-react': 'lucide',
      'gsap': null,
      'gsap/all': null,
      'gsap/MotionPathPlugin': null,
      'gsap/ScrollTrigger': null,
      'gsap/ScrollToPlugin': null,
      'gsap/TextPlugin': null,
      'gsap/SplitText': null,
      'gsap/CustomEase': null,
      'gsap/DrawSVGPlugin': null,
      'gsap/Observer': null,
      'gsap/Flip': null,
      // framer-motion has no UMD build of its React API; this shim renders the
      // plain elements so content still appears (motion props are dropped).
      'framer-motion': '__intentdrawMotion',
      'motion/react': '__intentdrawMotion'
    };

    // A stand-in for anything imported from a library the preview can't load.
    // Rendering it gives nothing, calling it gives nothing, reading from it
    // gives another stand-in — so one unsupported import costs one effect
    // instead of the whole page ("X is not defined" used to blank everything).
    window.__intentdrawStub = function(name) {
      if (!window.__intentdrawMissing) window.__intentdrawMissing = {};
      if (!window.__intentdrawMissing[name]) {
        window.__intentdrawMissing[name] = true;
        console.warn('[IntentDraw] "' + name + '" comes from a library this preview does not load; it renders as nothing.');
      }
      var fn = function() { return null; };
      return new Proxy(fn, {
        get: function(target, key) {
          if (key === '__intentdrawStub') return true;
          // React probes components for these; a stand-in has none.
          if (key === 'defaultProps' || key === 'contextTypes' || key === 'propTypes' || key === 'contextType' || key === 'getDerivedStateFromProps' || key === '$typeof' || key === 'displayName' || key === 'then') return undefined;
          if (key === 'prototype' || key === 'call' || key === 'apply' || key === 'bind') return target[key];
          if (key === Symbol.toPrimitive) return function() { return ''; };
          return window.__intentdrawStub(name + '.' + String(key));
        }
      });
    };

    (function() {
      var MOTION_PROPS = ['initial', 'animate', 'exit', 'transition', 'variants', 'whileHover', 'whileTap', 'whileInView', 'whileFocus', 'whileDrag', 'viewport', 'layout', 'layoutId', 'drag', 'dragConstraints', 'onAnimationComplete', 'custom'];
      var cache = {};
      var motion = new Proxy({}, {
        get: function(_, tag) {
          if (!cache[tag]) {
            cache[tag] = React.forwardRef(function(props, ref) {
              var clean = {};
              for (var k in props) if (MOTION_PROPS.indexOf(k) === -1) clean[k] = props[k];
              clean.ref = ref;
              return React.createElement(tag, clean);
            });
          }
          return cache[tag];
        }
      });
      var value = function(v) { return { get: function() { return v; }, set: function() {}, on: function() { return function() {}; }, onChange: function() { return function() {}; } }; };
      window.__intentdrawMotion = {
        motion: motion,
        m: motion,
        AnimatePresence: function(props) { return React.createElement(React.Fragment, null, props.children); },
        LayoutGroup: function(props) { return React.createElement(React.Fragment, null, props.children); },
        useInView: function() { return true; },
        useAnimation: function() { return { start: function() { return Promise.resolve(); }, stop: function() {}, set: function() {} }; },
        useAnimate: function() { return [React.useRef(null), function() { return Promise.resolve(); }]; },
        useScroll: function() { return { scrollY: value(0), scrollYProgress: value(0), scrollX: value(0), scrollXProgress: value(0) }; },
        useTransform: function() { return value(0); },
        useMotionValue: function(v) { return value(v); },
        useSpring: function(v) { return typeof v === 'object' ? v : value(v); },
        useReducedMotion: function() { return true; }
      };
    })();

    // Plugins that resolved to stand-ins must not reach GSAP's registry.
    if (window.gsap && window.gsap.registerPlugin) {
      var __register = window.gsap.registerPlugin.bind(window.gsap);
      window.gsap.registerPlugin = function() {
        var real = Array.prototype.filter.call(arguments, function(p) { return p && !p.__intentdrawStub; });
        return real.length ? __register.apply(null, real) : undefined;
      };
    }

    // Register custom Babel plugin to handle imports/exports robustly via AST
    Babel.registerPlugin('intentdraw-transform', function(babel) {
      const t = babel.types;
      return {
        visitor: {
          ImportDeclaration(path) {
            const source = path.node.source.value;
            if (!(source in MODULE_GLOBALS)) {
              // CSS and other side-effect imports have nothing to bind.
              if (path.node.specifiers.length === 0) { path.remove(); return; }
              path.replaceWith(t.variableDeclaration('const', path.node.specifiers.map(function(spec) {
                // A plugin that exists on window after all (a GSAP plugin we do
                // load, imported from an unexpected path) is used for real.
                const name = spec.local.name;
                return t.variableDeclarator(
                  t.identifier(name),
                  t.logicalExpression('||',
                    t.memberExpression(t.identifier('window'), t.identifier(name)),
                    t.callExpression(t.memberExpression(t.identifier('window'), t.identifier('__intentdrawStub')), [t.stringLiteral(name)])
                  )
                );
              })));
              return;
            }

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
  componentDidCatch(error, info) {
    // The component stack names the section that crashed, so the editor can
    // offer to rebuild just that one.
    window.__intentdrawReport("runtime", error && error.message, info && info.componentStack);
  }
  render() {
    if (this.state.hasError) return React.createElement("div", { style: window.__intentdrawQuiet }, "This page has an error and can't be shown.");
    return this.props.children;
  }
}

const root = ReactDOM.createRoot(document.getElementById("root"));
if (typeof window.__RenderComponent !== "undefined") {
  root.render(React.createElement(ErrorBoundary, null, React.createElement(window.__RenderComponent)));
} else if (typeof App !== "undefined") {
  root.render(React.createElement(ErrorBoundary, null, React.createElement(App)));
} else {
  window.__intentdrawFail("compile", "No default export found to render.");
}\`;

      eval(compiled);
    } catch (e) {
      window.__intentdrawFail('compile', e && e.message);
    }
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
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
  <!-- The other plugins models reach for. A real run imported ScrollToPlugin,
       which wasn't loaded, and the whole page died on "not defined". -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.15.0/ScrollToPlugin.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.15.0/TextPlugin.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.15.0/SplitText.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.15.0/CustomEase.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.15.0/DrawSVGPlugin.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.15.0/Observer.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.15.0/Flip.min.js"></script>

  <!-- Use Lucide UMD -->
  <script src="https://unpkg.com/lucide@latest"></script>
  ${captureScriptTag}

  <style>
    body { margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }
    #root { min-height: 100vh; }
  </style>
  <!-- The site's own typefaces (lib/design/fonts.ts). After the base style so
       its body font wins. -->
  ${fontHead(code)}
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