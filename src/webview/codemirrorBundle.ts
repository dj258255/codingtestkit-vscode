import { EditorView, keymap, placeholder } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { java } from '@codemirror/lang-java';
import { python } from '@codemirror/lang-python';
import { cpp } from '@codemirror/lang-cpp';
import { javascript } from '@codemirror/lang-javascript';
import { oneDarkTheme, oneDarkHighlightStyle } from '@codemirror/theme-one-dark';

type LangKey = 'JAVA' | 'PYTHON' | 'CPP' | 'KOTLIN' | 'JAVASCRIPT';
type PlatformKey = 'BAEKJOON' | 'PROGRAMMERS' | 'SWEA' | 'LEETCODE' | 'CODEFORCES';

const langExtensions: Record<LangKey, () => any> = {
  JAVA: java,
  PYTHON: python,
  CPP: cpp,
  KOTLIN: java,
  JAVASCRIPT: javascript,
};

// --- Detect VS Code theme mode ---

function isDarkTheme(): boolean {
  const kind = document.body?.getAttribute('data-vscode-theme-kind') || '';
  if (kind) {
    return kind.includes('dark') || kind.includes('high-contrast');
  }
  return true; // default to dark
}

// --- Pre-built HighlightStyle constants for each platform × theme ---

// Programmers / Baekjoon / SWEA — dark (tomorrow-night-bright, actual Programmers colors)
const programmersDark = HighlightStyle.define([
  { tag: [t.keyword, t.operatorKeyword], color: '#C38FE5' },
  { tag: t.string, color: '#E7C547' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: '#D27B53' },
  { tag: t.number, color: '#A16A94' },
  { tag: [t.definition(t.variableName), t.function(t.variableName)], color: '#FFEB3B' },
  { tag: [t.typeName, t.className], color: '#7AA6DA' },
  { tag: [t.atom, t.bool, t.null], color: '#A16A94' },
  { tag: t.variableName, color: '#4CAF50' },
  { tag: t.propertyName, color: '#99CC99' },
  { tag: [t.operator, t.punctuation], color: '#EAEAEA' },
  { tag: t.self, color: '#C38FE5' },
  { tag: t.meta, color: '#EAEAEA' },
]);

// Programmers / Baekjoon / SWEA — light (eclipse customized, actual Programmers colors)
const programmersLight = HighlightStyle.define([
  { tag: [t.keyword, t.operatorKeyword], color: '#9C27B0' },
  { tag: t.string, color: '#2A00FF' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: '#3F7F5F' },
  { tag: t.number, color: '#116644' },
  { tag: [t.definition(t.variableName), t.function(t.variableName)], color: '#0000FF' },
  { tag: [t.typeName, t.className], color: '#FF5722' },
  { tag: [t.atom, t.bool, t.null], color: '#221199' },
  { tag: t.variableName, color: '#000000' },
  { tag: t.propertyName, color: '#000000' },
  { tag: [t.operator, t.punctuation], color: '#000000' },
  { tag: t.self, color: '#9C27B0' },
  { tag: t.meta, color: '#FF1717' },
]);

// LeetCode — dark (Monaco vs-dark)
const leetcodeDark = HighlightStyle.define([
  { tag: t.keyword, color: '#569CD6' },
  { tag: t.operatorKeyword, color: '#C586C0' },
  { tag: t.string, color: '#CE9178' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: '#6A9955' },
  { tag: t.number, color: '#B5CEA8' },
  { tag: [t.definition(t.variableName), t.function(t.variableName)], color: '#DCDCAA' },
  { tag: [t.typeName, t.className], color: '#4EC9B0' },
  { tag: [t.atom, t.bool, t.null], color: '#569CD6' },
  { tag: t.variableName, color: '#9CDCFE' },
  { tag: t.propertyName, color: '#9CDCFE' },
  { tag: [t.operator, t.punctuation], color: '#D4D4D4' },
  { tag: t.self, color: '#569CD6' },
]);

// LeetCode — light (Monaco vs-light)
const leetcodeLight = HighlightStyle.define([
  { tag: t.keyword, color: '#0000FF' },
  { tag: t.operatorKeyword, color: '#AF00DB' },
  { tag: t.string, color: '#A31515' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: '#008000' },
  { tag: t.number, color: '#098658' },
  { tag: [t.definition(t.variableName), t.function(t.variableName)], color: '#795E26' },
  { tag: [t.typeName, t.className], color: '#267F99' },
  { tag: [t.atom, t.bool, t.null], color: '#0000FF' },
  { tag: t.variableName, color: '#001080' },
  { tag: t.propertyName, color: '#001080' },
  { tag: [t.operator, t.punctuation], color: '#000000' },
  { tag: t.self, color: '#0000FF' },
]);

// Codeforces — dark (Ace chrome brightened)
const codeforcesDark = HighlightStyle.define([
  { tag: [t.keyword, t.operatorKeyword], color: '#8899AA' },
  { tag: t.string, color: '#7A7AE6' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: '#6A9955' },
  { tag: t.number, color: '#7A7AFF' },
  { tag: [t.definition(t.variableName), t.function(t.variableName)], color: '#DCDCAA' },
  { tag: [t.typeName, t.className], color: '#56B6C2' },
  { tag: [t.atom, t.bool, t.null], color: '#569CD6' },
  { tag: t.variableName, color: '#9CDCFE' },
  { tag: t.propertyName, color: '#9CDCFE' },
  { tag: [t.operator, t.punctuation], color: '#D4D4D4' },
  { tag: t.self, color: '#569CD6' },
]);

