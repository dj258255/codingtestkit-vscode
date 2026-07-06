import * as vscode from 'vscode';
import { CodingTestKitViewProvider } from './webview/webviewProvider';
import { initI18n } from './services/i18n';
import { initAuthService } from './services/authService';
import { initGitHubService } from './services/githubService';
import { initTemplateService } from './services/templateService';
import { setToolPathOverrides } from './services/codeRunner';

function applyToolPathOverrides(): void {
  const cfg = vscode.workspace.getConfiguration('codingtestkit.toolPath');
  setToolPathOverrides({
    java: cfg.get<string>('java') || undefined,
    javac: cfg.get<string>('javac') || undefined,
    python3: cfg.get<string>('python') || undefined,
    gpp: cfg.get<string>('cpp') || undefined,
    kotlinc: cfg.get<string>('kotlin') || undefined,
    node: cfg.get<string>('node') || undefined,
    rustc: cfg.get<string>('rust') || undefined,
    go: cfg.get<string>('go') || undefined,
    ruby: cfg.get<string>('ruby') || undefined,
  });
}

let statusBarProblem: vscode.StatusBarItem;
let statusBarPlatform: vscode.StatusBarItem;
let statusBarTimer: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
  // Initialize services
  initI18n();
  applyToolPathOverrides();
  initAuthService(context);
  initGitHubService(context);
  initTemplateService(context);

  // ── Status bar items ──
  statusBarPlatform = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarPlatform.text = '$(beaker) CTK';
  statusBarPlatform.tooltip = 'CodingTestKit';
  statusBarPlatform.command = 'codingtestkit.fetchProblem';
  statusBarPlatform.show();
  context.subscriptions.push(statusBarPlatform);

  statusBarProblem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
  statusBarProblem.tooltip = 'Current problem';
  context.subscriptions.push(statusBarProblem);

  statusBarTimer = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 98);
  statusBarTimer.command = 'codingtestkit.openTimer';
  context.subscriptions.push(statusBarTimer);

  // Register webview provider
  const provider = new CodingTestKitViewProvider(context);

  // Register URI handler for auto-login callback
  // URI format: vscode://codingtestkit.codingtestkit/auth?source=PROGRAMMERS&cookies=...
  context.subscriptions.push(
    vscode.window.registerUriHandler({
      handleUri(uri: vscode.Uri) {
        if (uri.path === '/auth') {
          const params = new URLSearchParams(uri.query);
          const source = params.get('source') || '';
          const cookies = params.get('cookies') || '';
          if (source && cookies) {
            provider.handleAuthCallback(source, cookies);
          }
        }
      }
    })
  );

  // Let provider update status bar
  provider.onStatusUpdate = (data: { platform?: string; problemId?: string; title?: string }) => {
    if (data.platform) {
      statusBarPlatform.text = `$(beaker) ${data.platform}`;
    }
    if (data.problemId) {
      statusBarProblem.text = `$(file-code) #${data.problemId} ${data.title || ''}`.trim();
      statusBarProblem.show();
    }
  };

  // Mirror the webview timers in the status bar so they stay visible on any
  // tab or layout
  provider.onTimerUpdate = (data) => {
    const timers = data.timers ?? [];
    if (timers.length === 0) {
      statusBarTimer.hide();
      return;
    }
    statusBarTimer.text = timers
      .map((t) => {
        const icon = !t.running ? '$(debug-pause)' : t.mode === 'countdown' ? '$(clock)' : '$(watch)';
        return `${icon} ${t.text}`;
      })
      .join('  ');
    statusBarTimer.tooltip = 'CodingTestKit timer — click to open';
    statusBarTimer.show();
  };

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('codingtestkit.mainView', provider, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('codingtestkit.fetchProblem', () => {
      provider.sendCommand('focusFetch');
    }),
    vscode.commands.registerCommand('codingtestkit.runTests', () => {
      provider.sendCommand('runTests');
    }),
    vscode.commands.registerCommand('codingtestkit.submitCode', () => {
      provider.sendCommand('submitCode');
    }),
    vscode.commands.registerCommand('codingtestkit.login', () => {
      provider.sendCommand('login');
    }),
    vscode.commands.registerCommand('codingtestkit.openSearch', () => {
      provider.sendCommand('openSearch');
    }),
    vscode.commands.registerCommand('codingtestkit.openRandom', () => {
      provider.sendCommand('openRandom');
    }),
    vscode.commands.registerCommand('codingtestkit.pushToGitHub', () => {
      provider.sendCommand('pushToGitHub');
    }),
    vscode.commands.registerCommand('codingtestkit.translate', () => {
      provider.sendCommand('translate');
    }),
    vscode.commands.registerCommand('codingtestkit.openTimer', async () => {
      await vscode.commands.executeCommand('codingtestkit.mainView.focus');
      provider.sendCommand('showTimerTab');
    })
  );

  // Listen for active editor changes to auto-detect problems
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      provider.onEditorChanged(editor);
    })
  );

  // Focus alert: detect VS Code window focus loss (not webview iframe blur)
  context.subscriptions.push(
    vscode.window.onDidChangeWindowState((state) => {
      if (!state.focused) {
        provider.sendCommand('focusLost');
      }
    })
  );

  // Listen for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('codingtestkit')) {
        initI18n();
        if (e.affectsConfiguration('codingtestkit.toolPath')) {
          applyToolPathOverrides();
        }
        provider.sendCommand('settingsChanged');
      }
    })
  );
}

export function deactivate() {
  if (statusBarProblem) { statusBarProblem.dispose(); }
  if (statusBarPlatform) { statusBarPlatform.dispose(); }
  if (statusBarTimer) { statusBarTimer.dispose(); }
}
