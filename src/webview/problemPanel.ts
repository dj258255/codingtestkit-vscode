import { Problem, ProblemSourceInfo } from '../models/models';

// Full-size, read-only rendering of the problem statement for an editor-tab
// WebviewPanel — the sidebar view is too narrow for long statements (#33).
// Styles mirror the sidebar's #problemContent rules, including the dark-theme
// image treatment, so both surfaces render identically.
export function getProblemPanelHtml(problem: Problem, description: string, uiLangKo: boolean): string {
  const sourceInfo = ProblemSourceInfo[problem.source];
  const metaParts: string[] = [];
  if (problem.timeLimit) { metaParts.push(`${uiLangKo ? '시간' : 'Time'}: ${escapeHtml(problem.timeLimit)}`); }
  if (problem.memoryLimit) { metaParts.push(`${uiLangKo ? '메모리' : 'Memory'}: ${escapeHtml(problem.memoryLimit)}`); }
  if (problem.difficulty) { metaParts.push(`${uiLangKo ? '난이도' : 'Difficulty'}: ${escapeHtml(problem.difficulty)}`); }

  return `<!DOCTYPE html>
<html lang="${uiLangKo ? 'ko' : 'en'}">
<head>
<meta charset="UTF-8"/>
<meta http-equiv="Content-Security-Policy"
  content="default-src 'none'; img-src https: data:; style-src 'unsafe-inline';" />
<title>${escapeHtml(problem.title)}</title>
<style>
body {
  font-family: var(--vscode-font-family, sans-serif);
  color: var(--vscode-foreground, #ccc);
  background: var(--vscode-editor-background, #1e1e1e);
  font-size: 15px;
  line-height: 1.75;
  max-width: 900px;
  margin: 0 auto;
  padding: 24px 32px 48px;
}
h1 { font-size: 24px; font-weight: 700; margin-bottom: 8px; }
h2 { font-size: 18px; margin-top: 24px; margin-bottom: 8px; }
h3 { font-size: 16px; margin-top: 16px; margin-bottom: 6px; }
p { margin-bottom: 8px; }
img { max-width: 100%; border-radius: 4px; }
/* Codeforces serves some formulas and diagrams as black-on-transparent
   images — invisible on dark themes. Invert them there; hue-rotate keeps
   any colors close to the original. Light themes show them as-is. */
body.vscode-dark img.tex-formula,
body.vscode-dark img.tex-graphics,
body.vscode-high-contrast img.tex-formula,
body.vscode-high-contrast img.tex-graphics {
  filter: invert(0.92) hue-rotate(180deg);
}
/* Other transparent images with dark strokes get a white backing instead */
body.vscode-dark img:not(.tex-formula):not(.tex-graphics),
body.vscode-high-contrast img:not(.tex-formula):not(.tex-graphics) {
  background: #fff;
  padding: 4px;
}
pre {
  background: var(--vscode-textCodeBlock-background, #2d2d2d);
  padding: 12px; border-radius: 8px; overflow-x: auto;
  font-family: var(--vscode-editor-font-family, monospace);
  font-size: 14px;
  border: 1px solid var(--vscode-panel-border, #333);
}
table { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 14px; }
th, td { border: 1px solid var(--vscode-panel-border, #444); padding: 8px 12px; text-align: left; }
.meta { font-size: 13px; color: var(--vscode-descriptionForeground, #999); margin-bottom: 16px; }
.attribution {
  color: #888; font-size: 11px;
  border-top: 1px solid var(--vscode-panel-border, #333);
  margin-top: 32px; padding-top: 8px;
}
</style>
</head>
<body>
<h1>${escapeHtml(problem.title)}</h1>
${metaParts.length > 0 ? `<div class="meta">${metaParts.join(' &nbsp; ')}</div>` : ''}
<div class="problem-body">${description}</div>
<div class="attribution">
  ${uiLangKo ? '출처' : 'Source'}: ${escapeHtml(sourceInfo.englishName)}<br>
  ${uiLangKo
    ? '이 문제의 저작권은 원 플랫폼에 있습니다. 개인 학습 목적으로만 사용하세요.'
    : 'All rights reserved by the original platform. For personal study use only.'}
</div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
