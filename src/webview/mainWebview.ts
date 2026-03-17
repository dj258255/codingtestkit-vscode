import * as vscode from 'vscode';

export function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri, codemirrorUri?: vscode.Uri): string {
  const cspSource = webview.cspSource;
  const codiconsUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css'),
  );
  return getRawHtml(cspSource, codiconsUri.toString(), codemirrorUri?.toString() ?? '');
}

function getRawHtml(cspSource: string, codiconsUri: string, codemirrorUri: string): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<meta http-equiv="Content-Security-Policy"
  content="default-src 'none';
    img-src ${cspSource} https: data:;
    script-src 'unsafe-inline' ${cspSource};
    style-src ${cspSource} 'unsafe-inline';
    frame-src https://devdocs.io https://*.devdocs.io;
    font-src ${cspSource} https:;
    connect-src https:;" />
<link href="${codiconsUri}" rel="stylesheet" />
<title>CodingTestKit</title>
<style>
/* ===== DESIGN TOKENS ===== */
:root {
  --ctk-radius-sm: 4px;
  --ctk-radius-md: 8px;
  --ctk-radius-lg: 12px;
  --ctk-radius-pill: 20px;
  --ctk-space-xs: 4px;
  --ctk-space-sm: 8px;
  --ctk-space-md: 12px;
  --ctk-space-lg: 16px;
  --ctk-space-xl: 20px;
  --ctk-shadow-sm: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08);
  --ctk-shadow-md: 0 4px 12px rgba(0,0,0,0.15), 0 2px 4px rgba(0,0,0,0.1);
  --ctk-shadow-lg: 0 12px 40px rgba(0,0,0,0.25), 0 4px 12px rgba(0,0,0,0.15);
  --ctk-glass-bg: rgba(255,255,255,0.04);
  --ctk-glass-border: rgba(255,255,255,0.08);
  --ctk-glass-hover: rgba(255,255,255,0.07);
  --ctk-ease: cubic-bezier(0.4, 0, 0.2, 1);
  --ctk-ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ctk-duration: 0.2s;
  --ctk-accent: var(--vscode-focusBorder, #007acc);
  --ctk-success: #2ea043;
  --ctk-danger: #da3633;
  --ctk-warning: #d29922;
}

/* ===== RESET & BASE ===== */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
input[type="number"] { -moz-appearance: textfield; }
html, body {
  width: 100%; height: 100%;
  font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
  font-size: var(--vscode-font-size, 13px);
  color: var(--vscode-editor-foreground, #ccc);
  background: var(--vscode-editor-background, #1e1e1e);
  overflow: hidden;
}
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--vscode-scrollbarSlider-background, rgba(121,121,121,0.4)); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--vscode-scrollbarSlider-hoverBackground, rgba(100,100,100,0.7)); }

