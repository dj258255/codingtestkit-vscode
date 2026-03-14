import { spawn, ChildProcess, execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { RunResult, Language } from '../models/models';

const DEFAULT_TIMEOUT = 10000;
const MEMORY_POLL_INTERVAL = 50;
const MAIN_SEPARATOR = '///MAIN_SEPARATOR///';

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
}

const pathCache: Partial<DetectedPaths> = {};

function whichSync(cmd: string): string | null {
  try {
    return execFileSync('which', [cmd], { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim() || null;
  } catch {
    return null;
  }
}

function firstExisting(...candidates: string[]): string | null {
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return c;
    }
  }
  return null;
}

function detectJavaHome(): string | null {
  // 1. JAVA_HOME env
  const envHome = process.env['JAVA_HOME'];
  if (envHome && fs.existsSync(path.join(envHome, 'bin', 'java'))) {
    return envHome;
  }

  // 2. java.home (VS Code setting-like env, not always present)
  const javaHomeSetting = process.env['java.home'];
  if (javaHomeSetting && fs.existsSync(path.join(javaHomeSetting, 'bin', 'java'))) {
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
  searchDirs.push('/usr/lib/jvm');

  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) { continue; }
    // /opt/homebrew/opt/openjdk is a direct JDK
    const directBin = path.join(dir, 'bin', 'java');
    if (fs.existsSync(directBin)) {
      return dir;
    }
    // Directories containing JDK subdirectories
    try {
      const entries = fs.readdirSync(dir).sort().reverse();
      for (const entry of entries) {
        const candidate = path.join(dir, entry, 'Contents', 'Home');
        if (fs.existsSync(path.join(candidate, 'bin', 'java'))) {
          return candidate;
        }
        const candidate2 = path.join(dir, entry);
        if (fs.existsSync(path.join(candidate2, 'bin', 'java'))) {
          return candidate2;
        }
      }
    } catch { /* ignore */ }
  }

  return null;
}

function detectJava(): string | null {
  if (pathCache.java !== undefined) { return pathCache.java; }
  const home = detectJavaHome();
  if (home) {
    const javaBin = path.join(home, 'bin', 'java');
    if (fs.existsSync(javaBin)) {
      pathCache.java = javaBin;
      pathCache.javac = path.join(home, 'bin', 'javac');
      return javaBin;
    }
  }
  const found = whichSync('java');
  pathCache.java = found;
  return found;
}

function detectJavac(): string | null {
  if (pathCache.javac !== undefined) { return pathCache.javac; }
  detectJava();
  if (pathCache.javac !== undefined) { return pathCache.javac; }
  const found = whichSync('javac');
  pathCache.javac = found;
  return found;
}

function detectPython3(): string | null {
  if (pathCache.python3 !== undefined) { return pathCache.python3; }
  const found = whichSync('python3')
    ?? firstExisting('/usr/bin/python3', '/usr/local/bin/python3', '/opt/homebrew/bin/python3');
  pathCache.python3 = found;
  return found;
}

function detectGpp(): string | null {
  if (pathCache.gpp !== undefined) { return pathCache.gpp; }
  const found = whichSync('g++')
    ?? firstExisting('/usr/bin/g++', '/usr/local/bin/g++', '/opt/homebrew/bin/g++');
  pathCache.gpp = found;
  return found;
}

function detectKotlinc(): string | null {
  if (pathCache.kotlinc !== undefined) { return pathCache.kotlinc; }

  let found = whichSync('kotlinc');
  if (found) { pathCache.kotlinc = found; return found; }

  // SDKMAN
  const sdkmanPath = path.join(os.homedir(), '.sdkman', 'candidates', 'kotlin', 'current', 'bin', 'kotlinc');
  if (fs.existsSync(sdkmanPath)) { pathCache.kotlinc = sdkmanPath; return sdkmanPath; }

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
          if (fs.existsSync(kotlinPlugin)) { pathCache.kotlinc = kotlinPlugin; return kotlinPlugin; }
        }
      } catch { /* ignore */ }
    }
  }

  pathCache.kotlinc = null;
  return null;
}

function detectNode(): string | null {
  if (pathCache.node !== undefined) { return pathCache.node; }

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
    ?? firstExisting('/usr/local/bin/node', '/opt/homebrew/bin/node');
  pathCache.node = found;
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

    const child: ChildProcess = spawn(command, args, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    // Memory polling via ps (macOS/Linux)
    if (child.pid) {
      memoryTimer = setInterval(() => {
        if (!child.pid || killed) {
          if (memoryTimer) { clearInterval(memoryTimer); }
          return;
        }
        try {
          const psOutput = execFileSync('ps', ['-o', 'rss=', '-p', String(child.pid)], {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
            timeout: 1000,
          }).trim();
          const rss = parseInt(psOutput, 10);
          if (!isNaN(rss) && rss > peakMemoryKB) {
            peakMemoryKB = rss;
          }
        } catch {
          // Process may have ended
        }
      }, MEMORY_POLL_INTERVAL);
    }

    // Timeout handling
    const timeoutTimer = setTimeout(() => {
      timedOut = true;
      killed = true;
      try {
        child.kill('SIGKILL');
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

    // Write stdin
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
      error: 'Java compiler (javac) not found. Please install JDK and set JAVA_HOME.',
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
  const compileResult = await executeProcess(javac, [fileName], tmpDir, null, timeout);
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
  return executeProcess(java, ['-cp', tmpDir, className], tmpDir, input, timeout);
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
  const compileResult = await executeProcess(javac, files, tmpDir, null, timeout);
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
  return executeProcess(java, ['-cp', tmpDir, 'Main'], tmpDir, input, timeout);
}

async function runPython(code: string, tmpDir: string, input: string, timeout: number): Promise<RunResult> {
  const python3 = detectPython3();
  if (!python3) {
    return {
      output: '',
      error: 'Python 3 not found. Please install Python 3.',
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
      error: 'g++ not found. Please install a C++ compiler.',
      exitCode: -1,
      timedOut: false,
      executionTimeMs: 0,
      peakMemoryKB: 0,
    };
  }

  const srcPath = path.join(tmpDir, 'solution.cpp');
  const outPath = path.join(tmpDir, 'solution');
  fs.writeFileSync(srcPath, code, 'utf-8');

  // Compile
  const compileResult = await executeProcess(
    gpp, ['-std=c++17', '-O2', '-o', outPath, srcPath], tmpDir, null, timeout,
  );
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
      error: 'Kotlin compiler (kotlinc) not found. Please install Kotlin.',
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
    kotlinc, ['Solution.kt', '-include-runtime', '-d', 'solution.jar'], tmpDir, null, timeout,
  );
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
  return executeProcess(java, ['-jar', jarPath], tmpDir, input, timeout);
}

async function runJavaScript(code: string, tmpDir: string, input: string, timeout: number): Promise<RunResult> {
  const node = detectNode();
  if (!node) {
    return {
      output: '',
      error: 'Node.js not found. Please install Node.js.',
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