// Codeforces — light (Ace chrome original)
const codeforcesLight = HighlightStyle.define([
  { tag: [t.keyword, t.operatorKeyword], color: '#687687' },
  { tag: t.string, color: '#1A1AA6' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: '#236E24' },
  { tag: t.number, color: '#0000CD' },
  { tag: [t.definition(t.variableName), t.function(t.variableName)], color: '#444444' },
  { tag: [t.typeName, t.className], color: '#318495' },
  { tag: [t.atom, t.bool, t.null], color: '#0000CD' },
  { tag: t.variableName, color: '#000000' },
  { tag: t.propertyName, color: '#000000' },
  { tag: [t.operator, t.punctuation], color: '#000000' },
  { tag: t.self, color: '#0000CD' },
]);

const platformStyles: Record<PlatformKey, { dark: HighlightStyle; light: HighlightStyle }> = {
  PROGRAMMERS: { dark: programmersDark, light: programmersLight },
  BAEKJOON:    { dark: programmersDark, light: programmersLight },
  SWEA:        { dark: programmersDark, light: programmersLight },
  LEETCODE:    { dark: leetcodeDark, light: leetcodeLight },
  CODEFORCES:  { dark: codeforcesDark, light: codeforcesLight },
};

// --- Editor state ---

let view: EditorView | null = null;
let currentLang: LangKey = 'JAVA';
let currentPlatform: PlatformKey = 'BAEKJOON';

function getHighlightStyle(): HighlightStyle {
  const dark = isDarkTheme();
  const styles = platformStyles[currentPlatform];
  if (styles) {
    return dark ? styles.dark : styles.light;
  }
  return oneDarkHighlightStyle; // fallback
}

// Editor chrome uses VS Code CSS variables — adapts to light/dark automatically
const editorTheme = EditorView.theme({
  '&': {
    fontSize: '13px',
    border: '1px solid var(--vscode-input-border, #3c3c3c)',
    borderRadius: '4px',
    backgroundColor: 'var(--vscode-input-background, #1e1e1e)',
    color: 'var(--vscode-editor-foreground, #d4d4d4)',
  },
  '.cm-content': {
    fontFamily: 'var(--vscode-editor-font-family, monospace)',
    padding: '8px 0',
    minHeight: '150px',
    caretColor: 'var(--vscode-editorCursor-foreground, #d4d4d4)',
  },
  '.cm-cursor': {
    borderLeftColor: 'var(--vscode-editorCursor-foreground, #d4d4d4)',
  },
  '.cm-activeLine': {
    backgroundColor: 'var(--vscode-editor-lineHighlightBackground, transparent)',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--vscode-editorGutter-background, var(--vscode-input-background, #1e1e1e))',
    color: 'var(--vscode-editorLineNumber-foreground, #858585)',
    borderRight: '1px solid var(--vscode-panel-border, #2d2d2d)',
  },
  '&.cm-focused': {
    outline: '1px solid var(--vscode-focusBorder, #007fd4)',
  },
  '.cm-scroller': {
    maxHeight: '300px',
    overflow: 'auto',
  },
  '.cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--vscode-editor-selectionBackground, #264f78) !important',
  },
});

function createEditor(parent: HTMLElement, doc: string, lang: LangKey): EditorView {
  currentLang = lang;
  const langExt = langExtensions[lang] || java;

  const state = EditorState.create({
    doc,
    extensions: [
      keymap.of([...defaultKeymap, ...historyKeymap]),
      history(),
      langExt(),
      oneDarkTheme,
      syntaxHighlighting(getHighlightStyle()),
      EditorView.lineWrapping,
      placeholder('Select a template or write code here...'),
      editorTheme,
    ],
  });

  return new EditorView({ state, parent });
}

function recreateView() {
  if (!view) { return; }
  const doc = view.state.doc.toString();
  const parent = view.dom.parentElement;
  if (!parent) { return; }
  view.destroy();
  view = createEditor(parent, doc, currentLang);
}

// Watch for VS Code theme changes
if (typeof MutationObserver !== 'undefined' && document.body) {
  new MutationObserver(() => recreateView())
    .observe(document.body, { attributes: true, attributeFilter: ['data-vscode-theme-kind'] });
}

// Expose global API for inline webview JS
(window as any).cmEditor = {
  init(containerId: string, lang: LangKey) {
    const container = document.getElementById(containerId);
    if (!container) { return; }
    container.textContent = '';
    view = createEditor(container, '', lang);
  },

  getValue(): string {
    return view?.state.doc.toString() ?? '';
  },

  setValue(text: string) {
    if (!view) { return; }
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: text },
    });
  },

  setLanguage(lang: LangKey) {
    if (!view || lang === currentLang) { return; }
    currentLang = lang;
    recreateView();
  },

  setPlatform(platform: PlatformKey) {
    if (platform === currentPlatform) { return; }
    currentPlatform = platform;
    recreateView();
  },

  destroy() {
    if (view) {
      view.destroy();
      view = null;
    }
  },
};
