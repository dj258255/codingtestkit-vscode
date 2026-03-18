import { ProblemSource, Language, LanguageInfo } from '../models/models';
import { detectChromiumBrowser, getBrowserProfileDir } from './browserLogin';

export interface BrowserSubmitResult {
  success: boolean;
  error?: 'NO_BROWSER' | 'NO_PUPPETEER' | 'INJECT_FAILED' | 'UNKNOWN';
  message?: string;
}

// --- Language slug/ID mappings per platform ---

const LEETCODE_LANG_SLUG: Record<Language, string> = {
  [Language.JAVA]: 'java',
  [Language.PYTHON]: 'python3',
  [Language.CPP]: 'cpp',
  [Language.KOTLIN]: 'kotlin',
  [Language.JAVASCRIPT]: 'javascript',
};

const CODEFORCES_LANG_VALUE: Record<Language, string> = {
  [Language.JAVA]: '87',       // Java 21 64bit
  [Language.PYTHON]: '31',     // Python 3.8.10
  [Language.CPP]: '89',        // GNU C++23 14.2 (64 bit)
  [Language.KOTLIN]: '88',     // Kotlin 2.0.21
  [Language.JAVASCRIPT]: '34', // JavaScript V8
};

const PROGRAMMERS_LANG_SLUG: Record<Language, string> = {
  [Language.JAVA]: 'java',
  [Language.PYTHON]: 'python3',
  [Language.CPP]: 'cpp',
  [Language.KOTLIN]: 'kotlin',
  [Language.JAVASCRIPT]: 'javascript',
};

// --- Cookie parsing ---

function parseCookieString(cookieStr: string, url: string): Array<{ name: string; value: string; url: string; path: string }> {
  if (!cookieStr) { return []; }
  return cookieStr.split(';').map(part => {
    const trimmed = part.trim();
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx <= 0) { return null; }
    return {
      name: trimmed.substring(0, eqIdx).trim(),
      value: trimmed.substring(eqIdx + 1).trim(),
      url,
      path: '/',
    };
  }).filter(Boolean) as Array<{ name: string; value: string; url: string; path: string }>;
}

// --- Submit URL builders ---

function getSubmitUrl(source: ProblemSource, problemId: string, language?: Language, contestProbId?: string): string {
  switch (source) {
    case ProblemSource.BAEKJOON:
      return `https://www.acmicpc.net/submit/${problemId}`;

    case ProblemSource.PROGRAMMERS: {
      const langSlug = language ? PROGRAMMERS_LANG_SLUG[language] : '';
      const langParam = langSlug ? `?language=${langSlug}` : '';
      return `https://school.programmers.co.kr/learn/courses/30/lessons/${problemId}${langParam}`;
    }

    case ProblemSource.SWEA:
      return `https://swexpertacademy.com/main/code/problem/problemDetail.do?contestProbId=${contestProbId || problemId}`;

    case ProblemSource.LEETCODE: {
      const lcSlug = LEETCODE_LANG_SLUG[language!] || '';
      const lcLangParam = lcSlug ? `?lang=${lcSlug}` : '';
      return `https://leetcode.com/problems/${contestProbId || problemId}/${lcLangParam}`;
    }

    case ProblemSource.CODEFORCES: {
      const match = problemId.match(/^(\d+)([A-Za-z]\d?)$/);
      if (match) {
        return `https://codeforces.com/contest/${match[1]}/submit/${match[2]}`;
      }
      return `https://codeforces.com/problemset/submit`;
    }

    default:
      return '';
  }
}

function getCookieUrl(source: ProblemSource): string {
  switch (source) {
    case ProblemSource.BAEKJOON: return 'https://www.acmicpc.net';
    case ProblemSource.PROGRAMMERS: return 'https://school.programmers.co.kr';
    case ProblemSource.SWEA: return 'https://swexpertacademy.com';
    case ProblemSource.LEETCODE: return 'https://leetcode.com';
    case ProblemSource.CODEFORCES: return 'https://codeforces.com';
    default: return '';
  }
}

function getCookieDomain(source: ProblemSource): string {
  switch (source) {
    case ProblemSource.BAEKJOON: return '.acmicpc.net';
    case ProblemSource.PROGRAMMERS: return '.programmers.co.kr';
    case ProblemSource.SWEA: return '.swexpertacademy.com';
    case ProblemSource.LEETCODE: return '.leetcode.com';
    case ProblemSource.CODEFORCES: return '.codeforces.com';
    default: return '';
  }
}

// --- Code injection per platform ---

