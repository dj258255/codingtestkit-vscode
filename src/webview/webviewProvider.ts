import * as vscode from 'vscode';
import * as path from 'path';
import { getWebviewContent } from './mainWebview';
import { Problem, ProblemSource, Language, LanguageInfo, TestCase, languageFromExtension } from '../models/models';
import { t, setLanguage, getLang } from '../services/i18n';
import { fetchBaekjoonProblem } from '../services/baekjoonCrawler';
import { searchProblems as searchBoj, searchSuggestions, searchRandomProblems as randomBoj, fetchTagList as fetchBojTags } from '../services/solvedAcApi';
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
import { getToken, setToken, getRepoFullName, setRepoFullName, getAutoPushEnabled, setAutoPushEnabled, validateToken, listRepos, pushSolution } from '../services/githubService';
import { getTemplates, saveTemplate, deleteTemplate } from '../services/templateService';
import { createProblemFiles, loadProblemFromFolder, findProblemFolder } from '../services/problemFileManager';
import { translate, detectLanguage } from '../services/translateService';
import { fetchSolvedProblems, isSupported as isSolvedSupported } from '../services/solvedProblemsService';

export class CodingTestKitViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private _currentProblem?: Problem;
  private _currentSource: ProblemSource = ProblemSource.BAEKJOON;
  private _currentLanguage: Language = Language.JAVA;
  private _stateRestored = false;
  private _testCases: TestCase[] = [];
  private _translatedHtml?: string;
  private _originalHtml?: string;
  private _isTranslated = false;

  public onStatusUpdate?: (data: { platform?: string; problemId?: string; title?: string }) => void;

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
          this._loadTemplate(data);
          break;
        case 'deleteTemplate':
          this._deleteTemplate(data);
          break;
        case 'pushToGitHub':
          await this._pushToGitHub();
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
        case 'searchSuggestion':
          await this._searchSuggestion(data);
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
    const templates = getTemplates();
    this.sendCommand('templateList', templates);

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
      case ProblemSource.BAEKJOON:
        problem = await fetchBaekjoonProblem(problemId);
        break;
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
    this.onStatusUpdate?.({ platform: source, problemId: problem.id, title: problem.title });
    this.sendCommand('info', {
      message: t(
        `✓ ${problem.title} 가져오기 완료`,
        `✓ Fetched: ${problem.title}`
      ),
    });
  }

  private async _runTests(data: { testCases: TestCase[] }): Promise<void> {
    if (!this._currentProblem) {
      this.sendCommand('error', { message: t('먼저 문제를 가져와주세요.', 'Please fetch a problem first.') });
      return;
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      this.sendCommand('error', { message: t('코드 파일을 열어주세요.', 'Please open a code file.') });
      return;
    }

    const code = editor.document.getText();
    const ext = path.extname(editor.document.uri.fsPath).slice(1);
    const lang = languageFromExtension(ext) || this._currentLanguage;
    const testCases = data.testCases || this._testCases;
    const source = this._currentProblem.source;
    const paramNames = this._currentProblem.parameterNames;
    const isFunctionMode = source === ProblemSource.PROGRAMMERS || source === ProblemSource.LEETCODE;

    let passCount = 0;
    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      this.sendCommand('testResult', { index: i, status: 'running' });
      try {
        const result = isFunctionMode
          ? await runProgrammers(code, lang, tc.input, paramNames)
          : await runCode(code, lang, tc.input);

        const actual = result.output.trim();
        const expected = tc.expectedOutput.trim();
        // Normalize comparison
        const normalizeOutput = (s: string) =>
          s.split('\n').map((l) => l.trimEnd()).join('\n')
            .replace(/\[\s*/g, '[').replace(/\s*\]/g, ']').replace(/,\s+/g, ',');
        const passed = normalizeOutput(actual) === normalizeOutput(expected);
        if (passed) { passCount++; }

        this.sendCommand('testResult', {
          index: i,
          status: result.timedOut ? 'timeout' : passed ? 'pass' : 'fail',
          actualOutput: actual,
          error: result.error,
          timeMs: result.executionTimeMs,
          memoryKB: result.peakMemoryKB,
          passed,
        });
      } catch (err: any) {
        this.sendCommand('testResult', {
          index: i,
          status: 'error',
          actualOutput: '',
          error: err.message || String(err),
          timeMs: 0,
          memoryKB: 0,
          passed: false,
        });
      }
    }

    this.sendCommand('testComplete', {
      passCount,
      totalCount: testCases.length,
      message: `${passCount}/${testCases.length} ${t('통과', 'passed')}`,
    });
  }

  private async _submitCode(_data: any): Promise<void> {
    if (!this._currentProblem) {
      this.sendCommand('error', { message: t('먼저 문제를 가져와주세요.', 'Please fetch a problem first.') });
      return;
    }

    const source = this._currentProblem.source;
    const cookies = await getCookies(source);
    if (!cookies) {
      this.sendCommand('error', { message: t('먼저 로그인해주세요.', 'Please login first.') });
      return;
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      this.sendCommand('error', { message: t('코드 파일을 열어주세요.', 'Please open a code file.') });
      return;
    }

    const code = editor.document.getText();
    this.sendCommand('info', { message: t('브라우저를 여는 중...', 'Opening browser...') });

    const result = await browserSubmit(
      source,
      this._currentProblem.id,
      code,
      this._currentLanguage,
      cookies,
      this._currentProblem.contestProbId,
    );

    if (result.error === 'NO_BROWSER' || result.error === 'NO_PUPPETEER') {
      // Fallback: API submission for BOJ/Programmers/SWEA, browser URL for LeetCode/Codeforces
      await this._fallbackSubmit(source, this._currentProblem.id, code, cookies);
    } else if (result.success && result.error === 'INJECT_FAILED') {
      this.sendCommand('info', { message: t('브라우저가 열렸습니다. 코드를 직접 붙여넣고 제출해주세요.', 'Browser opened. Please paste code manually and submit.') });
    } else if (result.success) {
      this.sendCommand('info', { message: t('코드가 자동 입력되었습니다. 브라우저에서 확인 후 제출해주세요.', 'Code auto-filled. Please review and submit in the browser.') });
      // Auto push to GitHub if enabled
      const autoPush = await getAutoPushEnabled();
      if (autoPush && this._currentProblem) {
        await this._pushToGitHub();
      }
    } else {
      this.sendCommand('error', { message: result.message || t('브라우저 열기에 실패했습니다.', 'Failed to open browser.') });
    }
  }

  private async _fallbackSubmit(source: ProblemSource, problemId: string, code: string, cookies: string): Promise<void> {
    // For BOJ/Programmers/SWEA: use existing HTTP API submission
    if (source === ProblemSource.BAEKJOON || source === ProblemSource.PROGRAMMERS || source === ProblemSource.SWEA) {
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
      case ProblemSource.BAEKJOON: {
        // Apply solve filter to query
        let bojQuery = query || '';
        if (data.solveFilter === 1 || data.solveFilter === 2) {
          const username = await getUsername(source);
          if (username) {
            bojQuery += data.solveFilter === 1 ? ` -solved_by:${username}` : ` solved_by:${username}`;
          }
        }
        results = await searchBoj(bojQuery, sort || 'id', 'asc', page || 1);
        break;
      }
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
      case ProblemSource.BAEKJOON: {
        // tierQuery is a complete solved.ac query string built by the webview
        const query = data.tierQuery || 'solvable:true';
        // solveFilter: 0=all, 1=exclude solved, 2=only solved
        let finalQuery = query;
        if (data.solveFilter === 1 || data.solveFilter === 2) {
          const username = await getUsername(source);
          if (username) {
            finalQuery += data.solveFilter === 1 ? ` -solved_by:${username}` : ` solved_by:${username}`;
          }
        }
        problems = await randomBoj(finalQuery, [], count || 5);
        break;
      }
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

  private async _translate(): Promise<void> {
    if (!this._currentProblem) { return; }

    if (this._isTranslated && this._originalHtml) {
      this._isTranslated = false;
      this.sendCommand('translated', { description: this._originalHtml, isTranslated: false });
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
  }

  private _saveTemplate(data: { name: string; language: string; code?: string }): void {
    const editor = vscode.window.activeTextEditor;
    // Prefer active VS Code editor content over CodeMirror preview
    const code = (editor ? editor.document.getText() : '') || data.code || '';
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
    this.sendCommand('templateList', getTemplates());
    this.sendCommand('info', { message: t('✓ 템플릿이 저장되었습니다.', '✓ Template saved.') });
  }

  private _loadTemplate(data: { name: string }): void {
    const templates = getTemplates();
    const tmpl = templates.find((t) => t.name === data.name);
    if (tmpl) {
      this.sendCommand('templateLoaded', tmpl);
      // Write to editor
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        editor.edit((editBuilder) => {
          const doc = editor.document;
          const fullRange = new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length));
          editBuilder.replace(fullRange, tmpl.code);
        });
      }
    }
  }

  private _deleteTemplate(data: { name: string }): void {
    deleteTemplate(data.name);
    this.sendCommand('templateList', getTemplates());
    this.sendCommand('info', { message: t('✓ 템플릿이 삭제되었습니다.', '✓ Template deleted.') });
  }

  private async _pushToGitHub(): Promise<void> {
    if (!this._currentProblem) {
      this.sendCommand('error', { message: t('먼저 문제를 가져와주세요.', 'Please fetch a problem first.') });
      return;
    }
    const token = await getToken();
    const repo = await getRepoFullName();
    if (!token || !repo) {
      this.sendCommand('error', {
        message: t('GitHub 설정을 먼저 완료해주세요.', 'Please configure GitHub settings first.'),
      });
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
        // Determine foreground color based on current theme
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
    } else if (data.key === 'diagnosticsOff') {
      await config.update(data.key, data.value, vscode.ConfigurationTarget.Global);
      const problemsConfig = vscode.workspace.getConfiguration('problems');
      await problemsConfig.update('visibility', !data.value, vscode.ConfigurationTarget.Global);
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
        } else {
          this.sendCommand('error', { message: t('유효하지 않은 토큰입니다.', 'Invalid token.') });
        }
      }
    }
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
    const repos = await listRepos(token);
    this.sendCommand('githubRepos', repos);
  }

  private async _searchSuggestion(data: { query: string }): Promise<void> {
    if (!data.query || data.query.length < 2) { return; }
    const suggestions = await searchSuggestions(data.query);
    this.sendCommand('searchSuggestions', suggestions);
  }

  private async _fetchTags(data: { source: string }): Promise<void> {
    const { source } = data;
    try {
      let tags: any[] = [];
      switch (source) {
        case ProblemSource.BAEKJOON:
          tags = await fetchBojTags();
          break;
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
