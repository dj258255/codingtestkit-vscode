import { spawn, execFile, ChildProcess, execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { RunResult, Language } from '../models/models';

const DEFAULT_TIMEOUT = 10000;
// Compilation gets its own generous limit — kotlinc cold start alone can
// exceed the run timeout, which would surface as a bogus "timeout".
const COMPILE_TIMEOUT = 60000;
// Force UTF-8 on JVM tools so Korean I/O survives Windows' MS949 default.
const JAVA_UTF8_FLAGS = ['-Dfile.encoding=UTF-8', '-Dstdout.encoding=UTF-8', '-Dstderr.encoding=UTF-8'];
const MEMORY_POLL_INTERVAL = 50;
const MAIN_SEPARATOR = '///MAIN_SEPARATOR///';

// ---------------------------------------------------------------------------
// Build output hook
// ---------------------------------------------------------------------------

// Compiler warnings and build messages are routed here (the extension wires
// this to a "CodingTestKit Build" output channel) instead of being mixed
// into — or silently dropped from — the per-test results.
let buildOutputHandler: ((label: string, text: string) => void) | null = null;
let lastBuildReport = '';

export function setBuildOutputHandler(handler: (label: string, text: string) => void): void {
  buildOutputHandler = handler;
}

// Each test case triggers its own compile, so the same warnings would repeat
// once per case — skip consecutive duplicates to keep the channel readable.
function reportBuildOutput(label: string, result: RunResult): void {
  if (!buildOutputHandler) { return; }
  const text = [result.output, result.error].filter(Boolean).join('\n').trim();
  if (!text) { return; }
  const report = `${label}\n${text}`;
  if (report === lastBuildReport) { return; }
  lastBuildReport = report;
  buildOutputHandler(label, text);
}

// ---------------------------------------------------------------------------
// Tool path cache
// ---------------------------------------------------------------------------

interface DetectedPaths {
  java: string | null;
  javac: string | null;
  python3: string | null;
  gpp: string | null;
  kotlinc: string | null;
  node: string | null;
  rustc: string | null;
  go: string | null;
  ruby: string | null;
}

const pathCache: Partial<DetectedPaths> = {};

export type ToolName = keyof DetectedPaths;

let toolPathOverrides: Partial<Record<ToolName, string>> = {};

// User-configured tool paths (codingtestkit.toolPath.*) take precedence over
// auto-detection. Called by the extension on activation and settings changes.
export function setToolPathOverrides(overrides: Partial<Record<ToolName, string>>): void {
  toolPathOverrides = overrides;
  for (const key of Object.keys(pathCache) as ToolName[]) {
    delete pathCache[key];
  }
}

const isWindows = process.platform === 'win32';

// A path only counts as a usable tool if it is a file the current user can
// execute — IDE-bundled scripts (e.g. IntelliJ's kotlinc) sometimes exist
// without the executable bit, and spawning those fails with EACCES.
function canExec(p: string): boolean {
  try {
    if (!fs.statSync(p).isFile()) { return false; }
    if (!isWindows) { fs.accessSync(p, fs.constants.X_OK); }
    return true;
  } catch {
    return false;
  }
}

function overrideFor(tool: ToolName): string | null {
  const p = toolPathOverrides[tool]?.trim();
  return p && canExec(p) ? p : null;
}

// The extension host inherits the PATH captured when VS Code was launched, so
// a tool installed (or PATH edited) afterwards shows up in a fresh cmd window
// but not here. Re-read the live PATH from the registry as a fallback.
let registryPathCache: string | null | undefined;
function windowsRegistryPath(): string | null {
  if (registryPathCache !== undefined) { return registryPathCache; }
  registryPathCache = null;
  if (!isWindows) { return null; }
  const keys: Array<[string, string]> = [
    ['HKLM', 'SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment'],
    ['HKCU', 'Environment'],
  ];
  const parts: string[] = [];
  for (const [hive, key] of keys) {
    try {
      const out = execFileSync('reg', ['query', `${hive}\\${key}`, '/v', 'Path'],
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 5000 });
      const match = out.match(/Path\s+REG(?:_EXPAND)?_SZ\s+(.+)/i);
      if (match) { parts.push(match[1].trim()); }
    } catch { /* reg.exe missing or key unreadable */ }
  }
  if (parts.length > 0) {
    // REG_EXPAND_SZ values keep %VAR% references unexpanded
    registryPathCache = parts.join(path.delimiter)
      .replace(/%([^%;]+)%/g, (whole, name) => process.env[name] ?? whole);
  }
  return registryPathCache;
}

// Scans PATH directly instead of shelling out to `which`, which does not exist
// on Windows (the extension host spawns without a shell).
function scanPath(cmd: string, pathEnv: string): string | null {
  const exts = isWindows
    ? (path.extname(cmd) ? [''] : (process.env['PATHEXT'] ?? '.COM;.EXE;.BAT;.CMD').split(';'))
    : [''];
  for (const rawDir of pathEnv.split(path.delimiter)) {
    // Windows PATH entries are sometimes quoted ("C:\Program Files\...")
    const dir = rawDir.replace(/^"|"$/g, '');
    if (!dir) { continue; }
    for (const ext of exts) {
      const candidate = path.join(dir, cmd + ext.toLowerCase());
      if (canExec(candidate)) {
        return candidate;
      }
    }
  }
  return null;
}

function whichSync(cmd: string): string | null {
  const found = scanPath(cmd, process.env['PATH'] ?? '');
  if (found) { return found; }
  // Windows: the process PATH can be stale — retry with the registry PATH
  const regPath = windowsRegistryPath();
  return regPath ? scanPath(cmd, regPath) : null;
}

