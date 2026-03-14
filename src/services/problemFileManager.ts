import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {
  Problem,
  ProblemSource,
  ProblemSourceInfo,
  Language,
  LanguageInfo,
  getDefaultCode,
} from '../models/models';
import { t } from './i18n';
import { htmlToMarkdown } from './htmlToMarkdown';

// --- Constants ---

const PROBLEM_JSON = 'problem.json';
const PROBLEMS_DIR = 'problems';
const MAX_FOLDER_NAME_LENGTH = 60;

// --- Create problem files ---

export async function createProblemFiles(
  problem: Problem,
  language: Language,
): Promise<string> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    throw new Error(
      t(
        '워크스페이스가 열려 있지 않습니다. 폴더를 열어주세요.',
        'No workspace is open. Please open a folder.',
      ),
    );
  }

  const workspaceRoot = workspaceFolders[0].uri.fsPath;
  const sourceInfo = ProblemSourceInfo[problem.source];
  const langInfo = LanguageInfo[language];

  // Build folder path
  const platformDir = sourceInfo.folderName;
  const difficultyDir = sanitizeFolderName(problem.difficulty || 'unrated');
  const problemDir = sanitizeFolderName(`${problem.id}. ${problem.title}`);
  const folderPath = path.join(workspaceRoot, PROBLEMS_DIR, platformDir, difficultyDir, problemDir);

  // Create directories
  fs.mkdirSync(folderPath, { recursive: true });

  // Write problem.json
  const problemJsonPath = path.join(folderPath, PROBLEM_JSON);
  fs.writeFileSync(problemJsonPath, JSON.stringify(problem, null, 2), 'utf-8');

  // Determine code file name and content
  const codeFileName = `${sourceInfo.mainClassName}.${langInfo.extension}`;
  const codeFilePath = path.join(folderPath, codeFileName);

  // Only create the code file if it doesn't already exist
  if (!fs.existsSync(codeFilePath)) {
    // Use initialCode from problem (e.g., LeetCode snippets) or default template
    let codeContent = problem.initialCode || getDefaultCode(language, problem.source);

    // If still empty, add a simple comment
    if (!codeContent) {
      codeContent = getEmptyTemplate(language, problem);
    }

    fs.writeFileSync(codeFilePath, codeContent, 'utf-8');
  }

  // Optionally generate README.md
  const config = vscode.workspace.getConfiguration('codingtestkit');
  const generateReadme = config.get<boolean>('generateReadme', false);
  if (generateReadme) {
    const readmePath = path.join(folderPath, 'README.md');
    if (!fs.existsSync(readmePath)) {
      const markdown = generateMarkdown(problem);
      fs.writeFileSync(readmePath, markdown, 'utf-8');
    }
  }

  return codeFilePath;
}

// --- Load problem from folder ---

