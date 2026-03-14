import katex from 'katex';

/**
 * Replace $...$ (inline) and $$...$$ (display) LaTeX delimiters in HTML
 * with KaTeX-rendered MathML. MathML is natively supported by Chromium 109+
 * (VS Code 1.85+ uses Electron 28+ / Chromium 120+), so no external CSS or
 * fonts are needed.
 */
export function renderLatexInHtml(html: string): string {
  if (!html || (!html.includes('$'))) {
    return html;
  }

  // Step 1: Protect existing HTML tags and code blocks from LaTeX processing
  const protected_: string[] = [];
  let idx = 0;
  let safe = html.replace(/<(pre|code|script|style)[^>]*>[\s\S]*?<\/\1>/gi, (m) => {
    protected_.push(m);
    return `\x00PROTECT${idx++}\x00`;
  });
  // Also protect HTML tags themselves
  safe = safe.replace(/<[^>]+>/g, (m) => {
    protected_.push(m);
    return `\x00PROTECT${idx++}\x00`;
  });

  // Step 2: Replace $$...$$ (display math) first
  safe = safe.replace(/\$\$([\s\S]+?)\$\$/g, (_match, latex: string) => {
    try {
      return katex.renderToString(latex.trim(), {
        displayMode: true,
        output: 'mathml',
        throwOnError: false,
      });
    } catch {
      return `$$${latex}$$`;
    }
  });

  // Step 3: Replace $...$ (inline math) — avoid matching escaped \$ or empty $$
  safe = safe.replace(/\$([^$\n]+?)\$/g, (_match, latex: string) => {
    try {
      return katex.renderToString(latex.trim(), {
        displayMode: false,
        output: 'mathml',
        throwOnError: false,
      });
    } catch {
      return `$${latex}$`;
    }
  });

  // Step 4: Restore protected content
  safe = safe.replace(/\x00PROTECT(\d+)\x00/g, (_m, i) => protected_[Number(i)]);

  return safe;
}