// Verifies a candidate binary actually runs. Filters out non-executables such
// as the Windows Store `python.exe` alias stub, which exists but exits non-zero.
function runsOk(bin: string, args: string[]): boolean {
  try {
    execFileSync(bin, args, { stdio: ['pipe', 'pipe', 'pipe'], timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

function firstExisting(...candidates: string[]): string | null {
  for (const c of candidates) {
    if (canExec(c)) {
      return c;
    }
  }
  return null;
}

const javaExe = isWindows ? 'java.exe' : 'java';
const javacExe = isWindows ? 'javac.exe' : 'javac';

function detectJavaHome(): string | null {
  // 1. JAVA_HOME env
  const envHome = process.env['JAVA_HOME'];
  if (envHome && fs.existsSync(path.join(envHome, 'bin', javaExe))) {
    return envHome;
  }

  // 2. java.home (VS Code setting-like env, not always present)
  const javaHomeSetting = process.env['java.home'];
  if (javaHomeSetting && fs.existsSync(path.join(javaHomeSetting, 'bin', javaExe))) {
    return javaHomeSetting;
  }

  // 3. macOS: /usr/libexec/java_home
  if (process.platform === 'darwin') {
    try {
      const home = execFileSync('/usr/libexec/java_home', [], { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
      if (home && fs.existsSync(path.join(home, 'bin', 'java'))) {
        return home;
      }
    } catch { /* ignore */ }
  }

  // 4. Common installation paths
  const searchDirs: string[] = [];
  if (process.platform === 'darwin') {
    searchDirs.push('/Library/Java/JavaVirtualMachines');
    searchDirs.push('/opt/homebrew/opt/openjdk');
  }
  if (isWindows) {
    for (const programFiles of ['C:\\Program Files', 'C:\\Program Files (x86)']) {
      searchDirs.push(path.join(programFiles, 'Java'));
      searchDirs.push(path.join(programFiles, 'Eclipse Adoptium'));
      searchDirs.push(path.join(programFiles, 'Microsoft'));
      searchDirs.push(path.join(programFiles, 'Zulu'));
      searchDirs.push(path.join(programFiles, 'Amazon Corretto'));
    }
  }
  searchDirs.push('/usr/lib/jvm');

  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) { continue; }
    // /opt/homebrew/opt/openjdk is a direct JDK
    const directBin = path.join(dir, 'bin', javaExe);
    if (fs.existsSync(directBin)) {
      return dir;
    }
    // Directories containing JDK subdirectories
    try {
      const entries = fs.readdirSync(dir).sort().reverse();
      for (const entry of entries) {
        const candidate = path.join(dir, entry, 'Contents', 'Home');
        if (fs.existsSync(path.join(candidate, 'bin', javaExe))) {
          return candidate;
        }
        const candidate2 = path.join(dir, entry);
        if (fs.existsSync(path.join(candidate2, 'bin', javaExe))) {
          return candidate2;
        }
      }
    } catch { /* ignore */ }
  }

  return null;
}

function detectJava(): string | null {
  if (pathCache.java !== undefined) { return pathCache.java; }
  const override = overrideFor('java');
  if (override) { pathCache.java = override; return override; }
  const home = detectJavaHome();
  if (home) {
    const javaBin = path.join(home, 'bin', javaExe);
    if (fs.existsSync(javaBin)) {
      pathCache.java = javaBin;
      const javacBin = path.join(home, 'bin', javacExe);
      if (fs.existsSync(javacBin)) {
        pathCache.javac = javacBin;
      }
      return javaBin;
    }
  }
  const found = whichSync('java');
  pathCache.java = found;
  return found;
}

function detectJavac(): string | null {
  if (pathCache.javac !== undefined) { return pathCache.javac; }
  const override = overrideFor('javac');
  if (override) { pathCache.javac = override; return override; }
  detectJava();
  if (pathCache.javac !== undefined) { return pathCache.javac; }
  const found = whichSync('javac');
  pathCache.javac = found;
  return found;
}

function detectPython3(): string | null {
  if (pathCache.python3 !== undefined) { return pathCache.python3; }
  const override = overrideFor('python3');
  if (override) { pathCache.python3 = override; return override; }
  let found = whichSync('python3')
    ?? firstExisting('/usr/bin/python3', '/usr/local/bin/python3', '/opt/homebrew/bin/python3');
  if (isWindows) {
    // `python3` on Windows is usually the Store alias stub; prefer a candidate
    // that actually runs (`python`, then the `py` launcher).
    const candidates = [found, whichSync('python'), whichSync('py')].filter((c): c is string => !!c);
    found = candidates.find(c => runsOk(c, ['--version'])) ?? null;
  }
  pathCache.python3 = found;
  return found;
}

function detectGpp(): string | null {
  if (pathCache.gpp !== undefined) { return pathCache.gpp; }
  const override = overrideFor('gpp');
  if (override) { pathCache.gpp = override; return override; }
  let found = whichSync('g++')
    ?? firstExisting('/usr/bin/g++', '/usr/local/bin/g++', '/opt/homebrew/bin/g++');
  if (!found && isWindows) {
    found = firstExisting(
      'C:\\msys64\\ucrt64\\bin\\g++.exe',
      'C:\\msys64\\mingw64\\bin\\g++.exe',
      'C:\\msys64\\clang64\\bin\\g++.exe',
      'C:\\msys64\\mingw32\\bin\\g++.exe',
      'C:\\MinGW\\bin\\g++.exe',
      'C:\\mingw64\\bin\\g++.exe',
      'C:\\TDM-GCC-64\\bin\\g++.exe',
      'C:\\Strawberry\\c\\bin\\g++.exe',
      'C:\\w64devkit\\bin\\g++.exe',
      'C:\\ProgramData\\chocolatey\\bin\\g++.exe',
      path.join(os.homedir(), 'scoop', 'shims', 'g++.exe'),
      'C:\\Program Files\\CodeBlocks\\MinGW\\bin\\g++.exe',
      'C:\\Program Files (x86)\\Embarcadero\\Dev-Cpp\\TDM-GCC-64\\bin\\g++.exe',
    );
  }
  // Fall back to clang++ (same flags work for both compilers)
  if (!found) {
    found = whichSync('clang++');
  }
  pathCache.gpp = found;
  return found;
}

function detectKotlinc(): string | null {
  if (pathCache.kotlinc !== undefined) { return pathCache.kotlinc; }
  const override = overrideFor('kotlinc');
  if (override) { pathCache.kotlinc = override; return override; }

  let found = whichSync('kotlinc');
  if (found) { pathCache.kotlinc = found; return found; }

  // SDKMAN
  const sdkmanPath = path.join(os.homedir(), '.sdkman', 'candidates', 'kotlin', 'current', 'bin', 'kotlinc');
  if (canExec(sdkmanPath)) { pathCache.kotlinc = sdkmanPath; return sdkmanPath; }

  // IntelliJ bundled (macOS)
  if (process.platform === 'darwin') {
    const ideaDirs = [
      path.join(os.homedir(), 'Library', 'Application Support', 'JetBrains'),
    ];
    for (const ideaBase of ideaDirs) {
      if (!fs.existsSync(ideaBase)) { continue; }
      try {
        const entries = fs.readdirSync(ideaBase).filter(e => e.startsWith('IntelliJIdea')).sort().reverse();
        for (const entry of entries) {
          const kotlinPlugin = path.join(ideaBase, entry, 'plugins', 'Kotlin', 'kotlinc', 'bin', 'kotlinc');
          if (canExec(kotlinPlugin)) { pathCache.kotlinc = kotlinPlugin; return kotlinPlugin; }
        }
      } catch { /* ignore */ }
    }

    // IntelliJ app bundles — /Applications (direct) and ~/Applications (Toolbox)
    for (const appsDir of ['/Applications', path.join(os.homedir(), 'Applications')]) {
      try {
        const apps = fs.readdirSync(appsDir).filter(e => e.startsWith('IntelliJ IDEA')).sort().reverse();
        for (const app of apps) {
          const p = path.join(appsDir, app, 'Contents', 'plugins', 'Kotlin', 'kotlinc', 'bin', 'kotlinc');
          if (canExec(p)) { pathCache.kotlinc = p; return p; }
        }
      } catch { /* ignore */ }
    }
  }

  // IntelliJ installs (Windows) — Program Files (direct) and Local Programs (Toolbox)
  if (isWindows) {
    const bases = [
      'C:\\Program Files\\JetBrains',
      path.join(os.homedir(), 'AppData', 'Local', 'Programs'),
    ];
    for (const base of bases) {
      try {
        const entries = fs.readdirSync(base).filter(e => e.startsWith('IntelliJ IDEA')).sort().reverse();
        for (const entry of entries) {
          const p = path.join(base, entry, 'plugins', 'Kotlin', 'kotlinc', 'bin', 'kotlinc.bat');
          if (canExec(p)) { pathCache.kotlinc = p; return p; }
        }
      } catch { /* ignore */ }
    }
  }

  pathCache.kotlinc = null;
  return null;
}

function detectNode(): string | null {
  if (pathCache.node !== undefined) { return pathCache.node; }
  const override = overrideFor('node');
  if (override) { pathCache.node = override; return override; }

  // nvm
  const nvmDir = path.join(os.homedir(), '.nvm', 'versions', 'node');
  if (fs.existsSync(nvmDir)) {
    try {
      const versions = fs.readdirSync(nvmDir).sort().reverse();
      for (const v of versions) {
        const nodeBin = path.join(nvmDir, v, 'bin', 'node');
        if (fs.existsSync(nodeBin)) { pathCache.node = nodeBin; return nodeBin; }
      }
    } catch { /* ignore */ }
  }

  const found = whichSync('node')
    ?? firstExisting('/usr/local/bin/node', '/opt/homebrew/bin/node', 'C:\\Program Files\\nodejs\\node.exe');
  pathCache.node = found;
  return found;
}

function detectRustc(): string | null {
  if (pathCache.rustc !== undefined) { return pathCache.rustc; }
  const override = overrideFor('rustc');
  if (override) { pathCache.rustc = override; return override; }
  const cargoBin = path.join(os.homedir(), '.cargo', 'bin', isWindows ? 'rustc.exe' : 'rustc');
  const found = whichSync('rustc')
    ?? firstExisting(cargoBin, '/usr/local/bin/rustc', '/opt/homebrew/bin/rustc');
  pathCache.rustc = found;
  return found;
}

function detectGo(): string | null {
  if (pathCache.go !== undefined) { return pathCache.go; }
  const override = overrideFor('go');
  if (override) { pathCache.go = override; return override; }
  const found = whichSync('go')
    ?? firstExisting(
      '/usr/local/go/bin/go', '/opt/homebrew/bin/go', '/usr/local/bin/go',
      path.join(os.homedir(), 'go', 'bin', isWindows ? 'go.exe' : 'go'),
      'C:\\Program Files\\Go\\bin\\go.exe',
    );
  pathCache.go = found;
  return found;
}

function detectRuby(): string | null {
  if (pathCache.ruby !== undefined) { return pathCache.ruby; }
  const override = overrideFor('ruby');
  if (override) { pathCache.ruby = override; return override; }
  const found = whichSync('ruby')
    ?? firstExisting(
      path.join(os.homedir(), '.rbenv', 'shims', 'ruby'),
      '/opt/homebrew/opt/ruby/bin/ruby', '/usr/local/opt/ruby/bin/ruby',
      '/usr/bin/ruby',
    );
  pathCache.ruby = found;
  return found;
}

export function getDetectedPaths(): DetectedPaths {
  return {
    java: detectJava(),
    javac: detectJavac(),
    python3: detectPython3(),
    gpp: detectGpp(),
    kotlinc: detectKotlinc(),
    node: detectNode(),
    rustc: detectRustc(),
    go: detectGo(),
    ruby: detectRuby(),
  };
}

// ---------------------------------------------------------------------------
// hasMainFunction
// ---------------------------------------------------------------------------

function hasMainFunction(code: string, language: Language): boolean {
  switch (language) {
    case Language.JAVA:
      return /public\s+static\s+void\s+main/.test(code);
    case Language.PYTHON:
      return /if\s+__name__/.test(code);
    case Language.CPP:
      return /int\s+main\s*\(/.test(code);
    case Language.KOTLIN:
      return /fun\s+main\s*\(/.test(code);
    case Language.JAVASCRIPT:
      return /readline/.test(code) || /process\.stdin/.test(code);
    case Language.RUST:
      return /fn\s+main\s*\(/.test(code);
    case Language.GO:
      return /func\s+main\s*\(/.test(code);
    case Language.RUBY:
      // Ruby has no main; treat stdin usage as script-style code
      return /gets|STDIN/.test(code);
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Java helpers
// ---------------------------------------------------------------------------

function detectJavaClassName(code: string): string {
  // 1. public class Name
  const publicMatch = code.match(/public\s+class\s+(\w+)/);
  if (publicMatch) { return publicMatch[1]; }

  // 2. Class containing public static void main (brace counting)
  const classRegex = /class\s+(\w+)/g;
  let match: RegExpExecArray | null;
  while ((match = classRegex.exec(code)) !== null) {
    const className = match[1];
    const startIdx = match.index + match[0].length;
    // Find the opening brace of this class
    const braceStart = code.indexOf('{', startIdx);
    if (braceStart === -1) { continue; }
    let depth = 1;
    let i = braceStart + 1;
    let classBody = '';
    while (i < code.length && depth > 0) {
      if (code[i] === '{') { depth++; }
      else if (code[i] === '}') { depth--; }
      if (depth > 0) { classBody += code[i]; }
      i++;
    }
    if (/public\s+static\s+void\s+main/.test(classBody)) {
      return className;
    }
  }

  // 3. First class declaration
  const firstClass = code.match(/class\s+(\w+)/);
  if (firstClass) { return firstClass[1]; }

  // 4. Default
  return 'Main';
}

// ---------------------------------------------------------------------------
// toJavaLiteral
// ---------------------------------------------------------------------------

function toJavaLiteral(value: string): string {
  const trimmed = value.trim();

  // Nested array: [[1,2],[3,4]]
  if (trimmed.startsWith('[[')) {
    return toJavaNestedArrayLiteral(trimmed);
  }

  // Single-dimension array: [1,2,3]
  if (trimmed.startsWith('[')) {
    return toJavaArrayLiteral(trimmed);
  }

  // String literal
  if (trimmed.startsWith('"')) {
    return trimmed;
  }

  // Boolean
  if (trimmed === 'true' || trimmed === 'false') {
    return trimmed;
  }

  // Numeric
  return trimmed;
}

function detectInnerType(elements: string[]): string {
  if (elements.length === 0) { return 'int'; }
  const first = elements[0].trim();
  if (first.startsWith('"')) { return 'String'; }
  if (first === 'true' || first === 'false') { return 'boolean'; }
  if (first.includes('.')) { return 'double'; }
  // Check if the number exceeds int range
  try {
    const n = Number(first);
    if (!isNaN(n) && (n > 2147483647 || n < -2147483648)) { return 'long'; }
  } catch { /* ignore */ }
  return 'int';
}

function toJavaArrayLiteral(value: string): string {
  const inner = value.slice(1, -1).trim();
  if (inner.length === 0) { return 'new int[]{}'; }
  const elements = splitTopLevel(inner);
  const type = detectInnerType(elements);
  const joined = elements.map(e => e.trim()).join(',');
  return `new ${type}[]{${joined}}`;
}

function toJavaNestedArrayLiteral(value: string): string {
  // Parse top-level arrays within the outer brackets
  const inner = value.slice(1, -1).trim();
  const subArrays = splitTopLevel(inner);
  if (subArrays.length === 0) { return 'new int[][]{}'; }

  // Detect type from first sub-array
  const firstSub = subArrays[0].trim();
  let innerType = 'int';
  if (firstSub.startsWith('[')) {
    const subInner = firstSub.slice(1, -1).trim();
    if (subInner.length > 0) {
      const subElements = splitTopLevel(subInner);
      innerType = detectInnerType(subElements);
    }
  }

  const converted = subArrays.map(sa => {
    const si = sa.trim();
    if (si.startsWith('[')) {
      const content = si.slice(1, -1).trim();
      return `{${content}}`;
    }
    return si;
  }).join(',');

  return `new ${innerType}[][]{${converted}}`;
}

function splitTopLevel(s: string): string[] {
  const result: string[] = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '[' || ch === '(' || ch === '{') { depth++; }
    else if (ch === ']' || ch === ')' || ch === '}') { depth--; }
    if (ch === ',' && depth === 0) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim().length > 0) {
    result.push(current);
  }
  return result;
}

// ---------------------------------------------------------------------------
// wrapJava
// ---------------------------------------------------------------------------

function wrapJava(code: string, parameterNames: string[], input: string): string {
  // Extract method name: public ReturnType methodName(...)
  const methodRegex = /public\s+\S+\s+(\w+)\s*\(/g;
  let methodName: string | null = null;
  let m: RegExpExecArray | null;
  const candidates: string[] = [];
  while ((m = methodRegex.exec(code)) !== null) {
    const name = m[1];
    if (name !== 'main' && name !== 'Solution') {
      candidates.push(name);
    }
  }
  // Prefer "solution"
  methodName = candidates.find(c => c.toLowerCase() === 'solution') ?? candidates[0] ?? 'solution';

  // Parse input lines to arguments
  const inputLines = input.split('\n').filter(l => l.trim().length > 0);
  const args: string[] = [];
  for (let i = 0; i < parameterNames.length && i < inputLines.length; i++) {
    args.push(toJavaLiteral(inputLines[i]));
  }

  const argStr = args.join(', ');

  const mainClass = `
import java.io.*;
import java.util.*;

public class Main {
    static String printResult(Object result) {
        if (result instanceof int[]) {
            return Arrays.toString((int[]) result);
        } else if (result instanceof long[]) {
            return Arrays.toString((long[]) result);
        } else if (result instanceof double[]) {
            return Arrays.toString((double[]) result);
        } else if (result instanceof boolean[]) {
            return Arrays.toString((boolean[]) result);
        } else if (result instanceof Object[]) {
            return Arrays.deepToString((Object[]) result);
        } else if (result instanceof String) {
            return "\\"" + result + "\\"";
        } else {
            return String.valueOf(result);
        }
    }

    public static void main(String[] args) throws Exception {
        PrintStream originalOut = System.out;
        System.setOut(new PrintStream(System.err, true));

        Solution sol = new Solution();
        Object result = sol.${methodName}(${argStr});

        System.setOut(originalOut);
        System.out.println(printResult(result));
    }
}
`;

  return code + '\n' + MAIN_SEPARATOR + '\n' + mainClass;
}

// ---------------------------------------------------------------------------
// wrapPython
// ---------------------------------------------------------------------------

function wrapPython(code: string, parameterNames: string[], input: string): string {
  const inputLines = input.split('\n').filter(l => l.trim().length > 0);

  // Detect class-based (LeetCode style)
  const classMatch = code.match(/class\s+(\w+)\s*[:(]/);
  const isClassBased = classMatch !== null;

  // Detect method name
  let methodName = 'solution';
  if (isClassBased) {
    // Find def method(self, ...)
    const defMatch = code.match(/def\s+(\w+)\s*\(\s*self/);
    if (defMatch && defMatch[1] !== '__init__') {
      methodName = defMatch[1];
    }
  } else {
    // Find standalone def
    const defMatch = code.match(/def\s+(\w+)\s*\(/);
    if (defMatch) {
      methodName = defMatch[1];
    }
  }

  // Build argument conversions
  const argSetup: string[] = [];
  const argNames: string[] = [];
  for (let i = 0; i < parameterNames.length && i < inputLines.length; i++) {
    const varName = `_arg${i}`;
    const rawVal = inputLines[i].trim();
    // Python can eval most JSON-like literals directly
    // Replace true/false/null for JSON compat
    const pyVal = rawVal
      .replace(/\btrue\b/g, 'True')
      .replace(/\bfalse\b/g, 'False')
      .replace(/\bnull\b/g, 'None');
    argSetup.push(`${varName} = ${pyVal}`);
    argNames.push(varName);
  }

  const argSetupStr = argSetup.join('\n');
  const argCallStr = argNames.join(', ');

  const className = classMatch ? classMatch[1] : null;

  let printResultCode: string;
  if (isClassBased && className) {
    printResultCode = `
import sys as _sys
import json as _json

_original_stdout = _sys.stdout
_sys.stdout = _sys.stderr

${argSetupStr}
_sol = ${className}()
_result = _sol.${methodName}(${argCallStr})

_sys.stdout = _original_stdout

if isinstance(_result, str):
    print('"' + _result + '"')
elif isinstance(_result, list):
    print(_json.dumps(_result, separators=(',', ':')))
elif isinstance(_result, bool):
    print(str(_result).lower())
else:
    print(_result)
`;
  } else {
    printResultCode = `
import sys as _sys
import json as _json

_original_stdout = _sys.stdout
_sys.stdout = _sys.stderr

${argSetupStr}
_result = ${methodName}(${argCallStr})

_sys.stdout = _original_stdout

if isinstance(_result, str):
    print('"' + _result + '"')
elif isinstance(_result, list):
    print(_json.dumps(_result, separators=(',', ':')))
elif isinstance(_result, bool):
    print(str(_result).lower())
else:
    print(_result)
`;
  }

  return code + '\n' + printResultCode;
}

// ---------------------------------------------------------------------------
// wrapCpp
// ---------------------------------------------------------------------------

function wrapCpp(code: string, parameterNames: string[], input: string): string {
  const inputLines = input.split('\n').filter(l => l.trim().length > 0);

  // Detect function name - look for return_type function_name(params)
  // but exclude main
  const funcRegex = /(?:^|\n)\s*(\w[\w\s*&<>,]*?)\s+(\w+)\s*\(([^)]*)\)\s*\{/g;
  let funcName = 'solution';
  let fm: RegExpExecArray | null;
  while ((fm = funcRegex.exec(code)) !== null) {
    const name = fm[2];
    if (name !== 'main') {
      funcName = name;
      break;
    }
  }

  // Also check for class-based Solution
  const isClassBased = /class\s+Solution\s*\{/.test(code);
  if (isClassBased) {
    // Find method inside Solution class
    const classMethodRegex = /\s+(\w[\w\s*&<>,]*?)\s+(\w+)\s*\(([^)]*)\)\s*\{/g;
    let cm: RegExpExecArray | null;
    while ((cm = classMethodRegex.exec(code)) !== null) {
      const name = cm[2];
      if (name !== 'Solution' && name !== 'main') {
        funcName = name;
        break;
      }
    }
  }

  // Build argument conversions for C++
  const argDecls: string[] = [];
  const argNames: string[] = [];
  for (let i = 0; i < parameterNames.length && i < inputLines.length; i++) {
    const varName = `_arg${i}`;
    const rawVal = inputLines[i].trim();
    const { decl } = toCppLiteral(rawVal, varName);
    argDecls.push(decl);
    argNames.push(varName);
  }

  const argDeclStr = argDecls.join('\n    ');
  const argCallStr = argNames.join(', ');

  // Add missing includes
  const neededIncludes: string[] = [];
  const existingCode = code;
  if (!existingCode.includes('#include <iostream>') && !existingCode.includes('#include<iostream>')) {
    neededIncludes.push('#include <iostream>');
  }
  if (!existingCode.includes('#include <vector>') && !existingCode.includes('#include<vector>')) {
    neededIncludes.push('#include <vector>');
  }
  if (!existingCode.includes('#include <string>') && !existingCode.includes('#include<string>')) {
    neededIncludes.push('#include <string>');
  }
  if (!existingCode.includes('#include <sstream>') && !existingCode.includes('#include<sstream>')) {
    neededIncludes.push('#include <sstream>');
  }

  const includeStr = neededIncludes.length > 0 ? neededIncludes.join('\n') + '\n' : '';

  const callExpr = isClassBased
    ? `Solution _sol;\n    auto _result = _sol.${funcName}(${argCallStr});`
    : `auto _result = ${funcName}(${argCallStr});`;

  const mainCode = `
${includeStr}
// Template print functions
template<typename T>
void _print(const T& val) { std::cout << val; }

template<>
void _print<bool>(const bool& val) { std::cout << (val ? "true" : "false"); }

template<>
void _print<std::string>(const std::string& val) { std::cout << "\\"" << val << "\\""; }

template<typename T>
void _print(const std::vector<T>& vec) {
    std::cout << "[";
    for (size_t i = 0; i < vec.size(); i++) {
        if (i > 0) std::cout << ",";
        _print(vec[i]);
    }
    std::cout << "]";
}

int main() {
    std::streambuf* _origBuf = std::cout.rdbuf();
    std::cout.rdbuf(std::cerr.rdbuf());

    ${argDeclStr}

    ${callExpr}

    std::cout.rdbuf(_origBuf);
    _print(_result);
    std::cout << std::endl;
    return 0;
}
`;

  return code + '\n' + mainCode;
}

function toCppLiteral(value: string, varName: string): { decl: string } {
  const trimmed = value.trim();

  // Nested array
  if (trimmed.startsWith('[[')) {
    const inner = trimmed.slice(1, -1).trim();
    const subArrays = splitTopLevel(inner);
    const subDecls: string[] = [];
    const subNames: string[] = [];
    for (let i = 0; i < subArrays.length; i++) {
      const subName = `${varName}_sub${i}`;
      const { decl } = toCppLiteral(subArrays[i].trim(), subName);
      subDecls.push(decl);
      subNames.push(subName);
    }
    const declStr = subDecls.join('\n    ');
    const vecInit = subNames.join(', ');
    // Detect inner element type
    const firstSub = subArrays[0]?.trim() ?? '[]';
    const subInner = firstSub.slice(1, -1).trim();
    let elemType = 'int';
    if (subInner.length > 0) {
      const firstElem = splitTopLevel(subInner)[0]?.trim() ?? '';
      if (firstElem.startsWith('"')) { elemType = 'std::string'; }
      else if (firstElem === 'true' || firstElem === 'false') { elemType = 'bool'; }
      else if (firstElem.includes('.')) { elemType = 'double'; }
    }
    return {
      decl: `${declStr}\n    std::vector<std::vector<${elemType}>> ${varName} = {${vecInit}};`,
    };
  }

  // Array
  if (trimmed.startsWith('[')) {
    const inner = trimmed.slice(1, -1).trim();
    if (inner.length === 0) {
      return { decl: `std::vector<int> ${varName} = {};` };
    }
    const elements = splitTopLevel(inner);
    const firstElem = elements[0].trim();
    let elemType = 'int';
    if (firstElem.startsWith('"')) { elemType = 'std::string'; }
    else if (firstElem === 'true' || firstElem === 'false') { elemType = 'bool'; }
    else if (firstElem.includes('.')) { elemType = 'double'; }
    const elems = elements.map(e => e.trim()).join(', ');
    return { decl: `std::vector<${elemType}> ${varName} = {${elems}};` };
  }

  // String
  if (trimmed.startsWith('"')) {
    return { decl: `std::string ${varName} = ${trimmed};` };
  }

  // Boolean
  if (trimmed === 'true' || trimmed === 'false') {
    return { decl: `bool ${varName} = ${trimmed};` };
  }

  // Double
  if (trimmed.includes('.')) {
    return { decl: `double ${varName} = ${trimmed};` };
  }

  // Long check
  try {
    const n = Number(trimmed);
    if (!isNaN(n) && (n > 2147483647 || n < -2147483648)) {
      return { decl: `long long ${varName} = ${trimmed}LL;` };
    }
  } catch { /* ignore */ }

  // Int
  return { decl: `int ${varName} = ${trimmed};` };
}

// ---------------------------------------------------------------------------
// wrapKotlin
// ---------------------------------------------------------------------------

function wrapKotlin(code: string, parameterNames: string[], input: string): string {
  const inputLines = input.split('\n').filter(l => l.trim().length > 0);

  // Detect function name
  const funcRegex = /fun\s+(\w+)\s*\(/g;
  let funcName = 'solution';
  let km: RegExpExecArray | null;
  while ((km = funcRegex.exec(code)) !== null) {
    const name = km[1];
    if (name !== 'main') {
      funcName = name;
      break;
    }
  }

  // Build arguments
  const args: string[] = [];
  for (let i = 0; i < parameterNames.length && i < inputLines.length; i++) {
    args.push(toKotlinLiteral(inputLines[i].trim()));
  }
  const argStr = args.join(', ');

  const mainCode = `
fun main() {
    val originalOut = System.out
    System.setOut(java.io.PrintStream(System.err, true))

    val result = ${funcName}(${argStr})

    System.setOut(originalOut)

    when (result) {
        is IntArray -> println(result.contentToString())
        is LongArray -> println(result.contentToString())
        is DoubleArray -> println(result.contentToString())
        is BooleanArray -> println(result.contentToString())
        is Array<*> -> println(result.contentDeepToString())
        is String -> println("\\"$result\\"")
        else -> println(result)
    }
}
`;

  return code + '\n' + mainCode;
}

function toKotlinLiteral(value: string): string {
  const trimmed = value.trim();

  // Nested array
  if (trimmed.startsWith('[[')) {
    const inner = trimmed.slice(1, -1).trim();
    const subArrays = splitTopLevel(inner);
    const converted = subArrays.map(sa => toKotlinLiteral(sa.trim())).join(', ');
    return `arrayOf(${converted})`;
  }

  // Array
  if (trimmed.startsWith('[')) {
    const inner = trimmed.slice(1, -1).trim();
    if (inner.length === 0) { return 'intArrayOf()'; }
    const elements = splitTopLevel(inner);
    const firstElem = elements[0].trim();
    const elems = elements.map(e => e.trim()).join(', ');

    if (firstElem.startsWith('"')) { return `arrayOf(${elems})`; }
    if (firstElem === 'true' || firstElem === 'false') { return `booleanArrayOf(${elems})`; }
    if (firstElem.includes('.')) { return `doubleArrayOf(${elems})`; }
    // Check for long
    try {
      const n = Number(firstElem);
      if (!isNaN(n) && (n > 2147483647 || n < -2147483648)) {
        const longElems = elements.map(e => e.trim() + 'L').join(', ');
        return `longArrayOf(${longElems})`;
      }
    } catch { /* ignore */ }
    return `intArrayOf(${elems})`;
  }

  // String
  if (trimmed.startsWith('"')) { return trimmed; }

  // Boolean
  if (trimmed === 'true' || trimmed === 'false') { return trimmed; }

  // Numeric
  return trimmed;
}

// ---------------------------------------------------------------------------
// wrapJavaScript
// ---------------------------------------------------------------------------

function wrapJavaScript(code: string, parameterNames: string[], input: string): string {
  const inputLines = input.split('\n').filter(l => l.trim().length > 0);

  // Detect function name
  let funcName = 'solution';

  // var/const/let name = function
  const varFuncMatch = code.match(/(?:var|const|let)\s+(\w+)\s*=\s*function/);
  if (varFuncMatch) { funcName = varFuncMatch[1]; }

  // Arrow function: const name = (...) =>
  const arrowMatch = code.match(/(?:var|const|let)\s+(\w+)\s*=\s*(?:\([^)]*\)|[^=])\s*=>/);
  if (arrowMatch) { funcName = arrowMatch[1]; }

  // .prototype.name = function
  const protoMatch = code.match(/\.prototype\.(\w+)\s*=\s*function/);
  if (protoMatch) { funcName = protoMatch[1]; }

  // function name(
  const funcDeclMatch = code.match(/function\s+(\w+)\s*\(/);
  if (funcDeclMatch && funcDeclMatch[1] !== 'main') { funcName = funcDeclMatch[1]; }

  // Build arguments - JS can use JSON values directly
  const args: string[] = [];
  for (let i = 0; i < parameterNames.length && i < inputLines.length; i++) {
    args.push(inputLines[i].trim());
  }
  const argStr = args.join(', ');

  const wrapperCode = `
// Redirect console.log to stderr
const _originalLog = console.log;
console.log = (...args) => {
    process.stderr.write(args.map(String).join(' ') + '\\n');
};

const _result = ${funcName}(${argStr});

// Restore and print result
console.log = _originalLog;

if (typeof _result === 'string') {
    process.stdout.write('"' + _result + '"\\n');
} else if (Array.isArray(_result)) {
    process.stdout.write(JSON.stringify(_result) + '\\n');
} else {
    process.stdout.write(String(_result) + '\\n');
}
`;

  return code + '\n' + wrapperCode;
}

// ---------------------------------------------------------------------------
// Rust helpers
// ---------------------------------------------------------------------------

// [1,2,3] → vec![1,2,3], "abc" → String::from("abc"), nested arrays recurse
function toRustLiteral(value: string): string {
  const v = value.trim();
  if (v.startsWith('"')) { return `String::from(${v})`; }
  if (!v.startsWith('[')) { return v; }

  if (v.startsWith('[[')) {
    const inner = v.slice(1, -1);
    const arrays: string[] = [];
    let depth = 0;
    let current = '';
    for (const c of inner) {
      if (c === '[') { depth++; }
      if (c === ']') { depth--; }
      current += c;
      if (depth === 0 && current.trim().length > 0) {
        const arr = current.trim().replace(/^,/, '').trim();
        if (arr.length > 0) { arrays.push(arr); }
        current = '';
      }
    }
    return `vec![${arrays.map(toRustLiteral).join(', ')}]`;
  }

  const content = v.slice(1, -1).trim();
  if (content.length === 0) { return 'vec![]'; }
  const first = (content.split(',')[0] ?? '').trim();
  if (first.startsWith('"')) {
    const items = content.split(',').map(s => `String::from(${s.trim()})`).join(', ');
    return `vec![${items}]`;
  }
  return `vec![${content}]`;
}

function wrapRust(code: string, _parameterNames: string[], input: string): string {
  const inputLines = input.split('\n').filter(l => l.trim().length > 0);
  const args = inputLines.map(toRustLiteral).join(', ');

  // Method name: solution first, otherwise the last non-main fn
  const fnNames: string[] = [];
  const fnRegex = /fn\s+(\w+)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = fnRegex.exec(code)) !== null) {
    if (m[1] !== 'main') { fnNames.push(m[1]); }
  }
  const methodName = fnNames.includes('solution') ? 'solution' : (fnNames[fnNames.length - 1] ?? 'solution');

  // LeetCode style (impl Solution): add struct decl and call as associated fn
  const hasImpl = code.includes('impl Solution');
  const structDecl = hasImpl && !code.includes('struct Solution') ? 'struct Solution;\n\n' : '';
  const callExpr = hasImpl ? `Solution::${methodName}(${args})` : `${methodName}(${args})`;

  return `${structDecl}${code}

fn main() {
    let _result = ${callExpr};
    // {:?} prints strings quoted and vectors as [a, b] — strip spaces to match [a,b]
    let _s = format!("{:?}", _result).replace(", ", ",");
    println!("{}", _s);
}
`;
}

// ---------------------------------------------------------------------------
// Go helpers
// ---------------------------------------------------------------------------

function detectGoElementType(content: string): string {
  const first = (content.split(',')[0] ?? '').trim();
  if (first.startsWith('"')) { return 'string'; }
  if (first === 'true' || first === 'false') { return 'bool'; }
  if (first.includes('.')) { return 'float64'; }
  const n = Number(first);
  if (Number.isFinite(n) && Number.isInteger(n) && (n > 2147483647 || n < -2147483648)) { return 'int64'; }
  return 'int';
}

// [1,2,3] → []int{1,2,3}, [[1,2],[3,4]] → [][]int{{1,2},{3,4}}
function toGoLiteral(value: string): string {
  const v = value.trim();
  if (!v.startsWith('[')) { return v; }

  if (v.startsWith('[[')) {
    // Detect element type from the first inner array
    const firstInner = v.slice(1).split('[')[1]?.split(']')[0] ?? '';
    const elemType = detectGoElementType(firstInner);
    return `[][]${elemType}` + v.replace(/\[/g, '{').replace(/\]/g, '}');
  }

  const content = v.slice(1, -1).trim();
  if (content.length === 0) { return '[]int{}'; }
  const elemType = detectGoElementType(content);
  return `[]${elemType}{${content}}`;
}

function wrapGo(code: string, _parameterNames: string[], input: string): string {
  const inputLines = input.split('\n').filter(l => l.trim().length > 0);
  const args = inputLines.map(toGoLiteral).join(', ');

  const funcNames: string[] = [];
  const funcRegex = /func\s+(\w+)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = funcRegex.exec(code)) !== null) {
    if (m[1] !== 'main') { funcNames.push(m[1]); }
  }
  const methodName = funcNames.includes('solution') ? 'solution' : (funcNames[funcNames.length - 1] ?? 'solution');

  // Strip any user package declaration; the wrapper provides package main
  const body = code.split('\n').filter(l => !l.trim().startsWith('package ')).join('\n');

  // Import json/os only, so a user-level `import "fmt"` never conflicts
  return `package main

import (
	"encoding/json"
	"os"
)

${body}

func main() {
	// Redirect user fmt.Print* to stderr; only the return value goes to stdout
	_realStdout := os.Stdout
	os.Stdout = os.Stderr
	_result := ${methodName}(${args})
	os.Stdout = _realStdout
	_b, _ := json.Marshal(_result)
	os.Stdout.Write(append(_b, '\\n'))
}
`;
}

// ---------------------------------------------------------------------------
// Ruby helpers
// ---------------------------------------------------------------------------

function wrapRuby(code: string, _parameterNames: string[], input: string): string {
  const inputLines = input.split('\n').filter(l => l.trim().length > 0);
  const args = inputLines.map(l => l.trim()).join(', ');

  const defNames: string[] = [];
  const defRegex = /def\s+(\w+)/g;
  let m: RegExpExecArray | null;
  while ((m = defRegex.exec(code)) !== null) {
    if (m[1] !== 'initialize') { defNames.push(m[1]); }
  }
  const methodName = defNames.includes('solution') ? 'solution' : (defNames[defNames.length - 1] ?? 'solution');

  return `require 'json'

${code}

# Redirect user puts to stderr, then print only the return value
_orig_stdout = $stdout
$stdout = $stderr
_result = ${methodName}(${args})
$stdout = _orig_stdout
if _result.is_a?(String)
  puts "\\"#{_result}\\""
elsif _result.is_a?(Array)
  puts _result.to_json
else
  puts _result
end
`;
}

// ---------------------------------------------------------------------------
// Process execution
// ---------------------------------------------------------------------------

function executeProcess(
  command: string,
  args: string[],
  cwd: string,
  stdinData: string | null,
  timeout: number,
): Promise<RunResult> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let peakMemoryKB = 0;
    let memoryTimer: ReturnType<typeof setInterval> | null = null;
    let killed = false;

    // Windows cannot spawn .bat/.cmd scripts directly (e.g. kotlinc.bat);
    // wrap them in cmd.exe with verbatim quoting.
    let spawnCommand = command;
    let spawnArgs = args;
    let verbatim = false;
    if (isWindows && /\.(bat|cmd)$/i.test(command)) {
      spawnCommand = process.env['ComSpec'] ?? 'cmd.exe';
      const quoted = [command, ...args].map(a => `"${a}"`).join(' ');
      spawnArgs = ['/d', '/s', '/c', `"${quoted}"`];
      verbatim = true;
    }

    const child: ChildProcess = spawn(spawnCommand, spawnArgs, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      // PYTHONIOENCODING keeps Python stdout/stderr UTF-8 on Windows (MS949 default)
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      windowsVerbatimArguments: verbatim,
    });

    // Memory measurement. Linux and Windows expose a kernel-recorded peak
    // (VmHWM / PeakWorkingSet64), which is monotonic — polls can never miss a
    // spike between samples. macOS has no cheap peak counter, so we sample the
    // current RSS via `ps` and keep the maximum. All polls run async so a slow
    // reader never blocks the extension host.
    if (child.pid) {
      const pid = child.pid;
      let pollInFlight = false;

      const recordPeakKB = (kb: number) => {
        if (!isNaN(kb) && kb > peakMemoryKB) { peakMemoryKB = kb; }
      };

      let pollFn: () => void;
      let pollInterval = MEMORY_POLL_INTERVAL;

      if (process.platform === 'linux') {
        pollFn = () => {
          fs.readFile(`/proc/${pid}/status`, 'utf-8', (err, data) => {
            pollInFlight = false;
            if (err || !data) { return; }
            const m = /VmHWM:\s*(\d+)\s*kB/.exec(data);
            if (m) { recordPeakKB(parseInt(m[1], 10)); }
          });
        };
      } else if (isWindows) {
        // PowerShell startup is slow (~300ms), but PeakWorkingSet64 being
        // monotonic means a sparse poll still converges on the true maximum.
        pollInterval = 500;
        pollFn = () => {
          execFile(
            'powershell',
            ['-NoProfile', '-Command', `(Get-Process -Id ${pid}).PeakWorkingSet64`],
            { timeout: 3000 },
            (err, out) => {
              pollInFlight = false;
              if (err || !out) { return; }
              const bytes = parseInt(String(out).trim(), 10);
              if (!isNaN(bytes)) { recordPeakKB(Math.round(bytes / 1024)); }
            },
          );
        };
      } else {
        pollFn = () => {
          execFile('ps', ['-o', 'rss=', '-p', String(pid)], { timeout: 2000 }, (err, out) => {
            pollInFlight = false;
            if (err || !out) { return; }
            recordPeakKB(parseInt(String(out).trim(), 10));
          });
        };
      }

      memoryTimer = setInterval(() => {
        if (killed) {
          if (memoryTimer) { clearInterval(memoryTimer); }
          return;
        }
        if (pollInFlight) { return; }
        pollInFlight = true;
        pollFn();
      }, pollInterval);

      // Sample immediately so runs shorter than one poll interval still
      // report memory instead of 0
      pollInFlight = true;
      pollFn();
    }

    // Timeout handling
    const timeoutTimer = setTimeout(() => {
      timedOut = true;
      killed = true;
      try {
        if (isWindows && child.pid) {
          // SIGKILL only terminates the direct child on Windows; use taskkill
          // to take down the whole tree (e.g. cmd.exe -> java.exe).
          execFile('taskkill', ['/PID', String(child.pid), '/T', '/F']);
        } else {
          child.kill('SIGKILL');
        }
      } catch { /* ignore */ }
    }, timeout);

    child.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('close', (exitCode: number | null) => {
      clearTimeout(timeoutTimer);
      if (memoryTimer) { clearInterval(memoryTimer); }
      const executionTimeMs = Date.now() - startTime;

      resolve({
        output: stdout.trimEnd(),
        error: stderr.trimEnd(),
        exitCode: exitCode ?? -1,
        timedOut,
        executionTimeMs,
        peakMemoryKB,
      });
    });

    child.on('error', (err: Error) => {
      clearTimeout(timeoutTimer);
      if (memoryTimer) { clearInterval(memoryTimer); }
      const executionTimeMs = Date.now() - startTime;

      resolve({
        output: '',
        error: err.message,
        exitCode: -1,
        timedOut: false,
        executionTimeMs,
        peakMemoryKB,
      });
    });

    // Write stdin (ignore EPIPE when the process exits before reading)
    child.stdin?.on('error', () => { /* ignore */ });
    if (stdinData && stdinData.trim().length > 0) {
      child.stdin?.write(stdinData);
    }
    child.stdin?.end();
  });
}

// ---------------------------------------------------------------------------
// Temp directory helper
// ---------------------------------------------------------------------------

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'coderunner-'));
}

function cleanupDir(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// run (Mode 1: stdin mode)
// ---------------------------------------------------------------------------

export async function run(
  code: string,
  language: Language,
  input: string,
  timeout: number = DEFAULT_TIMEOUT,
): Promise<RunResult> {
  const tmpDir = createTempDir();

  try {
    switch (language) {
      case Language.JAVA:
        return await runJava(code, tmpDir, input, timeout);
      case Language.PYTHON:
        return await runPython(code, tmpDir, input, timeout);
      case Language.CPP:
        return await runCpp(code, tmpDir, input, timeout);
      case Language.KOTLIN:
        return await runKotlin(code, tmpDir, input, timeout);
      case Language.JAVASCRIPT:
        return await runJavaScript(code, tmpDir, input, timeout);
      case Language.RUST:
        return await runRust(code, tmpDir, input, timeout);
      case Language.GO:
        return await runGo(code, tmpDir, input, timeout);
      case Language.RUBY:
        return await runRuby(code, tmpDir, input, timeout);
      default:
        return {
          output: '',
          error: `Unsupported language: ${language}`,
          exitCode: -1,
          timedOut: false,
          executionTimeMs: 0,
          peakMemoryKB: 0,
        };
    }
  } finally {
    cleanupDir(tmpDir);
  }
}

// ---------------------------------------------------------------------------
// runProgrammers (Mode 2: function-call mode)
// ---------------------------------------------------------------------------

export async function runProgrammers(
  code: string,
  language: Language,
  input: string,
  parameterNames: string[],
  timeout: number = DEFAULT_TIMEOUT,
): Promise<RunResult> {
  // If code already has a main function, fall back to stdin mode
  if (hasMainFunction(code, language)) {
    return run(code, language, input, timeout);
  }

  let wrappedCode: string;

  switch (language) {
    case Language.JAVA:
      wrappedCode = wrapJava(code, parameterNames, input);
      break;
    case Language.PYTHON:
      wrappedCode = wrapPython(code, parameterNames, input);
      break;
    case Language.CPP:
      wrappedCode = wrapCpp(code, parameterNames, input);
      break;
    case Language.KOTLIN:
      wrappedCode = wrapKotlin(code, parameterNames, input);
      break;
    case Language.JAVASCRIPT:
      wrappedCode = wrapJavaScript(code, parameterNames, input);
      break;
    case Language.RUST:
      wrappedCode = wrapRust(code, parameterNames, input);
      break;
    case Language.GO:
      wrappedCode = wrapGo(code, parameterNames, input);
      break;
    case Language.RUBY:
      wrappedCode = wrapRuby(code, parameterNames, input);
      break;
    default:
      return {
        output: '',
        error: `Unsupported language: ${language}`,
        exitCode: -1,
        timedOut: false,
        executionTimeMs: 0,
        peakMemoryKB: 0,
      };
  }

  // For wrapped code, stdin is not used (args are embedded)
  return run(wrappedCode, language, '', timeout);
}

// ---------------------------------------------------------------------------
// Language-specific runners
// ---------------------------------------------------------------------------

async function runJava(code: string, tmpDir: string, input: string, timeout: number): Promise<RunResult> {
  const javac = detectJavac();
  const java = detectJava();

  if (!javac || !java) {
    return {
      output: '',
      error: 'Java compiler (javac) not found. Please install JDK and set JAVA_HOME, or set "codingtestkit.toolPath.javac" in Settings.',
      exitCode: -1,
      timedOut: false,
      executionTimeMs: 0,
      peakMemoryKB: 0,
    };
  }

  // Check for multi-file Java (MAIN_SEPARATOR or both Main and Solution classes)
  const isMultiFile = code.includes(MAIN_SEPARATOR)
    || (/class\s+Main\b/.test(code) && /class\s+Solution\b/.test(code));

  if (isMultiFile) {
    return await runJavaMultiFile(code, tmpDir, input, timeout, javac, java);
  }

  const className = detectJavaClassName(code);
  const fileName = `${className}.java`;
  const filePath = path.join(tmpDir, fileName);

  fs.writeFileSync(filePath, code, 'utf-8');

  // Compile
  const compileResult = await executeProcess(javac, ['-encoding', 'UTF-8', fileName], tmpDir, null, COMPILE_TIMEOUT);
  reportBuildOutput(`javac ${fileName}`, compileResult);
  if (compileResult.exitCode !== 0) {
    return {
      output: '',
      error: compileResult.error || compileResult.output,
      exitCode: compileResult.exitCode,
      timedOut: compileResult.timedOut,
      executionTimeMs: compileResult.executionTimeMs,
      peakMemoryKB: compileResult.peakMemoryKB,
    };
  }

  // Run
  return executeProcess(java, [...JAVA_UTF8_FLAGS, '-cp', tmpDir, className], tmpDir, input, timeout);
}

async function runJavaMultiFile(
  code: string,
  tmpDir: string,
  input: string,
  timeout: number,
  javac: string,
  java: string,
): Promise<RunResult> {
  const files: string[] = [];

  if (code.includes(MAIN_SEPARATOR)) {
    const parts = code.split(MAIN_SEPARATOR);
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.length === 0) { continue; }
      const className = detectJavaClassName(trimmed);
      const fileName = `${className}.java`;
      fs.writeFileSync(path.join(tmpDir, fileName), trimmed, 'utf-8');
      files.push(fileName);
    }
  } else {
    // Split by class boundaries - write each top-level class to its own file
    // First, find import block
    const lines = code.split('\n');
    let importBlock = '';
    let classContent = '';
    let inImports = true;
    for (const line of lines) {
      if (inImports && (line.startsWith('import ') || line.startsWith('package ') || line.trim().length === 0)) {
        importBlock += line + '\n';
      } else {
        inImports = false;
        classContent += line + '\n';
      }
    }

    // Split classes
    const classRegex = /(?:public\s+)?class\s+(\w+)/g;
    let cm: RegExpExecArray | null;
    const classEntries: { name: string; start: number }[] = [];
    while ((cm = classRegex.exec(classContent)) !== null) {
      classEntries.push({ name: cm[1], start: cm.index });
    }

    for (let i = 0; i < classEntries.length; i++) {
      const start = classEntries[i].start;
      const end = i + 1 < classEntries.length ? classEntries[i + 1].start : classContent.length;
      const body = classContent.slice(start, end).trim();
      const fileName = `${classEntries[i].name}.java`;
      fs.writeFileSync(path.join(tmpDir, fileName), importBlock + body, 'utf-8');
      files.push(fileName);
    }

    if (classEntries.length === 0) {
      // Fallback: write as Main.java
      fs.writeFileSync(path.join(tmpDir, 'Main.java'), code, 'utf-8');
      files.push('Main.java');
    }
  }

  // Compile all files together
  const compileResult = await executeProcess(javac, ['-encoding', 'UTF-8', ...files], tmpDir, null, COMPILE_TIMEOUT);
  reportBuildOutput(`javac ${files.join(' ')}`, compileResult);
  if (compileResult.exitCode !== 0) {
    return {
      output: '',
      error: compileResult.error || compileResult.output,
      exitCode: compileResult.exitCode,
      timedOut: compileResult.timedOut,
      executionTimeMs: compileResult.executionTimeMs,
      peakMemoryKB: compileResult.peakMemoryKB,
    };
  }

  // Run Main class
  return executeProcess(java, [...JAVA_UTF8_FLAGS, '-cp', tmpDir, 'Main'], tmpDir, input, timeout);
}

async function runPython(code: string, tmpDir: string, input: string, timeout: number): Promise<RunResult> {
  const python3 = detectPython3();
  if (!python3) {
    return {
      output: '',
      error: 'Python 3 not found. Please install Python 3, or set "codingtestkit.toolPath.python" in Settings.',
      exitCode: -1,
      timedOut: false,
      executionTimeMs: 0,
      peakMemoryKB: 0,
    };
  }

  const filePath = path.join(tmpDir, 'solution.py');
  fs.writeFileSync(filePath, code, 'utf-8');

  return executeProcess(python3, [filePath], tmpDir, input, timeout);
}

async function runCpp(code: string, tmpDir: string, input: string, timeout: number): Promise<RunResult> {
  const gpp = detectGpp();
  if (!gpp) {
    return {
      output: '',
      error: 'g++ not found. Please install a C++ compiler, or set "codingtestkit.toolPath.cpp" in Settings.',
      exitCode: -1,
      timedOut: false,
      executionTimeMs: 0,
      peakMemoryKB: 0,
    };
  }

  const srcPath = path.join(tmpDir, 'solution.cpp');
  const outPath = path.join(tmpDir, isWindows ? 'solution.exe' : 'solution');
  fs.writeFileSync(srcPath, code, 'utf-8');

  // Compile
  const compileResult = await executeProcess(
    gpp, ['-std=c++17', '-O2', '-o', outPath, srcPath], tmpDir, null, COMPILE_TIMEOUT,
  );
  reportBuildOutput('g++ solution.cpp', compileResult);
  if (compileResult.exitCode !== 0) {
    return {
      output: '',
      error: compileResult.error || compileResult.output,
      exitCode: compileResult.exitCode,
      timedOut: compileResult.timedOut,
      executionTimeMs: compileResult.executionTimeMs,
      peakMemoryKB: compileResult.peakMemoryKB,
    };
  }

  // Run
  return executeProcess(outPath, [], tmpDir, input, timeout);
}

async function runKotlin(code: string, tmpDir: string, input: string, timeout: number): Promise<RunResult> {
  const kotlinc = detectKotlinc();
  const java = detectJava();
  if (!kotlinc) {
    return {
      output: '',
      error: 'Kotlin compiler (kotlinc) not found. Please install Kotlin, or set "codingtestkit.toolPath.kotlin" in Settings.',
      exitCode: -1,
      timedOut: false,
      executionTimeMs: 0,
      peakMemoryKB: 0,
    };
  }
  if (!java) {
    return {
      output: '',
      error: 'Java runtime not found. Kotlin requires JVM to run.',
      exitCode: -1,
      timedOut: false,
      executionTimeMs: 0,
      peakMemoryKB: 0,
    };
  }

  const srcPath = path.join(tmpDir, 'Solution.kt');
  const jarPath = path.join(tmpDir, 'solution.jar');
  fs.writeFileSync(srcPath, code, 'utf-8');

  // Compile
  const compileResult = await executeProcess(
    kotlinc, ['-J-Dfile.encoding=UTF-8', 'Solution.kt', '-include-runtime', '-d', 'solution.jar'], tmpDir, null, COMPILE_TIMEOUT,
  );
  reportBuildOutput('kotlinc Solution.kt', compileResult);
  if (compileResult.exitCode !== 0) {
    return {
      output: '',
      error: compileResult.error || compileResult.output,
      exitCode: compileResult.exitCode,
      timedOut: compileResult.timedOut,
      executionTimeMs: compileResult.executionTimeMs,
      peakMemoryKB: compileResult.peakMemoryKB,
    };
  }

  // Run
  return executeProcess(java, [...JAVA_UTF8_FLAGS, '-jar', jarPath], tmpDir, input, timeout);
}

async function runJavaScript(code: string, tmpDir: string, input: string, timeout: number): Promise<RunResult> {
  const node = detectNode();
  if (!node) {
    return {
      output: '',
      error: 'Node.js not found. Please install Node.js, or set "codingtestkit.toolPath.node" in Settings.',
      exitCode: -1,
      timedOut: false,
      executionTimeMs: 0,
      peakMemoryKB: 0,
    };
  }

  const filePath = path.join(tmpDir, 'solution.js');
  fs.writeFileSync(filePath, code, 'utf-8');

  return executeProcess(node, [filePath], tmpDir, input, timeout);
}

async function runRust(code: string, tmpDir: string, input: string, timeout: number): Promise<RunResult> {
  const rustc = detectRustc();
  if (!rustc) {
    return {
      output: '',
      error: 'rustc not found. Please install Rust via https://rustup.rs, or set "codingtestkit.toolPath.rust" in Settings.',
      exitCode: -1,
      timedOut: false,
      executionTimeMs: 0,
      peakMemoryKB: 0,
    };
  }

  const srcPath = path.join(tmpDir, 'solution.rs');
  // Unlike MinGW g++, rustc does not append .exe automatically on Windows
  const outPath = path.join(tmpDir, isWindows ? 'solution.exe' : 'solution');
  fs.writeFileSync(srcPath, code, 'utf-8');

  const compileResult = await executeProcess(
    rustc, ['-O', '--edition', '2021', '-o', outPath, srcPath], tmpDir, null, COMPILE_TIMEOUT,
  );
  reportBuildOutput('rustc solution.rs', compileResult);
  if (compileResult.exitCode !== 0) {
    return {
      output: '',
      error: compileResult.error || compileResult.output,
      exitCode: compileResult.exitCode,
      timedOut: compileResult.timedOut,
      executionTimeMs: compileResult.executionTimeMs,
      peakMemoryKB: compileResult.peakMemoryKB,
    };
  }

  return executeProcess(outPath, [], tmpDir, input, timeout);
}

async function runGo(code: string, tmpDir: string, input: string, timeout: number): Promise<RunResult> {
  const go = detectGo();
  if (!go) {
    return {
      output: '',
      error: 'Go not found. Please install Go via https://go.dev/dl, or set "codingtestkit.toolPath.go" in Settings.',
      exitCode: -1,
      timedOut: false,
      executionTimeMs: 0,
      peakMemoryKB: 0,
    };
  }

  const srcPath = path.join(tmpDir, 'solution.go');
  const outPath = path.join(tmpDir, isWindows ? 'solution.exe' : 'solution');
  fs.writeFileSync(srcPath, code, 'utf-8');

  const compileResult = await executeProcess(
    go, ['build', '-o', outPath, srcPath], tmpDir, null, COMPILE_TIMEOUT,
  );
  reportBuildOutput('go build solution.go', compileResult);
  if (compileResult.exitCode !== 0) {
    return {
      output: '',
      error: compileResult.error || compileResult.output,
      exitCode: compileResult.exitCode,
      timedOut: compileResult.timedOut,
      executionTimeMs: compileResult.executionTimeMs,
      peakMemoryKB: compileResult.peakMemoryKB,
    };
  }

  return executeProcess(outPath, [], tmpDir, input, timeout);
}

async function runRuby(code: string, tmpDir: string, input: string, timeout: number): Promise<RunResult> {
  const ruby = detectRuby();
  if (!ruby) {
    return {
      output: '',
      error: 'Ruby not found. Please install via https://www.ruby-lang.org (brew install ruby / rbenv / RubyInstaller), or set "codingtestkit.toolPath.ruby" in Settings.',
      exitCode: -1,
      timedOut: false,
      executionTimeMs: 0,
      peakMemoryKB: 0,
    };
  }

  const filePath = path.join(tmpDir, 'solution.rb');
  fs.writeFileSync(filePath, code, 'utf-8');

  return executeProcess(ruby, [filePath], tmpDir, input, timeout);
}
