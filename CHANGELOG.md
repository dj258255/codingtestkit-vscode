# Changelog

## [1.3.1] - 2026-07-07

### Fixed

- **Math in Browser-Fetched Codeforces Problems**: Problems fetched through the Cloudflare browser fallback showed every formula twice (MathJax's visual output plus its assistive MathML) and translation shredded the math markup entirely. The crawler now strips MathJax render artifacts and restores the original TeX for clean KaTeX rendering.
- **Translation Breaking Markup**: The translator no longer touches KaTeX/MathML math, `<code>` blocks, or any tag carrying attributes — previously attribute values themselves got translated (`style=` → `스타일=`), corrupting the layout.

## [1.3.0] - 2026-07-07

### Added

- **Rust · Go · Ruby Support**: Local test execution (stdin + Programmers-style function mode with literal conversion and debug-output separation), toolchain auto-detection, default code templates, and submit mappings (LeetCode/Codeforces; Programmers for Go/Ruby).
- **Configurable Tool Paths**: New `codingtestkit.toolPath.*` settings (java, javac, python, cpp, kotlin, node, rust, go, ruby) override auto-detection when compilers live in non-standard locations. Every "not found" error now names the matching setting.
- **Timer Everywhere**: The active stopwatch/countdown now mirrors to the status bar (click to open the Timer tab) and to a mini bar at the bottom of the Problem tab with per-timer start/pause buttons and a countdown progress strip.
- **Codeforces Browser Fallback**: When Cloudflare blocks direct crawling (currently the common case), the extension opens the user's own Chromium offscreen to pass the challenge and fetch the full problem — statement, sample tests, and limits — instead of degrading to metadata-only.
- **Cross-Platform CI Smoke Tests**: ubuntu/windows/macos runners execute all 8 languages, the function-mode wrapper, and memory measurement against real toolchains on every push.

### Fixed

- **Windows Local Test Execution**: Tool detection relied on the Unix `which` command and Unix-only fallback paths, so every compiler lookup failed on Windows ("g++ not found") even when the terminal worked. Detection now scans PATH directly (honoring PATHEXT), knows Windows install locations (MSYS2/MinGW/TDM-GCC/Strawberry, Adoptium/Corretto/Zulu, JetBrains), validates the Microsoft Store python stub, emits `solution.exe`, wraps `kotlinc.bat` in cmd.exe, and kills timed-out process trees with `taskkill /T /F`.
- **Korean I/O on Windows**: JVM tools now force UTF-8 (`-Dfile.encoding` etc.) and Python gets `PYTHONIOENCODING=utf-8`, preventing MS949 mojibake.
- **Bogus Compile Timeouts**: Compilation gets its own 60s limit, so slow compilers (kotlinc cold start) no longer surface as run timeouts.
- **Non-Executable Toolchains**: Detection now requires execute permission, skipping entries like IDE-bundled kotlinc scripts without the executable bit (previously EACCES at spawn).

### Improved

- **Memory Measurement**: Linux reads the kernel-recorded peak (`VmHWM`), Windows reads `PeakWorkingSet64` — both monotonic, so polling can no longer miss spikes — and an immediate first sample means sub-50ms runs report real values instead of 0. Polling is fully async and never blocks the extension host.

## [1.2.2] - 2026-04-28

### Added

- **Open VSX Registry**: Extension is now also published to [Open VSX](https://open-vsx.org/extension/codingtestkit/codingtestkit), making CodingTestKit installable directly from **Cursor**, **VSCodium**, **code-server**, and **Gitpod** without manual VSIX installation.

### Fixed

- **Release Workflow**: Fixed Open VSX publish step being silently skipped due to step-level `env` not being available in `if` conditions. Moved `OVSX_PAT` to job-level env so subsequent releases publish to both marketplaces automatically.

## [1.2.1] - 2026-04-28

### Added

- **Feedback Channel**: Added a Google Form for bug reports and feature suggestions. Accessible from the Settings tab inside the extension and linked in the README (both EN/KO sections).

### Improved

- **VSIX Size**: Reduced package size from 12.43 MB to 1.93 MB by excluding `media/demo/` GIFs from the VSIX and serving them via GitHub raw URLs in the README.

### Removed

- **BOJ Remnants**: Cleaned up untracked `baekjoonCrawler.ts` and `solvedAcApi.ts` files left over from v1.2.0 BOJ removal.

## [1.2.0] - 2026-04-20

### Removed

- **Baekjoon (BOJ) Support**: Removed all Baekjoon-related functionality — crawler, submit API, solved.ac integration, browser login/submit, random picker (tier/class filters, algorithm tags), search, my-solved lookup, and UI entries. Supported platforms are now Programmers, SWEA, LeetCode, and Codeforces. Default platform selection falls back to Programmers.

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
