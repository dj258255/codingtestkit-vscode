import * as vscode from 'vscode';
import axios from 'axios';
import { Problem, ProblemSource, ProblemSourceInfo, LanguageInfo, Language } from '../models/models';
import { t } from './i18n';

const API_BASE = 'https://api.github.com';
const USER_AGENT = 'CodingTestKit-Plugin';
const TIMEOUT = 15000;

// --- State ---

let globalState: vscode.Memento;

export function initGitHubService(context: vscode.ExtensionContext): void {
  globalState = context.globalState;
}

// --- Token ---

export async function getToken(): Promise<string | undefined> {
  return globalState.get<string>('github.token');
}

export async function setToken(token: string): Promise<void> {
  await globalState.update('github.token', token);
}

// --- Repo ---

export async function getRepoFullName(): Promise<string | undefined> {
  return globalState.get<string>('github.repoFullName');
}

export async function setRepoFullName(repo: string): Promise<void> {
  await globalState.update('github.repoFullName', repo);
}

// --- Auto-push ---

export async function getAutoPushEnabled(): Promise<boolean> {
  return globalState.get<boolean>('github.autoPush') ?? false;
}

export async function setAutoPushEnabled(enabled: boolean): Promise<void> {
  await globalState.update('github.autoPush', enabled);
}

// --- Common headers ---

function buildHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': USER_AGENT,
  };
}

// --- Validate token ---

export async function validateToken(token: string): Promise<boolean> {
  try {
    const response = await axios.get(`${API_BASE}/user`, {
      headers: buildHeaders(token),
      timeout: TIMEOUT,
      validateStatus: () => true,
    });
    return response.status === 200;
  } catch {
    return false;
  }
}

// --- List repos ---

export async function listRepos(token: string): Promise<string[]> {
  const repos: string[] = [];
  let page = 1;

  while (true) {
    const response = await axios.get(`${API_BASE}/user/repos`, {
      headers: buildHeaders(token),
      params: {
        sort: 'updated',
        per_page: 100,
        page,
      },
      timeout: TIMEOUT,
    });

    const data: any[] = response.data;
    for (const repo of data) {
      if (repo.full_name) {
        repos.push(repo.full_name);
      }
    }

    if (data.length < 100) {
      break;
    }
    page++;
  }

  return repos;
}

// --- File name sanitization ---

function sanitizeFileName(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, '_');
}

// --- Language extension lookup ---

function getExtensionForLanguage(language: string): string {
  const lower = language.toLowerCase();
  const extensionMap: Record<string, string> = {
    java: 'java',
    python: 'py',
    python3: 'py',
    py: 'py',
    cpp: 'cpp',
    'c++': 'cpp',
    kotlin: 'kt',
    kt: 'kt',
    javascript: 'js',
    js: 'js',
  };
  return extensionMap[lower] ?? lower;
}

// --- Determine main class name for file ---

function getFileName(source: ProblemSource, language: string): string {
  const info = ProblemSourceInfo[source];
  const ext = getExtensionForLanguage(language);
  return `${info.mainClassName}.${ext}`;
}

// --- Build folder path ---

function buildFolderPath(problem: Problem): string {
  const platformFolder = ProblemSourceInfo[problem.source].folderName;
  const difficultyFolder = sanitizeFileName(problem.difficulty || 'unrated');
  const titlePart = sanitizeFileName(problem.title);
  const problemFolder = `${problem.id}. ${titlePart}`;
  return `${platformFolder}/${difficultyFolder}/${problemFolder}`;
}

// --- Get existing file SHA ---

async function getFileSha(
  repo: string,
  filePath: string,
  token: string,
): Promise<string | null> {
  try {
    const response = await axios.get(
      `${API_BASE}/repos/${repo}/contents/${encodeURIComponent(filePath).replace(/%2F/g, '/')}`,
      {
        headers: buildHeaders(token),
        timeout: TIMEOUT,
        validateStatus: () => true,
      },
    );

    if (response.status === 200 && response.data?.sha) {
      return response.data.sha as string;
    }
    return null;
  } catch {
    return null;
  }
}

// --- Push solution ---

export async function pushSolution(
  problem: Problem,
  code: string,
  language: string,
): Promise<string> {
  const token = await getToken();
  if (!token) {
    throw new Error(t('GitHub 토큰이 설정되지 않았습니다.', 'GitHub token is not configured.'));
  }

  const repo = await getRepoFullName();
  if (!repo) {
    throw new Error(t('GitHub 저장소가 설정되지 않았습니다.', 'GitHub repository is not configured.'));
  }

  const folder = buildFolderPath(problem);
  const fileName = getFileName(problem.source, language);
  const filePath = `${folder}/${fileName}`;

  const platformName = ProblemSourceInfo[problem.source].englishName;
  const message = `[${platformName} #${problem.id}] ${problem.title} (${language})`;

  return pushFileInternal(repo, filePath, code, message, token);
}

// --- Push arbitrary file ---

export async function pushFile(
  filePath: string,
  content: string,
  message: string,
): Promise<string> {
  const token = await getToken();
  if (!token) {
    throw new Error(t('GitHub 토큰이 설정되지 않았습니다.', 'GitHub token is not configured.'));
  }

  const repo = await getRepoFullName();
  if (!repo) {
    throw new Error(t('GitHub 저장소가 설정되지 않았습니다.', 'GitHub repository is not configured.'));
  }

  return pushFileInternal(repo, filePath, content, message, token);
}

// --- Internal push ---

async function pushFileInternal(
  repo: string,
  filePath: string,
  content: string,
  message: string,
  token: string,
): Promise<string> {
  const sha = await getFileSha(repo, filePath, token);
  const encodedContent = Buffer.from(content, 'utf-8').toString('base64');

  const body: Record<string, any> = {
    message,
    content: encodedContent,
  };
  if (sha) {
    body.sha = sha;
  }

  const encodedPath = encodeURIComponent(filePath).replace(/%2F/g, '/');
  const response = await axios.put(
    `${API_BASE}/repos/${repo}/contents/${encodedPath}`,
    body,
    {
      headers: buildHeaders(token),
      timeout: TIMEOUT,
    },
  );

  const htmlUrl: string = response.data?.content?.html_url ?? '';
  return htmlUrl;
}
