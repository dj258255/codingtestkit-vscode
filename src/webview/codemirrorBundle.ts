import { EditorView, keymap, placeholder } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { java } from '@codemirror/lang-java';
import { python } from '@codemirror/lang-python';
import { cpp } from '@codemirror/lang-cpp';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';

type LangKey = 'JAVA' | 'PYTHON' | 'CPP' | 'KOTLIN' | 'JAVASCRIPT';

const langExtensions: Record<LangKey, () => any> = {
  JAVA: java,
  PYTHON: python,
  CPP: cpp,
  KOTLIN: java,       // Kotlin uses Java grammar as close approximation
  JAVASCRIPT: javascript,
};

let view: EditorView | null = null;
let currentLang: LangKey = 'JAVA';

function createEditor(parent: HTMLElement, doc: string, lang: LangKey): EditorView {
  currentLang = lang;
  const langExt = langExtensions[lang] || java;

  const state = EditorState.create({
    doc,
    extensions: [
      keymap.of([...defaultKeymap, ...historyKeymap]),
      history(),
      langExt(),
      oneDark,
      EditorView.lineWrapping,
      placeholder('Select a template or write code here...'),
      EditorView.theme({
        '&': {
          fontSize: '13px',
          border: '1px solid var(--vscode-input-border, #3c3c3c)',
          borderRadius: '4px',
          backgroundColor: 'var(--vscode-input-background, #1e1e1e)',
        },
        '.cm-content': {
          fontFamily: 'var(--vscode-editor-font-family, monospace)',
          padding: '8px 0',
          minHeight: '150px',
        },
        '.cm-gutters': {
          backgroundColor: 'var(--vscode-input-background, #1e1e1e)',
          borderRight: '1px solid var(--vscode-panel-border, #2d2d2d)',
        },
        '.cm-focused': {
          outline: '1px solid var(--vscode-focusBorder, #007fd4)',
        },
        '.cm-scroller': {
          maxHeight: '300px',
          overflow: 'auto',
        },
      }),
    ],
  });

  return new EditorView({ state, parent });
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
    const doc = view.state.doc.toString();
    const parent = view.dom.parentElement;
    if (!parent) { return; }
    view.destroy();
    view = createEditor(parent, doc, lang);
  },

  destroy() {
    if (view) {
      view.destroy();
      view = null;
    }
  },
};
