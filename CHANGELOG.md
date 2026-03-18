# Changelog

## [1.1.0] - 2026-03-18

### Fixed

- **Syntax Highlighting Toggle**: Fix "구문 강조 끄기" toggle not applying immediately — now uses same top-level `tokenColorCustomizations` override as exam mode for instant effect.

### Improved

- **README**: Add GIF demo animations for Fetch & Submit, Random Problem Picker, Code Templates, Timer, and Exam Mode.

## [1.0.9] - 2026-03-18

### Fixed

- **LeetCode Language Auto-Select**: Fix language not being auto-selected when submitting on LeetCode — now uses URL `?lang=java` parameter instead of unreliable DOM button matching. All platforms now correctly auto-select the configured language on submit.
- **Submit Flow**: Replaced Puppeteer browser submit with default browser (already logged in) + clipboard copy for all platforms. Submit button now shows file path confirmation dialog before opening.
- **Diagnostics OFF**: Fix "오류 검사 끄기" not fully hiding editor diagnostics — now disables unused import graying (`editor.showUnused`), lightbulb suggestions (`editor.lightbulb.enabled`), problems panel visibility, and excludes `**/problems/**` from Java LSP (`java.import.exclusions`) to prevent "The type Solution is already defined" duplicate class errors.
- **i18n Initial Load**: Fix settings tab showing English on first load when Korean is selected — now calls `applyI18n()` immediately when settings are loaded.
- **Cloudflare Bot Detection**: Add `--disable-blink-features=AutomationControlled` flag to Puppeteer launch for login, preventing Cloudflare bot detection.
- **VSIX Cleanup**: Remove unnecessary files from package (`.claude/`, `.playwright-mcp/`, `firebase-debug.log`, `.github/`).

## [1.0.5] - 2026-03-17

### Fixed

- **Random Problem (Programmers)**: Fix random picker returning problems outside selected levels — added client-side level filtering to ensure only chosen levels (e.g. Lv.1, Lv.2) appear in results.
- **LeetCode CSRF**: Fix "Failed to obtain CSRF token" error — LeetCode homepage is now blocked by Cloudflare (403). CSRF token is now obtained from the GraphQL endpoint instead.
- **Template Save**: Fix template saving wrong content — now correctly saves code from the active VS Code editor instead of the CodeMirror preview.
- **Debug Output**: Fix stderr textarea not filling full width — now expands horizontally and is vertically resizable.
- **Focus Alert**: Fix webview click (e.g. clicking problem view) being detected as focus loss — now uses VS Code's `onDidChangeWindowState` to only detect actual window focus loss (Alt+Tab, switching apps).
- **Random Problem Translation**: Initial display now shows API original as-is (no auto-translate). EN/KO button translates both titles and tags together via remote API for full consistency across all platforms.
- **LeetCode Submit URL**: Fix submit opening `problems/1/` instead of `problems/two-sum/` — now stores the title slug and uses it for the submit URL.
- **SWEA Tags**: Hide empty tag column for SWEA (tags not available).

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
