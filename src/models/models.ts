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