/* ===== TAB BAR ===== */
.tab-bar {
  display: flex;
  background: var(--vscode-editorGroupHeader-tabsBackground, #252526);
  border-bottom: 1px solid var(--vscode-editorGroupHeader-tabsBorder, var(--vscode-panel-border, #333));
  overflow-x: auto;
  flex-shrink: 0;
  padding: 0 2px;
}
.tab-btn {
  flex: 1;
  min-width: 0;
  padding: 8px 4px 6px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--vscode-tab-inactiveForeground, #888);
  cursor: pointer;
  font-size: 11px;
  text-align: center;
  white-space: nowrap;
  transition: color var(--ctk-duration) var(--ctk-ease),
              border-color var(--ctk-duration) var(--ctk-ease),
              background var(--ctk-duration) var(--ctk-ease);
  position: relative;
}
.tab-btn:hover {
  color: var(--vscode-tab-activeForeground, #fff);
  background: var(--ctk-glass-hover);
}
.tab-btn.active {
  color: var(--vscode-tab-activeForeground, #fff);
  border-bottom-color: var(--ctk-accent);
}
.tab-icon {
  font-size: 13px; display: inline-block; vertical-align: middle; margin-right: 3px;
  transition: transform var(--ctk-duration) var(--ctk-ease);
}
.tab-btn:hover .tab-icon { transform: scale(1.15); }

/* ===== TAB CONTENT ===== */
.tab-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--ctk-space-md);
  display: none;
}
.tab-content.active { display: block; }
#app { display: flex; flex-direction: column; height: 100vh; }

/* ===== COMMON CONTROLS ===== */
button, .btn {
  padding: 5px 12px;
  background: var(--vscode-button-background, #0e639c);
  color: var(--vscode-button-foreground, #fff);
  border: none;
  border-radius: var(--ctk-radius-sm);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.6;
  white-space: nowrap;
  transition: all var(--ctk-duration) var(--ctk-ease);
  position: relative;
  overflow: hidden;
}
button:hover {
  background: var(--vscode-button-hoverBackground, #1177bb);
  transform: translateY(-1px);
  box-shadow: var(--ctk-shadow-sm);
}
button:active {
  transform: translateY(0) scale(0.97);
  box-shadow: none;
}
button.secondary {
  background: var(--ctk-glass-bg);
  color: var(--vscode-button-secondaryForeground, #ccc);
  border: 1px solid var(--ctk-glass-border);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
button.secondary:hover {
  background: var(--ctk-glass-hover);
  border-color: rgba(255,255,255,0.15);
}
button:disabled { opacity: 0.4; cursor: not-allowed; transform: none !important; box-shadow: none !important; }
button.danger { background: var(--ctk-danger); }
button.danger:hover { background: #f85149; }
button.success { background: var(--ctk-success); }
button.success:hover { background: #3fb950; }
button .codicon { vertical-align: middle; font-size: 14px; margin-right: 2px; }
.btn-sm {
  padding: 2px 8px;
  font-size: 11px;
  line-height: 1.4;
  border-radius: var(--ctk-radius-sm);
  margin-left: 6px;
  vertical-align: middle;
}
input, select, textarea {
  background: var(--vscode-input-background, #3c3c3c);
  color: var(--vscode-input-foreground, #ccc);
  border: 1px solid var(--vscode-input-border, #555);
  border-radius: var(--ctk-radius-sm);
  padding: 5px 10px;
  font-size: 12px;
  font-family: inherit;
  outline: none;
  transition: border-color var(--ctk-duration) var(--ctk-ease),
              box-shadow var(--ctk-duration) var(--ctk-ease);
}
input:focus, select:focus, textarea:focus {
  border-color: var(--ctk-accent);
  box-shadow: 0 0 0 2px rgba(0,122,204,0.15);
}
textarea {
  font-family: var(--vscode-editor-font-family, 'Consolas', 'Courier New', monospace);
  font-size: var(--vscode-editor-font-size, 13px);
  resize: vertical;
  min-height: 60px;
}
label { font-size: 12px; display: flex; align-items: center; gap: var(--ctk-space-xs); }
.row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; margin-bottom: var(--ctk-space-sm); }
.row > input, .row > select { flex: 1; min-width: 0; }
.section-title {
  font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;
  margin: var(--ctk-space-lg) 0 var(--ctk-space-sm);
  color: var(--vscode-descriptionForeground, #999);
  padding-bottom: var(--ctk-space-xs);
  border-bottom: 1px solid var(--ctk-glass-border);
}
.badge {
  display: inline-block; padding: 2px 8px; border-radius: var(--ctk-radius-pill); font-size: 10px; font-weight: 600;
  letter-spacing: 0.3px;
}
.badge-pass { background: rgba(46,160,67,0.15); color: #3fb950; border: 1px solid rgba(46,160,67,0.3); }
.badge-fail { background: rgba(218,54,51,0.15); color: #f85149; border: 1px solid rgba(218,54,51,0.3); }
.info-bar {
  background: var(--ctk-glass-bg);
  border-left: 3px solid var(--ctk-accent);
  padding: var(--ctk-space-sm) var(--ctk-space-md);
  margin-bottom: var(--ctk-space-md);
  font-size: 12px;
  border-radius: 0 var(--ctk-radius-md) var(--ctk-radius-md) 0;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

/* ===== PROBLEM TAB ===== */
#problemContent {
  padding: var(--ctk-space-md);
  font-size: 15px;
  line-height: 1.75;
  overflow-y: auto;
  max-height: calc(100vh - 220px);
}
#problemContent h2 { font-size: 17px; margin-top: 20px; margin-bottom: 8px; }
#problemContent h3 { font-size: 16px; margin-top: 16px; margin-bottom: 6px; }
#problemContent p { margin-bottom: 8px; }
#problemContent img { max-width: 100%; border-radius: var(--ctk-radius-sm); }
#problemContent pre {
  background: var(--vscode-textCodeBlock-background, #2d2d2d);
  padding: var(--ctk-space-md); border-radius: var(--ctk-radius-md); overflow-x: auto;
  font-family: var(--vscode-editor-font-family, monospace);
  font-size: 14px;
  border: 1px solid var(--ctk-glass-border);
}
#problemContent table {
  border-collapse: collapse; width: 100%; margin: var(--ctk-space-sm) 0;
  font-size: 14px;
}
#problemContent th, #problemContent td {
  border: 1px solid var(--vscode-panel-border, #444);
  padding: 8px 12px; text-align: left;
}
#problemContent th {
  background: var(--ctk-glass-bg);
}

/* ===== TEST TAB ===== */
.test-card {
  border: 1px solid var(--ctk-glass-border);
  border-radius: var(--ctk-radius-md); margin-bottom: var(--ctk-space-sm);
  overflow: hidden;
  transition: all var(--ctk-duration) var(--ctk-ease);
  background: var(--ctk-glass-bg);
}
.test-card:hover { border-color: rgba(255,255,255,0.12); }
.test-card.pass { border-left: 3px solid var(--ctk-success); }
.test-card.fail { border-left: 3px solid var(--ctk-danger); }
.test-card-header {
  display: flex; align-items: center; gap: 8px;
  padding: 10px var(--ctk-space-md); cursor: pointer;
  background: transparent;
  user-select: none;
  transition: background var(--ctk-duration) var(--ctk-ease);
}
.test-card-header:hover { background: var(--ctk-glass-hover); }
.test-card-toggle {
  transition: transform var(--ctk-duration) var(--ctk-ease);
  display: inline-block; font-size: 10px;
  color: var(--vscode-descriptionForeground, #999);
}
.test-card-toggle.open { transform: rotate(90deg); }
.test-card-title { flex: 1; font-weight: 600; font-size: 12px; }
.test-card-delete {
  background: none; border: none; color: var(--vscode-descriptionForeground, #666); cursor: pointer;
  font-size: 14px; padding: 2px 6px; border-radius: var(--ctk-radius-sm);
  transition: all var(--ctk-duration) var(--ctk-ease);
}
.test-card-delete:hover { color: var(--ctk-danger); background: rgba(218,54,51,0.1); }
.test-card-body {
  max-height: 0; overflow: hidden;
  transition: max-height 0.35s var(--ctk-ease), padding 0.35s var(--ctk-ease);
  padding: 0 var(--ctk-space-md);
}
.test-card-body.open {
  max-height: 5000px; padding: var(--ctk-space-md);
  border-top: 1px solid var(--ctk-glass-border);
  overflow: visible;
}
.tc-grid {
  display: grid; grid-template-columns: 1fr; gap: 10px;
}
.tc-col { display: flex; flex-direction: column; min-width: 0; }
.tc-col textarea { flex: 1; min-height: 60px; resize: vertical; width: 100%; box-sizing: border-box; }
.tc-diff {
  flex: 1; min-height: 60px; overflow: auto; font-size: 12px; line-height: 1.5;
  font-family: var(--vscode-editor-font-family, 'Consolas', monospace);
  background: var(--vscode-input-background, #3c3c3c); border: 1px solid var(--vscode-input-border, #555);
  border-radius: var(--ctk-radius-sm); padding: 5px 10px; margin: 0; white-space: pre;
}
.tc-diff-ok { color: var(--ctk-success, #3fb950); }
.tc-diff-bad { color: var(--ctk-danger, #f85149); background: rgba(248,81,73,0.1); border-radius: 2px; }
.tc-extra-row { grid-column: 1 / -1; }
.tc-extra-row textarea { width: 100%; box-sizing: border-box; resize: vertical; min-height: 40px; }
.test-field-label {
  font-size: 11px; color: var(--vscode-descriptionForeground, #999);
  margin: 0 0 var(--ctk-space-xs);
  font-weight: 500; letter-spacing: 0.3px;
}
.test-metrics {
  display: flex; gap: var(--ctk-space-md); margin-top: var(--ctk-space-sm);
  font-size: 11px; color: var(--vscode-descriptionForeground, #999);
  grid-column: 1 / -1;
}

/* ===== TEMPLATE TAB ===== */
.template-list {
  border: 1px solid var(--ctk-glass-border);
  border-radius: var(--ctk-radius-md); max-height: 200px; overflow-y: auto;
  margin-bottom: var(--ctk-space-md);
  background: var(--ctk-glass-bg);
}
.template-item {
  padding: var(--ctk-space-sm) var(--ctk-space-md); cursor: pointer; font-size: 12px;
  border-bottom: 1px solid var(--ctk-glass-border);
  display: flex; justify-content: space-between; align-items: center;
  transition: background var(--ctk-duration) var(--ctk-ease);
}
.template-item:last-child { border-bottom: none; }
.template-item:hover { background: var(--ctk-glass-hover); }
.template-item.selected {
  background: rgba(0,122,204,0.15); color: var(--vscode-list-activeSelectionForeground, #fff);
  border-left: 2px solid var(--ctk-accent);
}
.template-lang-badge {
  font-size: 10px; padding: 2px 6px; border-radius: var(--ctk-radius-pill);
  background: var(--ctk-glass-bg); color: var(--vscode-badge-foreground, #ccc);
  border: 1px solid var(--ctk-glass-border);
}
#templateCodeContainer {
  width: 100%; min-height: 150px;
  border-radius: var(--ctk-radius-md);
  overflow: hidden;
}
#templateCodeContainer .cm-editor {
  border-radius: var(--ctk-radius-md);
}

/* ===== TIMER TAB ===== */
.timer-subtabs { display: flex; gap: 2px; margin-bottom: var(--ctk-space-lg); }
.timer-subtab {
  flex: 1; padding: 8px; text-align: center; cursor: pointer;
  background: var(--ctk-glass-bg);
  border: 1px solid var(--ctk-glass-border);
  border-bottom: 2px solid transparent; font-size: 12px;
  color: var(--vscode-tab-inactiveForeground, #888);
  transition: all var(--ctk-duration) var(--ctk-ease);
  font-weight: 500;
}
.timer-subtab:first-child { border-radius: var(--ctk-radius-md) 0 0 var(--ctk-radius-md); }
.timer-subtab:last-child { border-radius: 0 var(--ctk-radius-md) var(--ctk-radius-md) 0; }
.timer-subtab:hover { background: var(--ctk-glass-hover); }
.timer-subtab.active {
  color: var(--vscode-tab-activeForeground, #fff);
  border-bottom-color: var(--ctk-accent);
  background: rgba(0,122,204,0.08);
}
.timer-display {
  font-size: 48px; font-weight: 300; text-align: center;
  font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
  margin: var(--ctk-space-xl) 0; letter-spacing: 4px;
  background: linear-gradient(135deg, var(--vscode-editor-foreground, #ccc), var(--ctk-accent));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.timer-controls { display: flex; justify-content: center; gap: var(--ctk-space-sm); margin-bottom: var(--ctk-space-lg); }
.lap-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.lap-table th, .lap-table td {
  padding: 6px var(--ctk-space-sm); border-bottom: 1px solid var(--ctk-glass-border); text-align: left;
}
.lap-table th {
  color: var(--vscode-descriptionForeground, #999); font-weight: 600;
  font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;
}
.lap-table tr { transition: background var(--ctk-duration) var(--ctk-ease); }
.lap-table tr:hover { background: var(--ctk-glass-hover); }

/* Countdown */
.countdown-modes {
  display: flex; gap: var(--ctk-space-md); margin-bottom: var(--ctk-space-lg);
  flex-wrap: wrap; justify-content: center;
}
.countdown-modes label {
  font-size: 12px; cursor: pointer;
  padding: 4px var(--ctk-space-sm);
  border-radius: var(--ctk-radius-sm);
  transition: background var(--ctk-duration) var(--ctk-ease);
}
.countdown-modes label:hover { background: var(--ctk-glass-hover); }
#countdownCanvas {
  display: block; margin: 0 auto var(--ctk-space-lg); cursor: pointer;
}
.countdown-digital {
  font-size: 48px; font-weight: 300; text-align: center;
  font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
  letter-spacing: 4px; margin-bottom: var(--ctk-space-lg);
}
.countdown-input-row {
  display: flex; gap: var(--ctk-space-sm); align-items: center;
  justify-content: center; margin-bottom: var(--ctk-space-md);
}
.countdown-input-row label { font-size: 12px; font-weight: 600; color: var(--vscode-descriptionForeground, #999); }
.countdown-input-row input[type="number"] {
  width: 56px; text-align: center; font-size: 14px; font-weight: 600;
  font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', monospace;
  border-radius: var(--ctk-radius-md);
}
.presets { display: flex; gap: var(--ctk-space-sm); justify-content: center; flex-wrap: wrap; margin-bottom: var(--ctk-space-lg); }

/* ===== RANDOM FILTER STYLES ===== */
.rf-row { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }
.rf-label { font-size: 12px; font-weight: 600; min-width: 56px; color: var(--vscode-foreground); white-space: nowrap; }
.rf-chips { display: flex; gap: 4px; flex-wrap: wrap; flex: 1; }
.rf-chip {
  padding: 3px 10px; border-radius: var(--ctk-radius-pill); font-size: 11px; cursor: pointer;
  background: var(--ctk-glass-bg); color: var(--vscode-badge-foreground, #ccc);
  border: 1px solid var(--ctk-glass-border); transition: all var(--ctk-duration) var(--ctk-ease);
  user-select: none; white-space: nowrap;
}
.rf-chip:hover { background: var(--ctk-glass-hover); transform: translateY(-1px); }
.rf-chip.selected { background: rgba(0,122,204,0.18); color: var(--ctk-accent); border-color: var(--ctk-accent); font-weight: 600; }
.rf-select { padding: 4px 8px; font-size: 12px; border-radius: var(--ctk-radius-sm); border: 1px solid var(--ctk-glass-border);
  background: var(--vscode-input-background); color: var(--vscode-input-foreground); }
.rf-input { padding: 4px 8px; font-size: 12px; border-radius: var(--ctk-radius-sm); border: 1px solid var(--ctk-glass-border);
  background: var(--vscode-input-background); color: var(--vscode-input-foreground); width: 60px; text-align: center; }
.rf-input-wide { width: 100px; }
.rf-check { display: flex; align-items: center; gap: 6px; font-size: 12px; }
.rf-check input[type=checkbox] { margin: 0; }
.rf-sep { border-top: 1px solid var(--ctk-glass-border); margin: 8px 0; }
.rf-actions { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
.rf-pick-btn { padding: 6px 20px; border-radius: var(--ctk-radius-sm); border: 1px solid var(--ctk-accent);
  background: rgba(0,122,204,0.12); color: var(--ctk-accent); font-size: 12px; font-weight: 600;
  cursor: pointer; transition: all var(--ctk-duration) var(--ctk-ease); }
.rf-pick-btn:hover { background: rgba(0,122,204,0.25); transform: translateY(-1px); }

/* Problem results table */
.ptable { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 8px; }
.ptable th {
  text-align: left; padding: 6px 8px; font-weight: 600; font-size: 10px;
  color: var(--vscode-descriptionForeground, #999);
  border-bottom: 2px solid var(--ctk-glass-border);
  background: var(--ctk-glass-bg); white-space: nowrap;
  position: sticky; top: 0; z-index: 1;
}
.ptable td { padding: 5px 8px; border-bottom: 1px solid var(--ctk-glass-border); vertical-align: middle; }
.ptable tr:hover td { background: var(--ctk-glass-hover); }
.ptable tr.checked td { background: rgba(0,122,204,0.08); }
.ptable .col-check { width: 24px; text-align: center; }
.ptable .col-pid { width: 55px; color: var(--ctk-accent); font-family: 'JetBrains Mono', monospace; font-weight: 600; font-size: 11px; }
.ptable .col-title { }
.ptable .col-diff { width: 70px; font-size: 10px; }
.ptable .col-tags { max-width: 100px; color: var(--vscode-descriptionForeground, #999); font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: default; }
.tag-tooltip { position: fixed; z-index: 200; background: var(--vscode-editorHoverWidget-background, #2d2d30); color: var(--vscode-editorHoverWidget-foreground, #ccc); border: 1px solid var(--vscode-editorHoverWidget-border, #454545); padding: 6px 10px; border-radius: 4px; font-size: 11px; white-space: pre-wrap; max-width: 260px; line-height: 1.5; pointer-events: none; box-shadow: 0 2px 8px rgba(0,0,0,0.4); }
.ptable .col-accepted { width: 50px; text-align: right; font-family: 'JetBrains Mono', monospace; font-size: 10px; }
.ptable input[type="checkbox"] { cursor: pointer; accent-color: var(--ctk-accent); }

/* Tag dropdown selector */
.tag-selector { position: relative; display: flex; align-items: center; gap: 4px; flex-wrap: wrap; flex: 1; }
.tag-selected-chips { display: flex; gap: 4px; flex-wrap: wrap; max-height: 64px; overflow-y: auto; order: 1; }
.tag-dropdown-wrap { order: 0; }
.tag-chip-rm {
  display: inline-flex; align-items: center; gap: 2px;
  padding: 2px 8px; border-radius: var(--ctk-radius-pill); font-size: 10px;
  background: rgba(0,122,204,0.18); color: var(--ctk-accent); border: 1px solid var(--ctk-accent);
  white-space: nowrap; user-select: none;
}
.tag-chip-rm .tag-x { cursor: pointer; margin-left: 3px; font-weight: 700; opacity: 0.6; font-size: 11px; }
.tag-chip-rm .tag-x:hover { opacity: 1; }
.tag-add-btn {
  width: 22px; height: 22px; border-radius: 50%; border: 1px dashed var(--ctk-glass-border);
  background: none; color: var(--vscode-descriptionForeground, #999); cursor: pointer;
  font-size: 14px; display: flex; align-items: center; justify-content: center;
  transition: all var(--ctk-duration) var(--ctk-ease); padding: 0; line-height: 1;
}
.tag-add-btn:hover { border-color: var(--ctk-accent); color: var(--ctk-accent); background: rgba(0,122,204,0.08); }
.tag-dropdown-wrap { position: relative; display: inline-block; }
.tag-dropdown {
  position: fixed; z-index: 150;
  background: var(--vscode-editor-background, #1e1e1e);
  border: 1px solid var(--ctk-glass-border); border-radius: var(--ctk-radius-md);
  box-shadow: var(--ctk-shadow-lg); max-height: 200px; overflow-y: auto;
  min-width: 320px; display: none; padding: 4px 0;
}
.tag-dropdown.open { display: block; }
.tag-dropdown label {
  display: flex; align-items: baseline; gap: 6px;
  padding: 4px 10px; font-size: 11px; cursor: pointer;
  flex-wrap: wrap;
  transition: background var(--ctk-duration) var(--ctk-ease);
}
.tag-dropdown label:hover { background: var(--ctk-glass-hover); }
.tag-dropdown .tag-dd-sep { border-top: 1px solid var(--ctk-glass-border); margin: 2px 0; }

/* Modal footer info */
.modal-footer-info { flex: 1; font-size: 11px; color: var(--vscode-descriptionForeground, #999); }

/* ===== REFERENCE TAB ===== */
.ref-chips { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: var(--ctk-space-md); }
.ref-chip {
  padding: 4px 10px; border-radius: var(--ctk-radius-pill); font-size: 11px; cursor: pointer;
  background: var(--ctk-glass-bg); color: var(--vscode-badge-foreground, #ccc);
  border: 1px solid var(--ctk-glass-border);
  transition: all var(--ctk-duration) var(--ctk-ease);
  font-weight: 500;
}
.ref-chip:hover {
  background: var(--ctk-glass-hover);
  border-color: rgba(255,255,255,0.15);
  transform: translateY(-1px);
}
.ref-chip.active {
  background: rgba(0,122,204,0.15);
  color: var(--ctk-accent);
  border-color: var(--ctk-accent);
}
#refIframe {
  width: 100%; border: 1px solid var(--ctk-glass-border);
  border-radius: var(--ctk-radius-md); background: #fff;
  height: calc(100vh - 200px); min-height: 300px;
}

/* ===== SETTINGS TAB ===== */
.setting-group {
  margin-bottom: var(--ctk-space-md); padding: var(--ctk-space-lg);
  background: var(--ctk-glass-bg);
  border: 1px solid var(--ctk-glass-border);
  border-radius: var(--ctk-radius-md);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  transition: border-color var(--ctk-duration) var(--ctk-ease);
}
.setting-group:hover { border-color: rgba(255,255,255,0.12); }
.setting-group-title {
  font-size: 12px; font-weight: 600; margin-bottom: var(--ctk-space-md);
  color: var(--ctk-accent);
  text-transform: uppercase; letter-spacing: 0.5px;
}
.setting-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 6px 0; gap: var(--ctk-space-md);
  transition: background var(--ctk-duration) var(--ctk-ease);
  border-radius: var(--ctk-radius-sm);
  margin: 0 -4px; padding: 6px 4px;
}
.setting-row:hover { background: var(--ctk-glass-hover); }
.setting-row > label:first-child { flex: 1; }
.toggle-switch {
  position: relative; width: 38px; min-width: 38px; height: 20px; display: inline-block; flex: none;
}
.toggle-switch input { opacity: 0; width: 0; height: 0; }
.toggle-slider {
  position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  background: var(--vscode-input-background, #3c3c3c);
  border: 1px solid var(--vscode-input-border, #555);
  border-radius: 10px; cursor: pointer;
  transition: all var(--ctk-duration) var(--ctk-ease);
}
.toggle-slider::before {
  content: ''; position: absolute; width: 14px; height: 14px;
  left: 2px; bottom: 2px; background: #999; border-radius: 50%;
  transition: all var(--ctk-duration) var(--ctk-ease-bounce, var(--ctk-ease));
}
.toggle-switch input:checked + .toggle-slider {
  background: var(--ctk-accent);
  border-color: var(--ctk-accent);
}
.toggle-switch input:checked + .toggle-slider::before {
  transform: translateX(18px); background: #fff;
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}

/* ===== SEARCH / RANDOM / MYSOLVED MODAL ===== */
.modal-overlay {
  display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.6); z-index: 100; align-items: flex-start; justify-content: center;
  padding-top: 40px;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}
.modal-overlay.open { display: flex; }
.modal {
  background: var(--vscode-editor-background, #1e1e1e);
  border: 1px solid var(--ctk-glass-border);
  border-radius: var(--ctk-radius-lg); width: 90%; max-width: 500px; max-height: 70vh;
  display: flex; flex-direction: column;
  box-shadow: var(--ctk-shadow-lg);
  animation: modalIn 0.25s var(--ctk-ease);
}
@keyframes modalIn {
  from { opacity: 0; transform: translateY(-12px) scale(0.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: var(--ctk-space-md) var(--ctk-space-lg);
  border-bottom: 1px solid var(--ctk-glass-border);
  font-weight: 600; font-size: 14px;
}
.modal-close {
  background: none; border: none; color: var(--vscode-descriptionForeground, #888);
  font-size: 18px; cursor: pointer; padding: 4px 8px; border-radius: var(--ctk-radius-sm);
  transition: all var(--ctk-duration) var(--ctk-ease);
  line-height: 1;
}
.modal-close:hover { background: rgba(218,54,51,0.1); color: var(--ctk-danger); }
.modal-footer .modal-close { font-size: 13px; }
.modal-body { padding: var(--ctk-space-lg); overflow-y: auto; flex: 1; }
.modal-footer {
  padding: var(--ctk-space-md) var(--ctk-space-lg);
  border-top: 1px solid var(--ctk-glass-border);
  display: flex; justify-content: flex-end; gap: var(--ctk-space-sm);
}
.problem-list-item {
  padding: var(--ctk-space-sm) var(--ctk-space-md); cursor: pointer;
  border-bottom: 1px solid var(--ctk-glass-border);
  font-size: 12px; display: flex; justify-content: space-between; align-items: center;
  border-radius: var(--ctk-radius-sm);
  transition: all var(--ctk-duration) var(--ctk-ease);
  margin: 0 -4px;
  padding: var(--ctk-space-sm) var(--ctk-space-sm);
}
.problem-list-item:hover {
  background: var(--ctk-glass-hover);
  transform: translateX(2px);
}
.problem-list-item:last-child { border-bottom: none; }
.problem-list-item .pid {
  color: var(--ctk-accent); min-width: 50px;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 11px; font-weight: 600;
}
.problem-list-item .ptitle { flex: 1; margin: 0 var(--ctk-space-sm); }
.problem-list-item .plevel {
  font-size: 10px; padding: 2px 6px; border-radius: var(--ctk-radius-pill);
  background: var(--ctk-glass-bg); color: var(--vscode-badge-foreground, #ccc);
  border: 1px solid var(--ctk-glass-border);
}
.search-input-row { display: flex; gap: var(--ctk-space-sm); margin-bottom: var(--ctk-space-md); }
.search-input-row input { flex: 1; }

/* ===== LOADING SPINNER ===== */
.spinner {
  display: none; text-align: center; padding: var(--ctk-space-xl);
  color: var(--vscode-descriptionForeground, #999); font-size: 12px;
}
.spinner.active { display: block; }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
.spinner::before {
  content: ''; display: inline-block; width: 18px; height: 18px;
  border: 2px solid var(--ctk-glass-border);
  border-top-color: var(--ctk-accent); border-radius: 50%;
  animation: spin 0.8s linear infinite; vertical-align: middle; margin-right: var(--ctk-space-sm);
}

/* ===== PROGRESS BAR (Countdown) ===== */
.progress-bar-container {
  width: 100%; height: 6px; background: var(--ctk-glass-bg);
  border-radius: 3px; overflow: hidden; margin-bottom: var(--ctk-space-md); display: none;
  border: 1px solid var(--ctk-glass-border);
}
.progress-bar-fill {
  height: 100%; background: linear-gradient(90deg, var(--ctk-accent), #3fb950);
  border-radius: 3px; transition: width 0.5s linear;
}

/* ===== NOTIFICATION TOAST ===== */
.toast {
  position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%) translateY(12px);
  padding: 10px 20px; border-radius: var(--ctk-radius-pill); font-size: 12px;
  z-index: 200; opacity: 0;
  transition: all 0.35s var(--ctk-ease);
  pointer-events: none;
  box-shadow: var(--ctk-shadow-md);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  font-weight: 500;
}
.toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
.toast.info { background: rgba(0,122,204,0.9); color: #fff; }
.toast.error { background: rgba(218,54,51,0.9); color: #fff; }
.toast.success { background: rgba(46,160,67,0.9); color: #fff; }
</style>
</head>
<body>
<div id="app">

<!-- ===== TAB BAR ===== -->
<div class="tab-bar">
  <button class="tab-btn active" data-tab="tabProblem">
    <span class="tab-icon codicon codicon-book"></span><span data-ko="문제" data-en="Problem">Problem</span>
  </button>
  <button class="tab-btn" data-tab="tabTest">
    <span class="tab-icon codicon codicon-play"></span><span data-ko="테스트" data-en="Test">Test</span>
  </button>
  <button class="tab-btn" data-tab="tabTemplate">
    <span class="tab-icon codicon codicon-file-code"></span><span data-ko="템플릿" data-en="Template">Template</span>
  </button>
  <button class="tab-btn" data-tab="tabTimer">
    <span class="tab-icon codicon codicon-watch"></span><span data-ko="타이머" data-en="Timer">Timer</span>
  </button>
  <button class="tab-btn" data-tab="tabReference">
    <span class="tab-icon codicon codicon-globe"></span><span data-ko="참조" data-en="Ref">Ref</span>
  </button>
  <button class="tab-btn" data-tab="tabSettings">
    <span class="tab-icon codicon codicon-gear"></span><span data-ko="설정" data-en="Settings">Settings</span>
  </button>
</div>

<!-- ================= TAB 1: PROBLEM ================= -->
<div id="tabProblem" class="tab-content active">
  <!-- Row 1: Platform + Language + Login -->
  <div class="row">
    <select id="platformSelect">
      <option value="BAEKJOON">백준</option>
      <option value="PROGRAMMERS">프로그래머스</option>
      <option value="SWEA">SWEA</option>
      <option value="LEETCODE">LeetCode</option>
      <option value="CODEFORCES">Codeforces</option>
    </select>
    <select id="languageSelect">
      <option value="JAVA">Java</option>
      <option value="PYTHON">Python</option>
      <option value="CPP">C++</option>
      <option value="KOTLIN">Kotlin</option>
      <option value="JAVASCRIPT">JavaScript</option>
    </select>
    <button id="loginBtn" class="secondary"><span class="codicon codicon-log-in"></span> <span data-ko="로그인" data-en="Login">Login</span></button>
  </div>
  <!-- Row 2: Problem ID + Fetch + Random + Search + MySolved -->
  <div class="row">
    <input id="problemIdInput" type="text" placeholder="Problem ID" data-placeholder-ko="문제 번호" data-placeholder-en="Problem ID" style="flex:2;"/>
    <button id="fetchBtn"><span class="codicon codicon-cloud-download"></span> <span data-ko="가져오기" data-en="Fetch">Fetch</span></button>
    <button id="randomBtn" class="secondary"><span class="codicon codicon-refresh"></span> <span data-ko="랜덤" data-en="Random">Random</span></button>
    <button id="searchBtn" class="secondary"><span class="codicon codicon-search"></span> <span data-ko="검색" data-en="Search">Search</span></button>
    <button id="mySolvedBtn" class="secondary"><span class="codicon codicon-list-ordered"></span> <span data-ko="내 풀이" data-en="Solved">Solved</span></button>
  </div>
  <!-- Row 3: Submit + GitHub Push + Translate -->
  <div class="row">
    <button id="submitBtn" class="success"><span class="codicon codicon-cloud-upload"></span> <span data-ko="제출" data-en="Submit">Submit</span></button>
    <button id="githubPushBtn" class="secondary"><span class="codicon codicon-github"></span> <span data-ko="GitHub" data-en="GitHub">GitHub</span></button>
    <button id="translateBtn" class="secondary"><span class="codicon codicon-globe"></span> <span data-ko="번역" data-en="Translate">Translate</span></button>
  </div>
  <!-- Problem display -->
  <div id="problemContent">
    <div style="text-align:center; padding:40px 20px; color:var(--vscode-descriptionForeground,#777);">
      <p style="font-size:14px; margin-bottom:8px;">CodingTestKit</p>
      <p style="font-size:12px;" data-ko="문제 번호를 입력하고 가져오기를 클릭하세요." data-en="Enter a problem ID and click Fetch to get started.">Enter a problem ID and click Fetch to get started.</p>
    </div>
  </div>
</div>

<!-- ================= TAB 2: TEST ================= -->
<div id="tabTest" class="tab-content">
  <div class="row">
    <span id="testLangLabel" style="font-size:12px; font-weight:600;">Java</span>
    <span style="flex:1;"></span>
    <button id="runAllBtn" class="success"><span class="codicon codicon-play"></span> <span data-ko="전체 실행" data-en="Run All">Run All</span></button>
    <button id="addTestBtn" class="secondary"><span class="codicon codicon-add"></span> <span data-ko="추가" data-en="Add">Add</span></button>
  </div>
  <div id="testInfoBar" class="info-bar" data-ko="테스트 케이스가 없습니다." data-en="No test cases loaded.">
    No test cases loaded.
  </div>
  <div id="testCaseContainer">
    <!-- Test case cards inserted here -->
  </div>
</div>

<!-- ================= TAB 3: TEMPLATE ================= -->
<div id="tabTemplate" class="tab-content">
  <div class="row">
    <input id="templateNameInput" type="text" placeholder="Template name" data-placeholder-ko="템플릿 이름" data-placeholder-en="Template name" style="flex:2;"/>
    <select id="templateLangSelect">
      <option value="JAVA">Java</option>
      <option value="PYTHON">Python</option>
      <option value="CPP">C++</option>
      <option value="KOTLIN">Kotlin</option>
      <option value="JAVASCRIPT">JavaScript</option>
    </select>
  </div>
  <div class="row">
    <button id="saveTemplateBtn"><span class="codicon codicon-save"></span> <span data-ko="저장" data-en="Save">Save</span></button>
    <button id="loadTemplateBtn" class="secondary"><span class="codicon codicon-folder-opened"></span> <span data-ko="불러오기" data-en="Load">Load</span></button>
    <button id="deleteTemplateBtn" class="danger"><span class="codicon codicon-trash"></span> <span data-ko="삭제" data-en="Delete">Delete</span></button>
  </div>
  <div class="section-title" data-ko="저장된 템플릿" data-en="Saved Templates">Saved Templates</div>
  <div class="template-list" id="templateList">
    <div style="padding:10px; text-align:center; color:var(--vscode-descriptionForeground,#777); font-size:12px;" data-ko="저장된 템플릿이 없습니다." data-en="No templates saved yet.">
      No templates saved yet.
    </div>
  </div>
  <div class="section-title" data-ko="코드 미리보기" data-en="Code Preview">Code Preview</div>
  <div id="templateCodeContainer"></div>
</div>

<!-- ================= TAB 4: TIMER ================= -->
<div id="tabTimer" class="tab-content">
  <div class="timer-subtabs">
    <div class="timer-subtab active" data-subtab="stopwatch" data-ko="스톱워치" data-en="Stopwatch">Stopwatch</div>
    <div class="timer-subtab" data-subtab="countdown" data-ko="카운트다운" data-en="Countdown">Countdown</div>
  </div>

  <!-- Stopwatch -->
  <div id="subtabStopwatch">
    <div class="timer-display" id="stopwatchDisplay">00:00.00</div>
    <div class="timer-controls">
      <button id="swStartBtn" class="success" data-ko="시작" data-en="Start">Start</button>
      <button id="swStopBtn" class="danger" disabled data-ko="정지" data-en="Stop">Stop</button>
      <button id="swResetBtn" class="secondary" data-ko="초기화" data-en="Reset">Reset</button>
      <button id="swLapBtn" class="secondary" disabled data-ko="랩" data-en="Lap">Lap</button>
    </div>
    <table class="lap-table" id="lapTable">
      <thead><tr><th>#</th><th data-ko="랩 타임" data-en="Lap Time">Lap Time</th><th data-ko="합계" data-en="Total">Total</th><th data-ko="메모" data-en="Memo">Memo</th></tr></thead>
      <tbody id="lapTableBody"></tbody>
    </table>
  </div>

  <!-- Countdown -->
  <div id="subtabCountdown" style="display:none;">
    <div class="countdown-modes">
      <label><input type="checkbox" id="cdCircular" checked /> <span data-ko="원형" data-en="Circular">Circular</span></label>
      <label><input type="checkbox" id="cdDigital" checked /> <span data-ko="디지털" data-en="Digital">Digital</span></label>
      <label><input type="checkbox" id="cdProgress" /> <span data-ko="진행 바" data-en="Progress Bar">Progress Bar</span></label>
    </div>
    <canvas id="countdownCanvas" width="280" height="280" style="max-width:100%;"></canvas>
    <div class="countdown-digital" id="countdownDigital">00:00:00</div>
    <div class="progress-bar-container" id="cdProgressBar">
      <div class="progress-bar-fill" id="cdProgressFill" style="width:100%;"></div>
    </div>
    <div class="countdown-input-row">
      <label>H</label><input type="number" id="cdHours" min="0" max="99" value="0"/>
      <label>M</label><input type="number" id="cdMinutes" min="0" max="59" value="30"/>
      <label>S</label><input type="number" id="cdSeconds" min="0" max="59" value="0"/>
    </div>
    <div class="presets">
      <button class="secondary cd-preset" data-m="30">30m</button>
      <button class="secondary cd-preset" data-m="60">1h</button>
      <button class="secondary cd-preset" data-m="120">2h</button>
      <button class="secondary cd-preset" data-m="180">3h</button>
    </div>
    <div class="timer-controls">
      <button id="cdStartBtn" class="success" data-ko="시작" data-en="Start">Start</button>
      <button id="cdStopBtn" class="danger" disabled data-ko="정지" data-en="Stop">Stop</button>
      <button id="cdResetBtn" class="secondary" data-ko="초기화" data-en="Reset">Reset</button>
    </div>
  </div>
</div>

<!-- ================= TAB 5: REFERENCE ================= -->
<div id="tabReference" class="tab-content">
  <div class="row">
    <select id="refLangSelect">
      <option value="java">Java</option>
      <option value="python">Python</option>
      <option value="cpp">C++</option>
      <option value="kotlin">Kotlin</option>
      <option value="javascript">JavaScript</option>
    </select>
  </div>
  <div class="ref-chips" id="refChips">
    <!-- chips inserted by JS -->
  </div>
  <iframe id="refIframe" src="about:blank" sandbox="allow-scripts allow-same-origin allow-popups"></iframe>
</div>

<!-- ================= TAB 6: SETTINGS ================= -->
<div id="tabSettings" class="tab-content">
  <div class="setting-group">
    <div class="setting-group-title" data-ko="UI 언어" data-en="UI Language">UI Language</div>
    <div class="setting-row">
      <label data-ko="언어" data-en="Language">Language</label>
      <select id="settingLang">
        <option value="KO">한국어</option>
        <option value="EN">English</option>
      </select>
    </div>
  </div>
  <div class="setting-group">
    <div class="setting-group-title" data-ko="코딩 환경" data-en="Coding Environment">Coding Environment</div>
    <div class="setting-row">
      <label data-ko="자동완성 끄기" data-en="Disable Auto Complete">Disable Auto Complete</label>
      <label class="toggle-switch">
        <input type="checkbox" id="settingAutoComplete" />
        <span class="toggle-slider"></span>
      </label>
    </div>
    <div class="setting-row">
      <label data-ko="구문 강조 끄기" data-en="Syntax Highlighting OFF">Syntax Highlighting OFF</label>
      <label class="toggle-switch">
        <input type="checkbox" id="settingSyntaxOff" />
        <span class="toggle-slider"></span>
      </label>
    </div>
    <div class="setting-row">
      <label data-ko="오류 검사 끄기" data-en="Diagnostics OFF">Diagnostics OFF</label>
      <label class="toggle-switch">
        <input type="checkbox" id="settingDiagnosticsOff" />
        <span class="toggle-slider"></span>
      </label>
    </div>
    <div class="setting-row">
      <label data-ko="사용위치 힌트 끄기" data-en="CodeLens OFF">CodeLens OFF</label>
      <label class="toggle-switch">
        <input type="checkbox" id="settingCodeLensOff" />
        <span class="toggle-slider"></span>
      </label>
    </div>
    <div class="setting-row">
      <label data-ko="외부 붙여넣기 차단" data-en="Block External Paste">Block External Paste</label>
      <label class="toggle-switch">
        <input type="checkbox" id="settingPasteBlock" />
        <span class="toggle-slider"></span>
      </label>
    </div>
    <div class="setting-row">
      <label data-ko="포커스 이탈 감지" data-en="Focus Alert">Focus Alert</label>
      <label class="toggle-switch">
        <input type="checkbox" id="settingFocusAlert" />
        <span class="toggle-slider"></span>
      </label>
    </div>
    <div class="setting-row" style="gap:6px; justify-content:flex-end; margin-top:4px;">
      <button id="btnExamMode" class="secondary" style="font-size:11px;" data-ko="시험 모드" data-en="Exam Mode">Exam Mode</button>
      <button id="btnNormalMode" class="secondary" style="font-size:11px;" data-ko="일반 모드" data-en="Normal Mode">Normal Mode</button>
    </div>
  </div>
  <div class="setting-group">
    <div class="setting-group-title" data-ko="파일 설정" data-en="File Settings">File Settings</div>
    <div class="setting-row">
      <label data-ko="README 생성" data-en="Generate README">Generate README</label>
      <label class="toggle-switch">
        <input type="checkbox" id="settingReadme" />
        <span class="toggle-slider"></span>
      </label>
    </div>
  </div>
  <div class="setting-group">
    <div class="setting-group-title" data-ko="GitHub 연동" data-en="GitHub Integration">GitHub Integration</div>
    <div class="setting-row">
      <label data-ko="토큰" data-en="Token">Token</label>
      <input id="settingGithubToken" type="password" placeholder="GitHub PAT" style="width:180px;"/>
    </div>
    <div class="setting-row">
      <label data-ko="레포지토리" data-en="Repository">Repository</label>
      <select id="settingGithubRepo" style="width:180px;">
        <option value="" data-ko="-- 레포 선택 --" data-en="-- Select repo --">-- Select repo --</option>
      </select>
    </div>
    <div class="setting-row">
      <label data-ko="제출 시 자동 푸시" data-en="Auto Push on Submit">Auto Push on Submit</label>
      <label class="toggle-switch">
        <input type="checkbox" id="settingAutoPush" />
        <span class="toggle-slider"></span>
      </label>
    </div>
  </div>
  <div class="setting-group">
    <div class="setting-group-title" data-ko="도움말" data-en="Help">Help</div>
    <div id="settingHelp" style="font-size:11px; color:var(--vscode-descriptionForeground,#999); line-height:1.6;"></div>
  </div>
  <div class="setting-group">
    <div class="setting-group-title" data-ko="감지된 도구 경로" data-en="Detected Tool Paths">Detected Tool Paths</div>
    <div id="settingToolPaths" style="font-size:11px; line-height:1.8;"></div>
  </div>
</div>

<!-- ===== SEARCH MODAL ===== -->
<div class="modal-overlay" id="searchModal">
  <div class="modal" style="max-width:600px; max-height:80vh;">
    <div class="modal-header">
      <span data-ko="문제 검색" data-en="Search Problems">Search Problems</span>
      <button class="modal-close" data-close="searchModal">&times;</button>
    </div>
    <div class="modal-body" style="overflow-y:auto;">
      <div class="search-input-row">
        <input id="searchQueryInput" type="text" placeholder="Search by title, tag, or ID..." data-placeholder-ko="제목, 태그, ID로 검색..." data-placeholder-en="Search by title, tag, or ID..."/>
        <button id="searchQueryBtn"><span class="codicon codicon-search"></span> <span data-ko="검색" data-en="Search">Search</span></button>
      </div>
      <div id="searchFilters"></div>
      <div id="searchSpinner" class="spinner" data-ko="검색 중..." data-en="Searching...">Searching...</div>
      <div id="searchResultsList"></div>
    </div>
    <div class="modal-footer">
      <span class="modal-footer-info" id="searchFooterInfo"></span>
      <button id="searchTranslateBtn" class="btn-sm" title="EN↔KO">EN</button>
      <button class="secondary modal-close" data-close="searchModal" data-ko="닫기" data-en="Close">Close</button>
      <button id="searchFetchBtn" data-ko="가져오기" data-en="Fetch">Fetch</button>
    </div>
  </div>
</div>

<!-- ===== RANDOM MODAL ===== -->
<div class="modal-overlay" id="randomModal">
  <div class="modal" style="max-width:600px; max-height:80vh;">
    <div class="modal-header">
      <span id="randomModalTitle" data-ko="랜덤 문제" data-en="Random Problem">Random Problem</span>
      <button class="modal-close" data-close="randomModal">&times;</button>
    </div>
    <div class="modal-body" style="overflow-y:auto;">
      <div id="randomFilters"></div>
      <div id="randomSpinner" class="spinner" data-ko="랜덤 문제 검색 중..." data-en="Finding random problem...">Finding random problem...</div>
      <div id="randomResultsList"></div>
    </div>
    <div class="modal-footer">
      <span class="modal-footer-info" id="randomFooterInfo"></span>
      <button id="randomTranslateBtn" class="btn-sm" title="EN↔KO">EN</button>
      <button class="secondary modal-close" data-close="randomModal" data-ko="닫기" data-en="Close">Close</button>
      <button id="randomFetchBtn" data-ko="가져오기" data-en="Fetch">Fetch</button>
    </div>
  </div>
</div>

<!-- ===== MY SOLVED MODAL ===== -->
<div class="modal-overlay" id="mySolvedModal">
  <div class="modal" style="max-width:600px; max-height:80vh;">
    <div class="modal-header">
      <span data-ko="내 풀이 목록" data-en="My Solved Problems">My Solved Problems</span>
      <button class="modal-close" data-close="mySolvedModal">&times;</button>
    </div>
    <div class="modal-body" style="overflow-y:auto;">
      <div id="mySolvedSpinner" class="spinner" data-ko="불러오는 중..." data-en="Loading...">Loading...</div>
      <div id="mySolvedList"></div>
    </div>
    <div class="modal-footer">
      <span class="modal-footer-info" id="mySolvedFooterInfo"></span>
      <button class="secondary modal-close" data-close="mySolvedModal" data-ko="닫기" data-en="Close">Close</button>
      <button id="mySolvedFetchBtn" data-ko="가져오기" data-en="Fetch">Fetch</button>
    </div>
  </div>
</div>

<!-- ===== TOAST ===== -->
<div id="toast" class="toast info"></div>

</div><!-- /app -->

<script>
(function() {
  'use strict';

  // ===== VS Code API =====
  const vscode = acquireVsCodeApi();

  // ===== STATE =====
  let state = {
    currentTab: 'tabProblem',
    platform: 'BAEKJOON',
    language: 'JAVA',
    problem: null,
    testCases: [],
    testRunning: false,
    templates: [],
    selectedTemplate: null,
    // Stopwatch
    swRunning: false,
    swStartTime: 0,
    swElapsed: 0,
    swInterval: null,
    swLaps: [],
    // Countdown
    cdRunning: false,
    cdTotalMs: 30 * 60 * 1000,
    cdRemainingMs: 30 * 60 * 1000,
    cdStartTime: 0,
    cdInterval: null,
    // Settings
    uiLang: 'KO',
    loginStatus: null,
    focusLostCount: 0,
    // Dynamic tags (fetched from APIs)
    _cachedTags: {},
    _tagsLoading: {},
    // Programmers exam collections
    _examCollections: [],
    _examCollectionsLoading: false,
  };

  // ===== Dropdown positioning =====
  function positionTagDropdown(btn, dropdown) {
    var rect = btn.getBoundingClientRect();
    dropdown.style.top = (rect.bottom + 4) + 'px';
    dropdown.style.left = rect.left + 'px';
  }

  // ===== I18N =====
  function t(ko, en) { return state.uiLang === 'KO' ? ko : en; }

  var HEADER_KO_EN = {
    '문제': 'Problem', '입력': 'Input', '출력': 'Output',
    '제한': 'Constraints', '힌트': 'Hint', '노트': 'Note', '예제': 'Examples'
  };
  var HEADER_EN_KO = {
    'Problem': '문제', 'Input': '입력', 'Output': '출력',
    'Constraints': '제한', 'Hint': '힌트', 'Note': '노트', 'Examples': '예제'
  };

  function translateProblemHeaders(container) {
    container.querySelectorAll('h2, h3').forEach(function(h) {
      var txt = h.textContent.trim();
      // Korean → English mapping
      if (HEADER_KO_EN[txt]) {
        h.setAttribute('data-ko', txt);
        h.setAttribute('data-en', HEADER_KO_EN[txt]);
        h.textContent = t(txt, HEADER_KO_EN[txt]);
        return;
      }
      // English → Korean mapping (Codeforces etc.)
      if (HEADER_EN_KO[txt]) {
        h.setAttribute('data-ko', HEADER_EN_KO[txt]);
        h.setAttribute('data-en', txt);
        h.textContent = t(HEADER_EN_KO[txt], txt);
        return;
      }
      // "예제 입력 N" — flexible regex (allows trailing text like copy buttons)
      var sIn = txt.match(/^예제\s*입력\s*(\d+)/);
      if (sIn) {
        var koText = '예제 입력 ' + sIn[1];
        var enText = 'Sample Input ' + sIn[1];
        h.setAttribute('data-ko', koText);
        h.setAttribute('data-en', enText);
        h.textContent = t(koText, enText);
        return;
      }
      // "예제 출력 N"
      var sOut = txt.match(/^예제\s*출력\s*(\d+)/);
      if (sOut) {
        var koText2 = '예제 출력 ' + sOut[1];
        var enText2 = 'Sample Output ' + sOut[1];
        h.setAttribute('data-ko', koText2);
        h.setAttribute('data-en', enText2);
        h.textContent = t(koText2, enText2);
        return;
      }
      // "Sample Input N" (from English-source platforms)
      var eIn = txt.match(/^Sample\s+Input\s+(\d+)/i);
      if (eIn) {
        var koText3 = '예제 입력 ' + eIn[1];
        var enText3 = 'Sample Input ' + eIn[1];
        h.setAttribute('data-ko', koText3);
        h.setAttribute('data-en', enText3);
        h.textContent = t(koText3, enText3);
        return;
      }
      // "Sample Output N"
      var eOut = txt.match(/^Sample\s+Output\s+(\d+)/i);
      if (eOut) {
        var koText4 = '예제 출력 ' + eOut[1];
        var enText4 = 'Sample Output ' + eOut[1];
        h.setAttribute('data-ko', koText4);
        h.setAttribute('data-en', enText4);
        h.textContent = t(koText4, enText4);
        return;
      }
    });
  }

  function refreshProblemAttribution() {
    var el = document.getElementById('problemAttribution');
    if (!el || !state.problem) return;
    var p = state.problem;
    var sourceNames = {
      BAEKJOON: state.uiLang === 'KO' ? '백준 온라인 저지' : 'Baekjoon Online Judge',
      PROGRAMMERS: state.uiLang === 'KO' ? '프로그래머스 코딩 테스트 연습' : 'Programmers Coding Test Practice',
      SWEA: 'SW Expert Academy',
      LEETCODE: 'LeetCode',
      CODEFORCES: 'Codeforces'
    };
    var sourceUrls = {
      BAEKJOON: 'https://www.acmicpc.net/problem/' + p.id,
      PROGRAMMERS: 'https://school.programmers.co.kr/learn/courses/30/lessons/' + p.id,
      SWEA: 'https://swexpertacademy.com/main/code/problem/problemDetail.do?contestProbId=' + (p.contestProbId || p.id),
      LEETCODE: 'https://leetcode.com/problems/' + p.id + '/',
      CODEFORCES: 'https://codeforces.com/problemset/problem/' + (p.contestProbId || p.id)
    };
    var sourceName = sourceNames[p.source] || p.source;
    var problemUrl = sourceUrls[p.source] || '';
    var disclaimerText = state.uiLang === 'KO'
      ? '이 문제의 저작권은 ' + sourceName + '에 있습니다. 개인 학습 목적으로만 사용하세요.'
      : 'All rights reserved by ' + sourceName + '. For personal study use only.';
    el.innerHTML = (state.uiLang === 'KO' ? '출처' : 'Source') + ': ' + sourceName + '<br>'
      + '<span style="color:#589df6;">' + problemUrl + '</span><br>'
      + disclaimerText;
  }

  function applyI18n() {
    document.querySelectorAll('[data-ko][data-en]').forEach(function(el) {
      var ko = el.getAttribute('data-ko');
      var en = el.getAttribute('data-en');
      if (ko && en) {
        el.textContent = state.uiLang === 'KO' ? ko : en;
      }
    });
    document.querySelectorAll('[data-placeholder-ko][data-placeholder-en]').forEach(function(el) {
      var ko = el.getAttribute('data-placeholder-ko');
      var en = el.getAttribute('data-placeholder-en');
      if (ko && en) {
        el.placeholder = state.uiLang === 'KO' ? ko : en;
      }
    });
    // Re-render test cards so labels update
    if (state.testCases.length > 0) {
      renderTestCases();
    }
    // Re-render problem source attribution
    refreshProblemAttribution();
    renderHelpSection();
  }

  function renderHelpSection() {
    var el = $('#settingHelp');
    if (!el) return;
    if (state.uiLang === 'KO') {
      el.innerHTML =
        '<b>자동완성</b> – 코드 자동완성 팝업을 끕니다<br/>' +
        '<b>오류 검사 끄기</b> – 코드 오류/경고 표시를 숨깁니다<br/>' +
        '<b>사용위치 힌트 끄기</b> – 함수/클래스 위의 "N개 참조" 힌트를 숨깁니다<br/>' +
        '<b>외부 붙여넣기 차단</b> – 에디터 밖에서 복사한 텍스트 붙여넣기를 차단합니다<br/>' +
        '<b>포커스 이탈 감지</b> – VS Code 창이 포커스를 잃으면 알림을 표시합니다<br/>' +
        '<br/><b>시험 모드</b>를 누르면 위 5개를 한번에 활성화합니다<br/>' +
        '<b>일반 모드</b>를 누르면 모두 해제합니다';
    } else {
      el.innerHTML =
        '<b>Auto Complete</b> – Disable auto-completion popups<br/>' +
        '<b>Diagnostics OFF</b> – Hide code error/warning diagnostics<br/>' +
        '<b>CodeLens OFF</b> – Hide "N references" hints above functions/classes<br/>' +
        '<b>Block External Paste</b> – Block pasting text copied from outside the editor<br/>' +
        '<b>Focus Alert</b> – Show alert when VS Code window loses focus<br/>' +
        '<br/>Press <b>Exam Mode</b> to enable all 5 restrictions at once<br/>' +
        'Press <b>Normal Mode</b> to disable all restrictions';
    }
  }

  // ===== UTILITY FUNCTIONS =====
  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return document.querySelectorAll(sel); }

  function showToast(msg, type) {
    type = type || 'info';
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast ' + type + ' show';
    clearTimeout(t._timer);
    t._timer = setTimeout(function() { t.classList.remove('show'); }, 3000);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    const cs = Math.floor((ms % 1000) / 10);
    return String(min).padStart(2, '0') + ':' + String(sec).padStart(2, '0') + '.' + String(cs).padStart(2, '0');
  }

  function formatCountdown(ms) {
    if (ms < 0) { ms = 0; }
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  // ===== TAB SWITCHING =====
  $$('.tab-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var tabId = btn.getAttribute('data-tab');
      switchTab(tabId);
    });
  });

  function switchTab(tabId) {
    $$('.tab-btn').forEach(function(b) { b.classList.toggle('active', b.getAttribute('data-tab') === tabId); });
    $$('.tab-content').forEach(function(c) { c.classList.toggle('active', c.id === tabId); });
    state.currentTab = tabId;
    // Initialize canvas if switching to timer countdown
    if (tabId === 'tabTimer') {
      drawCountdownCanvas();
    }
  }

  // Timer subtabs
  $$('.timer-subtab').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var sub = btn.getAttribute('data-subtab');
      $$('.timer-subtab').forEach(function(b) { b.classList.toggle('active', b.getAttribute('data-subtab') === sub); });
      $('#subtabStopwatch').style.display = sub === 'stopwatch' ? 'block' : 'none';
      $('#subtabCountdown').style.display = sub === 'countdown' ? 'block' : 'none';
      if (sub === 'countdown') { drawCountdownCanvas(); }
    });
  });

  // ===== PROBLEM TAB =====
  $('#platformSelect').addEventListener('change', function() {
    state.platform = this.value;
    if (window.cmEditor) { window.cmEditor.setPlatform(this.value); }
    vscode.postMessage({ command: 'changePlatform', data: { source: this.value } });
  });

  $('#languageSelect').addEventListener('change', function() {
    state.language = this.value;
    $('#testLangLabel').textContent = this.options[this.selectedIndex].text;
    vscode.postMessage({ command: 'changeLanguage', data: { language: this.value } });
  });

  $('#fetchBtn').addEventListener('click', function() {
    var id = $('#problemIdInput').value.trim();
    if (!id) { showToast(t('문제 번호를 입력하세요.', 'Please enter a problem ID.'), 'error'); return; }
    vscode.postMessage({ command: 'fetchProblem', data: { problemId: id, source: state.platform, language: state.language } });
    showToast(t('문제 가져오는 중...', 'Fetching problem...'));
  });

  $('#loginBtn').addEventListener('click', function() {
    if (state.loginStatus) {
      vscode.postMessage({ command: 'logout', data: { source: state.platform } });
    } else {
      vscode.postMessage({ command: 'login', data: { source: state.platform } });
    }
  });

  $('#submitBtn').addEventListener('click', function() {
    vscode.postMessage({ command: 'submitCode', data: { source: state.platform, language: state.language } });
    showToast(t('코드 제출 중...', 'Submitting code...'));
  });

  $('#githubPushBtn').addEventListener('click', function() {
    vscode.postMessage({ command: 'pushToGitHub', data: {} });
    showToast(t('GitHub에 푸시 중...', 'Pushing to GitHub...'));
  });

  $('#translateBtn').addEventListener('click', function() {
    vscode.postMessage({ command: 'translate', data: {} });
    showToast(t('번역 중...', 'Translating...'));
  });

  // ─── Search modal: platform-specific filters ───
  function renderSearchFilters() {
    var c = $('#searchFilters');
    c.textContent = '';
    var p = state.platform;
    var html = '';

    // Request dynamic tags if not cached
    if (p === 'LEETCODE') { requestTagsIfNeeded('LEETCODE'); }
    else if (p === 'CODEFORCES') { requestTagsIfNeeded('CODEFORCES'); }

    if (p === 'BAEKJOON') {
      html += '<div class="rf-row">';
      html += '<span class="rf-label">' + t('정렬','Sort') + '</span>';
      html += '<select id="sfSort" class="rf-select"><option value="id">' + t('번호순','By Number') + '</option><option value="level">' + t('난이도순','By Difficulty') + '</option><option value="title">' + t('제목순','By Title') + '</option><option value="solved">' + t('맞은 사람순','By Solved') + '</option></select>';
      html += '<span class="rf-label" style="min-width:auto;">' + t('풀이 필터','Solve') + '</span>';
      html += '<select id="sfSolveFilter" class="rf-select"><option value="0">' + t('전체','All') + '</option><option value="1">' + t('푼 문제 제외','Exclude Solved') + '</option><option value="2">' + t('푼 문제만','Only Solved') + '</option></select>';
      html += '</div>';
    } else if (p === 'SWEA') {
      html += '<div class="rf-row"><span class="rf-label">' + t('난이도','Difficulty') + '</span><div class="rf-chips" id="sfSweaLevels">';
      ['D1','D2','D3','D4','D5','D6','D7','D8'].forEach(function(d){ html += '<span class="rf-chip" data-level="'+d+'">'+d+'</span>'; });
      html += '</div></div>';
      html += '<div class="rf-row">';
      html += '<span class="rf-label">' + t('언어','Language') + '</span>';
      html += '<select id="sfSweaLang" class="rf-select"><option value="ALL">' + t('전체','All') + '</option><option value="CCPP">C/C++</option><option value="JAVA">Java</option><option value="PYTHON">Python</option></select>';
      html += '<span class="rf-label" style="min-width:auto;">' + t('정렬','Sort') + '</span>';
      html += '<select id="sfSweaSort" class="rf-select"><option value="INQUERY_COUNT">' + t('참여자순','Participants') + '</option><option value="FIRST_REG_DATETIME">' + t('최신순','Date') + '</option><option value="SUBMIT_COUNT">' + t('제출순','Submissions') + '</option><option value="PASS_RATE">' + t('정답률순','Pass Rate') + '</option></select>';
      html += '</div>';
    } else if (p === 'LEETCODE') {
      html += '<div class="rf-row">';
      html += '<span class="rf-label">' + t('난이도','Difficulty') + '</span>';
      html += '<select id="sfLcDiff" class="rf-select"><option value="">' + t('전체','All') + '</option><option value="EASY">Easy</option><option value="MEDIUM">Medium</option><option value="HARD">Hard</option></select>';
      html += '<span class="rf-label" style="min-width:auto;">' + t('태그','Tag') + '</span>';
      html += '<select id="sfLcTag" class="rf-select"><option value="">' + t('전체','All') + '</option>';
      getLcTags().forEach(function(tag){
        var displayName = tag.ko ? t(tag.ko, tag.en) : tag.en;
        html += '<option value="'+tag.id+'">'+displayName+'</option>';
      });
      html += '</select>';
      html += '</div>';
      html += '<div class="rf-row">';
      html += '<span class="rf-label">' + t('풀이 필터','Status') + '</span>';
      html += '<select id="sfLcStatus" class="rf-select"><option value="">' + t('전체','All') + '</option><option value="AC">' + t('풀은 문제','Solved') + '</option><option value="NOT_STARTED">' + t('안 푼 문제','Not Solved') + '</option></select>';
      html += '</div>';
    } else if (p === 'CODEFORCES') {
      html += '<div class="rf-row"><span class="rf-label">' + t('태그','Tags') + '</span>';
      html += '<div class="tag-selector" id="sfCfTagSelector">';
      html += '<div class="tag-selected-chips" id="sfCfTagChips"></div>';
      html += '<div class="tag-dropdown-wrap"><button type="button" class="tag-add-btn" id="sfCfTagAddBtn">+</button>';
      html += '<div class="tag-dropdown" id="sfCfTagDropdown">';
      html += '<label><input type="checkbox" data-toggle-all="true"/> ' + t('전체 선택 / 해제','Select / Deselect All') + '</label>';
      html += '<div class="tag-dd-sep"></div>';
      getCfTags().forEach(function(tag){
        var label = tag.ko ? t(tag.ko, tag.en) + (t(tag.ko, tag.en) !== t(tag.en, tag.ko) ? ' <span style="opacity:0.5;font-size:10px;width:100%;padding-left:20px;">(' + t(tag.en, tag.ko) + ')</span>' : '') : tag.en;
        html += '<label><input type="checkbox" data-tag="'+tag.id+'"/> '+label+'</label>';
      });
      html += '</div></div></div></div>';
      html += '<div class="rf-row">';
      html += '<span class="rf-label">' + t('레이팅','Rating') + '</span>';
      html += '<input type="number" id="sfCfRatingMin" class="rf-input" value="0" min="0" step="100"/>';
      html += '<span>~</span>';
      html += '<input type="number" id="sfCfRatingMax" class="rf-input" value="3500" min="0" step="100"/>';
      html += '<span class="rf-label" style="min-width:auto;">' + t('최소 맞은 사람','Min Solved') + '</span>';
      html += '<input type="number" id="sfCfMinSolved" class="rf-input" value="0" min="0"/>';
      html += '</div>';
    } else if (p === 'PROGRAMMERS') {
      html += '<div class="rf-row"><span class="rf-label">' + t('난이도','Level') + '</span><div class="rf-chips" id="sfProgLevels">';
      for(var li=0;li<=5;li++) html += '<span class="rf-chip" data-level="'+li+'">Lv. '+li+'</span>';
      html += '</div></div>';
      html += '<div class="rf-row">';
      html += '<span class="rf-label">' + t('언어','Language') + '</span>';
      html += '<select id="sfProgLang" class="rf-select"><option value="">' + t('전체','All') + '</option><option value="java">Java</option><option value="python3">Python3</option><option value="cpp">C++</option><option value="javascript">JavaScript</option><option value="kotlin">Kotlin</option></select>';
      html += '<span class="rf-label" style="min-width:auto;">' + t('풀이 상태','Status') + '</span>';
      html += '<select id="sfProgStatus" class="rf-select"><option value="">' + t('전체','All') + '</option><option value="unsolved">' + t('안 푼 문제','Unsolved') + '</option><option value="solving">' + t('풀고 있는 문제','Solving') + '</option><option value="solved">' + t('푼 문제','Solved') + '</option></select>';
      html += '</div>';
    }

    c.innerHTML = html;

    // Wire chip toggles (non-tag chips)
    c.querySelectorAll('.rf-chip').forEach(function(chip) {
      chip.addEventListener('click', function() { chip.classList.toggle('selected'); });
    });

    // Wire Codeforces search tag dropdown
    var sfCfTagAddBtn = c.querySelector('#sfCfTagAddBtn');
    var sfCfTagDropdown = c.querySelector('#sfCfTagDropdown');
    var sfCfTagChips = c.querySelector('#sfCfTagChips');
    if (sfCfTagAddBtn && sfCfTagDropdown && sfCfTagChips) {
      sfCfTagAddBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        var wasOpen = sfCfTagDropdown.classList.contains('open');
        document.querySelectorAll('.tag-dropdown.open').forEach(function(d) { d.classList.remove('open'); });
        if (!wasOpen) {
          positionTagDropdown(sfCfTagAddBtn, sfCfTagDropdown);
          sfCfTagDropdown.classList.add('open');
        }
      });
      document.addEventListener('click', function(e) {
        if (sfCfTagDropdown && !sfCfTagDropdown.contains(e.target) && e.target !== sfCfTagAddBtn) {
          sfCfTagDropdown.classList.remove('open');
        }
      });
      function refreshSfCfTagChips() {
        sfCfTagChips.textContent = '';
        sfCfTagDropdown.querySelectorAll('input[data-tag]:checked').forEach(function(cb) {
          var tagId = cb.getAttribute('data-tag');
          var tagInfo = getCfTags().find(function(tg) { return tg.id === tagId; });
          var chip = document.createElement('span');
          chip.className = 'tag-chip-rm';
          chip.textContent = tagInfo ? (tagInfo.ko ? t(tagInfo.ko, tagInfo.en) : tagInfo.en) : tagId;
          var xBtn = document.createElement('span');
          xBtn.className = 'tag-x';
          xBtn.textContent = '\u00d7';
          xBtn.addEventListener('click', function() {
            cb.checked = false;
            refreshSfCfTagChips();
          });
          chip.appendChild(xBtn);
          sfCfTagChips.appendChild(chip);
        });
      }
      sfCfTagDropdown.querySelectorAll('input[type="checkbox"]').forEach(function(cb) {
        if (cb.getAttribute('data-toggle-all')) {
          cb.addEventListener('change', function() {
            var checked = cb.checked;
            sfCfTagDropdown.querySelectorAll('input[data-tag]').forEach(function(tcb) { tcb.checked = checked; });
            refreshSfCfTagChips();
          });
        } else {
          cb.addEventListener('change', function() { refreshSfCfTagChips(); });
        }
      });
    }
  }

  function collectSearchData() {
    var q = $('#searchQueryInput').value.trim();
    var data = { query: q, source: state.platform };
    var p = state.platform;
    var c = $('#searchFilters');

    if (p === 'BAEKJOON') {
      data.sort = (c.querySelector('#sfSort') || {}).value || 'id';
      var sf = parseInt((c.querySelector('#sfSolveFilter') || {}).value || '0', 10);
      data.solveFilter = sf;
    } else if (p === 'SWEA') {
      var levels = [];
      c.querySelectorAll('#sfSweaLevels .rf-chip.selected').forEach(function(ch){ levels.push(ch.getAttribute('data-level')); });
      data.problemLevels = levels.length > 0 ? levels : undefined;
      data.selectCodeLang = (c.querySelector('#sfSweaLang') || {}).value || 'ALL';
      data.orderBy = (c.querySelector('#sfSweaSort') || {}).value || 'INQUERY_COUNT';
    } else if (p === 'LEETCODE') {
      var diff = (c.querySelector('#sfLcDiff') || {}).value;
      data.difficulty = diff || null;
      var tag = (c.querySelector('#sfLcTag') || {}).value;
      data.tags = tag ? [tag] : [];
      var status = (c.querySelector('#sfLcStatus') || {}).value;
      data.status = status || null;
    } else if (p === 'CODEFORCES') {
      var cfTags = [];
      c.querySelectorAll('#sfCfTagDropdown input[data-tag]:checked').forEach(function(cb){ cfTags.push(cb.getAttribute('data-tag')); });
      data.tags = cfTags;
      data.ratingMin = parseInt((c.querySelector('#sfCfRatingMin') || {}).value || '0', 10);
      data.ratingMax = parseInt((c.querySelector('#sfCfRatingMax') || {}).value || '3500', 10);
      data.minSolved = parseInt((c.querySelector('#sfCfMinSolved') || {}).value || '0', 10);
    } else if (p === 'PROGRAMMERS') {
      var progLevels = [];
      c.querySelectorAll('#sfProgLevels .rf-chip.selected').forEach(function(ch){ progLevels.push(parseInt(ch.getAttribute('data-level'),10)); });
      data.levels = progLevels;
      var progLang = (c.querySelector('#sfProgLang') || {}).value;
      data.languages = progLang ? [progLang] : [];
      var progStatus = (c.querySelector('#sfProgStatus') || {}).value;
      data.statuses = progStatus ? [progStatus] : [];
    }
    return data;
  }

  // Search modal
  $('#searchBtn').addEventListener('click', function() {
    renderSearchFilters();
    $('#searchModal').classList.add('open');
    $('#searchQueryInput').focus();
  });
  $('#searchQueryBtn').addEventListener('click', function() {
    var data = collectSearchData();
    if (!data.query && state.platform !== 'SWEA' && state.platform !== 'PROGRAMMERS') return;
    $('#searchSpinner').classList.add('active');
    $('#searchResultsList').textContent = '';
    state._searchTranslated = false;
    state._searchOriginalTitles = {};
    state._searchTranslatedTitles = {};
    $('#searchTranslateBtn').textContent = 'EN';
    vscode.postMessage({ command: 'search', data: data });
  });
  $('#searchQueryInput').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { $('#searchQueryBtn').click(); }
  });

  // Search translate button
  $('#searchTranslateBtn').addEventListener('click', function() {
    var titleEls = $$('#searchResultsList .problem-row-title');
    if (titleEls.length === 0) return;
    state._searchTranslated = !state._searchTranslated;
    if (state._searchTranslated && Object.keys(state._searchTranslatedTitles || {}).length === 0) {
      var originals = {};
      titleEls.forEach(function(el, i) { originals[i] = el.textContent; });
      state._searchOriginalTitles = originals;
      $('#searchTranslateBtn').textContent = '...';
      $('#searchTranslateBtn').disabled = true;
      var batch = Object.values(originals).join('\\n');
      vscode.postMessage({ command: 'translateBatch', data: { text: batch, context: 'search' } });
    } else {
      applySearchTranslation();
    }
  });

  // ─── Random modal: platform-specific filters ───
  var RANDOM_CFG = {
    BOJ_TIERS: [
      'Bronze V','Bronze IV','Bronze III','Bronze II','Bronze I',
      'Silver V','Silver IV','Silver III','Silver II','Silver I',
      'Gold V','Gold IV','Gold III','Gold II','Gold I',
      'Platinum V','Platinum IV','Platinum III','Platinum II','Platinum I',
      'Diamond V','Diamond IV','Diamond III','Diamond II','Diamond I',
      'Ruby V','Ruby IV','Ruby III','Ruby II','Ruby I'
    ],
    BOJ_TIER_CODES: [
      'b5','b4','b3','b2','b1','s5','s4','s3','s2','s1',
      'g5','g4','g3','g2','g1','p5','p4','p3','p2','p1',
      'd5','d4','d3','d2','d1','r5','r4','r3','r2','r1'
    ],
    BOJ_TAGS: [
      {id:'math',ko:'수학',en:'Math'},{id:'implementation',ko:'구현',en:'Implementation'},
      {id:'dp',ko:'DP',en:'DP'},{id:'graphs',ko:'그래프',en:'Graphs'},
      {id:'greedy',ko:'그리디',en:'Greedy'},{id:'sorting',ko:'정렬',en:'Sorting'},
      {id:'string',ko:'문자열',en:'String'},{id:'bruteforcing',ko:'브루트포스',en:'Brute Force'},
      {id:'binary_search',ko:'이분 탐색',en:'Binary Search'},{id:'bfs',ko:'BFS',en:'BFS'},
      {id:'dfs',ko:'DFS',en:'DFS'},{id:'trees',ko:'트리',en:'Trees'},
      {id:'data_structures',ko:'자료구조',en:'Data Structures'},{id:'shortest_path',ko:'최단경로',en:'Shortest Path'},
      {id:'backtracking',ko:'백트래킹',en:'Backtracking'},{id:'two_pointer',ko:'투 포인터',en:'Two Pointer'},
      {id:'divide_and_conquer',ko:'분할정복',en:'Divide & Conquer'},{id:'segtree',ko:'세그먼트 트리',en:'Segment Tree'},
      {id:'union_find',ko:'유니온 파인드',en:'Union Find'},{id:'geometry',ko:'기하학',en:'Geometry'},
      {id:'number_theory',ko:'정수론',en:'Number Theory'}
    ],
    LC_TAGS: [
      {id:'array',en:'Array'},{id:'string',en:'String'},{id:'hash-table',en:'Hash Table'},
      {id:'dynamic-programming',en:'DP'},{id:'math',en:'Math'},{id:'sorting',en:'Sorting'},
      {id:'greedy',en:'Greedy'},{id:'depth-first-search',en:'DFS'},{id:'breadth-first-search',en:'BFS'},
      {id:'binary-search',en:'Binary Search'},{id:'tree',en:'Tree'},{id:'graph',en:'Graph'},
      {id:'linked-list',en:'Linked List'},{id:'stack',en:'Stack'},{id:'heap-priority-queue',en:'Heap'},
      {id:'two-pointers',en:'Two Pointers'},{id:'sliding-window',en:'Sliding Window'},
      {id:'backtracking',en:'Backtracking'},{id:'divide-and-conquer',en:'D&C'},
      {id:'bit-manipulation',en:'Bit Manipulation'},{id:'union-find',en:'Union Find'}
    ],
    CF_TAGS: [
      {id:'implementation',en:'Implementation'},{id:'math',en:'Math'},{id:'greedy',en:'Greedy'},
      {id:'dp',en:'DP'},{id:'data structures',en:'Data Structures'},{id:'brute force',en:'Brute Force'},
      {id:'constructive algorithms',en:'Constructive'},{id:'graphs',en:'Graphs'},
      {id:'sortings',en:'Sorting'},{id:'binary search',en:'Binary Search'},
      {id:'dfs and similar',en:'DFS'},{id:'trees',en:'Trees'},{id:'strings',en:'Strings'},
      {id:'number theory',en:'Number Theory'},{id:'geometry',en:'Geometry'},
      {id:'combinatorics',en:'Combinatorics'},{id:'two pointers',en:'Two Pointers'},
      {id:'bitmasks',en:'Bitmasks'},{id:'dsu',en:'DSU'},{id:'shortest paths',en:'Shortest Paths'}
    ]
  };

  state._randomSelectedTags = [];
  state._randomSelectedLevels = [];

  function getBojTags() { return state._cachedTags['BAEKJOON'] || RANDOM_CFG.BOJ_TAGS; }
  function getLcTags() { return state._cachedTags['LEETCODE'] || RANDOM_CFG.LC_TAGS; }
  function getCfTags() { return state._cachedTags['CODEFORCES'] || RANDOM_CFG.CF_TAGS; }

  function requestTagsIfNeeded(platform) {
    if (state._cachedTags[platform] || state._tagsLoading[platform]) return;
    state._tagsLoading[platform] = true;
    vscode.postMessage({ command: 'fetchTags', data: { source: platform } });
  }

  function renderRandomFilters() {
    var c = $('#randomFilters');
    c.textContent = '';
    state._randomSelectedTags = [];
    state._randomSelectedLevels = [];
    var p = state.platform;
    var html = '';

    // Request dynamic tags if not cached
    if (p === 'BAEKJOON') { requestTagsIfNeeded('BAEKJOON'); }
    else if (p === 'LEETCODE') { requestTagsIfNeeded('LEETCODE'); }
    else if (p === 'CODEFORCES') { requestTagsIfNeeded('CODEFORCES'); }

    if (p === 'BAEKJOON') {
      html += '<div class="rf-row">';
      html += '<span class="rf-label">' + t('기준','Criteria') + '</span>';
      html += '<select id="rfBojMode" class="rf-select"><option value="tier">' + t('난이도 (티어)','Tier') + '</option><option value="class">' + t('클래스','Class') + '</option></select>';
      html += '</div>';
      html += '<div class="rf-row" id="rfBojTierRow">';
      html += '<span class="rf-label"></span>';
      html += '<select id="rfBojTierFrom" class="rf-select">';
      RANDOM_CFG.BOJ_TIERS.forEach(function(n,i){ html += '<option value="'+i+'">'+n+'</option>'; });
      html += '</select>';
      html += '<span>~</span>';
      html += '<select id="rfBojTierTo" class="rf-select">';
      RANDOM_CFG.BOJ_TIERS.forEach(function(n,i){ html += '<option value="'+i+'"'+(i===29?' selected':'')+'>'+n+'</option>'; });
      html += '</select>';
      html += '</div>';
      html += '<div class="rf-row" id="rfBojClassRow" style="display:none;">';
      html += '<span class="rf-label"></span>';
      html += '<select id="rfBojClassFrom" class="rf-select">';
      for(var ci=1;ci<=10;ci++) html += '<option value="'+ci+'">Class '+ci+'</option>';
      html += '</select>';
      html += '<span>~</span>';
      html += '<select id="rfBojClassTo" class="rf-select">';
      for(var ci2=1;ci2<=10;ci2++) html += '<option value="'+ci2+'"'+(ci2===10?' selected':'')+'>Class '+ci2+'</option>';
      html += '</select>';
      html += '</div>';
      html += '<div class="rf-row"><span class="rf-label">' + t('알고리즘','Tags') + '</span>';
      html += '<div class="tag-selector" id="rfBojTagSelector">';
      html += '<div class="tag-selected-chips" id="rfBojTagChips"></div>';
      html += '<div class="tag-dropdown-wrap"><button type="button" class="tag-add-btn" id="rfBojTagAddBtn">+</button>';
      html += '<div class="tag-dropdown" id="rfBojTagDropdown">';
      html += '<label><input type="checkbox" data-toggle-all="true"/> ' + t('전체 선택 / 해제','Select / Deselect All') + '</label>';
      html += '<div class="tag-dd-sep"></div>';
      getBojTags().forEach(function(tag){
        var displayName = t(tag.ko, tag.en);
        var altName = t(tag.en, tag.ko);
        var label = displayName !== altName ? displayName + ' <span style="opacity:0.5;font-size:10px;width:100%;padding-left:20px;">(' + altName + ')</span>' : displayName;
        html += '<label><input type="checkbox" data-tag="'+tag.id+'"/> ' + label + '</label>';
      });
      html += '</div></div></div></div>';
      html += '<div class="rf-row">';
      html += '<span class="rf-label">' + t('개수','Count') + '</span><input type="number" id="rfCount" class="rf-input" value="5" min="1" max="50"/>';
      html += '<span style="flex:1"></span>';
      html += '<button class="rf-pick-btn" id="rfPickBtn">' + t('뽑기','Pick') + '</button>';
      html += '</div>';
      html += '<div class="rf-row">';
      html += '<span class="rf-label">' + t('풀이 필터','Solve Filter') + '</span>';
      html += '<select id="rfSolveFilter" class="rf-select"><option value="0">' + t('전체','All') + '</option><option value="1">' + t('내가 푼 문제 제외','Exclude Solved') + '</option><option value="2">' + t('내가 푼 문제만','Only Solved') + '</option></select>';
      html += '</div>';
      html += '<div class="rf-row">';
      html += '<label class="rf-check"><input type="checkbox" id="rfExcludeObscure" checked/>' + t('듣보 문제 제외 (맞은 사람','Exclude obscure (accepted ≥') + '</label>';
      html += '<input type="number" id="rfMinAccepted" class="rf-input" value="100" min="0"/>';
      html += '<span style="font-size:12px;">' + t('명 이하)',' solvers)') + '</span>';
      html += '</div>';
    } else if (p === 'SWEA') {
      html += '<div class="rf-row"><span class="rf-label">' + t('난이도','Difficulty') + '</span>';
      html += '<div class="tag-selector" id="rfSweaLevelSelector">';
      html += '<div class="tag-selected-chips" id="rfSweaLevelChips"></div>';
      html += '<div class="tag-dropdown-wrap"><button type="button" class="tag-add-btn" id="rfSweaLevelAddBtn">+</button>';
      html += '<div class="tag-dropdown" id="rfSweaLevelDropdown">';
      html += '<label><input type="checkbox" data-toggle-all="true"/> ' + t('전체 선택 / 해제','Select / Deselect All') + '</label>';
      html += '<div class="tag-dd-sep"></div>';
      ['D1','D2','D3','D4','D5','D6','D7','D8'].forEach(function(d){
        html += '<label><input type="checkbox" data-tag="'+d+'"/> '+d+'</label>';
      });
      html += '</div></div></div></div>';
      html += '<div class="rf-row">';
      html += '<span class="rf-label">' + t('언어','Language') + '</span>';
      html += '<select id="rfSweaLang" class="rf-select"><option value="ALL">' + t('전체','All') + '</option><option value="CCPP">C/C++</option><option value="JAVA">Java</option><option value="PYTHON">Python</option></select>';
      html += '</div>';
      html += '<div class="rf-row">';
      html += '<span class="rf-label">' + t('풀이 상태','Status') + '</span>';
      html += '<select id="rfSweaStatus" class="rf-select"><option value="0">' + t('전체','All') + '</option><option value="1">' + t('안 푼 문제','Unsolved') + '</option><option value="2">' + t('푼 문제만','Solved Only') + '</option></select>';
      html += '</div>';
      html += '<div class="rf-row">';
      html += '<span class="rf-label">' + t('개수','Count') + '</span><input type="number" id="rfCount" class="rf-input" value="5" min="1" max="50"/>';
      html += '<span class="rf-label" style="min-width:auto;">' + t('최소 참여자','Min Participants') + '</span><input type="number" id="rfMinParticipants" class="rf-input rf-input-wide" value="0" min="0"/>';
      html += '<span style="flex:1"></span>';
      html += '<button class="rf-pick-btn" id="rfPickBtn">' + t('뽑기','Pick') + '</button>';
      html += '</div>';
    } else if (p === 'LEETCODE') {
      html += '<div class="rf-row"><span class="rf-label">' + t('난이도','Difficulty') + '</span>';
      html += '<div class="tag-selector" id="rfLcDiffSelector">';
      html += '<div class="tag-selected-chips" id="rfLcDiffChips"></div>';
      html += '<div class="tag-dropdown-wrap"><button type="button" class="tag-add-btn" id="rfLcDiffAddBtn">+</button>';
      html += '<div class="tag-dropdown" id="rfLcDiffDropdown">';
      html += '<label><input type="checkbox" data-toggle-all="true"/> ' + t('전체 선택 / 해제','Select / Deselect All') + '</label>';
      html += '<div class="tag-dd-sep"></div>';
      ['Easy','Medium','Hard'].forEach(function(d){
        html += '<label><input type="checkbox" data-tag="'+d+'"/> '+d+'</label>';
      });
      html += '</div></div></div></div>';
      html += '<div class="rf-row"><span class="rf-label">' + t('태그','Tags') + '</span>';
      html += '<div class="tag-selector" id="rfLcTagSelector">';
      html += '<div class="tag-selected-chips" id="rfLcTagChips"></div>';
      html += '<div class="tag-dropdown-wrap"><button type="button" class="tag-add-btn" id="rfLcTagAddBtn">+</button>';
      html += '<div class="tag-dropdown" id="rfLcTagDropdown">';
      html += '<label><input type="checkbox" data-toggle-all="true"/> ' + t('전체 선택 / 해제','Select / Deselect All') + '</label>';
      html += '<div class="tag-dd-sep"></div>';
      getLcTags().forEach(function(tag){
        var label = tag.ko ? t(tag.ko, tag.en) + (t(tag.ko, tag.en) !== t(tag.en, tag.ko) ? ' <span style="opacity:0.5;font-size:10px;width:100%;padding-left:20px;">(' + t(tag.en, tag.ko) + ')</span>' : '') : tag.en;
        html += '<label><input type="checkbox" data-tag="'+tag.id+'"/> '+label+'</label>';
      });
      html += '</div></div></div></div>';
      html += '<div class="rf-row">';
      html += '<span class="rf-label">' + t('개수','Count') + '</span><input type="number" id="rfCount" class="rf-input" value="5" min="1" max="50"/>';
      html += '<span style="flex:1"></span>';
      html += '<button class="rf-pick-btn" id="rfPickBtn">' + t('뽑기','Pick') + '</button>';
      html += '</div>';
      html += '<div class="rf-row">';
      html += '<span class="rf-label">' + t('풀이 필터','Solve Filter') + '</span>';
      html += '<select id="rfSolveFilter" class="rf-select"><option value="0">' + t('전체','All') + '</option><option value="1">' + t('내가 푼 문제 제외','Exclude Solved') + '</option><option value="2">' + t('내가 푼 문제만','Only Solved') + '</option></select>';
      html += '</div>';
      html += '<div class="rf-row">';
      html += '<label class="rf-check"><input type="checkbox" id="rfExcludeObscure" checked/>' + t('듣보 문제 제외 (정답자','Exclude obscure (accepted ≥') + '</label>';
      html += '<input type="number" id="rfMinAccepted" class="rf-input" value="1000" min="0"/>';
      html += '<span style="font-size:12px;">' + t('명 이상)',' users)') + '</span>';
      html += '</div>';
    } else if (p === 'CODEFORCES') {
      html += '<div class="rf-row">';
      html += '<span class="rf-label">' + t('레이팅','Rating') + '</span>';
      html += '<input type="number" id="rfCfRatingMin" class="rf-input" value="800" min="0" step="100"/>';
      html += '<span>~</span>';
      html += '<input type="number" id="rfCfRatingMax" class="rf-input" value="1600" min="0" step="100"/>';
      html += '</div>';
      html += '<div class="rf-row"><span class="rf-label">' + t('태그','Tags') + '</span>';
      html += '<div class="tag-selector" id="rfCfTagSelector">';
      html += '<div class="tag-selected-chips" id="rfCfTagChips"></div>';
      html += '<div class="tag-dropdown-wrap"><button type="button" class="tag-add-btn" id="rfCfTagAddBtn">+</button>';
      html += '<div class="tag-dropdown" id="rfCfTagDropdown">';
      html += '<label><input type="checkbox" data-toggle-all="true"/> ' + t('전체 선택 / 해제','Select / Deselect All') + '</label>';
      html += '<div class="tag-dd-sep"></div>';
      getCfTags().forEach(function(tag){
        var label = tag.ko ? t(tag.ko, tag.en) + (t(tag.ko, tag.en) !== t(tag.en, tag.ko) ? ' <span style="opacity:0.5;font-size:10px;width:100%;padding-left:20px;">(' + t(tag.en, tag.ko) + ')</span>' : '') : tag.en;
        html += '<label><input type="checkbox" data-tag="'+tag.id+'"/> '+label+'</label>';
      });
      html += '</div></div></div></div>';
      html += '<div class="rf-row">';
      html += '<span class="rf-label">' + t('개수','Count') + '</span><input type="number" id="rfCount" class="rf-input" value="5" min="1" max="50"/>';
      html += '<span style="flex:1"></span>';
      html += '<button class="rf-pick-btn" id="rfPickBtn">' + t('뽑기','Pick') + '</button>';
      html += '</div>';
      html += '<div class="rf-row">';
      html += '<span class="rf-label">' + t('풀이 필터','Solve Filter') + '</span>';
      html += '<select id="rfSolveFilter" class="rf-select"><option value="0">' + t('전체','All') + '</option><option value="1">' + t('내가 푼 문제 제외','Exclude Solved') + '</option><option value="2">' + t('내가 푼 문제만','Only Solved') + '</option></select>';
      html += '</div>';
      html += '<div class="rf-row">';
      html += '<label class="rf-check"><input type="checkbox" id="rfExcludeObscure" checked/>' + t('듣보 문제 제외 (맞은 사람','Exclude obscure (solved ≥') + '</label>';
      html += '<input type="number" id="rfMinAccepted" class="rf-input" value="100" min="0"/>';
      html += '<span style="font-size:12px;">' + t('명 이하)',' solvers)') + '</span>';
      html += '</div>';
    } else if (p === 'PROGRAMMERS') {
      // Request exam collections if not cached
      if (!state._examCollections.length && !state._examCollectionsLoading) {
        state._examCollectionsLoading = true;
        vscode.postMessage({ command: 'fetchExamCollections' });
      }
      html += '<div class="rf-row"><span class="rf-label">' + t('분류','Category') + '</span>';
      html += '<div class="tag-selector" id="rfProgPartSelector">';
      html += '<div class="tag-selected-chips" id="rfProgPartChips"></div>';
      html += '<div class="tag-dropdown-wrap"><button type="button" class="tag-add-btn" id="rfProgPartAddBtn">+</button>';
      html += '<div class="tag-dropdown" id="rfProgPartDropdown">';
      html += '<label><input type="checkbox" data-toggle-all="true"/> ' + t('전체 선택 / 해제','Select / Deselect All') + '</label>';
      html += '<div class="tag-dd-sep"></div>';
      state._examCollections.forEach(function(col) {
        html += '<label><input type="checkbox" data-tag="' + col.id + '"/> ' + col.name + '</label>';
      });
      html += '</div></div></div></div>';
      html += '<div class="rf-row"><span class="rf-label">' + t('난이도','Level') + '</span>';
      html += '<div class="tag-selector" id="rfProgLevelSelector">';
      html += '<div class="tag-selected-chips" id="rfProgLevelChips"></div>';
      html += '<div class="tag-dropdown-wrap"><button type="button" class="tag-add-btn" id="rfProgLevelAddBtn">+</button>';
      html += '<div class="tag-dropdown" id="rfProgLevelDropdown">';
      html += '<label><input type="checkbox" data-toggle-all="true"/> ' + t('전체 선택 / 해제','Select / Deselect All') + '</label>';
      html += '<div class="tag-dd-sep"></div>';
      for(var li=0;li<=5;li++) {
        html += '<label><input type="checkbox" data-tag="'+li+'"/> Lv. '+li+'</label>';
      }
      html += '</div></div></div></div>';
      html += '<div class="rf-row">';
      html += '<span class="rf-label">' + t('언어','Language') + '</span>';
      html += '<select id="rfProgLang" class="rf-select"><option value="">' + t('전체','All') + '</option><option value="java">Java</option><option value="python3">Python3</option><option value="cpp">C++</option><option value="javascript">JavaScript</option><option value="kotlin">Kotlin</option></select>';
      html += '</div>';
      html += '<div class="rf-row">';
      html += '<span class="rf-label">' + t('풀이 상태','Status') + '</span>';
      html += '<select id="rfProgStatus" class="rf-select"><option value="">' + t('전체','All') + '</option><option value="unsolved">' + t('안 푼 문제','Unsolved') + '</option><option value="solving">' + t('풀고 있는 문제','Solving') + '</option><option value="solved">' + t('푼 문제','Solved') + '</option><option value="solved_with_unlock">' + t('다른 풀이 확인','Unlocked') + '</option></select>';
      html += '</div>';
      html += '<div class="rf-row">';
      html += '<span class="rf-label">' + t('개수','Count') + '</span><input type="number" id="rfCount" class="rf-input" value="5" min="1" max="50"/>';
      html += '<span style="flex:1"></span>';
      html += '<button class="rf-pick-btn" id="rfPickBtn">' + t('뽑기','Pick') + '</button>';
      html += '</div>';
    }

    c.innerHTML = html;

    // ─── Wire up chip toggles (non-tag chips like difficulty levels) ───
    c.querySelectorAll('.rf-chip[data-level]').forEach(function(chip) {
      chip.addEventListener('click', function() { chip.classList.toggle('selected'); });
    });

    // ─── Wire tag dropdowns ───
    function wireTagDropdown(addBtnId, dropdownId, chipsId, tagsData, getTagLabel) {
      var tagAddBtn = c.querySelector('#' + addBtnId);
      var tagDropdown = c.querySelector('#' + dropdownId);
      var tagChips = c.querySelector('#' + chipsId);
      if (!tagAddBtn || !tagDropdown || !tagChips) return;

      // Add search box if there are many items (e.g. BOJ tags)
      var allLabels = tagDropdown.querySelectorAll('label');
      if (allLabels.length > 10) {
        var searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = t('검색...', 'Search...');
        searchInput.style.cssText = 'width:calc(100% - 12px);margin:4px 6px;padding:4px 6px;border:1px solid var(--vscode-input-border,#3c3c3c);background:var(--vscode-input-background,#1e1e1e);color:var(--vscode-input-foreground,#ccc);border-radius:3px;font-size:11px;outline:none;';
        searchInput.addEventListener('click', function(e) { e.stopPropagation(); });
        searchInput.addEventListener('input', function() {
          var q = searchInput.value.toLowerCase();
          allLabels.forEach(function(lbl) {
            var cb = lbl.querySelector('input');
            if (cb && cb.getAttribute('data-toggle-all')) { lbl.style.display = q ? 'none' : ''; return; }
            var text = lbl.textContent.toLowerCase();
            lbl.style.display = text.indexOf(q) >= 0 ? '' : 'none';
          });
          // Also hide separator when searching
          var sep = tagDropdown.querySelector('.tag-dd-sep');
          if (sep) sep.style.display = q ? 'none' : '';
        });
        tagDropdown.insertBefore(searchInput, tagDropdown.firstChild);
      }

      var _modalBody = tagAddBtn.closest('.modal-body');

      function setModalOverflow(visible) {
        if (_modalBody) { _modalBody.style.overflowY = visible ? 'visible' : 'auto'; }
      }

      tagAddBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        var wasOpen = tagDropdown.classList.contains('open');
        // close all other tag dropdowns first
        document.querySelectorAll('.tag-dropdown.open').forEach(function(d) { d.classList.remove('open'); });
        setModalOverflow(false);
        if (!wasOpen) {
          positionTagDropdown(tagAddBtn, tagDropdown);
          tagDropdown.classList.add('open');
          setModalOverflow(true);
          // Focus search if exists
          var si = tagDropdown.querySelector('input[type="text"]');
          if (si) { si.value = ''; si.dispatchEvent(new Event('input')); si.focus(); }
        }
      });
      document.addEventListener('click', function(e) {
        if (tagDropdown && !tagDropdown.contains(e.target) && e.target !== tagAddBtn) {
          tagDropdown.classList.remove('open');
          setModalOverflow(false);
        }
      });

      function refreshTagChips() {
        tagChips.textContent = '';
        tagDropdown.querySelectorAll('input[data-tag]:checked').forEach(function(cb) {
          var tagId = cb.getAttribute('data-tag');
          var label = getTagLabel(tagId);
          var chip = document.createElement('span');
          chip.className = 'tag-chip-rm';
          chip.textContent = label;
          var xBtn = document.createElement('span');
          xBtn.className = 'tag-x';
          xBtn.textContent = '\u00d7';
          xBtn.addEventListener('click', function() {
            cb.checked = false;
            refreshTagChips();
          });
          chip.appendChild(xBtn);
          tagChips.appendChild(chip);
        });
      }

      tagDropdown.querySelectorAll('input[type="checkbox"]').forEach(function(cb) {
        if (cb.getAttribute('data-toggle-all')) {
          cb.addEventListener('change', function() {
            var checked = cb.checked;
            tagDropdown.querySelectorAll('input[data-tag]').forEach(function(tcb) {
              tcb.checked = checked;
            });
            refreshTagChips();
          });
        } else {
          cb.addEventListener('change', function() { refreshTagChips(); });
        }
      });
    }

    wireTagDropdown('rfBojTagAddBtn', 'rfBojTagDropdown', 'rfBojTagChips', getBojTags(), function(tagId) {
      var tagInfo = getBojTags().find(function(tg) { return tg.id === tagId; });
      return tagInfo ? t(tagInfo.ko, tagInfo.en) : tagId;
    });
    wireTagDropdown('rfLcTagAddBtn', 'rfLcTagDropdown', 'rfLcTagChips', getLcTags(), function(tagId) {
      var tagInfo = getLcTags().find(function(tg) { return tg.id === tagId; });
      return tagInfo ? (tagInfo.ko ? t(tagInfo.ko, tagInfo.en) : tagInfo.en) : tagId;
    });
    wireTagDropdown('rfCfTagAddBtn', 'rfCfTagDropdown', 'rfCfTagChips', getCfTags(), function(tagId) {
      var tagInfo = getCfTags().find(function(tg) { return tg.id === tagId; });
      return tagInfo ? (tagInfo.ko ? t(tagInfo.ko, tagInfo.en) : tagInfo.en) : tagId;
    });
    wireTagDropdown('rfSweaLevelAddBtn', 'rfSweaLevelDropdown', 'rfSweaLevelChips',
      [{id:'D1',en:'D1'},{id:'D2',en:'D2'},{id:'D3',en:'D3'},{id:'D4',en:'D4'},{id:'D5',en:'D5'},{id:'D6',en:'D6'},{id:'D7',en:'D7'},{id:'D8',en:'D8'}],
      function(tagId) { return tagId; });
    wireTagDropdown('rfLcDiffAddBtn', 'rfLcDiffDropdown', 'rfLcDiffChips',
      [{id:'Easy',en:'Easy'},{id:'Medium',en:'Medium'},{id:'Hard',en:'Hard'}],
      function(tagId) { return tagId; });
    wireTagDropdown('rfProgLevelAddBtn', 'rfProgLevelDropdown', 'rfProgLevelChips',
      [{id:'0',en:'Lv. 0'},{id:'1',en:'Lv. 1'},{id:'2',en:'Lv. 2'},{id:'3',en:'Lv. 3'},{id:'4',en:'Lv. 4'},{id:'5',en:'Lv. 5'}],
      function(tagId) { return 'Lv. ' + tagId; });
    wireTagDropdown('rfProgPartAddBtn', 'rfProgPartDropdown', 'rfProgPartChips',
      state._examCollections.map(function(col) { return {id: String(col.id), en: col.name}; }),
      function(tagId) { var c = state._examCollections.find(function(x){return String(x.id)===tagId;}); return c ? c.name : tagId; });

    // BOJ: mode switch
    var bojMode = c.querySelector('#rfBojMode');
    if (bojMode) {
      bojMode.addEventListener('change', function() {
        c.querySelector('#rfBojTierRow').style.display = this.value === 'tier' ? '' : 'none';
        c.querySelector('#rfBojClassRow').style.display = this.value === 'class' ? '' : 'none';
      });
    }

    // Pick button
    var pickBtn = c.querySelector('#rfPickBtn');
    if (pickBtn) {
      pickBtn.addEventListener('click', function() {
        var count = parseInt((c.querySelector('#rfCount') || {}).value || '5', 10);
        count = Math.max(1, Math.min(50, count));
        var data = { source: state.platform, count: count };

        if (p === 'BAEKJOON') {
          var mode = (c.querySelector('#rfBojMode') || {}).value || 'tier';
          var queryParts = [];
          if (mode === 'tier') {
            var from = parseInt(c.querySelector('#rfBojTierFrom').value, 10);
            var to = parseInt(c.querySelector('#rfBojTierTo').value, 10);
            queryParts.push('tier:' + RANDOM_CFG.BOJ_TIER_CODES[from] + '..' + RANDOM_CFG.BOJ_TIER_CODES[to]);
          } else {
            var cf = c.querySelector('#rfBojClassFrom').value;
            var ct = c.querySelector('#rfBojClassTo').value;
            queryParts.push('class:' + cf + '..' + ct);
          }
          var selTags = [];
          c.querySelectorAll('#rfBojTagDropdown input[data-tag]:checked').forEach(function(cb){ selTags.push('tag:'+cb.getAttribute('data-tag')); });
          if (selTags.length > 0) queryParts.push('(' + selTags.join('|') + ')');
          var exCheck = c.querySelector('#rfExcludeObscure');
          if (exCheck && exCheck.checked) {
            var minAcc = parseInt((c.querySelector('#rfMinAccepted') || {}).value || '100', 10);
            queryParts.push('solved:' + minAcc + '..');
          }
          var solveF = parseInt((c.querySelector('#rfSolveFilter') || {}).value || '0', 10);
          data.tierQuery = queryParts.join(' ');
          data.solveFilter = solveF;
        } else if (p === 'SWEA') {
          var sweaLevels = [];
          c.querySelectorAll('#rfSweaLevelDropdown input[data-tag]:checked').forEach(function(cb){ sweaLevels.push(cb.getAttribute('data-tag')); });
          data.problemLevels = sweaLevels.length > 0 ? sweaLevels : undefined;
          data.selectCodeLang = (c.querySelector('#rfSweaLang') || {}).value || 'ALL';
          var sweaStatusVal = (c.querySelector('#rfSweaStatus') || {}).value;
          data.sweaStatus = parseInt(sweaStatusVal || '0', 10);
          data.minParticipants = parseInt((c.querySelector('#rfMinParticipants') || {}).value || '0', 10);
        } else if (p === 'LEETCODE') {
          var lcDiffs = [];
          c.querySelectorAll('#rfLcDiffDropdown input[data-tag]:checked').forEach(function(cb){ lcDiffs.push(cb.getAttribute('data-tag')); });
          data.difficulty = lcDiffs.length === 1 ? lcDiffs[0] : null;
          data.difficulties = lcDiffs;
          var lcTags = [];
          c.querySelectorAll('#rfLcTagDropdown input[data-tag]:checked').forEach(function(cb){ lcTags.push(cb.getAttribute('data-tag')); });
          data.tags = lcTags.length > 0 ? lcTags : [];
          var lcExCheck = c.querySelector('#rfExcludeObscure');
          if (lcExCheck && lcExCheck.checked) data.minAccepted = parseInt((c.querySelector('#rfMinAccepted') || {}).value || '1000', 10);
          data.solveFilter = parseInt((c.querySelector('#rfSolveFilter') || {}).value || '0', 10);
        } else if (p === 'CODEFORCES') {
          data.ratingMin = parseInt((c.querySelector('#rfCfRatingMin') || {}).value || '800', 10);
          data.ratingMax = parseInt((c.querySelector('#rfCfRatingMax') || {}).value || '1600', 10);
          var cfTags = [];
          c.querySelectorAll('#rfCfTagDropdown input[data-tag]:checked').forEach(function(cb){ cfTags.push(cb.getAttribute('data-tag')); });
          data.tags = cfTags;
          var cfExCheck = c.querySelector('#rfExcludeObscure');
          if (cfExCheck && cfExCheck.checked) data.minSolved = parseInt((c.querySelector('#rfMinAccepted') || {}).value || '100', 10);
          data.solveFilter = parseInt((c.querySelector('#rfSolveFilter') || {}).value || '0', 10);
        } else if (p === 'PROGRAMMERS') {
          var progLevels = [];
          c.querySelectorAll('#rfProgLevelDropdown input[data-tag]:checked').forEach(function(cb){ progLevels.push(parseInt(cb.getAttribute('data-tag'),10)); });
          data.levels = progLevels;
          var progLang = (c.querySelector('#rfProgLang') || {}).value;
          data.languages = progLang ? [progLang] : [];
          var progStatus = (c.querySelector('#rfProgStatus') || {}).value;
          data.statuses = progStatus ? [progStatus] : [];
          var progParts = [];
          c.querySelectorAll('#rfProgPartDropdown input[data-tag]:checked').forEach(function(cb){ progParts.push(parseInt(cb.getAttribute('data-tag'),10)); });
          data.partIds = progParts;
        }

        $('#randomSpinner').classList.add('active');
        $('#randomResultsList').textContent = '';
        state._randomTranslated = false;
        state._randomOriginalTitles = {};
        state._randomTranslatedTitles = {};
        $('#randomTranslateBtn').textContent = 'EN';
        vscode.postMessage({ command: 'random', data: data });
      });
    }
  }

  $('#randomBtn').addEventListener('click', function() {
    renderRandomFilters();
    $('#randomResultsList').textContent = '';
    $('#randomModal').classList.add('open');
  });

  // Random translate button
  $('#randomTranslateBtn').addEventListener('click', function() {
    var titleEls = $$('#randomResultsList .problem-row-title');
    var tagEls = $$('#randomResultsList .col-tags');
    if (titleEls.length === 0) return;
    state._randomTranslated = !state._randomTranslated;
    if (state._randomTranslated && Object.keys(state._randomTranslatedTitles || {}).length === 0) {
      // Save originals and request translation (titles + tags together)
      var originals = {};
      titleEls.forEach(function(el, i) { originals[i] = el.textContent; });
      state._randomOriginalTitles = originals;
      var originalTags = {};
      tagEls.forEach(function(el, i) { originalTags[i] = el.textContent; });
      state._randomOriginalTags = originalTags;
      $('#randomTranslateBtn').textContent = '...';
      $('#randomTranslateBtn').disabled = true;
      // Combine titles and tags with separator for batch translation
      var titleBatch = Object.values(originals).join('\\n');
      var tagBatch = Object.values(originalTags).join('\\n');
      vscode.postMessage({ command: 'translateBatch', data: { text: titleBatch, context: 'random' } });
      if (tagBatch.trim()) {
        vscode.postMessage({ command: 'translateBatch', data: { text: tagBatch, context: 'randomTags' } });
      }
    } else {
      applyRandomTranslation();
    }
  });

  // My Solved modal
  $('#mySolvedBtn').addEventListener('click', function() {
    $('#mySolvedModal').classList.add('open');
    $('#mySolvedSpinner').classList.add('active');
    $('#mySolvedList').textContent = '';
    vscode.postMessage({ command: 'mySolved', data: { source: state.platform } });
  });

  // Close modals
  $$('.modal-close').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var target = btn.getAttribute('data-close');
      $('#' + target).classList.remove('open');
    });
  });
  $$('.modal-overlay').forEach(function(overlay) {
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) { overlay.classList.remove('open'); }
    });
  });

  // Fetch selected problems from modals
  $('#randomFetchBtn').addEventListener('click', function() {
    fetchCheckedProblems('randomResultsList');
  });
  $('#searchFetchBtn').addEventListener('click', function() {
    fetchCheckedProblems('searchResultsList');
  });
  $('#mySolvedFetchBtn').addEventListener('click', function() {
    fetchCheckedProblems('mySolvedList');
  });

  function fetchCheckedProblems(containerId) {
    var container = $('#' + containerId);
    var pids = [];
    // Use stored pagination data if available (supports all pages)
    var tableData = container._ptableData;
    if (tableData && tableData.items) {
      tableData.items.forEach(function(p, i) {
        if (tableData.checkedState[i]) {
          pids.push(p.problemId || p.id || '');
        }
      });
    } else {
      // Fallback: read from DOM
      var rows = $$('#' + containerId + ' .ptable tbody tr.checked');
      rows.forEach(function(r) { pids.push(r.getAttribute('data-pid')); });
    }
    if (pids.length === 0) { showToast(t('선택된 문제가 없습니다.', 'No problems selected.'), 'error'); return; }
    $$('.modal-overlay').forEach(function(m) { m.classList.remove('open'); });
    // Fetch all selected problems sequentially
    var idx = 0;
    function fetchNext() {
      if (idx >= pids.length) {
        showToast(t(pids.length + '개 문제 가져오기 완료', pids.length + ' problems fetched'), 'info');
        return;
      }
      $('#problemIdInput').value = pids[idx];
      vscode.postMessage({ command: 'fetchProblem', data: { source: state.platform, language: state.language, problemId: pids[idx] } });
      idx++;
    }
    // Listen for completion to fetch next
    state._fetchQueue = pids;
    state._fetchQueueIdx = 1;
    fetchNext();
  }

  // ─── Translation helpers for search/random modals ───
  function applyRandomTranslation() {
    var titleEls = $$('#randomResultsList .problem-row-title');
    var tagEls = $$('#randomResultsList .col-tags');
    var showing = state._randomTranslated;
    $('#randomTranslateBtn').textContent = showing ? 'KO' : 'EN';
    titleEls.forEach(function(el, i) {
      if (showing && state._randomTranslatedTitles && state._randomTranslatedTitles[i]) {
        el.textContent = state._randomTranslatedTitles[i];
      } else if (!showing && state._randomOriginalTitles && state._randomOriginalTitles[i]) {
        el.textContent = state._randomOriginalTitles[i];
      }
    });
    tagEls.forEach(function(el, i) {
      if (showing && state._randomTranslatedTags && state._randomTranslatedTags[i]) {
        el.textContent = state._randomTranslatedTags[i];
        el.setAttribute('data-full', state._randomTranslatedTags[i]);
      } else if (!showing && state._randomOriginalTags && state._randomOriginalTags[i]) {
        el.textContent = state._randomOriginalTags[i];
        el.setAttribute('data-full', state._randomOriginalTags[i]);
      }
    });
  }

  function applySearchTranslation() {
    var titleEls = $$('#searchResultsList .problem-row-title');
    var showing = state._searchTranslated;
    $('#searchTranslateBtn').textContent = showing ? 'KO' : 'EN';
    titleEls.forEach(function(el, i) {
      if (showing && state._searchTranslatedTitles && state._searchTranslatedTitles[i]) {
        el.textContent = state._searchTranslatedTitles[i];
      } else if (!showing && state._searchOriginalTitles && state._searchOriginalTitles[i]) {
        el.textContent = state._searchOriginalTitles[i];
      }
    });
  }

  var PAGE_SIZE = 10;

  // Translate Codeforces/LeetCode English tags to Korean using cached tag data
  function translateTags(tagsArr) {
    if (state.uiLang !== 'KO' || !tagsArr || !Array.isArray(tagsArr)) return tagsArr;
    // Build lookup from all cached tag sources
    var lookup = {};
    ['CODEFORCES', 'LEETCODE'].forEach(function(src) {
      var cached = state._cachedTags[src];
      if (cached) {
        cached.forEach(function(tg) {
          if (tg.en && tg.ko) { lookup[tg.en.toLowerCase()] = tg.ko; }
        });
      }
    });
    if (Object.keys(lookup).length === 0) return tagsArr;
    return tagsArr.map(function(tag) {
      return lookup[tag.toLowerCase()] || tag;
    });
  }

  function renderProblemTable(items, containerId) {
    var container = $('#' + containerId);
    var footerMap = { randomResultsList: 'randomFooterInfo', searchResultsList: 'searchFooterInfo', mySolvedList: 'mySolvedFooterInfo' };
    var footerId = footerMap[containerId];

    if (!items || items.length === 0) {
      container.textContent = '';
      var empty = document.createElement('div');
      empty.style.cssText = 'padding:10px; text-align:center; color:var(--vscode-descriptionForeground,#777); font-size:12px;';
      empty.textContent = t('검색 결과가 없습니다.', 'No results found.');
      container.appendChild(empty);
      if (footerId) { var fi = $('#' + footerId); if (fi) fi.textContent = ''; }
      return;
    }

    // Store all items and checked state for pagination
    var allItems = items;
    var checkedState = {};
    allItems.forEach(function(_p, i) { checkedState[i] = true; });
    var currentPage = 0;
    var totalPages = Math.ceil(allItems.length / PAGE_SIZE);

    function renderPage() {
      container.textContent = '';
      var start = currentPage * PAGE_SIZE;
      var end = Math.min(start + PAGE_SIZE, allItems.length);
      var pageItems = allItems.slice(start, end);

      var table = document.createElement('table');
      table.className = 'ptable';

      // Header
      var thead = document.createElement('thead');
      var htr = document.createElement('tr');
      var thCheck = document.createElement('th');
      thCheck.className = 'col-check';
      var selectAllCb = document.createElement('input');
      selectAllCb.type = 'checkbox';
      // Check if all items on this page are checked
      var allPageChecked = true;
      for (var ci = start; ci < end; ci++) { if (!checkedState[ci]) { allPageChecked = false; break; } }
      selectAllCb.checked = allPageChecked;
      thCheck.appendChild(selectAllCb);
      htr.appendChild(thCheck);

      var headers = [
        { text: t('번호', 'No.'), cls: 'col-pid' },
        { text: t('제목', 'Title'), cls: 'col-title' },
        { text: t('난이도', 'Difficulty'), cls: 'col-diff' },
        { text: t('태그', 'Tags'), cls: 'col-tags' },
        { text: t('맞은 사람', 'Accepted'), cls: 'col-accepted' }
      ];
      headers.forEach(function(h) {
        var th = document.createElement('th');
        th.className = h.cls;
        th.textContent = h.text;
        htr.appendChild(th);
      });
      thead.appendChild(htr);
      table.appendChild(thead);

      // Body
      var tbody = document.createElement('tbody');
      pageItems.forEach(function(p, localIdx) {
        var globalIdx = start + localIdx;
        var tr = document.createElement('tr');
        if (checkedState[globalIdx]) tr.className = 'checked';
        tr.setAttribute('data-pid', p.problemId || p.id || '');
        tr.setAttribute('data-idx', String(globalIdx));

        // Checkbox
        var tdCheck = document.createElement('td');
        tdCheck.className = 'col-check';
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = !!checkedState[globalIdx];
        cb.addEventListener('change', function() {
          checkedState[globalIdx] = cb.checked;
          tr.classList.toggle('checked', cb.checked);
          updateFooterInfo();
        });
        tdCheck.appendChild(cb);
        tr.appendChild(tdCheck);

        // Problem ID
        var tdPid = document.createElement('td');
        tdPid.className = 'col-pid';
        tdPid.textContent = p.problemId || p.id || '';
        tr.appendChild(tdPid);

        // Title
        var tdTitle = document.createElement('td');
        tdTitle.className = 'col-title problem-row-title';
        tdTitle.textContent = p.title || '';
        tr.appendChild(tdTitle);

        // Difficulty
        var tdDiff = document.createElement('td');
        tdDiff.className = 'col-diff';
        tdDiff.textContent = p.difficulty || (p.level !== undefined ? 'Lv.' + p.level : '');
        tr.appendChild(tdDiff);

        // Tags — translate CF/LC English tags to Korean if available
        var tdTags = document.createElement('td');
        tdTags.className = 'col-tags';
        var tagStr = '';
        if (p.tags && Array.isArray(p.tags)) {
          var displayTags = (state.uiLang === 'KO') ? translateTags(p.tags) : (p.tagsEn && p.tagsEn.length > 0 ? p.tagsEn : p.tags);
          tagStr = displayTags.join(', ');
        } else if (p.tags && typeof p.tags === 'string') {
          tagStr = p.tags;
        }
        tdTags.textContent = tagStr;
        tdTags.setAttribute('data-full', tagStr);
        tr.appendChild(tdTags);

        // Accepted count
        var tdAcc = document.createElement('td');
        tdAcc.className = 'col-accepted';
        var accVal = p.acceptedUserCount || p.solvedCount || p.finishedCount || '';
        tdAcc.textContent = accVal ? String(accVal).replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '';
        tr.appendChild(tdAcc);

        // Double click to fetch single problem
        tr.addEventListener('dblclick', function() {
          var pid = tr.getAttribute('data-pid');
          $('#problemIdInput').value = pid;
          $$('.modal-overlay').forEach(function(m) { m.classList.remove('open'); });
          $('#fetchBtn').click();
        });

        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      container.appendChild(table);

      // Select all checkbox handler (toggles ALL items, not just current page)
      selectAllCb.addEventListener('change', function() {
        var checked = selectAllCb.checked;
        allItems.forEach(function(_p, i) { checkedState[i] = checked; });
        tbody.querySelectorAll('input[type="checkbox"]').forEach(function(cb) {
          cb.checked = checked;
          cb.closest('tr').classList.toggle('checked', checked);
        });
        updateFooterInfo();
      });

      // Pagination controls (only if more than 1 page)
      if (totalPages > 1) {
        var pager = document.createElement('div');
        pager.style.cssText = 'display:flex; align-items:center; justify-content:center; gap:6px; padding:8px 0; font-size:12px;';

        var prevBtn = document.createElement('button');
        prevBtn.className = 'secondary';
        prevBtn.style.cssText = 'padding:3px 8px; font-size:11px;';
        prevBtn.textContent = '◀';
        prevBtn.disabled = currentPage === 0;
        prevBtn.addEventListener('click', function() { if (currentPage > 0) { currentPage--; renderPage(); } });
        pager.appendChild(prevBtn);

        var pageInfo = document.createElement('span');
        pageInfo.style.cssText = 'color:var(--vscode-descriptionForeground,#999);';
        pageInfo.textContent = (currentPage + 1) + ' / ' + totalPages + '  (' + allItems.length + t('개', ' items') + ')';
        pager.appendChild(pageInfo);

        var nextBtn = document.createElement('button');
        nextBtn.className = 'secondary';
        nextBtn.style.cssText = 'padding:3px 8px; font-size:11px;';
        nextBtn.textContent = '▶';
        nextBtn.disabled = currentPage >= totalPages - 1;
        nextBtn.addEventListener('click', function() { if (currentPage < totalPages - 1) { currentPage++; renderPage(); } });
        pager.appendChild(nextBtn);

        container.appendChild(pager);
      }

      updateFooterInfo();
    }

    function updateFooterInfo() {
      if (!footerId) return;
      var fi = $('#' + footerId);
      if (!fi) return;
      var checkedCount = 0;
      allItems.forEach(function(_p, i) { if (checkedState[i]) checkedCount++; });
      fi.textContent = checkedCount + t('개 선택됨 (가져오기로 불러오기, 더블클릭=1개)', ' selected (Fetch to import, dblclick=single)');
    }

    // Store items and checked state on container for fetchCheckedProblems
    container._ptableData = { items: allItems, checkedState: checkedState };

    renderPage();
  }

  // ===== TEST TAB =====
  $('#runAllBtn').addEventListener('click', function() {
    if (state.testRunning) return;
    state.testRunning = true;
    this.disabled = true;
    this.innerHTML = '<span class="codicon codicon-loading codicon-modifier-spin"></span> ' + t('실행 중...', 'Running...');
    // Collect test case data from UI
    var testCases = collectTestCases();
    vscode.postMessage({ command: 'runTests', data: { testCases: testCases, language: state.language } });
  });

  $('#addTestBtn').addEventListener('click', function() {
    state.testCases.push({ input: '', expectedOutput: '', actualOutput: '', passed: null });
    renderTestCases();
    // Auto-expand the newly added card
    var cards = $$('.test-card');
    var lastCard = cards[cards.length - 1];
    if (lastCard) {
      var body = lastCard.querySelector('.test-card-body');
      var toggle = lastCard.querySelector('.test-card-toggle');
      if (body) body.classList.add('open');
      if (toggle) toggle.classList.add('open');
    }
  });

  function collectTestCases() {
    var cases = [];
    var cards = $$('.test-card');
    cards.forEach(function(card, i) {
      var inp = card.querySelector('.tc-input');
      var exp = card.querySelector('.tc-expected');
      cases.push({
        input: inp ? inp.value : '',
        expectedOutput: exp ? exp.value : '',
        actualOutput: '',
        passed: null,
      });
    });
    return cases;
  }

  function renderTestCases() {
    var container = $('#testCaseContainer');
    if (state.testCases.length === 0) {
      container.textContent = '';
      $('#testInfoBar').textContent = t('테스트 케이스가 없습니다.', 'No test cases loaded.');
      return;
    }
    var passCount = 0;
    var failCount = 0;
    state.testCases.forEach(function(tc) {
      if (tc.passed === true) passCount++;
      else if (tc.passed === false) failCount++;
    });

    var infoText = state.testCases.length + t('개 테스트 케이스', ' test case(s)');
    if (passCount > 0 || failCount > 0) {
      infoText += '  |  ';
      if (passCount > 0) infoText += t('통과: ', 'PASS: ') + passCount + '  ';
      if (failCount > 0) infoText += t('실패: ', 'FAIL: ') + failCount;
    }
    if (state.problem && state.problem.parameterNames && state.problem.parameterNames.length > 0) {
      infoText += '  |  ' + t('매개변수: ', 'Params: ') + state.problem.parameterNames.join(', ');
    }
    $('#testInfoBar').textContent = infoText;

    // Build test cards using DOM methods
    container.textContent = '';
    state.testCases.forEach(function(tc, i) {
      var statusClass = '';
      var titleText = '#' + (i + 1);
      var passedStatus = null;
      if (tc.passed === true) { statusClass = 'pass'; titleText = '#' + (i + 1) + ' PASS'; passedStatus = true; }
      else if (tc.passed === false) { statusClass = 'fail'; titleText = '#' + (i + 1) + ' FAIL'; passedStatus = false; }

      var card = document.createElement('div');
      card.className = 'test-card ' + statusClass;
      card.setAttribute('data-index', String(i));

      // Header
      var header = document.createElement('div');
      header.className = 'test-card-header';

      var toggle = document.createElement('span');
      toggle.className = 'test-card-toggle';
      toggle.textContent = '\u25B6';
      header.appendChild(toggle);

      var title = document.createElement('span');
      title.className = 'test-card-title';
      title.textContent = titleText + ' ';
      if (passedStatus === true) {
        var badgePass = document.createElement('span');
        badgePass.className = 'badge badge-pass';
        badgePass.textContent = 'PASS';
        title.appendChild(badgePass);
      } else if (passedStatus === false) {
        var badgeFail = document.createElement('span');
        badgeFail.className = 'badge badge-fail';
        badgeFail.textContent = 'FAIL';
        title.appendChild(badgeFail);
      }
      header.appendChild(title);

      var delBtn = document.createElement('button');
      delBtn.className = 'test-card-delete';
      delBtn.setAttribute('data-idx', String(i));
      delBtn.title = 'Delete';
      delBtn.textContent = '\u00D7';
      header.appendChild(delBtn);

      card.appendChild(header);

      // Body
      var body = document.createElement('div');
      body.className = 'test-card-body';

      var grid = document.createElement('div');
      grid.className = 'tc-grid';

      // Column 1: Input
      var colInput = document.createElement('div');
      colInput.className = 'tc-col';
      var lblInput = document.createElement('div');
      lblInput.className = 'test-field-label';
      lblInput.textContent = t('입력', 'Input');
      colInput.appendChild(lblInput);
      var taInput = document.createElement('textarea');
      taInput.className = 'tc-input';
      taInput.setAttribute('data-idx', String(i));
      taInput.value = tc.input || '';
      colInput.appendChild(taInput);
      grid.appendChild(colInput);

      // Column 2: Expected Output
      var colExpected = document.createElement('div');
      colExpected.className = 'tc-col';
      var lblExpected = document.createElement('div');
      lblExpected.className = 'test-field-label';
      lblExpected.textContent = t('예상 출력', 'Expected');
      colExpected.appendChild(lblExpected);
      var taExpected = document.createElement('textarea');
      taExpected.className = 'tc-expected';
      taExpected.setAttribute('data-idx', String(i));
      taExpected.value = tc.expectedOutput || '';
      colExpected.appendChild(taExpected);
      grid.appendChild(colExpected);

      // Column 3: Actual Output (with diff highlighting)
      var colActual = document.createElement('div');
      colActual.className = 'tc-col';
      var lblActual = document.createElement('div');
      lblActual.className = 'test-field-label';
      lblActual.textContent = t('실제 출력', 'Actual');
      colActual.appendChild(lblActual);
      if (tc.actualOutput && tc.passed === false) {
        // Show diff view
        var diffPre = document.createElement('pre');
        diffPre.className = 'tc-diff';
        var expectedLines = (tc.expectedOutput || '').split('\\n');
        var actualLines = (tc.actualOutput || '').split('\\n');
        var maxLen = Math.max(expectedLines.length, actualLines.length);
        for (var li = 0; li < maxLen; li++) {
          var lineDiv = document.createElement('div');
          var aLine = actualLines[li] !== undefined ? actualLines[li] : '';
          var eLine = expectedLines[li] !== undefined ? expectedLines[li] : '';
          lineDiv.textContent = aLine;
          if (aLine.trimEnd() !== eLine.trimEnd()) {
            lineDiv.className = 'tc-diff-bad';
          } else {
            lineDiv.className = 'tc-diff-ok';
          }
          diffPre.appendChild(lineDiv);
        }
        colActual.appendChild(diffPre);
      } else {
        var taActual = document.createElement('textarea');
        taActual.className = 'tc-actual';
        taActual.readOnly = true;
        taActual.setAttribute('data-idx', String(i));
        taActual.value = tc.actualOutput || '';
        colActual.appendChild(taActual);
      }
      grid.appendChild(colActual);

      // Stderr row (full width)
      if (tc.error) {
        var stderrRow = document.createElement('div');
        stderrRow.className = 'tc-extra-row';
        var lblStderr = document.createElement('div');
        lblStderr.className = 'test-field-label';
        lblStderr.textContent = t('디버그 출력 (stderr)', 'Debug Output (stderr)');
        stderrRow.appendChild(lblStderr);
        var taStderr = document.createElement('textarea');
        taStderr.className = 'tc-stderr';
        taStderr.rows = 2;
        taStderr.readOnly = true;
        taStderr.style.color = 'var(--vscode-errorForeground, #f44)';
        taStderr.value = tc.error || '';
        stderrRow.appendChild(taStderr);
        grid.appendChild(stderrRow);
      }

      // Metrics row (full width)
      if (tc.executionTimeMs !== undefined || tc.peakMemoryKB !== undefined) {
        var metrics = document.createElement('div');
        metrics.className = 'test-metrics';
        if (tc.executionTimeMs !== undefined) {
          var timeSpan = document.createElement('span');
          timeSpan.textContent = t('시간: ', 'Time: ') + tc.executionTimeMs + ' ms';
          metrics.appendChild(timeSpan);
        }
        if (tc.peakMemoryKB !== undefined) {
          var memSpan = document.createElement('span');
          memSpan.textContent = t('메모리: ', 'Memory: ') + tc.peakMemoryKB + ' KB';
          metrics.appendChild(memSpan);
        }
        grid.appendChild(metrics);
      }

      body.appendChild(grid);

      card.appendChild(body);
      container.appendChild(card);

      // Bind accordion toggle
      header.addEventListener('click', function(e) {
        if (e.target.classList.contains('test-card-delete')) return;
        body.classList.toggle('open');
        toggle.classList.toggle('open');
      });

      // Bind delete
      delBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        state.testCases.splice(i, 1);
        renderTestCases();
      });

      // Bind textarea input
      taInput.addEventListener('input', function() {
        if (state.testCases[i]) state.testCases[i].input = taInput.value;
      });
      taExpected.addEventListener('input', function() {
        if (state.testCases[i]) state.testCases[i].expectedOutput = taExpected.value;
      });
    });
  }

  // ===== TEMPLATE TAB =====
  $('#templateLangSelect').addEventListener('change', function() {
    if (window.cmEditor) { window.cmEditor.setLanguage(this.value); }
  });

  $('#saveTemplateBtn').addEventListener('click', function() {
    var name = $('#templateNameInput').value.trim();
    var lang = $('#templateLangSelect').value;
    var code = window.cmEditor ? window.cmEditor.getValue() : '';
    if (!name) { showToast(t('템플릿 이름을 입력하세요.', 'Please enter a template name.'), 'error'); return; }
    vscode.postMessage({ command: 'saveTemplate', data: { name: name, language: lang, code: code } });
    showToast(t('템플릿 저장 중...', 'Saving template...'));
  });

  $('#loadTemplateBtn').addEventListener('click', function() {
    if (!state.selectedTemplate) { showToast(t('템플릿을 먼저 선택하세요.', 'Select a template first.'), 'error'); return; }
    vscode.postMessage({ command: 'loadTemplate', data: { name: state.selectedTemplate } });
    showToast(t('템플릿 불러오는 중...', 'Loading template...'));
  });

  $('#deleteTemplateBtn').addEventListener('click', function() {
    if (!state.selectedTemplate) { showToast(t('템플릿을 먼저 선택하세요.', 'Select a template first.'), 'error'); return; }
    vscode.postMessage({ command: 'deleteTemplate', data: { name: state.selectedTemplate } });
    showToast(t('템플릿 삭제 중...', 'Deleting template...'));
  });

  function renderTemplateList() {
    var container = $('#templateList');
    if (!state.templates || state.templates.length === 0) {
      container.textContent = '';
      var empty = document.createElement('div');
      empty.style.cssText = 'padding:10px; text-align:center; color:var(--vscode-descriptionForeground,#777); font-size:12px;';
      empty.textContent = t('저장된 템플릿이 없습니다.', 'No templates saved yet.');
      container.appendChild(empty);
      return;
    }
    container.textContent = '';
    state.templates.forEach(function(tmpl) {
      var item = document.createElement('div');
      item.className = 'template-item' + (state.selectedTemplate === tmpl.name ? ' selected' : '');
      item.setAttribute('data-name', tmpl.name);

      var nameSpan = document.createElement('span');
      nameSpan.textContent = tmpl.name;
      item.appendChild(nameSpan);

      var langBadge = document.createElement('span');
      langBadge.className = 'template-lang-badge';
      langBadge.textContent = tmpl.language || '';
      item.appendChild(langBadge);

      item.addEventListener('click', function() {
        state.selectedTemplate = tmpl.name;
        container.querySelectorAll('.template-item').forEach(function(i) { i.classList.remove('selected'); });
        item.classList.add('selected');
        // Find template and show code
        var found = state.templates.find(function(t) { return t.name === state.selectedTemplate; });
        if (found) {
          if (window.cmEditor) { window.cmEditor.setValue(found.code || ''); window.cmEditor.setLanguage(found.language || 'JAVA'); }
          $('#templateNameInput').value = found.name;
          $('#templateLangSelect').value = found.language || 'JAVA';
        }
      });

      container.appendChild(item);
    });
  }

  // ===== STOPWATCH =====
  $('#swStartBtn').addEventListener('click', function() {
    if (state.swRunning) return;
    state.swRunning = true;
    state.swStartTime = Date.now() - state.swElapsed;
    state.swInterval = setInterval(updateStopwatch, 30);
    $('#swStartBtn').disabled = true;
    $('#swStopBtn').disabled = false;
    $('#swLapBtn').disabled = false;
  });

  $('#swStopBtn').addEventListener('click', function() {
    if (!state.swRunning) return;
    state.swRunning = false;
    clearInterval(state.swInterval);
    state.swElapsed = Date.now() - state.swStartTime;
    $('#swStartBtn').disabled = false;
    $('#swStopBtn').disabled = true;
    $('#swLapBtn').disabled = true;
  });

  $('#swResetBtn').addEventListener('click', function() {
    state.swRunning = false;
    clearInterval(state.swInterval);
    state.swElapsed = 0;
    state.swLaps = [];
    $('#stopwatchDisplay').textContent = '00:00.00';
    $('#swStartBtn').disabled = false;
    $('#swStopBtn').disabled = true;
    $('#swLapBtn').disabled = true;
    $('#lapTableBody').textContent = '';
  });

  $('#swLapBtn').addEventListener('click', function() {
    if (!state.swRunning) return;
    var current = Date.now() - state.swStartTime;
    var prevTotal = state.swLaps.length > 0 ? state.swLaps[state.swLaps.length - 1].total : 0;
    var lapTime = current - prevTotal;
    state.swLaps.push({ lap: lapTime, total: current });
    renderLaps();
  });

  function updateStopwatch() {
    state.swElapsed = Date.now() - state.swStartTime;
    $('#stopwatchDisplay').textContent = formatTime(state.swElapsed);
  }

  function renderLaps() {
    var body = $('#lapTableBody');
    body.textContent = '';
    state.swLaps.forEach(function(l, i) {
      var tr = document.createElement('tr');
      var td1 = document.createElement('td');
      td1.textContent = String(i + 1);
      var td2 = document.createElement('td');
      td2.textContent = formatTime(l.lap);
      var td3 = document.createElement('td');
      td3.textContent = formatTime(l.total);
      var td4 = document.createElement('td');
      var memoInput = document.createElement('input');
      memoInput.type = 'text';
      memoInput.value = l.memo || '';
      memoInput.placeholder = '...';
      memoInput.style.cssText = 'background:transparent;border:none;border-bottom:1px solid var(--ctk-glass-border);color:inherit;font-size:11px;padding:2px 4px;width:100%;outline:none;';
      memoInput.addEventListener('input', function() { state.swLaps[i].memo = this.value; });
      td4.appendChild(memoInput);
      tr.appendChild(td1);
      tr.appendChild(td2);
      tr.appendChild(td3);
      tr.appendChild(td4);
      body.appendChild(tr);
    });
  }

  // ===== COUNTDOWN =====
  $('#cdCircular').addEventListener('change', function() {
    $('#countdownCanvas').style.display = this.checked ? 'block' : 'none';
    drawCountdownCanvas();
  });
  $('#cdDigital').addEventListener('change', function() {
    $('#countdownDigital').style.display = this.checked ? 'block' : 'none';
  });
  $('#cdProgress').addEventListener('change', function() {
    $('#cdProgressBar').style.display = this.checked ? 'block' : 'none';
  });

  $$('.cd-preset').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var m = parseInt(btn.getAttribute('data-m'), 10);
      var h = Math.floor(m / 60);
      var mins = m % 60;
      $('#cdHours').value = h;
      $('#cdMinutes').value = mins;
      $('#cdSeconds').value = 0;
      var ms = m * 60 * 1000;
      state.cdTotalMs = ms;
      state.cdRemainingMs = ms;
      updateCountdownDisplay();
      drawCountdownCanvas();
    });
  });

  function getCountdownInputMs() {
    var h = parseInt($('#cdHours').value, 10) || 0;
    var m = parseInt($('#cdMinutes').value, 10) || 0;
    var s = parseInt($('#cdSeconds').value, 10) || 0;
    return (h * 3600 + m * 60 + s) * 1000;
  }

  // Update display immediately when user types in H/M/S fields
  ['#cdHours', '#cdMinutes', '#cdSeconds'].forEach(function(sel) {
    $(sel).addEventListener('input', function() {
      if (state.cdRunning) return;
      var ms = getCountdownInputMs();
      state.cdTotalMs = ms;
      state.cdRemainingMs = ms;
      updateCountdownDisplay();
      drawCountdownCanvas();
      updateProgressBar();
    });
  });

  $('#cdStartBtn').addEventListener('click', function() {
    if (state.cdRunning) return;
    if (state.cdRemainingMs <= 0) {
      state.cdTotalMs = getCountdownInputMs();
      state.cdRemainingMs = state.cdTotalMs;
    }
    if (state.cdTotalMs <= 0) {
      state.cdTotalMs = getCountdownInputMs();
      state.cdRemainingMs = state.cdTotalMs;
    }
    if (state.cdRemainingMs <= 0) { showToast(t('시간을 먼저 설정하세요.', 'Set a time first.'), 'error'); return; }
    state.cdRunning = true;
    state.cdStartTime = Date.now();
    var startRemaining = state.cdRemainingMs;
    state.cdInterval = setInterval(function() {
      var elapsed = Date.now() - state.cdStartTime;
      state.cdRemainingMs = Math.max(0, startRemaining - elapsed);
      updateCountdownDisplay();
      drawCountdownCanvas();
      updateProgressBar();
      if (state.cdRemainingMs <= 0) {
        clearInterval(state.cdInterval);
        state.cdRunning = false;
        $('#cdStartBtn').disabled = false;
        $('#cdStopBtn').disabled = true;
        vscode.postMessage({ command: 'countdownComplete', data: {} });
      }
    }, 100);
    $('#cdStartBtn').disabled = true;
    $('#cdStopBtn').disabled = false;
  });

  $('#cdStopBtn').addEventListener('click', function() {
    if (!state.cdRunning) return;
    clearInterval(state.cdInterval);
    state.cdRunning = false;
    $('#cdStartBtn').disabled = false;
    $('#cdStopBtn').disabled = true;
  });

  // Click canvas center button to toggle play/pause
  $('#countdownCanvas').addEventListener('click', function(e) {
    var rect = this.getBoundingClientRect();
    var x = e.clientX - rect.left - rect.width / 2;
    var y = e.clientY - rect.top - rect.height / 2;
    var dist = Math.sqrt(x * x + y * y);
    var innerR = (Math.min(rect.width, rect.height) / 2 - 28) * 0.36;
    if (dist <= innerR) {
      if (state.cdRunning) {
        $('#cdStopBtn').click();
      } else {
        $('#cdStartBtn').click();
      }
    }
  });

  $('#cdResetBtn').addEventListener('click', function() {
    clearInterval(state.cdInterval);
    state.cdRunning = false;
    state.cdTotalMs = getCountdownInputMs();
    state.cdRemainingMs = state.cdTotalMs;
    updateCountdownDisplay();
    drawCountdownCanvas();
    updateProgressBar();
    $('#cdStartBtn').disabled = false;
    $('#cdStopBtn').disabled = true;
  });

  function updateCountdownDisplay() {
    var el = $('#countdownDigital');
    el.textContent = formatCountdown(state.cdRemainingMs);
    // Warning color when < 1 minute
    if (state.cdRemainingMs > 0 && state.cdRemainingMs < 60000) {
      el.style.color = '#e55050';
    } else {
      el.style.color = '';
    }
  }

  function updateProgressBar() {
    if (state.cdTotalMs <= 0) return;
    var pct = (state.cdRemainingMs / state.cdTotalMs) * 100;
    $('#cdProgressFill').style.width = pct + '%';
  }

  function drawCountdownCanvas() {
    var canvas = $('#countdownCanvas');
    if (!canvas || canvas.style.display === 'none') return;
    var ctx = canvas.getContext('2d');
    var dpr = window.devicePixelRatio || 1;
    var cssW = 280;
    var cssH = 280;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    ctx.scale(dpr, dpr);

    var cx = cssW / 2;
    var cy = cssH / 2;
    var outerR = cx - 28;
    var innerR = outerR * 0.36;

    ctx.clearRect(0, 0, cssW, cssH);

    // Background circle (dark)
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, 2 * Math.PI);
    ctx.fillStyle = '#32353a';
    ctx.fill();

    // Remaining time sector (pie slice) - red/salmon color
    var fraction = state.cdTotalMs > 0 ? state.cdRemainingMs / state.cdTotalMs : 1;
    if (fraction > 0) {
      var startAngle = -Math.PI / 2; // 12 o'clock (top)
      var sweepAngle = fraction * 2 * Math.PI;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, outerR, startAngle, startAngle + sweepAngle, false);
      ctx.closePath();
      // Color based on remaining
      var sectorColor;
      if (fraction > 0.5) {
        sectorColor = '#c96464'; // default red/salmon
      } else if (fraction > 0.15) {
        sectorColor = '#d47a3a'; // orange warning
      } else {
        sectorColor = '#da3633'; // bright red urgent
      }
      ctx.fillStyle = sectorColor;
      ctx.fill();
    }

    // Tick marks & numbers
    var totalSec = state.cdTotalMs / 1000;
    var numSegments = 5;
    var segmentVal;
    var unitLabel = '';
    if (totalSec >= 60) {
      segmentVal = Math.ceil(totalSec / 60 / numSegments);
      if (segmentVal < 1) segmentVal = 1;
      numSegments = Math.ceil(totalSec / 60 / segmentVal);
      unitLabel = '';
    } else {
      segmentVal = Math.ceil(totalSec / numSegments);
      if (segmentVal < 1) segmentVal = 1;
      numSegments = Math.ceil(totalSec / segmentVal);
    }
    var totalTicks = numSegments;
    var tickInnerR = outerR + 2;
    var tickMajorOuterR = outerR + 10;
    ctx.strokeStyle = 'rgba(180,180,180,0.5)';
    ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(170,170,170,0.7)';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var i = 0; i <= totalTicks; i++) {
      var angle = -Math.PI / 2 + (i / totalTicks) * 2 * Math.PI;
      // Tick line
      ctx.beginPath();
      ctx.moveTo(cx + tickInnerR * Math.cos(angle), cy + tickInnerR * Math.sin(angle));
      ctx.lineTo(cx + tickMajorOuterR * Math.cos(angle), cy + tickMajorOuterR * Math.sin(angle));
      ctx.stroke();
      // Number label
      var numR = outerR + 22;
      var labelVal = i * segmentVal;
      ctx.fillText(String(labelVal), cx + numR * Math.cos(angle), cy + numR * Math.sin(angle));
    }
    // Minor ticks between major ones
    ctx.strokeStyle = 'rgba(120,120,120,0.4)';
    ctx.lineWidth = 1;
    var tickMinorOuterR = outerR + 6;
    for (var i = 0; i < totalTicks; i++) {
      var midAngle = -Math.PI / 2 + ((i + 0.5) / totalTicks) * 2 * Math.PI;
      ctx.beginPath();
      ctx.moveTo(cx + tickInnerR * Math.cos(midAngle), cy + tickInnerR * Math.sin(midAngle));
      ctx.lineTo(cx + tickMinorOuterR * Math.cos(midAngle), cy + tickMinorOuterR * Math.sin(midAngle));
      ctx.stroke();
    }

    // Center button circle
    ctx.beginPath();
    ctx.arc(cx, cy, innerR, 0, 2 * Math.PI);
    ctx.fillStyle = '#414446';
    ctx.fill();
    ctx.strokeStyle = '#5a5d5f';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Play/Pause icon in center
    ctx.fillStyle = '#aaa';
    if (state.cdRunning) {
      // Pause icon: two vertical bars
      var barW = 5;
      var barH = innerR * 0.65;
      var barGap = 5;
      ctx.fillRect(cx - barGap - barW, cy - barH / 2, barW, barH);
      ctx.fillRect(cx + barGap, cy - barH / 2, barW, barH);
    } else {
      // Play icon: triangle
      var triSize = innerR * 0.45;
      ctx.beginPath();
      ctx.moveTo(cx - triSize * 0.4, cy - triSize);
      ctx.lineTo(cx - triSize * 0.4, cy + triSize);
      ctx.lineTo(cx + triSize * 0.8, cy);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Initialize countdown display
  updateCountdownDisplay();

  // ===== REFERENCE TAB =====
  var refData = {
    java: {
      url: 'https://devdocs.io/openjdk~21/',
      chips: [
        { label: 'String', url: 'https://devdocs.io/openjdk~21/java.base/java/lang/string' },
        { label: 'ArrayList', url: 'https://devdocs.io/openjdk~21/java.base/java/util/arraylist' },
        { label: 'HashMap', url: 'https://devdocs.io/openjdk~21/java.base/java/util/hashmap' },
        { label: 'Arrays', url: 'https://devdocs.io/openjdk~21/java.base/java/util/arrays' },
        { label: 'Collections', url: 'https://devdocs.io/openjdk~21/java.base/java/util/collections' },
        { label: 'Stream', url: 'https://devdocs.io/openjdk~21/java.base/java/util/stream/stream' },
        { label: 'Math', url: 'https://devdocs.io/openjdk~21/java.base/java/lang/math' },
        { label: 'Scanner', url: 'https://devdocs.io/openjdk~21/java.base/java/util/scanner' },
      ],
    },
    python: {
      url: 'https://devdocs.io/python~3.12/',
      chips: [
        { label: 'str', url: 'https://devdocs.io/python~3.12/library/stdtypes#str' },
        { label: 'list', url: 'https://devdocs.io/python~3.12/library/stdtypes#list' },
        { label: 'dict', url: 'https://devdocs.io/python~3.12/library/stdtypes#dict' },
        { label: 'set', url: 'https://devdocs.io/python~3.12/library/stdtypes#set' },
        { label: 'itertools', url: 'https://devdocs.io/python~3.12/library/itertools' },
        { label: 'collections', url: 'https://devdocs.io/python~3.12/library/collections' },
        { label: 'heapq', url: 'https://devdocs.io/python~3.12/library/heapq' },
        { label: 'bisect', url: 'https://devdocs.io/python~3.12/library/bisect' },
      ],
    },
    cpp: {
      url: 'https://devdocs.io/cpp/',
      chips: [
        { label: 'vector', url: 'https://devdocs.io/cpp/container/vector' },
        { label: 'map', url: 'https://devdocs.io/cpp/container/map' },
        { label: 'set', url: 'https://devdocs.io/cpp/container/set' },
        { label: 'string', url: 'https://devdocs.io/cpp/string/basic_string' },
        { label: 'algorithm', url: 'https://devdocs.io/cpp/algorithm' },
        { label: 'queue', url: 'https://devdocs.io/cpp/container/queue' },
        { label: 'stack', url: 'https://devdocs.io/cpp/container/stack' },
        { label: 'deque', url: 'https://devdocs.io/cpp/container/deque' },
      ],
    },
    kotlin: {
      url: 'https://devdocs.io/kotlin~1.9/',
      chips: [
        { label: 'List', url: 'https://devdocs.io/kotlin~1.9/api/latest/jvm/stdlib/kotlin.collections/-list/index' },
        { label: 'Map', url: 'https://devdocs.io/kotlin~1.9/api/latest/jvm/stdlib/kotlin.collections/-map/index' },
        { label: 'String', url: 'https://devdocs.io/kotlin~1.9/api/latest/jvm/stdlib/kotlin/-string/index' },
        { label: 'Sequence', url: 'https://devdocs.io/kotlin~1.9/api/latest/jvm/stdlib/kotlin.sequences/-sequence/index' },
        { label: 'Array', url: 'https://devdocs.io/kotlin~1.9/api/latest/jvm/stdlib/kotlin/-array/index' },
      ],
    },
    javascript: {
      url: 'https://devdocs.io/javascript/',
      chips: [
        { label: 'Array', url: 'https://devdocs.io/javascript/global_objects/array' },
        { label: 'Map', url: 'https://devdocs.io/javascript/global_objects/map' },
        { label: 'Set', url: 'https://devdocs.io/javascript/global_objects/set' },
        { label: 'String', url: 'https://devdocs.io/javascript/global_objects/string' },
        { label: 'Math', url: 'https://devdocs.io/javascript/global_objects/math' },
        { label: 'JSON', url: 'https://devdocs.io/javascript/global_objects/json' },
        { label: 'RegExp', url: 'https://devdocs.io/javascript/global_objects/regexp' },
      ],
    },
  };

  function renderRefChips(lang) {
    var data = refData[lang];
    if (!data) return;
    var container = $('#refChips');
    container.textContent = '';

    var homeChip = document.createElement('div');
    homeChip.className = 'ref-chip';
    homeChip.setAttribute('data-url', data.url);
    homeChip.textContent = t('홈', 'Home');
    homeChip.addEventListener('click', function() {
      container.querySelectorAll('.ref-chip').forEach(function(c) { c.classList.remove('active'); });
      homeChip.classList.add('active');
      $('#refIframe').src = data.url;
    });
    container.appendChild(homeChip);

    data.chips.forEach(function(c) {
      var chip = document.createElement('div');
      chip.className = 'ref-chip';
      chip.setAttribute('data-url', c.url);
      chip.textContent = c.label;
      chip.addEventListener('click', function() {
        container.querySelectorAll('.ref-chip').forEach(function(ch) { ch.classList.remove('active'); });
        chip.classList.add('active');
        $('#refIframe').src = c.url;
      });
      container.appendChild(chip);
    });

    // Load default
    $('#refIframe').src = data.url;
  }

  $('#refLangSelect').addEventListener('change', function() {
    renderRefChips(this.value);
  });

  // Initialize reference
  renderRefChips('java');

  // ===== SETTINGS TAB =====
  $('#settingLang').addEventListener('change', function() {
    vscode.postMessage({ command: 'changeSetting', data: { key: 'language', value: this.value } });
    state.uiLang = this.value;
    applyI18n();
  });

  $('#settingAutoComplete').addEventListener('change', function() {
    vscode.postMessage({ command: 'changeSetting', data: { key: 'autoComplete', value: !this.checked } });
  });

  $('#settingSyntaxOff').addEventListener('change', function() {
    if (window.cmEditor) { window.cmEditor.setSyntaxHighlighting(!this.checked); }
    vscode.postMessage({ command: 'changeSetting', data: { key: 'syntaxHighlightingOff', value: this.checked } });
  });

  $('#settingDiagnosticsOff').addEventListener('change', function() {
    vscode.postMessage({ command: 'changeSetting', data: { key: 'diagnosticsOff', value: this.checked } });
  });

  $('#settingCodeLensOff').addEventListener('change', function() {
    vscode.postMessage({ command: 'changeSetting', data: { key: 'codeLensOff', value: this.checked } });
  });

  $('#settingPasteBlock').addEventListener('change', function() {
    vscode.postMessage({ command: 'changeSetting', data: { key: 'pasteBlock', value: this.checked } });
  });

  $('#settingFocusAlert').addEventListener('change', function() {
    vscode.postMessage({ command: 'changeSetting', data: { key: 'focusAlert', value: this.checked } });
  });

  $('#btnExamMode').addEventListener('click', function() {
    $('#settingAutoComplete').checked = true;
    $('#settingSyntaxOff').checked = true;
    $('#settingDiagnosticsOff').checked = true;
    $('#settingCodeLensOff').checked = true;
    $('#settingPasteBlock').checked = true;
    $('#settingFocusAlert').checked = true;
    vscode.postMessage({ command: 'changeSetting', data: { key: 'examMode', value: true } });
    showToast(t('시험 모드가 활성화되었습니다', 'Exam Mode enabled'), 'info');
  });

  $('#btnNormalMode').addEventListener('click', function() {
    $('#settingAutoComplete').checked = false;
    $('#settingSyntaxOff').checked = false;
    $('#settingDiagnosticsOff').checked = false;
    $('#settingCodeLensOff').checked = false;
    $('#settingPasteBlock').checked = false;
    $('#settingFocusAlert').checked = false;
    vscode.postMessage({ command: 'changeSetting', data: { key: 'examMode', value: false } });
    showToast(t('일반 모드로 돌아왔습니다', 'Normal Mode restored'), 'info');
  });

  $('#settingReadme').addEventListener('change', function() {
    vscode.postMessage({ command: 'changeSetting', data: { key: 'generateReadme', value: this.checked } });
  });

  $('#settingGithubToken').addEventListener('change', function() {
    vscode.postMessage({ command: 'changeSetting', data: { key: 'githubToken', value: this.value } });
  });

  $('#settingGithubRepo').addEventListener('change', function() {
    vscode.postMessage({ command: 'changeSetting', data: { key: 'githubRepo', value: this.value } });
  });

  $('#settingAutoPush').addEventListener('change', function() {
    vscode.postMessage({ command: 'changeSetting', data: { key: 'autoPush', value: this.checked } });
  });

  // Focus alert: detect window blur
  window.addEventListener('blur', function() {
    if ($('#settingFocusAlert').checked) {
      state.focusLostCount++;
      showToast(
        t('포커스 이탈 감지! (총 ' + state.focusLostCount + '회)', 'Focus lost! (Total: ' + state.focusLostCount + ')'),
        'error'
      );
    }
  });

  // Request tool paths and initial settings
  vscode.postMessage({ command: 'getToolPaths' });
  vscode.postMessage({ command: 'getSettings' });

  // ===== MESSAGE HANDLER FROM EXTENSION HOST =====
  window.addEventListener('message', function(event) {
    var msg = event.data;
    if (!msg || !msg.command) return;

    switch (msg.command) {

      case 'problemFetched': {
        var pRaw = msg.data;
        var p = pRaw.problem || pRaw;
        if (pRaw.source) p.source = pRaw.source;
        state.problem = p;
        // Render problem using safe DOM methods for title/metadata, trusted HTML for description
        var contentEl = $('#problemContent');
        contentEl.textContent = '';

        if (p.title) {
          var h2 = document.createElement('h2');
          h2.style.cssText = 'margin-bottom:8px; font-size:20px; font-weight:700;';
          h2.textContent = p.title;
          contentEl.appendChild(h2);
        }
        if (p.timeLimit || p.memoryLimit) {
          var metaDiv = document.createElement('div');
          metaDiv.style.cssText = 'font-size:13px; color:var(--vscode-descriptionForeground,#999); margin-bottom:12px;';
          var metaParts = [];
          if (p.timeLimit) metaParts.push(t('시간: ', 'Time: ') + p.timeLimit);
          if (p.memoryLimit) metaParts.push(t('메모리: ', 'Memory: ') + p.memoryLimit);
          metaDiv.textContent = metaParts.join('  ');
          contentEl.appendChild(metaDiv);
        }
        if (p.description) {
          // Problem description is pre-sanitized HTML from the extension host crawlers.
          // It must be rendered as HTML to display formatted problem statements with
          // tables, images, math formulas, and styled text from online judges.
          var descDiv = document.createElement('div');
          descDiv.className = 'problem-body';
          // Description HTML is pre-sanitized by extension host crawlers (cheerio/axios).
          // It contains structured content (tables, math, images) that cannot be expressed
          // as plain text. CSP blocks inline scripts; only static markup is rendered.
          descDiv.innerHTML = p.description;
          // Make section headers translatable (Korean headers from crawlers)
          translateProblemHeaders(descDiv);
          contentEl.appendChild(descDiv);
        }

        // Source Attribution (출처 표시)
        if (p.source && p.id) {
          var sourceUrls = {
            BAEKJOON: 'https://www.acmicpc.net/problem/' + p.id,
            PROGRAMMERS: 'https://school.programmers.co.kr/learn/courses/30/lessons/' + p.id,
            SWEA: 'https://swexpertacademy.com/main/code/problem/problemDetail.do?contestProbId=' + (p.contestProbId || p.id),
            LEETCODE: 'https://leetcode.com/problems/' + p.id + '/',
            CODEFORCES: 'https://codeforces.com/problemset/problem/' + (p.contestProbId || p.id)
          };
          var sourceNames = {
            BAEKJOON: state.uiLang === 'KO' ? '백준 온라인 저지' : 'Baekjoon Online Judge',
            PROGRAMMERS: state.uiLang === 'KO' ? '프로그래머스 코딩 테스트 연습' : 'Programmers Coding Test Practice',
            SWEA: 'SW Expert Academy',
            LEETCODE: 'LeetCode',
            CODEFORCES: 'Codeforces'
          };
          var problemUrl = sourceUrls[p.source] || '';
          var sourceName = sourceNames[p.source] || p.source;
          var disclaimerText = state.uiLang === 'KO'
            ? '이 문제의 저작권은 ' + sourceName + '에 있습니다. 개인 학습 목적으로만 사용하세요.'
            : 'All rights reserved by ' + sourceName + '. For personal study use only.';
          var attrDiv = document.createElement('div');
          attrDiv.id = 'problemAttribution';
          attrDiv.style.cssText = 'color:#888; font-size:11px; border-top:1px solid var(--vscode-panel-border,#333); margin-top:20px; padding-top:8px;';
          attrDiv.innerHTML = (state.uiLang === 'KO' ? '출처' : 'Source') + ': ' + sourceName + '<br>'
            + '<span style="color:#589df6;">' + problemUrl + '</span><br>'
            + disclaimerText;
          contentEl.appendChild(attrDiv);
        }

        // Load test cases
        if (p.testCases && p.testCases.length > 0) {
          state.testCases = p.testCases.map(function(tc) {
            return { input: tc.input || '', expectedOutput: tc.expectedOutput || '', actualOutput: '', passed: null };
          });
          renderTestCases();
        }

        // Update problem ID input
        if (p.id) { $('#problemIdInput').value = p.id; }

        showToast(t('문제 로드 완료: ', 'Problem loaded: ') + (p.title || p.id), 'success');

        // If there are queued problems, fetch next
        if (state._fetchQueue && state._fetchQueueIdx < state._fetchQueue.length) {
          var nextPid = state._fetchQueue[state._fetchQueueIdx];
          state._fetchQueueIdx++;
          vscode.postMessage({ command: 'fetchProblem', data: { source: state.platform, language: state.language, problemId: nextPid } });
        } else {
          state._fetchQueue = null;
        }
        break;
      }

      case 'clearProblem': {
        state.problem = null;
        state.testCases = [];
        $('#problemContent').textContent = '';
        $('#problemIdInput').value = '';
        renderTestCases();
        break;
      }

      case 'testResult': {
        var r = msg.data;
        var idx = r.index !== undefined ? r.index : 0;
        if (state.testCases[idx]) {
          state.testCases[idx].actualOutput = r.output || '';
          state.testCases[idx].passed = r.passed;
          state.testCases[idx].error = r.error || '';
          state.testCases[idx].executionTimeMs = r.executionTimeMs;
          state.testCases[idx].peakMemoryKB = r.peakMemoryKB;
        }
        renderTestCases();
        // Auto-expand the result card
        var cards = $$('.test-card');
        if (cards[idx]) {
          var body = cards[idx].querySelector('.test-card-body');
          var toggle = cards[idx].querySelector('.test-card-toggle');
          if (body && !body.classList.contains('open')) {
            body.classList.add('open');
            toggle.classList.add('open');
          }
        }
        break;
      }

      case 'testComplete': {
        state.testRunning = false;
        var runAllBtn = $('#runAllBtn');
        runAllBtn.disabled = false;
        runAllBtn.innerHTML = '<span class="codicon codicon-play"></span> <span data-ko="전체 실행" data-en="Run All">' + t('전체 실행', 'Run All') + '</span>';
        renderTestCases();
        var allPass = state.testCases.every(function(tc) { return tc.passed === true; });
        if (allPass && state.testCases.length > 0) {
          showToast(t('모든 테스트 통과!', 'All tests passed!'), 'success');
        } else {
          var fc = state.testCases.filter(function(tc) { return tc.passed === false; }).length;
          if (fc > 0) showToast(fc + t('개 테스트 실패', ' test(s) failed.'), 'error');
        }
        break;
      }

      case 'loginStatus': {
        state.loginStatus = msg.data.loggedIn ? msg.data : null;
        var loginBtn = $('#loginBtn');
        if (msg.data.loggedIn) {
          loginBtn.innerHTML = '<span class="codicon codicon-log-out"></span> ' + t('로그아웃', 'Logout') + ' (' + (msg.data.username || '') + ')';
          loginBtn.classList.remove('secondary');
          loginBtn.classList.add('danger');
        } else {
          loginBtn.innerHTML = '<span class="codicon codicon-log-in"></span> <span data-ko="로그인" data-en="Login">' + t('로그인', 'Login') + '</span>';
          loginBtn.classList.remove('danger');
          loginBtn.classList.add('secondary');
        }
        break;
      }

      case 'templateList': {
        state.templates = Array.isArray(msg.data) ? msg.data : (msg.data.templates || []);
        renderTemplateList();
        break;
      }

      case 'templateLoaded': {
        if (msg.data && msg.data.code !== undefined) {
          if (window.cmEditor) { window.cmEditor.setValue(msg.data.code); if (msg.data.language) window.cmEditor.setLanguage(msg.data.language); }
          if (msg.data.name) $('#templateNameInput').value = msg.data.name;
          if (msg.data.language) $('#templateLangSelect').value = msg.data.language;
          showToast(t('템플릿을 불러왔습니다.', 'Template loaded.'), 'success');
        }
        break;
      }

      case 'searchResults': {
        $('#searchSpinner').classList.remove('active');
        renderProblemTable(msg.data.problems || [], 'searchResultsList');
        break;
      }

      case 'randomResults': {
        $('#randomSpinner').classList.remove('active');
        renderProblemTable(msg.data.problems || [], 'randomResultsList');
        break;
      }

      case 'mySolvedResults': {
        $('#mySolvedSpinner').classList.remove('active');
        renderProblemTable(msg.data.problems || [], 'mySolvedList');
        break;
      }

      case 'tagsLoaded': {
        var tSrc = msg.data.source;
        var tTags = msg.data.tags || [];
        if (tTags.length > 0) {
          state._cachedTags[tSrc] = tTags;
        }
        state._tagsLoading[tSrc] = false;
        // Re-render filters if a modal using this platform's tags is open
        if ($('#randomModal').classList.contains('open') && state.platform === tSrc) {
          renderRandomFilters();
        }
        if ($('#searchModal').classList.contains('open') && state.platform === tSrc) {
          renderSearchFilters();
        }
        break;
      }

      case 'examCollectionsLoaded': {
        state._examCollections = msg.data.collections || [];
        state._examCollectionsLoading = false;
        // Re-render if Programmers random modal is open
        if ($('#randomModal').classList.contains('open') && state.platform === 'PROGRAMMERS') {
          renderRandomFilters();
        }
        break;
      }

      case 'translateBatchResult': {
        var ctx = msg.data.context;
        var translatedList = (msg.data.translated || '').split('\\n');
        if (ctx === 'random') {
          var map = {};
          translatedList.forEach(function(t, i) { map[i] = t.trim(); });
          state._randomTranslatedTitles = map;
          $('#randomTranslateBtn').disabled = false;
          applyRandomTranslation();
        } else if (ctx === 'randomTags') {
          var tmap = {};
          translatedList.forEach(function(t, i) { tmap[i] = t.trim(); });
          state._randomTranslatedTags = tmap;
          applyRandomTranslation();
        } else if (ctx === 'search') {
          var smap = {};
          translatedList.forEach(function(t, i) { smap[i] = t.trim(); });
          state._searchTranslatedTitles = smap;
          $('#searchTranslateBtn').disabled = false;
          applySearchTranslation();
        }
        break;
      }

      case 'error': {
        showToast(msg.data.message || t('오류가 발생했습니다.', 'An error occurred.'), 'error');
        // Reset running states if needed
        if (state.testRunning) {
          state.testRunning = false;
          var runBtn = $('#runAllBtn');
          runBtn.disabled = false;
          runBtn.textContent = t('전체 실행', 'Run All');
        }
        $('#searchSpinner').classList.remove('active');
        $('#randomSpinner').classList.remove('active');
        $('#mySolvedSpinner').classList.remove('active');
        break;
      }

      case 'info': {
        showToast(msg.data.message || '', 'info');
        break;
      }

      case 'settingsLoaded': {
        var s = msg.data;
        if (s.language) { $('#settingLang').value = s.language; state.uiLang = s.language; }
        if (s.autoComplete !== undefined) { $('#settingAutoComplete').checked = !s.autoComplete; }
        if (s.syntaxHighlightingOff !== undefined) {
          $('#settingSyntaxOff').checked = s.syntaxHighlightingOff;
          if (window.cmEditor) { window.cmEditor.setSyntaxHighlighting(!s.syntaxHighlightingOff); }
        }
        if (s.diagnosticsOff !== undefined) { $('#settingDiagnosticsOff').checked = s.diagnosticsOff; }
        if (s.codeLensOff !== undefined) { $('#settingCodeLensOff').checked = s.codeLensOff; }
        if (s.pasteBlock !== undefined) { $('#settingPasteBlock').checked = s.pasteBlock; }
        if (s.focusAlert !== undefined) { $('#settingFocusAlert').checked = s.focusAlert; }
        if (s.generateReadme !== undefined) { $('#settingReadme').checked = s.generateReadme; }
        if (s.autoPush !== undefined) { $('#settingAutoPush').checked = s.autoPush; }
        if (s.githubRepos) {
          var sel = $('#settingGithubRepo');
          sel.textContent = '';
          var defaultOpt = document.createElement('option');
          defaultOpt.value = '';
          defaultOpt.textContent = t('-- 레포 선택 --', '-- Select repo --');
          sel.appendChild(defaultOpt);
          s.githubRepos.forEach(function(repo) {
            var opt = document.createElement('option');
            opt.value = repo;
            opt.textContent = repo;
            sel.appendChild(opt);
          });
          if (s.selectedRepo) { sel.value = s.selectedRepo; }
        }
        applyI18n();
        break;
      }

      case 'toolPaths': {
        var paths = msg.data;
        var container = $('#settingToolPaths');
        if (!container) break;
        container.textContent = '';
        var tools = [
          { name: 'Java', key: 'java' },
          { name: 'javac', key: 'javac' },
          { name: 'Python3', key: 'python3' },
          { name: 'g++', key: 'gpp' },
          { name: 'kotlinc', key: 'kotlinc' },
          { name: 'Node.js', key: 'node' },
        ];
        tools.forEach(function(tool) {
          var div = document.createElement('div');
          var found = paths[tool.key];
          var dotColor = found ? '#3fb950' : '#f85149';
          var pathText = found || t('미감지', 'Not found');
          div.innerHTML = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + dotColor + ';margin-right:6px;vertical-align:middle;"></span><b>' + tool.name + '</b>: <span style="color:var(--vscode-descriptionForeground,#999);">' + escapeHtml(pathText) + '</span>';
          container.appendChild(div);
        });
        break;
      }

      case 'translated': {
        if (msg.data.description) {
          // Translated problem description is pre-sanitized HTML from the extension host.
          var existing = $('#problemContent').querySelector('.problem-body');
          if (existing) {
            existing.innerHTML = msg.data.description;
          } else {
            var tDiv = document.createElement('div');
            tDiv.className = 'problem-body';
            tDiv.innerHTML = msg.data.description;
            $('#problemContent').appendChild(tDiv);
          }
          showToast(t('번역 완료', 'Translation complete.'), 'success');
        }
        break;
      }

      case 'updateLanguage': {
        if (msg.data.language) {
          $('#languageSelect').value = msg.data.language;
          state.language = msg.data.language;
          var langMap = { JAVA: 'Java', PYTHON: 'Python', CPP: 'C++', KOTLIN: 'Kotlin', JAVASCRIPT: 'JavaScript' };
          $('#testLangLabel').textContent = langMap[msg.data.language] || msg.data.language;
        }
        break;
      }

      case 'updatePlatform': {
        if (msg.data.platform) {
          $('#platformSelect').value = msg.data.platform;
          state.platform = msg.data.platform;
        }
        break;
      }

      default:
        break;
    }
  });

  // ===== TAG TOOLTIP =====
  var tagTip = document.createElement('div');
  tagTip.className = 'tag-tooltip';
  tagTip.style.display = 'none';
  document.body.appendChild(tagTip);
  document.addEventListener('mouseover', function(e) {
    var td = e.target.closest ? e.target.closest('.col-tags') : null;
    if (td && td.getAttribute('data-full')) {
      tagTip.textContent = td.getAttribute('data-full');
      tagTip.style.display = 'block';
      var rect = td.getBoundingClientRect();
      var tipW = tagTip.offsetWidth;
      var tipH = tagTip.offsetHeight;
      var left = rect.left;
      if (left + tipW > window.innerWidth - 8) left = window.innerWidth - tipW - 8;
      var top = rect.top - tipH - 4;
      if (top < 4) top = rect.bottom + 4;
      tagTip.style.left = left + 'px';
      tagTip.style.top = top + 'px';
    }
  });
  document.addEventListener('mouseout', function(e) {
    var td = e.target.closest ? e.target.closest('.col-tags') : null;
    if (td) tagTip.style.display = 'none';
  });

  // ===== INITIAL MESSAGES =====
  // Request current state from extension on load
  vscode.postMessage({ command: 'webviewReady', data: {} });

})();
</script>
${codemirrorUri ? `<script src="${codemirrorUri}"></script>
<script>
(function() {
  if (window.cmEditor) {
    window.cmEditor.init('templateCodeContainer', 'JAVA');
  }
})();
</script>` : ''}
</body>
</html>`;
}
