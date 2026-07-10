import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as vm from 'vm';
import { execFile } from 'child_process';
import { getWebviewContent } from './mainWebview';
import { Problem, ProblemSource, Language, LanguageInfo, TestCase, languageFromExtension } from '../models/models';
import { t, setLanguage, getLang } from '../services/i18n';
import { fetchProblem as fetchLeetCode, searchProblems as searchLeetCode, fetchAllProblemStats, fetchTopicTags as fetchLcTags } from '../services/leetCodeApi';
import { fetchProgrammersProblem, searchProblems as searchProgrammers, fetchExamCollections } from '../services/programmersApi';
import { searchProblems as searchSwea, randomProblems as randomSwea } from '../services/swexpertApi';
import { fetchSweaProblem } from '../services/sweaCrawler';
import { fetchCodeforcesProblem } from '../services/codeforcesCrawler';
import { searchProblems as searchCf, randomProblems as randomCf, fetchSolvedIds, fetchAllTags as fetchCfTags } from '../services/codeforcesApi';
import { run as runCode, runProgrammers, getDetectedPaths } from '../services/codeRunner';
import { submitCode } from '../services/submitService';
import { browserSubmit } from '../services/browserSubmit';
import { getCookies, setCookies, getUsername, setUsername, logout, isLoggedIn, getLoginUrl, fetchUsername, isDirectLoginSupported, directLogin, browserLogin } from '../services/authService';
import { getToken, setToken, clearToken, getRepoFullName, setRepoFullName, getAutoPushEnabled, setAutoPushEnabled, validateToken, listRepos, pushSolution } from '../services/githubService';
import { getTemplates, saveTemplate, deleteTemplate, getDefaultTemplateMap, setDefaultTemplate } from '../services/templateService';
import { getProblemPanelHtml } from './problemPanel';
import { createProblemFiles, loadProblemFromFolder, findProblemFolder } from '../services/problemFileManager';
import { translate, detectLanguage } from '../services/translateService';
import { fetchSolvedProblems, isSupported as isSolvedSupported } from '../services/solvedProblemsService';

