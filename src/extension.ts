import * as vscode from 'vscode';
import { CodingTestKitViewProvider } from './webview/webviewProvider';
import { initI18n } from './services/i18n';
import { initAuthService } from './services/authService';
import { initGitHubService } from './services/githubService';
import { initTemplateService } from './services/templateService';

let statusBarProblem: vscode.StatusBarItem;
let statusBarPlatform: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
  // Initialize services
  initI18n();
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

  // Register webview provider
  const provider = new CodingTestKitViewProvider(context);

  // Register URI handler for auto-login callback
  // URI format: vscode://codingtestkit.codingtestkit/auth?source=BAEKJOON&cookies=...
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
    })
  );

  // Listen for active editor changes to auto-detect problems
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        provider.onEditorChanged(editor);
      }
    })
  );

  // Listen for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('codingtestkit')) {
        initI18n();
        provider.sendCommand('settingsChanged');
      }
    })
  );
}

export function deactivate() {
  if (statusBarProblem) { statusBarProblem.dispose(); }
  if (statusBarPlatform) { statusBarPlatform.dispose(); }
}