async function injectCodeBaekjoon(page: any, code: string, language: Language): Promise<boolean> {
  const langId = String(LanguageInfo[language].baekjoonId);

  // Wait for submit form
  await page.waitForSelector('#submit_form, .CodeMirror, select#language', { timeout: 15000 });
  await new Promise(r => setTimeout(r, 1000));

  // Select language
  await page.evaluate((val: string) => {
    const select = document.querySelector('select#language, select[name="language"]') as HTMLSelectElement;
    if (select) {
      select.value = val;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, langId);

  await new Promise(r => setTimeout(r, 500));

  // Inject code into CodeMirror
  return await page.evaluate((codeStr: string) => {
    // Method 1: CodeMirror instance on DOM element
    const cmElement = document.querySelector('.CodeMirror') as any;
    if (cmElement?.CodeMirror) {
      cmElement.CodeMirror.setValue(codeStr);
      return true;
    }

    // Method 2: Ace Editor (fallback)
    const aceEl = document.querySelector('.ace_editor') as any;
    if (aceEl?.env?.editor) {
      aceEl.env.editor.setValue(codeStr, -1);
      return true;
    }

    // Method 3: textarea
    const textarea = document.querySelector('textarea[name="source"], #source') as HTMLTextAreaElement;
    if (textarea) {
      textarea.value = codeStr;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }

    return false;
  }, code);
}

async function injectCodeProgrammers(page: any, code: string, _language: Language): Promise<boolean> {
  // Language is already selected via URL parameter (?language=python3 etc.)
  // Wait for the editor area to load
  await page.waitForSelector('.editor, .CodeMirror, .ace_editor, .monaco-editor', { timeout: 15000 });
  await new Promise(r => setTimeout(r, 2000));

  // Inject code
  return await page.evaluate((codeStr: string) => {
    // Method 1: CodeMirror
    const cmElements = document.querySelectorAll('.CodeMirror');
    for (const el of cmElements) {
      const cm = (el as any).CodeMirror;
      if (cm) {
        cm.setValue(codeStr);
        return true;
      }
    }

    // Method 2: Ace Editor
    const win = window as any;
    const aceEl = document.querySelector('.ace_editor') as any;
    if (aceEl?.env?.editor) {
      aceEl.env.editor.setValue(codeStr, -1);
      return true;
    }
    if (win.ace?.edit) {
      const editors = document.querySelectorAll('.ace_editor');
      for (const el of editors) {
        try {
          const editor = win.ace.edit(el);
          if (editor) {
            editor.setValue(codeStr, -1);
            return true;
          }
        } catch { /* skip */ }
      }
    }

    // Method 3: Monaco Editor
    if (win.monaco?.editor) {
      const editors = win.monaco.editor.getEditors?.() || [];
      if (editors.length > 0) {
        const model = editors[0].getModel();
        if (model) { model.setValue(codeStr); return true; }
      }
      const models = win.monaco.editor.getModels?.() || [];
      if (models.length > 0) { models[0].setValue(codeStr); return true; }
    }

    return false;
  }, code);
}

async function injectCodeSwea(page: any, code: string, language: Language): Promise<boolean> {
  const sweaId = String(LanguageInfo[language].sweaId);

  // Wait for the page to load
  await page.waitForSelector('.CodeMirror, .ace_editor, textarea, select', { timeout: 15000 });
  await new Promise(r => setTimeout(r, 2000));

  // Select language if dropdown exists
  if (LanguageInfo[language].sweaId >= 0) {
    await page.evaluate((val: string) => {
      const selects = document.querySelectorAll('select');
      for (const sel of selects) {
        for (const opt of sel.options) {
          if (opt.value === val) {
            sel.value = val;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
            return;
          }
        }
      }
    }, sweaId);
    await new Promise(r => setTimeout(r, 500));
  }

  // Inject code
  return await page.evaluate((codeStr: string) => {
    // Method 1: CodeMirror
    const cmElements = document.querySelectorAll('.CodeMirror');
    for (const el of cmElements) {
      const cm = (el as any).CodeMirror;
      if (cm) {
        cm.setValue(codeStr);
        return true;
      }
    }

    // Method 2: Ace Editor
    const aceEl = document.querySelector('.ace_editor') as any;
    if (aceEl?.env?.editor) {
      aceEl.env.editor.setValue(codeStr, -1);
      return true;
    }

    // Method 3: textarea
    const textarea = document.querySelector('textarea[name="source"], textarea.source, textarea') as HTMLTextAreaElement;
    if (textarea) {
      textarea.value = codeStr;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }

    return false;
  }, code);
}

async function injectCodeLeetCode(page: any, code: string, language: Language): Promise<boolean> {
  const langSlug = LEETCODE_LANG_SLUG[language];

  // Wait for Monaco editor to load
  await page.waitForSelector('.monaco-editor', { timeout: 15000 });
  await new Promise(r => setTimeout(r, 1500));

  // Select language via LeetCode's language picker
  const langSelected = await page.evaluate((slug: string) => {
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      const text = btn.textContent?.trim().toLowerCase() || '';
      if (text.includes(slug) || text === slug) {
        btn.click();
        return true;
      }
    }
    return false;
  }, langSlug);

  if (!langSelected) {
    await page.evaluate((slug: string) => {
      const selects = document.querySelectorAll('select');
      for (const sel of selects) {
        for (const opt of sel.options) {
          if (opt.value === slug || opt.textContent?.toLowerCase().includes(slug)) {
            sel.value = opt.value;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
            return;
          }
        }
      }
    }, langSlug);
  }

  await new Promise(r => setTimeout(r, 500));

  // Set code in Monaco editor
  return await page.evaluate((codeStr: string) => {
    const win = window as any;
    if (win.monaco?.editor) {
      const editors = win.monaco.editor.getEditors?.() || [];
      if (editors.length > 0) {
        const model = editors[0].getModel();
        if (model) { model.setValue(codeStr); return true; }
      }
      const models = win.monaco.editor.getModels?.() || [];
      if (models.length > 0) { models[0].setValue(codeStr); return true; }
    }

    // Fallback: DOM-based approach
    const container = document.querySelector('[data-monaco-editor-id]') || document.querySelector('.monaco-editor');
    if (container && win.monaco?.editor) {
      const editors = win.monaco.editor.getEditors?.() || [];
      for (const ed of editors) {
        ed.getModel()?.setValue(codeStr);
        return true;
      }
    }

    return false;
  }, code);
}

async function injectCodeCodeforces(page: any, code: string, language: Language): Promise<boolean> {
  const langValue = CODEFORCES_LANG_VALUE[language];

  // Wait for the submit form to load
  await page.waitForSelector('form.submit-form, #sourceCodeTextarea, .ace_editor, #editor', { timeout: 15000 });
  await new Promise(r => setTimeout(r, 1000));

  // Select language in the dropdown
  await page.evaluate((val: string) => {
    const select = document.querySelector('select[name="programTypeId"]') as HTMLSelectElement;
    if (select) {
      for (const opt of select.options) {
        if (opt.value === val) {
          select.value = val;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          return;
        }
      }
    }
  }, langValue);

  await new Promise(r => setTimeout(r, 500));

  // Inject code
  return await page.evaluate((codeStr: string) => {
    // Method 1: Ace Editor
    const aceEditor = document.querySelector('.ace_editor') as any;
    if (aceEditor?.env?.editor) {
      aceEditor.env.editor.setValue(codeStr, -1);
      return true;
    }

    const win = window as any;
    if (win.ace?.edit) {
      const editors = document.querySelectorAll('.ace_editor');
      for (const el of editors) {
        try {
          const editor = win.ace.edit(el);
          if (editor) { editor.setValue(codeStr, -1); return true; }
        } catch { /* skip */ }
      }
    }

    // Method 2: CodeMirror
    const cmElement = document.querySelector('.CodeMirror') as any;
    if (cmElement?.CodeMirror) {
      cmElement.CodeMirror.setValue(codeStr);
      return true;
    }

    // Method 3: Plain textarea
    const textarea = document.querySelector('#sourceCodeTextarea, textarea[name="source"]') as HTMLTextAreaElement;
    if (textarea) {
      textarea.value = codeStr;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }

    return false;
  }, code);
}

// --- Inject dispatcher ---

async function injectCode(page: any, source: ProblemSource, code: string, language: Language): Promise<boolean> {
  switch (source) {
    case ProblemSource.BAEKJOON: return injectCodeBaekjoon(page, code, language);
    case ProblemSource.PROGRAMMERS: return injectCodeProgrammers(page, code, language);
    case ProblemSource.SWEA: return injectCodeSwea(page, code, language);
    case ProblemSource.LEETCODE: return injectCodeLeetCode(page, code, language);
    case ProblemSource.CODEFORCES: return injectCodeCodeforces(page, code, language);
    default: return false;
  }
}

// --- Main browser submit ---

export async function browserSubmit(
  source: ProblemSource,
  problemId: string,
  code: string,
  language: Language,
  cookies: string,
  contestProbId?: string,
): Promise<BrowserSubmitResult> {
  const executablePath = await detectChromiumBrowser();
  if (!executablePath) {
    return { success: false, error: 'NO_BROWSER' };
  }

  let puppeteer: any;
  try {
    puppeteer = require('puppeteer-core');
  } catch {
    return { success: false, error: 'NO_PUPPETEER' };
  }

  let browser: any;
  try {
    browser = await puppeteer.launch({
      executablePath,
      headless: false,
      defaultViewport: { width: 1200, height: 800 },
      args: [
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-extensions',
        '--disable-blink-features=AutomationControlled',
      ],
    });

    const pages = await browser.pages();
    const page = pages[0] || await browser.newPage();

    // Set cookies BEFORE navigation using url field (works from about:blank)
    const cookieUrl = getCookieUrl(source);
    const parsedCookies = parseCookieString(cookies, cookieUrl);
    if (parsedCookies.length > 0) {
      await page.setCookie(...parsedCookies.map(c => ({
        name: c.name,
        value: c.value,
        url: cookieUrl,
        path: '/',
        httpOnly: true,
        secure: true,
      })));
    }

    // Navigate to submit page (cookies sent with request → server sees logged-in session)
    const submitUrl = getSubmitUrl(source, problemId, language, contestProbId);
    await page.goto(submitUrl, { waitUntil: 'networkidle2', timeout: 20000 });

    // Inject code
    const injected = await injectCode(page, source, code, language);

    if (!injected) {
      return {
        success: true,
        error: 'INJECT_FAILED',
        message: 'CLIPBOARD_FALLBACK',
      };
    }

    // Browser stays open — user reviews and clicks submit
    return { success: true };
  } catch (err: any) {
    return { success: false, error: 'UNKNOWN', message: err?.message };
  }
}