export function loadProblemFromFolder(folderPath: string): Problem | null {
  const problemJsonPath = path.join(folderPath, PROBLEM_JSON);
  if (!fs.existsSync(problemJsonPath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(problemJsonPath, 'utf-8');
    const data = JSON.parse(raw);

    // Validate essential fields
    if (!data.source || !data.id || !data.title) {
      return null;
    }

    return {
      source: data.source as ProblemSource,
      id: String(data.id),
      title: String(data.title),
      description: String(data.description ?? ''),
      testCases: Array.isArray(data.testCases) ? data.testCases : [],
      timeLimit: String(data.timeLimit ?? ''),
      memoryLimit: String(data.memoryLimit ?? ''),
      difficulty: String(data.difficulty ?? ''),
      parameterNames: Array.isArray(data.parameterNames) ? data.parameterNames : [],
      initialCode: String(data.initialCode ?? ''),
      contestProbId: String(data.contestProbId ?? ''),
    };
  } catch {
    return null;
  }
}

// --- Find problem folder by walking up ---

export function findProblemFolder(filePath: string): string | null {
  let current = filePath;

  // If it's a file, start from its directory
  try {
    if (fs.statSync(current).isFile()) {
      current = path.dirname(current);
    }
  } catch {
    return null;
  }

  // Walk up directory tree looking for problem.json
  const root = path.parse(current).root;

  while (current !== root) {
    const problemJsonPath = path.join(current, PROBLEM_JSON);
    if (fs.existsSync(problemJsonPath)) {
      // Verify we're within a /problems/ directory structure
      if (current.includes(path.sep + PROBLEMS_DIR + path.sep) || current.includes('/' + PROBLEMS_DIR + '/')) {
        return current;
      }
    }
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return null;
}

// --- Find code file for a specific problem ---

export function findCodeFile(
  basePath: string,
  source: ProblemSource,
  problemId: string,
): string | null {
  const problemsDir = path.join(basePath, PROBLEMS_DIR);
  if (!fs.existsSync(problemsDir)) {
    return null;
  }

  const sourceInfo = ProblemSourceInfo[source];
  const platformDir = path.join(problemsDir, sourceInfo.folderName);
  if (!fs.existsSync(platformDir)) {
    return null;
  }

  // Search through difficulty directories
  const difficultyDirs = safeReadDir(platformDir);
  for (const diffDir of difficultyDirs) {
    const diffPath = path.join(platformDir, diffDir);
    if (!isDirectory(diffPath)) {
      continue;
    }

    const problemDirs = safeReadDir(diffPath);
    for (const probDir of problemDirs) {
      // Check if directory name starts with the problem ID
      if (!probDir.startsWith(problemId + '.') && !probDir.startsWith(problemId + ' ')) {
        continue;
      }

      const probPath = path.join(diffPath, probDir);
      if (!isDirectory(probPath)) {
        continue;
      }

      // Look for code files
      const files = safeReadDir(probPath);
      for (const file of files) {
        const baseName = path.parse(file).name;
        if (baseName === sourceInfo.mainClassName) {
          return path.join(probPath, file);
        }
      }
    }
  }

  return null;
}

// --- Sanitize folder name ---

function sanitizeFolderName(name: string): string {
  let sanitized = name.replace(/[^a-zA-Z0-9가-힣_\-() .]/g, '_');
  // Collapse multiple underscores
  sanitized = sanitized.replace(/_+/g, '_');
  // Trim underscores and spaces from edges
  sanitized = sanitized.replace(/^[_ ]+|[_ ]+$/g, '');
  // Truncate to max length
  if (sanitized.length > MAX_FOLDER_NAME_LENGTH) {
    sanitized = sanitized.substring(0, MAX_FOLDER_NAME_LENGTH).replace(/[_ ]+$/, '');
  }
  return sanitized || 'unnamed';
}

// --- Generate Markdown from problem ---

export function generateMarkdown(problem: Problem): string {
  const lines: string[] = [];
  const sourceInfo = ProblemSourceInfo[problem.source];

  // Title
  lines.push(`# [${sourceInfo.englishName} #${problem.id}] ${problem.title}`);
  lines.push('');

  // Limits
  if (problem.timeLimit) {
    lines.push(
      `**${t('시간 제한', 'Time Limit')}:** ${problem.timeLimit}`,
    );
  }
  if (problem.memoryLimit) {
    lines.push(
      `**${t('메모리 제한', 'Memory Limit')}:** ${problem.memoryLimit}`,
    );
  }
  if (problem.difficulty) {
    lines.push(
      `**${t('난이도', 'Difficulty')}:** ${problem.difficulty}`,
    );
  }
  if (problem.timeLimit || problem.memoryLimit || problem.difficulty) {
    lines.push('');
  }

  // Description
  if (problem.description) {
    lines.push(`## ${t('문제 설명', 'Description')}`);
    lines.push('');
    const descMarkdown = htmlToMarkdown(problem.description);
    lines.push(descMarkdown);
    lines.push('');
  }

  // Test cases
  if (problem.testCases.length > 0) {
    lines.push(`## ${t('예제', 'Examples')}`);
    lines.push('');

    for (let i = 0; i < problem.testCases.length; i++) {
      const tc = problem.testCases[i];
      lines.push(`### ${t('예제', 'Example')} ${i + 1}`);
      lines.push('');

      if (tc.input) {
        lines.push(`**${t('입력', 'Input')}:**`);
        lines.push('```');
        lines.push(tc.input);
        lines.push('```');
        lines.push('');
      }

      if (tc.expectedOutput) {
        lines.push(`**${t('출력', 'Output')}:**`);
        lines.push('```');
        lines.push(tc.expectedOutput);
        lines.push('```');
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}

// --- Empty template fallback ---

function getEmptyTemplate(language: Language, problem: Problem): string {
  const langInfo = LanguageInfo[language];
  const comment = getCommentPrefix(language);
  return `${comment} ${problem.source} #${problem.id}: ${problem.title}\n${comment} Language: ${langInfo.displayName}\n\n`;
}

function getCommentPrefix(language: Language): string {
  switch (language) {
    case Language.PYTHON:
      return '#';
    default:
      return '//';
  }
}

// --- Utilities ---

function safeReadDir(dirPath: string): string[] {
  try {
    return fs.readdirSync(dirPath);
  } catch {
    return [];
  }
}

function isDirectory(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isDirectory();
  } catch {
    return false;
  }
}
