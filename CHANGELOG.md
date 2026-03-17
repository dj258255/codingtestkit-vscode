# Changelog

## [1.0.3] - 2026-03-17

### Fixed

- **Random Problem (Programmers)**: Fix random picker returning problems outside selected levels — added client-side level filtering to ensure only chosen levels (e.g. Lv.1, Lv.2) appear in results.
- **LeetCode CSRF**: Fix "Failed to obtain CSRF token" error — LeetCode homepage is now blocked by Cloudflare (403). CSRF token is now obtained from the GraphQL endpoint instead.
- **Template Save**: Fix template saving wrong content — now correctly saves code from the active VS Code editor instead of the CodeMirror preview.
- **Debug Output**: Fix stderr textarea not filling full width — now expands horizontally and is vertically resizable.
- **Focus Alert**: Fix webview click (e.g. clicking problem view) being detected as focus loss — now uses VS Code's `onDidChangeWindowState` to only detect actual window focus loss (Alt+Tab, switching apps).
- **Random Problem Translation**: Fix EN/KO toggle not translating tags — tags were only translated via local cache which lacked Korean data for LeetCode. Now uses remote translation for both titles and tags consistently.

### Improved

- **Syntax Highlighting (Programmers)**: Template code preview and VS Code editor syntax colors now use actual Programmers colors extracted from programmers.co.kr (dark: tomorrow-night-bright, light: eclipse theme). All languages supported uniformly.
- **Template Edit/Save/Cancel**: Template code preview now shows "Save Changes" and "Cancel" buttons when editing — save updates the template, cancel reverts to original.
- **Editor-Problem Sync**: Clicking a problem file shows that problem; switching to a non-problem file clears the problem view for a cleaner workspace.

## [1.0.1] - 2026-03-16

### Fixed

- **Browser Login**: Fix automatic browser login not working on installed extension — puppeteer-core was excluded from VSIX package due to `.vscodeignore` ignoring `node_modules/**`. Now bundled directly into `extension.js` via esbuild so all platforms (BOJ, Programmers, SWEA, LeetCode, Codeforces) correctly launch Chromium and capture cookies automatically.

## [1.0.0] - 2026-03-14

### Features

- **5 Platform Support**: BOJ (Baekjoon), Programmers, SWEA, LeetCode, Codeforces
- **5 Language Support**: Java, Python, C++, Kotlin, JavaScript
- **Problem Fetch**: Auto-extract problem description & test cases from URL or problem ID
- **Local Test Execution**: Run all test cases locally with execution time (ms) & memory (KB) metrics
- **Browser Login & Submit**: Log in via built-in Chromium browser, submit code with auto language selection
- **Problem Search**: Search problems on all 5 platforms with difficulty/tag/keyword filters
- **Random Problem Picker**: Pick random problems with tier, difficulty, tag, and solved filters
- **Problem Translation**: One-click Korean ↔ English translation with caching & rate limit protection
- **Code Templates**: Save & reuse frequently used code snippets with CodeMirror syntax highlighting
- **Timer**: Stopwatch with laps + Countdown with circular dial, digital clock, progress bar
- **Exam Mode**: Block paste, disable autocomplete & syntax highlighting, focus loss alert
- **GitHub Integration**: Auto-push accepted solutions to GitHub (BaekjoonHub-style)
- **LaTeX Rendering**: Math formulas rendered natively via KaTeX
- **i18n**: Full Korean / English UI support