export class CodingTestKitViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private _currentProblem?: Problem;
  private _currentSource: ProblemSource = ProblemSource.PROGRAMMERS;
  private _currentLanguage: Language = Language.JAVA;
  private _stateRestored = false;
  private _testCases: TestCase[] = [];
  private _translatedHtml?: string;
  private _originalHtml?: string;
  private _isTranslated = false;
  private _problemPanel?: vscode.WebviewPanel;

  public onStatusUpdate?: (data: { platform?: string; problemId?: string; title?: string }) => void;
  public onTimerUpdate?: (data: { timers: Array<{ mode: string; running: boolean; text: string }> }) => void;

  constructor(private readonly _context: vscode.ExtensionContext) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._context.extensionUri, 'media'),
        vscode.Uri.joinPath(this._context.extensionUri, 'dist'),
        vscode.Uri.joinPath(this._context.extensionUri, 'node_modules', '@vscode', 'codicons', 'dist'),
      ],
    };
    const codemirrorUri = webviewView.webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, 'dist', 'codemirror.js')
    );
    webviewView.webview.html = getWebviewContent(webviewView.webview, this._context.extensionUri, codemirrorUri);
    webviewView.webview.onDidReceiveMessage((msg) => this._handleMessage(msg));
  }

  sendCommand(command: string, data?: any): void {
    this._view?.webview.postMessage({ command, data });
  }

  async onEditorChanged(editor?: vscode.TextEditor): Promise<void> {
    if (!editor) {
      this._currentProblem = undefined;
      this._testCases = [];
      this._originalHtml = undefined;
      this._translatedHtml = undefined;
      this._isTranslated = false;
      this.sendCommand('clearProblem');
      this.onStatusUpdate?.({ problemId: '', title: '' });
      return;
    }

    const filePath = editor.document.uri.fsPath;
    const problemFolder = findProblemFolder(filePath);
    if (problemFolder) {
      const problem = loadProblemFromFolder(problemFolder);
      if (problem) {
        this._currentProblem = problem;
        this._currentSource = problem.source;
        this._testCases = problem.testCases;
        this._originalHtml = problem.description;
        this._isTranslated = false;
        this.sendCommand('problemFetched', {
          problem: { ...problem, description: problem.description },
          source: problem.source,
        });
        this._updateProblemPanel();
        // Detect language from file extension
        const ext = path.extname(filePath).slice(1);
        const lang = languageFromExtension(ext);
        if (lang) {
          this._currentLanguage = lang;
          this.sendCommand('updateLanguage', lang);
        }
        return;
      }
    }

    // Not a problem file → clear display
    this._currentProblem = undefined;
    this._testCases = [];
    this._originalHtml = undefined;
    this._translatedHtml = undefined;
    this._isTranslated = false;
    this.sendCommand('clearProblem');
    this.onStatusUpdate?.({ problemId: '', title: '' });
  }

  private async _handleMessage(msg: any): Promise<void> {
    const { command, data } = msg;
    try {
      switch (command) {
        case 'webviewReady':
          await this._onWebviewReady();
          break;
        case 'fetchProblem':
          await this._fetchProblem(data);
          break;
        case 'runTests':
          await this._runTests(data);
          break;
        case 'runSingleTest':
          await this._runSingleTest(data);
          break;
        case 'debugTest':
          await this._debugTest(data);
          break;
        case 'saveValidator':
          this._saveValidator(data);
          break;
        case 'submitCode':
          await this._submitCode(data);
          break;
        case 'login':
          await this._login(data);
          break;
        case 'logout':
          await this._logout(data);
          break;
        case 'search':
          await this._search(data);
          break;
        case 'random':
          await this._random(data);
          break;
        case 'mySolved':
          await this._mySolved(data);
          break;
        case 'translate':
          await this._translate();
          break;
        case 'saveTemplate':
          this._saveTemplate(data);
          break;
        case 'loadTemplate':
          await this._loadTemplate(data);
          break;
        case 'deleteTemplate':
          this._deleteTemplate(data);
          break;
        case 'setDefaultTemplate':
          this._setDefaultTemplate(data);
          break;
        case 'openProblemPanel':
          this.openProblemPanel();
          break;
        case 'githubLogout':
          await this._githubLogout();
          break;
        case 'changePlatform': {
          const newSource = data.source as ProblemSource;
          this._currentSource = newSource;
          this._context.globalState.update('lastPlatform', newSource);
          this.onStatusUpdate?.({ platform: data.source });
          const loggedIn = await isLoggedIn(newSource);
          const username = loggedIn ? await getUsername(newSource) : '';
          this.sendCommand('loginStatus', { source: newSource, loggedIn, username });
          break;
        }
        case 'changeLanguage':
          this._currentLanguage = data.language as Language;
          this._context.globalState.update('lastLanguage', data.language);
          break;
        case 'changeSetting':
          await this._changeSetting(data);
          break;
        case 'getToolPaths':
          this._getToolPaths();
          break;
        case 'getSettings':
          await this._sendSettings();
          break;
        case 'githubLogin':
          await this._githubLogin();
          break;
        case 'githubSaveConfig':
          await this._githubSaveConfig(data);
          break;
        case 'githubLoadConfig':
          await this._githubLoadConfig();
          break;
        case 'githubListRepos':
          await this._githubListRepos();
          break;
        case 'fetchTags':
          await this._fetchTags(data);
          break;
        case 'fetchExamCollections':
          await this._fetchExamCollections();
          break;
        case 'translateBatch':
          await this._translateBatch(data);
          break;
        case 'timerState':
          this.onTimerUpdate?.(data);
          break;
        case 'countdownComplete':
          vscode.window.showWarningMessage(
            t('시간 종료!', 'Time is up!'),
            { modal: true },
          );
          break;
      }
    } catch (err: any) {
      this.sendCommand('error', { message: err.message || String(err) });
    }
  }

  private async _onWebviewReady(): Promise<void> {
    // Restore saved platform & language
    const savedPlatform = this._context.globalState.get<string>('lastPlatform');
    const savedLanguage = this._context.globalState.get<string>('lastLanguage');
    if (savedPlatform && Object.values(ProblemSource).includes(savedPlatform as ProblemSource)) {
      this._currentSource = savedPlatform as ProblemSource;
      this.sendCommand('updatePlatform', { platform: savedPlatform });
    }
    if (savedLanguage && Object.values(Language).includes(savedLanguage as Language)) {
      this._currentLanguage = savedLanguage as Language;
      this.sendCommand('updateLanguage', { language: savedLanguage });
    }

    // Send initial state
    this._sendTemplateList();

    // Check login status for all platforms
    for (const source of Object.values(ProblemSource)) {
      const loggedIn = await isLoggedIn(source);
      const username = loggedIn ? await getUsername(source) : '';
      this.sendCommand('loginStatus', { source, loggedIn, username });
    }

    // Send settings
    await this._sendSettings();

    // Send tool paths
    this._getToolPaths();

    // GitHub config
    await this._githubLoadConfig();

    // Auto-detect problem from current editor
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      await this.onEditorChanged(editor);
    }
  }

  private async _fetchProblem(data: { source: ProblemSource; language: Language; problemId: string }): Promise<void> {
    const { source, language, problemId } = data;
    this._currentSource = source;
    this._context.globalState.update('lastPlatform', source);
    this._context.globalState.update('lastLanguage', language);
    this._currentLanguage = language;
    this.sendCommand('info', { message: t('문제를 가져오는 중...', 'Fetching problem...') });

    let problem: Problem;
    const cookies = await getCookies(source);

    switch (source) {
      case ProblemSource.PROGRAMMERS:
        problem = await fetchProgrammersProblem(problemId, cookies);
        break;
      case ProblemSource.LEETCODE:
        problem = await fetchLeetCode(problemId, LanguageInfo[language].extension, cookies);
        break;
      case ProblemSource.CODEFORCES:
        problem = await fetchCodeforcesProblem(problemId, cookies);
        break;
      case ProblemSource.SWEA:
        problem = await fetchSweaProblem(problemId, cookies);
        break;
      default:
        throw new Error(t('지원하지 않는 플랫폼입니다.', 'Unsupported platform.'));
    }

    this._currentProblem = problem;
    this._testCases = [...problem.testCases];
    this._originalHtml = problem.description;
    this._isTranslated = false;

    // Create problem files in workspace
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      const codeFilePath = await createProblemFiles(problem, language);
      // Open the code file
      const doc = await vscode.workspace.openTextDocument(codeFilePath);
      await vscode.window.showTextDocument(doc);
    }

    this.sendCommand('problemFetched', { problem, source });
    this._updateProblemPanel();
    this.onStatusUpdate?.({ platform: source, problemId: problem.id, title: problem.title });
    this.sendCommand('info', {
      message: t(
        `✓ ${problem.title} 가져오기 완료`,
        `✓ Fetched: ${problem.title}`
      ),
    });
  }

  // Gathers everything a test run needs from the current editor/problem, or
  // reports the reason it can't run and returns null.
  private _getRunContext(): { code: string; lang: Language; paramNames: string[]; isFunctionMode: boolean; validator?: string } | null {
    if (!this._currentProblem) {
      this.sendCommand('error', { message: t('먼저 문제를 가져와주세요.', 'Please fetch a problem first.') });
      return null;
    }
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      this.sendCommand('error', { message: t('코드 파일을 열어주세요.', 'Please open a code file.') });
      return null;
    }
    const code = editor.document.getText();
    const ext = path.extname(editor.document.uri.fsPath).slice(1);
    const lang = languageFromExtension(ext) || this._currentLanguage;
    const source = this._currentProblem.source;
    return {
      code,
      lang,
      paramNames: this._currentProblem.parameterNames,
      isFunctionMode: source === ProblemSource.PROGRAMMERS || source === ProblemSource.LEETCODE,
    };
  }

  // Runs one test case and reports its result to the webview. An empty
  // expected output marks the case as "neutral": the code still runs (to
  // check runtime, errors and time limits — e.g. generated stress inputs)
  // but no pass/fail verdict is given (passed: null).
  private async _runOneCase(
    ctx: { code: string; lang: Language; paramNames: string[]; isFunctionMode: boolean; validator?: string },
    tc: TestCase,
    index: number,
  ): Promise<{ comparable: boolean; passed: boolean }> {
    this.sendCommand('testResult', { index, status: 'running' });
    try {
      const result = ctx.isFunctionMode
        ? await runProgrammers(ctx.code, ctx.lang, tc.input, ctx.paramNames)
        : await runCode(ctx.code, ctx.lang, tc.input);

      const actual = result.output.trim();
      const expected = tc.expectedOutput.trim();
      const validator = ctx.validator?.trim();

      let comparable: boolean;
      let passed: boolean;
      let validatorError = '';
      if (validator) {
        // Special judge (#36): problems with multiple valid answers judge via
        // the user's validator instead of output comparison — an expected
        // output is not required.
        comparable = true;
        try {
          passed = this._runValidator(validator, tc.input, expected, actual);
        } catch (err: any) {
          passed = false;
          validatorError = `Validator error: ${err.message || String(err)}`;
        }
      } else {
        comparable = expected.length > 0;
        // Normalize comparison
        const normalizeOutput = (s: string) =>
          s.split('\n').map((l) => l.trimEnd()).join('\n')
            .replace(/\[\s*/g, '[').replace(/\s*\]/g, ']').replace(/,\s+/g, ',');
        passed = comparable && normalizeOutput(actual) === normalizeOutput(expected);
      }

      this.sendCommand('testResult', {
        index,
        status: result.timedOut ? 'timeout' : !comparable ? 'done' : passed ? 'pass' : 'fail',
        actualOutput: actual,
        error: [result.error, validatorError].filter(Boolean).join('\n'),
        timeMs: result.executionTimeMs,
        memoryKB: result.peakMemoryKB,
        passed: comparable ? passed : null,
      });
      return { comparable, passed };
    } catch (err: any) {
      this.sendCommand('testResult', {
        index,
        status: 'error',
        actualOutput: '',
        error: err.message || String(err),
        timeMs: 0,
        memoryKB: 0,
        passed: false,
      });
      return { comparable: true, passed: false };
    }
  }

  private async _runTests(data: { testCases: TestCase[]; validator?: string }): Promise<void> {
    const ctx = this._getRunContext();
    if (!ctx) {
      this.sendCommand('testComplete', { passCount: 0, totalCount: 0, message: '' });
      return;
    }
    ctx.validator = data.validator ?? this._currentProblem?.validator;
    const testCases = data.testCases || this._testCases;

    let passCount = 0;
    let comparableCount = 0;
    for (let i = 0; i < testCases.length; i++) {
      const outcome = await this._runOneCase(ctx, testCases[i], i);
      if (outcome.comparable) {
        comparableCount++;
        if (outcome.passed) { passCount++; }
      }
    }

    this.sendCommand('testComplete', {
      passCount,
      totalCount: comparableCount,
      message: `${passCount}/${comparableCount} ${t('통과', 'passed')}`,
    });
  }

  private async _runSingleTest(data: { index: number; testCase: TestCase; validator?: string }): Promise<void> {
    const ctx = this._getRunContext();
    if (!ctx) {
      this.sendCommand('singleTestComplete', { index: data.index });
      return;
    }
    ctx.validator = data.validator ?? this._currentProblem?.validator;
    await this._runOneCase(ctx, data.testCase, data.index);
    this.sendCommand('singleTestComplete', { index: data.index });
  }

  // #36: launches the current solution under the IDE debugger with a test
  // case's input. Python/JS get stdin wired automatically through a small
  // wrapper; C++ recompiles with -g and redirects; JVM/Go read the input
  // pasted into the integrated terminal (it is placed on the clipboard).
  private async _debugTest(data: { testCase: TestCase }): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      this.sendCommand('error', { message: t('코드 파일을 열어주세요.', 'Please open a code file.') });
      return;
    }
    const filePath = editor.document.uri.fsPath;
    const folder = path.dirname(filePath);
    const ext = path.extname(filePath).slice(1);
    const lang = languageFromExtension(ext) || this._currentLanguage;

    const input = data.testCase?.input ?? '';
    try { fs.writeFileSync(path.join(folder, 'input.txt'), input, 'utf-8'); } catch { /* clipboard still works */ }
    await vscode.env.clipboard.writeText(input);

    let config: vscode.DebugConfiguration;
    let manualStdin = false;
    switch (lang) {
      case Language.PYTHON: {
        const wrapper = path.join(folder, '.ctk_debug.py');
        fs.writeFileSync(wrapper, [
          'import sys, runpy',
          "sys.stdin = open('input.txt', encoding='utf-8')",
          `runpy.run_path(${JSON.stringify(path.basename(filePath))}, run_name='__main__')`,
          '',
        ].join('\n'), 'utf-8');
        config = { type: 'debugpy', name: 'CodingTestKit Debug', request: 'launch', program: wrapper, cwd: folder, console: 'integratedTerminal', justMyCode: false };
        break;
      }
      case Language.JAVASCRIPT: {
        const wrapper = path.join(folder, '.ctk_debug.js');
        fs.writeFileSync(wrapper, [
          "const fs = require('fs');",
          "const path = require('path');",
          "const { Readable } = require('stream');",
          "const data = fs.readFileSync(path.join(__dirname, 'input.txt'));",
          'const stdin = new Readable();',
          'stdin.push(data);',
          'stdin.push(null);',
          "Object.defineProperty(process, 'stdin', { value: stdin, configurable: true });",
          `require(path.join(__dirname, ${JSON.stringify(path.basename(filePath))}));`,
          '',
        ].join('\n'), 'utf-8');
        config = { type: 'node', name: 'CodingTestKit Debug', request: 'launch', program: wrapper, cwd: folder, console: 'integratedTerminal' };
        break;
      }
      case Language.CPP: {
        const gpp = getDetectedPaths().gpp;
        if (!gpp) {
          this.sendCommand('error', { message: t('g++를 찾을 수 없습니다. 설정에서 "codingtestkit.toolPath.cpp"에 컴파일러 경로를 지정해주세요.', 'g++ not found. Set "codingtestkit.toolPath.cpp" to your compiler path in Settings.') });
          return;
        }
        const outPath = path.join(folder, process.platform === 'win32' ? '.ctk_debug.exe' : '.ctk_debug');
        const compileErr = await new Promise<string>((resolve) => {
          execFile(gpp, ['-std=c++17', '-g', '-O0', '-o', outPath, filePath], { cwd: folder }, (err, _stdout, stderr) => {
            resolve(err ? (stderr || String(err)) : '');
          });
        });
        if (compileErr) {
          this.sendCommand('error', { message: compileErr });
          return;
        }
        // CodeLLDB redirects stdin natively; cpptools needs the shell trick
        const hasCodeLLDB = !!vscode.extensions.getExtension('vadimcn.vscode-lldb');
        config = hasCodeLLDB
          ? { type: 'lldb', name: 'CodingTestKit Debug', request: 'launch', program: outPath, cwd: folder, stdio: ['input.txt', null, null] }
          : { type: 'cppdbg', name: 'CodingTestKit Debug', request: 'launch', program: outPath, cwd: folder, args: ['<', 'input.txt'], MIMode: process.platform === 'darwin' ? 'lldb' : 'gdb', externalConsole: false };
        break;
      }
      case Language.JAVA:
        config = { type: 'java', name: 'CodingTestKit Debug', request: 'launch', mainClass: filePath, cwd: folder, console: 'integratedTerminal' };
        manualStdin = true;
        break;
      case Language.GO:
        config = { type: 'go', name: 'CodingTestKit Debug', request: 'launch', mode: 'debug', program: filePath, cwd: folder, console: 'integratedTerminal' };
        manualStdin = true;
        break;
      default:
        this.sendCommand('error', {
          message: t(
            `${lang} 디버그 실행은 아직 지원하지 않습니다. 입력을 클립보드에 복사해두었으니 직접 디버깅할 때 붙여넣어 사용하세요.`,
            `Debugging is not supported for ${lang} yet. The input is on your clipboard for manual debugging.`,
          ),
        });
        return;
    }

    const wsFolder = vscode.workspace.workspaceFolders?.[0];
    const started = await Promise.resolve(vscode.debug.startDebugging(wsFolder, config)).then((r) => r, () => false);
    if (!started) {
      this.sendCommand('error', {
        message: t(
          '디버거를 시작하지 못했습니다. 해당 언어의 디버거 확장이 설치되어 있는지 확인하세요.',
          'Could not start the debugger. Make sure the debugger extension for this language is installed.',
        ),
      });
      return;
    }
    this.sendCommand('info', {
      message: manualStdin
        ? t('디버그 시작 — 입력이 클립보드에 있습니다. 터미널에 붙여넣으세요.', 'Debug started — the input is on your clipboard; paste it into the terminal.')
        : t('디버그 시작 — 입력은 input.txt로 연결되었습니다.', 'Debug started — input wired from input.txt.'),
    });
  }

  // Runs the special-judge validator via Node's vm module. NOT a security
  // sandbox (vm contexts are escapable by design) and not meant as one: the
  // validator is user-authored code from the local workspace — the same
  // trust level as the solution code this extension already compiles and
  // executes. Untrusted workspaces are gated by VS Code's Workspace Trust.
  // The timeout only guards against accidental infinite loops.
  private _runValidator(code: string, input: string, expected: string, actual: string): boolean {
    const sandbox = { input, expected, actual };
    const script = `(function(input, expected, actual) {\n${code}\n})(input, expected, actual)`;
    return !!vm.runInNewContext(script, sandbox, { timeout: 2000 });
  }

  // Persists the special-judge validator into the problem's problem.json so
  // it survives across sessions and re-opens with the problem.
  private _saveValidator(data: { validator: string }): void {
    if (!this._currentProblem) {
      this.sendCommand('error', { message: t('먼저 문제를 가져와주세요.', 'Please fetch a problem first.') });
      return;
    }
    this._currentProblem.validator = data.validator;

    const editor = vscode.window.activeTextEditor;
    const problemFolder = editor ? findProblemFolder(editor.document.uri.fsPath) : null;
    if (problemFolder) {
      try {
        const jsonPath = path.join(problemFolder, 'problem.json');
        const parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
        parsed.validator = data.validator;
        fs.writeFileSync(jsonPath, JSON.stringify(parsed, null, 2), 'utf-8');
        this.sendCommand('info', { message: t('✓ 검증기가 저장되었습니다.', '✓ Validator saved.') });
        return;
      } catch {
        // problem.json unreadable — fall through to the in-memory note
      }
    }
    this.sendCommand('info', {
      message: t('검증기가 이 세션에만 적용됩니다 (problem.json 없음).', 'Validator applies to this session only (no problem.json).'),
    });
  }

  private async _submitCode(_data: any): Promise<void> {
    if (!this._currentProblem) {
      this.sendCommand('error', { message: t('먼저 문제를 가져와주세요.', 'Please fetch a problem first.') });
      return;
    }

    const source = this._currentProblem.source;

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      this.sendCommand('error', { message: t('코드 파일을 열어주세요.', 'Please open a code file.') });
      return;
    }

    const filePath = editor.document.uri.fsPath;
    const fileName = path.basename(filePath);
    const confirm = await vscode.window.showInformationMessage(
      t(`${fileName} 파일을 ${source}에 제출하시겠습니까?\n${filePath}`,
        `Submit ${fileName} to ${source}?\n${filePath}`),
      { modal: true },
      t('제출', 'Submit'),
    );
    if (!confirm) { return; }

    const code = editor.document.getText();

    // All platforms: open submit page in user's default browser + copy code to clipboard
    await vscode.env.clipboard.writeText(code);

    let url: string;
    switch (source) {
      case ProblemSource.PROGRAMMERS: {
        const progLang = { JAVA: 'java', PYTHON: 'python3', CPP: 'cpp', KOTLIN: 'kotlin', JAVASCRIPT: 'javascript', RUST: '', GO: 'go', RUBY: 'ruby' }[this._currentLanguage] || '';
        url = `https://school.programmers.co.kr/learn/courses/30/lessons/${this._currentProblem.id}${progLang ? '?language=' + progLang : ''}`;
        break;
      }
      case ProblemSource.SWEA:
        url = `https://swexpertacademy.com/main/code/problem/problemDetail.do?contestProbId=${this._currentProblem.contestProbId || this._currentProblem.id}`;
        break;
      case ProblemSource.LEETCODE: {
        const slug = this._currentProblem.contestProbId || this._currentProblem.id;
        const lcLang = { JAVA: 'java', PYTHON: 'python3', CPP: 'cpp', KOTLIN: 'kotlin', JAVASCRIPT: 'javascript', RUST: 'rust', GO: 'golang', RUBY: 'ruby' }[this._currentLanguage] || '';
        url = `https://leetcode.com/problems/${slug}/${lcLang ? '?lang=' + lcLang : ''}`;
        break;
      }
      case ProblemSource.CODEFORCES: {
        const match = this._currentProblem.id.match(/^(\d+)([A-Za-z]\d?)$/);
        url = match
          ? `https://codeforces.com/contest/${match[1]}/submit/${match[2]}`
          : `https://codeforces.com/problemset/submit`;
        break;
      }
      default:
        this.sendCommand('error', { message: t('지원하지 않는 플랫폼입니다.', 'Unsupported platform.') });
        return;
    }

    await vscode.env.openExternal(vscode.Uri.parse(url));
    this.sendCommand('info', {
      message: t(
        '✓ 코드가 클립보드에 복사되었습니다. 브라우저에서 붙여넣고 제출하세요.',
        '✓ Code copied to clipboard. Paste and submit in the browser.'
      ),
    });
  }

  private async _fallbackSubmit(source: ProblemSource, problemId: string, code: string, cookies: string): Promise<void> {
    // For Programmers/SWEA: use existing HTTP API submission
    if (source === ProblemSource.PROGRAMMERS || source === ProblemSource.SWEA) {
      this.sendCommand('info', { message: t('API로 제출 중...', 'Submitting via API...') });
      const apiResult = await submitCode(
        source,
        problemId,
        code,
        this._currentLanguage,
        cookies,
        this._currentProblem?.contestProbId,
      );
      if (apiResult.success) {
        this.sendCommand('info', { message: `✓ ${apiResult.message}` });
        const autoPush = await getAutoPushEnabled();
        if (autoPush && this._currentProblem) {
          await this._pushToGitHub();
        }
      } else {
        this.sendCommand('error', { message: apiResult.message });
      }
      return;
    }

    // For LeetCode/Codeforces: open URL in default browser
    let url: string;
    if (source === ProblemSource.LEETCODE) {
      url = `https://leetcode.com/problems/${problemId}/`;
    } else {
      const match = problemId.match(/^(\d+)([A-Za-z]\d?)$/);
      url = match
        ? `https://codeforces.com/contest/${match[1]}/submit/${match[2]}`
        : `https://codeforces.com/problemset/submit`;
    }
    await vscode.env.openExternal(vscode.Uri.parse(url));
    this.sendCommand('info', { message: t('브라우저에서 코드를 붙여넣고 제출해주세요.', 'Please paste your code and submit in the browser.') });
  }

  public async handleAuthCallback(source: string, cookies: string): Promise<void> {
    const decodedCookies = decodeURIComponent(cookies);
    await setCookies(source as ProblemSource, decodedCookies);
    const username = await fetchUsername(source as ProblemSource, decodedCookies);
    if (username) {
      await setUsername(source as ProblemSource, username);
      this.sendCommand('loginStatus', { source, loggedIn: true, username });
      this.sendCommand('info', {
        message: t(`✓ ${username}님으로 로그인되었습니다.`, `✓ Logged in as ${username}.`),
      });
      vscode.window.showInformationMessage(
        t(`CodingTestKit: ${username}님으로 로그인되었습니다.`, `CodingTestKit: Logged in as ${username}.`)
      );
    } else {
      await logout(source as ProblemSource);
      this.sendCommand('loginStatus', { source, loggedIn: false, username: '' });
      this.sendCommand('error', {
        message: t('로그인에 실패했습니다. 쿠키를 확인해주세요.', 'Login failed. Please check your cookies.'),
      });
    }
  }

  private async _login(data: { source: ProblemSource }): Promise<void> {
    const { source } = data;

    // Try browser login first (puppeteer-core)
    const browserResult = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: t(`${source} 브라우저 로그인 대기 중...`, `Waiting for ${source} browser login...`),
        cancellable: true,
      },
      (_progress, token) => {
        return new Promise<Awaited<ReturnType<typeof browserLogin>>>((resolve) => {
          const loginPromise = browserLogin(source);
          loginPromise.then(resolve).catch(() => {
            resolve({ success: false, error: 'UNKNOWN' });
          });
          token.onCancellationRequested(() => {
            resolve({ success: false, error: 'USER_CLOSED' });
          });
        });
      },
    );

    if (browserResult.success && browserResult.cookies) {
      await this._processLoginCookies(source, browserResult.cookies, browserResult.username);
      return;
    }

    if (browserResult.error === 'USER_CLOSED') {
      this.sendCommand('info', {
        message: t('로그인이 취소되었습니다.', 'Login cancelled.'),
      });
      return;
    }

    if (browserResult.error === 'TIMEOUT') {
      this.sendCommand('error', {
        message: t('로그인 시간이 초과되었습니다.', 'Login timed out.'),
      });
      return;
    }

    // Fallback: NO_BROWSER or UNKNOWN → show QuickPick
    console.warn('[CodingTestKit] Browser login failed:', browserResult.error);
    await this._quickPickLogin(source);
  }

  private async _quickPickLogin(source: ProblemSource): Promise<void> {
    const loginUrl = getLoginUrl(source);

    const items: Array<{ label: string; description: string; value: string }> = [];

    items.push({
      label: t('$(zap) 브라우저 간편 로그인 (추천)', '$(zap) Browser Quick Login (Recommended)'),
      description: t(
        '브라우저 로그인 → F12 콘솔에 한 줄 붙여넣기 → 자동 완료',
        'Browser login → paste one line in F12 console → auto done'
      ),
      value: 'browser',
    });

    if (isDirectLoginSupported(source)) {
      items.push({
        label: t('$(account) 아이디/비밀번호 로그인', '$(account) ID/Password Login'),
        description: t(
          '아이디와 비밀번호를 입력하면 자동으로 로그인됩니다.',
          'Enter your ID and password to log in automatically.'
        ),
        value: 'direct',
      });
    }

    items.push({
      label: t('$(terminal) 수동 쿠키 입력', '$(terminal) Manual Cookie Input'),
      description: t(
        'document.cookie 결과를 직접 복사/붙여넣기',
        'Copy/paste document.cookie result manually'
      ),
      value: 'manual',
    });

    const choice = await vscode.window.showQuickPick(items, {
      title: t(`${source} 로그인`, `${source} Login`),
      placeHolder: t('로그인 방법을 선택하세요.', 'Choose login method.'),
      ignoreFocusOut: true,
    });

    if (!choice) { return; }

    if (choice.value === 'direct') {
      await this._directLogin(source);
      return;
    }

    if (choice.value === 'browser') {
      const captureScript = `location.href='vscode://codingtestkit.codingtestkit/auth?source=${source}&cookies='+encodeURIComponent(document.cookie)`;
      await vscode.env.clipboard.writeText(captureScript);
      await vscode.env.openExternal(vscode.Uri.parse(loginUrl));
      vscode.window.showInformationMessage(
        t(
          '로그인 완료 후: F12(개발자 도구) → Console 탭 → Ctrl+V → Enter',
          'After login: F12 (DevTools) → Console → Ctrl+V → Enter'
        )
      );
      return;
    }

    // Manual: paste cookies directly
    await vscode.env.openExternal(vscode.Uri.parse(loginUrl));
    const cookieStr = await vscode.window.showInputBox({
      title: t(`${source} 쿠키 입력`, `${source} Cookie Input`),
      prompt: t(
        '브라우저에서 로그인 후, 개발자 도구(F12) > Console > document.cookie 실행 결과를 붙여넣어주세요.',
        'After logging in, open DevTools (F12) > Console > run document.cookie and paste the result here.'
      ),
      placeHolder: 'cookie1=value1; cookie2=value2; ...',
      ignoreFocusOut: true,
    });

    if (!cookieStr) { return; }
    await this._processLoginCookies(source, cookieStr);
  }

  private async _directLogin(source: ProblemSource): Promise<void> {
    const usernameInput = await vscode.window.showInputBox({
      title: t(`${source} 로그인`, `${source} Login`),
      prompt: t('아이디 (또는 이메일)', 'Username (or email)'),
      ignoreFocusOut: true,
    });
    if (!usernameInput) { return; }

    const passwordInput = await vscode.window.showInputBox({
      title: t(`${source} 로그인`, `${source} Login`),
      prompt: t('비밀번호', 'Password'),
      password: true,
      ignoreFocusOut: true,
    });
    if (!passwordInput) { return; }

    this.sendCommand('info', { message: t('로그인 중...', 'Logging in...') });

    const result = await directLogin(source, usernameInput, passwordInput);

    if (result.success && result.cookies) {
      await this._processLoginCookies(source, result.cookies);
    } else {
      this.sendCommand('error', {
        message: t(
          `로그인 실패: ${result.error || '아이디 또는 비밀번호를 확인해주세요.'}`,
          `Login failed: ${result.error || 'Please check your credentials.'}`
        ),
      });
    }
  }

  private async _processLoginCookies(source: ProblemSource, cookieStr: string, preExtractedUsername?: string): Promise<void> {
    await setCookies(source, cookieStr);
    const username = preExtractedUsername || await fetchUsername(source, cookieStr);
    if (username) {
      await setUsername(source, username);
      this.sendCommand('loginStatus', { source, loggedIn: true, username });
      this.sendCommand('info', {
        message: t(`✓ ${username}님으로 로그인되었습니다.`, `✓ Logged in as ${username}.`),
      });
    } else if (preExtractedUsername === undefined && !username) {
      // Only fail if no username was pre-extracted AND fetch also failed
      await logout(source);
      this.sendCommand('loginStatus', { source, loggedIn: false, username: '' });
      this.sendCommand('error', {
        message: t('로그인에 실패했습니다. 쿠키를 확인해주세요.', 'Login failed. Please check your cookies.'),
      });
    } else {
      // Browser login: cookies captured but username unknown — still save
      await setUsername(source, source);
      this.sendCommand('loginStatus', { source, loggedIn: true, username: source });
      this.sendCommand('info', {
        message: t(`✓ ${source} 로그인 완료`, `✓ Logged in to ${source}.`),
      });
    }
  }

  private async _logout(data: { source: ProblemSource }): Promise<void> {
    await logout(data.source);
    this.sendCommand('loginStatus', { source: data.source, loggedIn: false, username: '' });
    this.sendCommand('info', { message: t('로그아웃되었습니다.', 'Logged out.') });
  }

  private async _search(data: any): Promise<void> {
    const { source, query, sort, difficulty, tags, status, page } = data;
    const cookies = await getCookies(source);

    let results: any;
    switch (source) {
      case ProblemSource.LEETCODE:
        results = await searchLeetCode(
          query || '', difficulty || null, tags ? (Array.isArray(tags) ? tags : [tags]) : [],
          status || null, 50, ((page || 1) - 1) * 50, cookies
        );
        break;
      case ProblemSource.CODEFORCES:
        results = {
          problems: await searchCf(
            query, tags || [],
            data.ratingMin || 0, data.ratingMax || 3500,
            data.minSolved || 0, 50
          ),
          totalCount: 0,
        };
        break;
      case ProblemSource.PROGRAMMERS:
        results = await searchProgrammers(query, data.levels, data.languages, data.statuses, data.partIds, sort, page, cookies);
        break;
      case ProblemSource.SWEA: {
        // Build proper SWEA search params from filters
        const sweaParams: any = {
          problemTitle: query || '',
          orderBy: data.orderBy || 'INQUERY_COUNT',
          selectCodeLang: data.selectCodeLang || 'ALL',
          pageSize: 20,
          pageIndex: page || 1,
        };
        if (data.problemLevels && data.problemLevels.length > 0) {
          sweaParams.problemLevels = data.problemLevels;
        }
        results = await searchSwea(sweaParams);
        break;
      }
      default:
        results = { problems: [], totalCount: 0 };
    }
    this.sendCommand('searchResults', { source, ...results });
  }

  private async _random(data: any): Promise<void> {
    const { source, count } = data;
    const cookies = await getCookies(source);

    let problems: any[];
    switch (source) {
      case ProblemSource.LEETCODE: {
        const tagArr = data.tags ? (Array.isArray(data.tags) ? data.tags : [data.tags]) : [];
        const difficulty = data.difficulty || null;
        const res = await searchLeetCode('', difficulty, tagArr, null, 150, 0, cookies);
        let filtered = res.problems;
        // Filter by multiple difficulties if provided
        if (data.difficulties && data.difficulties.length > 0 && data.difficulties.length < 3) {
          const diffSet = new Set(data.difficulties.map((d: string) => d.toUpperCase()));
          filtered = filtered.filter((p: any) => diffSet.has((p.difficulty || '').toUpperCase()));
        }
        // Filter by min accepted count — merge actual stats since searchLeetCode returns acceptedUserCount: 0
        if (data.minAccepted) {
          try {
            const stats = await fetchAllProblemStats(cookies);
            filtered = filtered.filter((p: any) => {
              const stat = stats.get(Number(p.problemId));
              return (stat?.totalAcs || 0) >= data.minAccepted;
            });
          } catch {
            // Stats fetch failed — skip filtering rather than filtering out everything
          }
        }
        // Shuffle and take count
        const shuffled = filtered.sort(() => Math.random() - 0.5);
        problems = shuffled.slice(0, count || 5);
        break;
      }
      case ProblemSource.CODEFORCES:
        problems = await randomCf(data.tags || [], data.ratingMin || 800, data.ratingMax || 3500, data.minSolved || 0, count || 5);
        break;
      case ProblemSource.SWEA:
        problems = await randomSwea({
          selectCodeLang: data.selectCodeLang,
          problemLevels: data.problemLevels,
          count: count || 5,
          minParticipants: data.minParticipants || 0,
        });
        break;
      case ProblemSource.PROGRAMMERS: {
        const progRes = await searchProgrammers(
          '', data.levels, data.languages || [], data.statuses || [], data.partIds || [],
          'acceptance_asc', 1, cookies
        );
        const allProgs = progRes.problems || [];
        const levelFiltered = data.levels?.length > 0
          ? allProgs.filter((p: any) => data.levels.includes(p.level))
          : allProgs;
        const progShuffled = levelFiltered.sort(() => Math.random() - 0.5);
        problems = progShuffled.slice(0, count || 5);
        break;
      }
      default:
        problems = [];
    }
    this.sendCommand('randomResults', { source, problems });
  }

  private async _mySolved(data: any): Promise<void> {
    const { source, query, page } = data;
    if (!isSolvedSupported(source)) {
      this.sendCommand('error', {
        message: t('이 플랫폼은 풀이 조회를 지원하지 않습니다.', 'This platform does not support solved problem lookup.'),
      });
      return;
    }
    const username = await getUsername(source);
    const cookies = await getCookies(source);
    if (!username) {
      this.sendCommand('error', { message: t('먼저 로그인해주세요.', 'Please login first.') });
      return;
    }
    const results = await fetchSolvedProblems(source, username, query || '', page || 1, cookies);
    this.sendCommand('mySolvedResults', { source, ...results });
  }

  // Opens (or reveals) the current problem statement in a full-size editor
  // tab — the sidebar is too narrow for long statements (#33).
  public openProblemPanel(): void {
    if (!this._currentProblem) {
      this.sendCommand('error', { message: t('먼저 문제를 가져와주세요.', 'Please fetch a problem first.') });
      return;
    }
    if (this._problemPanel) {
      this._problemPanel.reveal();
    } else {
      this._problemPanel = vscode.window.createWebviewPanel(
        'codingtestkit.problemPanel',
        this._currentProblem.title,
        vscode.ViewColumn.Active,
        { enableScripts: false, retainContextWhenHidden: true },
      );
      this._problemPanel.onDidDispose(() => { this._problemPanel = undefined; });
    }
    this._updateProblemPanel();
  }

  // Keeps the maximized panel in sync when a new problem is fetched or the
  // statement is translated. No-op while the panel is closed.
  private _updateProblemPanel(): void {
    if (!this._problemPanel || !this._currentProblem) { return; }
    const description = this._isTranslated && this._translatedHtml
      ? this._translatedHtml
      : this._currentProblem.description;
    this._problemPanel.title = this._currentProblem.title;
    this._problemPanel.webview.html = getProblemPanelHtml(this._currentProblem, description, getLang() === 'KO');
  }

  private async _translate(): Promise<void> {
    if (!this._currentProblem) { return; }

    if (this._isTranslated && this._originalHtml) {
      this._isTranslated = false;
      this.sendCommand('translated', { description: this._originalHtml, isTranslated: false });
      this._updateProblemPanel();
      return;
    }

    this.sendCommand('info', { message: t('번역 중...', 'Translating...') });
    const html = this._currentProblem.description;
    const srcLang = detectLanguage(html);
    const tgtLang = srcLang === 'ko' ? 'en' : 'ko';
    const translated = await translate(html, srcLang, tgtLang);
    this._translatedHtml = translated;
    this._isTranslated = true;
    this.sendCommand('translated', { description: translated, isTranslated: true });
    this._updateProblemPanel();
  }

  private _saveTemplate(data: { name: string; language: string; code?: string; fromPreview?: boolean }): void {
    const editor = vscode.window.activeTextEditor;
    // fromPreview: use CodeMirror content directly (editing existing template)
    // otherwise: prefer active VS Code editor (saving new template from file)
    const code = data.fromPreview
      ? (data.code || '')
      : ((editor ? editor.document.getText() : '') || data.code || '');
    if (!code) {
      this.sendCommand('error', { message: t('저장할 코드가 없습니다.', 'No code to save.') });
      return;
    }
    saveTemplate({
      name: data.name,
      language: data.language,
      code,
      inputTemplate: '',
    });
    this._sendTemplateList();
    this.sendCommand('info', { message: t('✓ 템플릿이 저장되었습니다.', '✓ Template saved.') });
  }

  private async _loadTemplate(data: { name: string }): Promise<void> {
    const templates = getTemplates();
    const tmpl = templates.find((t) => t.name === data.name);
    if (!tmpl) { return; }
    this.sendCommand('templateLoaded', tmpl);

    const editor = vscode.window.activeTextEditor;
    if (!editor) { return; }

    // Replacing an in-progress solution without warning loses work (#35) —
    // when the file has content, confirm and offer insert-at-cursor instead.
    let insertAtCursor = false;
    if (editor.document.getText().trim().length > 0) {
      const replaceLabel = t('전체 교체', 'Replace All');
      const insertLabel = t('커서에 삽입', 'Insert at Cursor');
      const choice = await vscode.window.showWarningMessage(
        t(
          '현재 파일에 코드가 있습니다. 템플릿을 어떻게 적용할까요?',
          'The current file is not empty. How should the template be applied?',
        ),
        { modal: true },
        replaceLabel,
        insertLabel,
      );
      if (!choice) { return; }
      insertAtCursor = choice === insertLabel;
    }

    await editor.edit((editBuilder) => {
      if (insertAtCursor) {
        editBuilder.insert(editor.selection.active, tmpl.code);
      } else {
        const doc = editor.document;
        const fullRange = new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length));
        editBuilder.replace(fullRange, tmpl.code);
      }
    });
  }

  private _deleteTemplate(data: { name: string }): void {
    deleteTemplate(data.name);
    this._sendTemplateList();
    this.sendCommand('info', { message: t('✓ 템플릿이 삭제되었습니다.', '✓ Template deleted.') });
  }

  private _sendTemplateList(): void {
    this.sendCommand('templateList', { templates: getTemplates(), defaults: getDefaultTemplateMap() });
  }

  // Marks (or clears, when name is empty) a template as the seed for new
  // solution files of a platform+language combination (#35).
  private _setDefaultTemplate(data: { source: string; language: string; name: string }): void {
    setDefaultTemplate(data.source, data.language, data.name || null);
    this._sendTemplateList();
  }

  // Pure push — only reached from the submit flow (auto-push on accepted).
  // Login/repo setup lives on the toolbar GitHub toggle and in Settings.
  private async _pushToGitHub(): Promise<void> {
    const token = await getToken();
    const repo = await getRepoFullName();
    if (!token || !repo) {
      this.sendCommand('error', {
        message: t('GitHub 버튼으로 먼저 로그인해주세요.', 'Please log in with the GitHub button first.'),
      });
      return;
    }
    if (!this._currentProblem) {
      this.sendCommand('error', { message: t('먼저 문제를 가져와주세요.', 'Please fetch a problem first.') });
      return;
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      this.sendCommand('error', { message: t('코드 파일을 열어주세요.', 'Please open a code file.') });
      return;
    }

    this.sendCommand('info', { message: t('GitHub에 푸시 중...', 'Pushing to GitHub...') });
    const code = editor.document.getText();
    const ext = path.extname(editor.document.uri.fsPath).slice(1);
    const langInfo = Object.entries(LanguageInfo).find(([, v]) => v.extension === ext);
    const langName = langInfo ? langInfo[1].displayName : ext;

    const sha = await pushSolution(this._currentProblem, code, langName);
    this.sendCommand('info', {
      message: t(`✓ GitHub에 푸시 완료 (${sha.slice(0, 7)})`, `✓ Pushed to GitHub (${sha.slice(0, 7)})`),
    });
  }

  private async _changeSetting(data: { key: string; value: any }): Promise<void> {
    const config = vscode.workspace.getConfiguration('codingtestkit');
    // GitHub settings live in globalState (via githubService), not in the
    // declared configuration — routing them through config.update would throw
    // on the unregistered keys and the runtime would never see the values.
    if (data.key === 'githubToken') {
      const token = String(data.value ?? '').trim();
      if (!token) { return; }
      if (await validateToken(token)) {
        await setToken(token);
        this.sendCommand('info', { message: t('✓ GitHub 토큰 설정 완료', '✓ GitHub token configured') });
        await this._githubLoadConfig();
        await this._githubListRepos();
      } else {
        this.sendCommand('error', { message: t('유효하지 않은 GitHub 토큰입니다.', 'Invalid GitHub token.') });
      }
      return;
    }
    if (data.key === 'githubRepo') {
      await setRepoFullName(String(data.value ?? ''));
      return;
    }
    if (data.key === 'autoPush') {
      await setAutoPushEnabled(!!data.value);
      await config.update('autoPush', !!data.value, vscode.ConfigurationTarget.Global);
      return;
    }
    // examMode sets multiple settings at once
    if (data.key === 'examMode') {
      const isExam = data.value;
      await config.update('autoComplete', !isExam, vscode.ConfigurationTarget.Global);
      await config.update('syntaxHighlightingOff', isExam, vscode.ConfigurationTarget.Global);
      await config.update('diagnosticsOff', isExam, vscode.ConfigurationTarget.Global);
      await config.update('codeLensOff', isExam, vscode.ConfigurationTarget.Global);
      await config.update('pasteBlock', isExam, vscode.ConfigurationTarget.Global);
      await config.update('focusAlert', isExam, vscode.ConfigurationTarget.Global);
      await config.update('examMode', isExam, vscode.ConfigurationTarget.Global);
      // Toggle VS Code settings
      const editorConfig = vscode.workspace.getConfiguration('editor');
      await editorConfig.update('quickSuggestions', !isExam ? { other: 'on', comments: 'off', strings: 'off' } : { other: 'off', comments: 'off', strings: 'off' }, vscode.ConfigurationTarget.Global);
      await editorConfig.update('suggestOnTriggerCharacters', !isExam, vscode.ConfigurationTarget.Global);
      // Fully disable/enable all suggestion sources (including Ctrl+Space)
      await editorConfig.update('wordBasedSuggestions', !isExam ? 'matchingDocuments' : 'off', vscode.ConfigurationTarget.Global);
      await editorConfig.update('snippetSuggestions', !isExam ? 'inline' : 'none', vscode.ConfigurationTarget.Global);
      await editorConfig.update('suggest.showWords', !isExam, vscode.ConfigurationTarget.Global);
      await editorConfig.update('suggest.showSnippets', !isExam, vscode.ConfigurationTarget.Global);
      await editorConfig.update('suggest.showKeywords', !isExam, vscode.ConfigurationTarget.Global);
      await editorConfig.update('parameterHints.enabled', !isExam, vscode.ConfigurationTarget.Global);
      await editorConfig.update('inlineSuggest.enabled', !isExam, vscode.ConfigurationTarget.Global);
      await editorConfig.update('semanticHighlighting.enabled', !isExam, vscode.ConfigurationTarget.Global);
      if (isExam) {
        const themeKind = vscode.window.activeColorTheme.kind;
        const fg = (themeKind === vscode.ColorThemeKind.Light || themeKind === vscode.ColorThemeKind.HighContrastLight)
          ? '#333333' : '#d4d4d4';
        await editorConfig.update('tokenColorCustomizations', {
          comments: fg,
          strings: fg,
          keywords: fg,
          numbers: fg,
          types: fg,
          functions: fg,
          variables: fg,
          textMateRules: [{
            scope: ['comment', 'string', 'keyword', 'constant', 'variable',
              'entity', 'storage', 'support', 'punctuation', 'meta', 'markup', 'source',
              'keyword.control', 'keyword.operator', 'keyword.other',
              'storage.type', 'storage.modifier',
              'entity.name', 'entity.other',
              'variable.parameter', 'variable.other',
              'support.function', 'support.class', 'support.type',
              'constant.language', 'constant.numeric', 'constant.character'],
            settings: { foreground: fg, fontStyle: '' },
          }],
        }, vscode.ConfigurationTarget.Global);
      } else {
        await editorConfig.update('tokenColorCustomizations', undefined, vscode.ConfigurationTarget.Global);
      }
      await editorConfig.update('codeLens', !isExam, vscode.ConfigurationTarget.Global);
      const problemsConfig = vscode.workspace.getConfiguration('problems');
      await problemsConfig.update('visibility', !isExam, vscode.ConfigurationTarget.Global);
    } else if (data.key === 'autoComplete') {
      await config.update(data.key, data.value, vscode.ConfigurationTarget.Global);
      const editorConfig = vscode.workspace.getConfiguration('editor');
      await editorConfig.update('quickSuggestions', data.value ? { other: 'on', comments: 'off', strings: 'off' } : { other: 'off', comments: 'off', strings: 'off' }, vscode.ConfigurationTarget.Global);
      await editorConfig.update('suggestOnTriggerCharacters', data.value, vscode.ConfigurationTarget.Global);
      // Disable Ctrl+Space manual trigger and all suggestion sources
      await editorConfig.update('wordBasedSuggestions', data.value ? 'matchingDocuments' : 'off', vscode.ConfigurationTarget.Global);
      await editorConfig.update('snippetSuggestions', data.value ? 'inline' : 'none', vscode.ConfigurationTarget.Global);
      await editorConfig.update('suggest.showWords', data.value, vscode.ConfigurationTarget.Global);
      await editorConfig.update('suggest.showSnippets', data.value, vscode.ConfigurationTarget.Global);
      await editorConfig.update('suggest.showKeywords', data.value, vscode.ConfigurationTarget.Global);
      await editorConfig.update('parameterHints.enabled', data.value, vscode.ConfigurationTarget.Global);
      await editorConfig.update('inlineSuggest.enabled', data.value, vscode.ConfigurationTarget.Global);
    } else if (data.key === 'syntaxHighlightingOff') {
      await config.update(data.key, data.value, vscode.ConfigurationTarget.Global);
      const editorConfig = vscode.workspace.getConfiguration('editor');
      await editorConfig.update('semanticHighlighting.enabled', !data.value, vscode.ConfigurationTarget.Global);
      if (data.value) {
        // OFF: set all token colors to single foreground (same as exam mode)
        const themeKind = vscode.window.activeColorTheme.kind;
        const fg = (themeKind === vscode.ColorThemeKind.Light || themeKind === vscode.ColorThemeKind.HighContrastLight)
          ? '#333333' : '#d4d4d4';
        await editorConfig.update('tokenColorCustomizations', {
          comments: fg, strings: fg, keywords: fg, numbers: fg,
          types: fg, functions: fg, variables: fg,
          textMateRules: [{
            scope: ['comment', 'string', 'keyword', 'constant', 'variable',
              'entity', 'storage', 'support', 'punctuation', 'meta', 'markup', 'source',
              'keyword.control', 'keyword.operator', 'keyword.other',
              'storage.type', 'storage.modifier',
              'entity.name', 'entity.other',
              'variable.parameter', 'variable.other',
              'support.function', 'support.class', 'support.type',
              'constant.language', 'constant.numeric', 'constant.character'],
            settings: { foreground: fg, fontStyle: '' },
          }],
        }, vscode.ConfigurationTarget.Global);
      } else {
        // ON: restore default (remove overrides)
        await editorConfig.update('tokenColorCustomizations', undefined, vscode.ConfigurationTarget.Global);
      }
    } else if (data.key === 'diagnosticsOff') {
      await config.update(data.key, data.value, vscode.ConfigurationTarget.Global);
      const editorConfig = vscode.workspace.getConfiguration('editor');
      const problemsConfig = vscode.workspace.getConfiguration('problems');
      // Hide problems panel
      await problemsConfig.update('visibility', !data.value, vscode.ConfigurationTarget.Global);
      // Hide unused code graying
      await editorConfig.update('showUnused', !data.value, vscode.ConfigurationTarget.Global);
      // Hide lightbulb suggestions
      await editorConfig.update('lightbulb.enabled', data.value ? 'off' : 'on', vscode.ConfigurationTarget.Global);
      // Exclude problems folder from Java LSP to prevent duplicate class errors
      const javaConfig = vscode.workspace.getConfiguration('java');
      const currentExclusions: string[] = javaConfig.get('import.exclusions') || [];
      const problemsPattern = '**/problems/**';
      if (data.value) {
        if (!currentExclusions.includes(problemsPattern)) {
          await javaConfig.update('import.exclusions', [...currentExclusions, problemsPattern], vscode.ConfigurationTarget.Global).catch(() => {});
        }
      } else {
        await javaConfig.update('import.exclusions', currentExclusions.filter((e: string) => e !== problemsPattern), vscode.ConfigurationTarget.Global).catch(() => {});
      }
    } else if (data.key === 'codeLensOff') {
      await config.update(data.key, data.value, vscode.ConfigurationTarget.Global);
      const editorConfig = vscode.workspace.getConfiguration('editor');
      await editorConfig.update('codeLens', !data.value, vscode.ConfigurationTarget.Global);
    } else {
      await config.update(data.key, data.value, vscode.ConfigurationTarget.Global);
    }
    if (data.key === 'language') {
      setLanguage(data.value);
    }
  }

  private _getToolPaths(): void {
    const paths = getDetectedPaths();
    this.sendCommand('toolPaths', paths);
  }

  private async _sendSettings(): Promise<void> {
    const config = vscode.workspace.getConfiguration('codingtestkit');
    this.sendCommand('settingsLoaded', {
      language: config.get<string>('language', 'KO'),
      autoComplete: config.get<boolean>('autoComplete', true),
      syntaxHighlightingOff: config.get<boolean>('syntaxHighlightingOff', false),
      diagnosticsOff: config.get<boolean>('diagnosticsOff', false),
      codeLensOff: config.get<boolean>('codeLensOff', false),
      pasteBlock: config.get<boolean>('pasteBlock', false),
      focusAlert: config.get<boolean>('focusAlert', false),
      generateReadme: config.get<boolean>('generateReadme', false),
      autoPush: config.get<boolean>('autoPush', false),
    });
  }

  private async _githubLogin(): Promise<void> {
    // Use VS Code's built-in GitHub auth provider
    try {
      const session = await vscode.authentication.getSession('github', ['repo'], { createIfNone: true });
      if (session) {
        await setToken(session.accessToken);
        this.sendCommand('info', { message: t('✓ GitHub 로그인 성공', '✓ GitHub login successful') });
        await this._githubLoadConfig();
        await this._githubListRepos();
        // Connecting means login + target repo — prompt right away if unset
        if (!(await getRepoFullName())) {
          await this._pickGithubRepo();
        }
      }
    } catch {
      // Fallback: ask for token manually
      const token = await vscode.window.showInputBox({
        title: 'GitHub Personal Access Token',
        prompt: t(
          'GitHub Settings > Developer settings > Personal access tokens > Generate (repo scope)',
          'GitHub Settings > Developer settings > Personal access tokens > Generate (repo scope)'
        ),
        password: true,
        ignoreFocusOut: true,
      });
      if (token) {
        const valid = await validateToken(token);
        if (valid) {
          await setToken(token);
          this.sendCommand('info', { message: t('✓ GitHub 토큰 설정 완료', '✓ GitHub token configured') });
          await this._githubLoadConfig();
          await this._githubListRepos();
          if (!(await getRepoFullName())) {
            await this._pickGithubRepo();
          }
        } else {
          this.sendCommand('error', { message: t('유효하지 않은 토큰입니다.', 'Invalid token.') });
        }
      }
    }
  }

  private async _githubLogout(): Promise<void> {
    const disconnect = t('연동 해제', 'Disconnect');
    const choice = await vscode.window.showWarningMessage(
      t('GitHub 연동을 해제할까요? 저장된 토큰이 삭제됩니다.', 'Disconnect GitHub? The saved token will be removed.'),
      { modal: true },
      disconnect,
    );
    if (choice !== disconnect) { return; }
    await clearToken();
    this.sendCommand('info', { message: t('GitHub 연동이 해제되었습니다.', 'GitHub disconnected.') });
    await this._githubLoadConfig();
  }

  private async _pickGithubRepo(): Promise<string | undefined> {
    const token = await getToken();
    if (!token) { return undefined; }
    try {
      const repos = await listRepos(token);
      const picked = await vscode.window.showQuickPick(repos, {
        title: t('푸시할 GitHub 레포지토리 선택', 'Select a GitHub repository to push to'),
        ignoreFocusOut: true,
      });
      if (picked) {
        await setRepoFullName(picked);
        // Keep the settings panel dropdown in sync with the QuickPick choice
        await this._githubLoadConfig();
        return picked;
      }
    } catch {
      this.sendCommand('error', { message: t('레포 목록을 불러오지 못했습니다.', 'Failed to load repository list.') });
    }
    return undefined;
  }

  private async _githubSaveConfig(data: { repo: string; autoPush: boolean }): Promise<void> {
    await setRepoFullName(data.repo);
    await setAutoPushEnabled(data.autoPush);
    this.sendCommand('info', { message: t('✓ GitHub 설정 저장 완료', '✓ GitHub settings saved') });
  }

  private async _githubLoadConfig(): Promise<void> {
    const token = await getToken();
    const repo = await getRepoFullName();
    const autoPush = await getAutoPushEnabled();
    this.sendCommand('githubConfig', {
      hasToken: !!token,
      repo: repo || '',
      autoPush,
    });
  }

  private async _githubListRepos(): Promise<void> {
    const token = await getToken();
    if (!token) { return; }
    try {
      const repos = await listRepos(token);
      this.sendCommand('githubRepos', repos);
    } catch {
      // Expired/revoked token or network failure — leave the dropdown as-is
      // instead of surfacing an error toast on every webview load
    }
  }

  private async _fetchTags(data: { source: string }): Promise<void> {
    const { source } = data;
    try {
      let tags: any[] = [];
      switch (source) {
        case ProblemSource.LEETCODE: {
          const cookies = await getCookies(ProblemSource.LEETCODE);
          tags = await fetchLcTags(cookies);
          break;
        }
        case ProblemSource.CODEFORCES:
          tags = await fetchCfTags();
          break;
      }
      // For LC/CF tags that only have 'en', batch-translate to add 'ko'
      if ((source === ProblemSource.LEETCODE || source === ProblemSource.CODEFORCES) && tags.length > 0) {
        // Send tags immediately so UI is responsive, then translate in background
        this.sendCommand('tagsLoaded', { source, tags });
        try {
          const enNames = tags.map((tg: any) => tg.en).join('\n');
          const koNames = await translate(enNames, 'en', 'ko');
          const koArr = koNames.split('\n');
          const translatedTags = tags.map((tg: any, i: number) => ({
            ...tg,
            ko: koArr[i]?.trim() || tg.en,
          }));
          this.sendCommand('tagsLoaded', { source, tags: translatedTags });
        } catch {
          // Translation failed — tags already sent with en-only, no action needed
        }
      } else {
        this.sendCommand('tagsLoaded', { source, tags });
      }
    } catch {
      this.sendCommand('tagsLoaded', { source, tags: [] });
    }
  }

  private async _fetchExamCollections(): Promise<void> {
    try {
      const cookies = await getCookies(ProblemSource.PROGRAMMERS);
      const collections = await fetchExamCollections(cookies);
      this.sendCommand('examCollectionsLoaded', { collections });
    } catch {
      this.sendCommand('examCollectionsLoaded', { collections: [] });
    }
  }

  private async _translateBatch(data: { text: string; context: string }): Promise<void> {
    try {
      const srcLang = detectLanguage(data.text);
      const tgtLang = srcLang === 'ko' ? 'en' : 'ko';
      const translated = await translate(data.text, srcLang, tgtLang);
      this.sendCommand('translateBatchResult', { translated, context: data.context });
    } catch {
      this.sendCommand('error', { message: t('번역 실패', 'Translation failed') });
    }
  }
}
