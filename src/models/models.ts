export interface Problem {
  source: ProblemSource;
  id: string;
  title: string;
  description: string;
  testCases: TestCase[];
  timeLimit: string;
  memoryLimit: string;
  difficulty: string;
  parameterNames: string[];
  initialCode: string;
  contestProbId: string;
}

export interface TestCase {
  input: string;
  expectedOutput: string;
  actualOutput: string;
  passed: boolean | null;
}

export interface RunResult {
  output: string;
  error: string;
  exitCode: number;
  timedOut: boolean;
  executionTimeMs: number;
  peakMemoryKB: number;
}

export interface CodeTemplate {
  name: string;
  language: string;
  code: string;
  inputTemplate: string;
}

export interface ProblemInfo {
  problemId: string;
  title: string;
  level: number;
  difficulty: string;
  tags: string[];
  tagsEn: string[];
  acceptedUserCount: number;
  acRate?: number;
  solvedDate?: string;
  status?: string;
}

export interface SearchResult {
  problems: ProblemInfo[];
  totalCount: number;
}

export enum ProblemSource {
  PROGRAMMERS = 'PROGRAMMERS',
  SWEA = 'SWEA',
  LEETCODE = 'LEETCODE',
  CODEFORCES = 'CODEFORCES',
}

export const ProblemSourceInfo: Record<ProblemSource, {
  displayName: string;
  englishName: string;
  folderName: string;
  mainClassName: string;
}> = {
  [ProblemSource.PROGRAMMERS]: { displayName: '프로그래머스', englishName: 'Programmers', folderName: 'programmers', mainClassName: 'Solution' },
  [ProblemSource.SWEA]: { displayName: 'SWEA', englishName: 'SWEA', folderName: 'swea', mainClassName: 'Solution' },
  [ProblemSource.LEETCODE]: { displayName: 'LeetCode', englishName: 'LeetCode', folderName: 'leetcode', mainClassName: 'Solution' },
  [ProblemSource.CODEFORCES]: { displayName: 'Codeforces', englishName: 'Codeforces', folderName: 'codeforces', mainClassName: 'Main' },
};

export enum Language {
  JAVA = 'JAVA',
  PYTHON = 'PYTHON',
  CPP = 'CPP',
  KOTLIN = 'KOTLIN',
  JAVASCRIPT = 'JAVASCRIPT',
  RUST = 'RUST',
  GO = 'GO',
  RUBY = 'RUBY',
}

export const LanguageInfo: Record<Language, {
  displayName: string;
  extension: string;
  sweaId: number;
}> = {
  [Language.JAVA]: { displayName: 'Java', extension: 'java', sweaId: 0 },
  [Language.PYTHON]: { displayName: 'Python', extension: 'py', sweaId: 5 },
  [Language.CPP]: { displayName: 'C++', extension: 'cpp', sweaId: 1 },
  [Language.KOTLIN]: { displayName: 'Kotlin', extension: 'kt', sweaId: -1 },
  [Language.JAVASCRIPT]: { displayName: 'JavaScript', extension: 'js', sweaId: -1 },
  [Language.RUST]: { displayName: 'Rust', extension: 'rs', sweaId: -1 },
  [Language.GO]: { displayName: 'Go', extension: 'go', sweaId: -1 },
  [Language.RUBY]: { displayName: 'Ruby', extension: 'rb', sweaId: -1 },
};

