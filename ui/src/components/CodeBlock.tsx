import { useEffect, useRef } from 'react';
import hljs from 'highlight.js/lib/core';
import typescript from 'highlight.js/lib/languages/typescript';
import javascript from 'highlight.js/lib/languages/javascript';
import python from 'highlight.js/lib/languages/python';
import rust from 'highlight.js/lib/languages/rust';
import go from 'highlight.js/lib/languages/go';
import java from 'highlight.js/lib/languages/java';
import kotlin from 'highlight.js/lib/languages/kotlin';
import csharp from 'highlight.js/lib/languages/csharp';
import cpp from 'highlight.js/lib/languages/cpp';
import c from 'highlight.js/lib/languages/c';
import ruby from 'highlight.js/lib/languages/ruby';
import php from 'highlight.js/lib/languages/php';
import swift from 'highlight.js/lib/languages/swift';
import scala from 'highlight.js/lib/languages/scala';
import lua from 'highlight.js/lib/languages/lua';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';
import json from 'highlight.js/lib/languages/json';

import 'highlight.js/styles/github-dark.css';

// Register only the languages CodeGraph actually indexes — keeps the bundle
// trim. The mapping below is from CodeGraph's `Language` strings to hljs ids.
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('go', go);
hljs.registerLanguage('java', java);
hljs.registerLanguage('kotlin', kotlin);
hljs.registerLanguage('csharp', csharp);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('c', c);
hljs.registerLanguage('ruby', ruby);
hljs.registerLanguage('php', php);
hljs.registerLanguage('swift', swift);
hljs.registerLanguage('scala', scala);
hljs.registerLanguage('lua', lua);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('json', json);

// Map CodeGraph language strings / file extensions to hljs language ids.
function resolveLang(language?: string, filePath?: string): string {
  const l = (language ?? '').toLowerCase();
  if (l === 'tsx' || l === 'typescript') return 'typescript';
  if (l === 'jsx' || l === 'javascript') return 'javascript';
  if (l === 'objc') return 'cpp';
  if (l && hljs.getLanguage(l)) return l;
  // Fallback to file extension.
  const ext = (filePath ?? '').split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts': case 'tsx': return 'typescript';
    case 'js': case 'jsx': case 'mjs': case 'cjs': return 'javascript';
    case 'py': return 'python';
    case 'rs': return 'rust';
    case 'go': return 'go';
    case 'java': return 'java';
    case 'kt': case 'kts': return 'kotlin';
    case 'cs': return 'csharp';
    case 'cpp': case 'cc': case 'cxx': case 'hpp': return 'cpp';
    case 'c': case 'h': return 'c';
    case 'rb': return 'ruby';
    case 'php': return 'php';
    case 'swift': return 'swift';
    case 'scala': return 'scala';
    case 'lua': return 'lua';
    case 'xml': case 'html': case 'svelte': case 'vue': return 'xml';
    case 'yaml': case 'yml': return 'yaml';
    case 'json': case 'jsonc': return 'json';
    default: return 'plaintext';
  }
}

export function CodeBlock({
  code,
  language,
  filePath,
  startLine,
  highlightLines,
}: {
  code: string;
  language?: string;
  filePath?: string;
  startLine?: number;
  /** Absolute file line numbers (1-based) to visually highlight. */
  highlightLines?: number[];
}) {
  const ref = useRef<HTMLElement>(null);
  const lang = resolveLang(language, filePath);
  const baseLine = startLine ?? 1;
  const sourceLines = code.split('\n');
  const lineCount = sourceLines.length;
  const highlightSet = new Set(highlightLines ?? []);

  useEffect(() => {
    if (!ref.current) return;
    // Highlight each line independently so we can wrap matched lines in a
    // styled span — hljs.highlight on the whole block produces a single
    // syntactically-correct HTML tree, but splitting it back into lines while
    // preserving open <span> tags is fiddly. Per-line highlighting loses
    // some cross-line constructs (multi-line strings/comments) but is
    // visually fine for short function bodies.
    const html = sourceLines.map((line, i) => {
      const absLine = baseLine + i;
      let rendered: string;
      try {
        rendered = lang === 'plaintext'
          ? escapeHtml(line)
          : hljs.highlight(line, { language: lang, ignoreIllegals: true }).value;
      } catch {
        rendered = escapeHtml(line);
      }
      // Render empty lines as a non-breaking space so the line height is preserved.
      if (rendered.length === 0) rendered = '&nbsp;';
      const cls = highlightSet.has(absLine) ? 'code-line highlighted' : 'code-line';
      return `<span class="${cls}">${rendered}</span>`;
    }).join('\n');
    ref.current.innerHTML = html;
  }, [code, lang, baseLine, highlightLines?.join(',')]);

  return (
    <pre className="code-block">
      <span className="line-numbers" aria-hidden="true">
        {Array.from({ length: lineCount }, (_, i) => {
          const n = baseLine + i;
          return highlightSet.has(n) ? `▶ ${n}` : `  ${n}`;
        }).join('\n')}
      </span>
      <code ref={ref} className={`hljs language-${lang}`}>{code}</code>
    </pre>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