export function getDefaultCode(lang: Language, source: ProblemSource): string {
  const templates: Record<Language, Record<ProblemSource, string>> = {
    [Language.JAVA]: {
      [ProblemSource.PROGRAMMERS]: `class Solution {\n    public int solution() {\n        int answer = 0;\n        return answer;\n    }\n}`,
      [ProblemSource.SWEA]: `import java.util.Scanner;\n\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int T = sc.nextInt();\n        for (int tc = 1; tc <= T; tc++) {\n            System.out.println("#" + tc + " ");\n        }\n    }\n}`,
      [ProblemSource.LEETCODE]: '',
      [ProblemSource.CODEFORCES]: `import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n\n    }\n}`,
    },
    [Language.PYTHON]: {
      [ProblemSource.PROGRAMMERS]: `def solution():\n    answer = 0\n    return answer`,
      [ProblemSource.SWEA]: `T = int(input())\nfor tc in range(1, T + 1):\n    print(f"#{tc}")`,
      [ProblemSource.LEETCODE]: '',
      [ProblemSource.CODEFORCES]: '',
    },
    [Language.CPP]: {
      [ProblemSource.PROGRAMMERS]: `#include <string>\n#include <vector>\nusing namespace std;\n\nint solution() {\n    int answer = 0;\n    return answer;\n}`,
      [ProblemSource.SWEA]: `#include <iostream>\nusing namespace std;\n\nint main() {\n    int T;\n    cin >> T;\n    for (int tc = 1; tc <= T; tc++) {\n        cout << "#" << tc << " " << endl;\n    }\n    return 0;\n}`,
      [ProblemSource.LEETCODE]: '',
      [ProblemSource.CODEFORCES]: `#include <iostream>\nusing namespace std;\n\nint main() {\n\n    return 0;\n}`,
    },
    [Language.KOTLIN]: {
      [ProblemSource.PROGRAMMERS]: `fun solution(): Int {\n    var answer = 0\n    return answer\n}`,
      [ProblemSource.SWEA]: `fun main() {\n    val T = readLine()!!.trim().toInt()\n    for (tc in 1..T) {\n        println("#\${tc}")\n    }\n}`,
      [ProblemSource.LEETCODE]: '',
      [ProblemSource.CODEFORCES]: `fun main() {\n\n}`,
    },
    [Language.JAVASCRIPT]: {
      [ProblemSource.PROGRAMMERS]: `function solution() {\n    var answer = 0;\n    return answer;\n}`,
      [ProblemSource.SWEA]: '',
      [ProblemSource.LEETCODE]: '',
      [ProblemSource.CODEFORCES]: `const readline = require('readline');\nconst rl = readline.createInterface({ input: process.stdin });\nconst lines = [];\nrl.on('line', (line) => lines.push(line));\nrl.on('close', () => {\n\n});`,
    },
    [Language.RUST]: {
      [ProblemSource.PROGRAMMERS]: `fn solution() -> i32 {\n    let answer = 0;\n    answer\n}`,
      [ProblemSource.SWEA]: `use std::io::{self, BufRead};\n\nfn main() {\n    let stdin = io::stdin();\n    let mut lines = stdin.lock().lines();\n    let t: usize = lines.next().unwrap().unwrap().trim().parse().unwrap();\n    for tc in 1..=t {\n        println!("#{} ", tc);\n    }\n}`,
      [ProblemSource.LEETCODE]: '',
      [ProblemSource.CODEFORCES]: `use std::io::{self, Read};\n\nfn main() {\n    let mut input = String::new();\n    io::stdin().read_to_string(&mut input).unwrap();\n    let mut it = input.split_whitespace();\n\n}`,
    },
    [Language.GO]: {
      [ProblemSource.PROGRAMMERS]: `func solution() int {\n    answer := 0\n    return answer\n}`,
      [ProblemSource.SWEA]: `package main\n\nimport (\n    "bufio"\n    "fmt"\n    "os"\n)\n\nfunc main() {\n    reader := bufio.NewReader(os.Stdin)\n    var T int\n    fmt.Fscan(reader, &T)\n    for tc := 1; tc <= T; tc++ {\n        fmt.Printf("#%d \\n", tc)\n    }\n}`,
      [ProblemSource.LEETCODE]: '',
      [ProblemSource.CODEFORCES]: `package main\n\nimport (\n    "bufio"\n    "fmt"\n    "os"\n)\n\nfunc main() {\n    reader := bufio.NewReader(os.Stdin)\n    writer := bufio.NewWriter(os.Stdout)\n    defer writer.Flush()\n\n    var n int\n    fmt.Fscan(reader, &n)\n    fmt.Fprintln(writer, n)\n}`,
    },
    [Language.RUBY]: {
      [ProblemSource.PROGRAMMERS]: `def solution()\n    answer = 0\n    answer\nend`,
      [ProblemSource.SWEA]: `T = gets.to_i\n(1..T).each do |tc|\n    puts "##{tc} "\nend`,
      [ProblemSource.LEETCODE]: '',
      [ProblemSource.CODEFORCES]: `lines = STDIN.read.split("\\n")\n`,
    },
  };
  return templates[lang]?.[source] ?? '';
}

export function languageFromExtension(ext: string): Language | null {
  const map: Record<string, Language> = {
    java: Language.JAVA,
    py: Language.PYTHON,
    cpp: Language.CPP,
    kt: Language.KOTLIN,
    js: Language.JAVASCRIPT,
    rs: Language.RUST,
    go: Language.GO,
    rb: Language.RUBY,
  };
  return map[ext] ?? null;
}

export function sourceFromName(name: string): ProblemSource {
  for (const [key, info] of Object.entries(ProblemSourceInfo)) {
    if (info.displayName === name || info.englishName === name) {
      return key as ProblemSource;
    }
  }
  return ProblemSource.PROGRAMMERS;
}
