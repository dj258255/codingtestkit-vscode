import axios, { AxiosResponse } from 'axios';
import { Problem, ProblemInfo, ProblemSource, SearchResult, TestCase } from '../models/models';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const GRAPHQL_URL = 'https://leetcode.com/graphql';
const ALL_PROBLEMS_URL = 'https://leetcode.com/api/problems/all/';
const TIMEOUT = 15000;

// --- CSRF Token Cache ---
let cachedCsrfToken: string | null = null;

// --- Problem Stats Cache ---
let cachedProblemStats: Map<number, { totalAcs: number; status: string | null }> | null = null;
let problemStatsCacheTime = 0;
const PROBLEM_STATS_TTL = 5 * 60 * 1000; // 5 minutes

// --- Language Slug Map ---
const LANG_SLUG_MAP: Record<string, string> = {
  java: 'java',
  python: 'python3',
  py: 'python3',
  python3: 'python3',
  cpp: 'cpp',
  'c++': 'cpp',
  kotlin: 'kotlin',
  kt: 'kotlin',
  javascript: 'javascript',
  js: 'javascript',
};

function clearCsrfToken(): void {
  cachedCsrfToken = null;
}

export async function fetchCsrfToken(): Promise<string> {
  if (cachedCsrfToken) {
    return cachedCsrfToken;
  }

  // Use a lightweight GraphQL query to obtain the CSRF token from response cookies.
  // The homepage (https://leetcode.com/) is blocked by Cloudflare (403).
  const response = await axios.post(
    GRAPHQL_URL,
    { query: '{ userStatus { isSignedIn } }', variables: {} },
    {
      headers: buildPublicHeaders(),
      timeout: TIMEOUT,
      validateStatus: () => true,
    },
  );

  const setCookieHeaders: string[] = response.headers['set-cookie'] ?? [];
  for (const cookie of setCookieHeaders) {
    const match = cookie.match(/csrftoken=([^;]+)/);
    if (match) {
      cachedCsrfToken = match[1];
      return cachedCsrfToken;
    }
  }

  throw new Error('Failed to obtain CSRF token from LeetCode');
}

function buildPublicHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Referer': 'https://leetcode.com',
    'Origin': 'https://leetcode.com',
    'User-Agent': UA,
  };
}

function buildAuthHeaders(csrfToken: string, cookies: string): Record<string, string> {
  let finalCookies = cookies;
  if (finalCookies) {
    finalCookies = finalCookies.replace(/csrftoken=[^;]*(;\s*)?/g, '');
    finalCookies = finalCookies.replace(/;\s*$/, '');
    if (finalCookies) {
      finalCookies = `${finalCookies}; csrftoken=${csrfToken}`;
    } else {
      finalCookies = `csrftoken=${csrfToken}`;
    }
  } else {
    finalCookies = `csrftoken=${csrfToken}`;
  }

  return {
    'Content-Type': 'application/json',
    'Referer': 'https://leetcode.com',
    'Origin': 'https://leetcode.com',
    'x-csrftoken': csrfToken,
    'User-Agent': UA,
    'Cookie': finalCookies,
  };
}

async function graphqlRequest(
  query: string,
  variables: Record<string, any>,
  cookies: string,
  retried = false,
): Promise<any> {
  // Use public headers when no cookies (no auth needed)
  let headers: Record<string, string>;
  if (cookies) {
    const csrfToken = await fetchCsrfToken();
    headers = buildAuthHeaders(csrfToken, cookies);
  } else {
    headers = buildPublicHeaders();
  }

  try {
    const response: AxiosResponse = await axios.post(
      GRAPHQL_URL,
      { query, variables },
      { headers, timeout: TIMEOUT, validateStatus: () => true },
    );

    if (response.status === 400 || response.status === 403) {
      throw { response };
    }

    return response.data;
  } catch (err: any) {
    const status = err?.response?.status;
    if ((status === 400 || status === 403) && !retried) {
      clearCsrfToken();
      return graphqlRequest(query, variables, cookies, true);
    }
    throw err;
  }
}

// --- Topic Tags Cache ---
let cachedTopicTags: Array<{ id: string; en: string }> | null = null;
let topicTagsCacheTime = 0;
const TOPIC_TAGS_TTL = 10 * 60 * 1000; // 10 minutes

export async function fetchTopicTags(cookies: string = ''): Promise<Array<{ id: string; en: string }>> {
  const now = Date.now();
  if (cachedTopicTags && now - topicTagsCacheTime < TOPIC_TAGS_TTL) {
    return cachedTopicTags;
  }

  const query = `query { questionTopicTags { edges { node { name slug } } } }`;
  const data = await graphqlRequest(query, {}, cookies);
  const edges: any[] = data?.data?.questionTopicTags?.edges ?? [];

  cachedTopicTags = edges
    .map((e: any) => e.node)
    .filter(Boolean)
    .map((t: any) => ({
      id: t.slug ?? '',
      en: t.name ?? t.slug ?? '',
    }));
  topicTagsCacheTime = now;
  return cachedTopicTags;
}

// --- Slug Resolution ---

function extractSlugFromUrl(input: string): string | null {
  const match = input.match(/leetcode\.com\/problems\/([^/?#]+)/);
  return match ? match[1] : null;
}

function toSlug(input: string): string {
  return input.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

async function resolveSlug(input: string, cookies: string): Promise<string> {
  const urlSlug = extractSlugFromUrl(input);
  if (urlSlug) {
    return urlSlug;
  }

  if (/^\d+$/.test(input.trim())) {
    const frontendId = input.trim();
    const variables = {
      categorySlug: '',
      limit: 50,
      skip: 0,
      filters: { searchKeywords: frontendId },
    };

    const data = await graphqlRequest(PROBLEMSET_QUERY, variables, cookies);
    const questions = data?.data?.problemsetQuestionList?.questions ?? [];

    for (const q of questions) {
      if (String(q.questionFrontendId) === frontendId) {
        return q.titleSlug;
      }
    }

    if (questions.length > 0) {
      return questions[0].titleSlug;
    }

    return toSlug(input);
  }

  return toSlug(input);
}

// --- Fetch Problem ---

const QUESTION_DATA_QUERY = `
  query selectProblem($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
      questionId
      questionFrontendId
      title
      titleSlug
      content
      difficulty
      exampleTestcases
      sampleTestCase
      codeSnippets {
        lang
        langSlug
        code
      }
      metaData
      topicTags {
        name
        slug
      }
    }
  }
`;

function extractExpectedOutputs(htmlContent: string): string[] {
  const outputs: string[] = [];
  const regex = /<strong>Output:?\s*<\/strong>\s*([^<\n]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(htmlContent)) !== null) {
    const output = match[1]
      .trim()
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'");
    if (output) {
      outputs.push(output);
    }
  }
  return outputs;
}

function extractParameterNames(metaData: string): string[] {
  try {
    const parsed = JSON.parse(metaData);
    const params: any[] = parsed.params ?? [];
    return params.map((p: any) => p.name);
  } catch {
    return [];
  }
}

function buildTestCases(
  exampleTestcases: string,
  expectedOutputs: string[],
  paramCount: number,
): TestCase[] {
  const testCases: TestCase[] = [];

  if (!exampleTestcases) {
    return testCases;
  }

  const inputLines = exampleTestcases.split('\n').filter((l) => l.trim() !== '');

  if (paramCount <= 0) {
    paramCount = 1;
  }

  const inputGroups: string[][] = [];
  for (let i = 0; i < inputLines.length; i += paramCount) {
    const group = inputLines.slice(i, i + paramCount);
    if (group.length === paramCount) {
      inputGroups.push(group);
    }
  }

  for (let i = 0; i < inputGroups.length; i++) {
    const input = inputGroups[i].join('\n');
    const expectedOutput = i < expectedOutputs.length ? expectedOutputs[i] : '';
    testCases.push({
      input,
      expectedOutput,
      actualOutput: '',
      passed: null,
    });
  }

  return testCases;
}

export async function fetchProblem(
  input: string,
  language: string,
  cookies: string,
): Promise<Problem> {
  const slug = await resolveSlug(input, cookies);
  const langSlug = LANG_SLUG_MAP[language.toLowerCase()] ?? language.toLowerCase();

  const data = await graphqlRequest(QUESTION_DATA_QUERY, { titleSlug: slug }, cookies);
  const question = data?.data?.question;

  if (!question) {
    throw new Error(`Problem not found: ${input}`);
  }

  const codeSnippets: any[] = question.codeSnippets ?? [];
  let initialCode = '';
  for (const snippet of codeSnippets) {
    if (snippet.langSlug === langSlug) {
      initialCode = snippet.code ?? '';
      break;
    }
  }

  const parameterNames = extractParameterNames(question.metaData ?? '{}');

  const htmlContent: string = question.content ?? '';
  const expectedOutputs = extractExpectedOutputs(htmlContent);
  const exampleTestcases: string = question.exampleTestcases ?? question.sampleTestCase ?? '';
  const testCases = buildTestCases(exampleTestcases, expectedOutputs, parameterNames.length || 1);

  const topicTags: any[] = question.topicTags ?? [];
  const tagNames = topicTags.map((t: any) => t.name).filter(Boolean);
  const tagsHtml = tagNames.length > 0
    ? `<p><strong>Tags:</strong> ${tagNames.join(', ')}</p>`
    : '';

  const description = `${htmlContent}${tagsHtml ? '\n' + tagsHtml : ''}`;

  return {
    source: ProblemSource.LEETCODE,
    id: question.questionFrontendId ?? question.questionId ?? '',
    title: question.title ?? '',
    description,
    testCases,
    timeLimit: '',
    memoryLimit: '',
    difficulty: question.difficulty ?? '',
    parameterNames,
    initialCode,
    contestProbId: '',
  };
}

// --- Search Problems ---

const PROBLEMSET_QUERY = `
  query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
    problemsetQuestionList: questionList(
      categorySlug: $categorySlug
      limit: $limit
      skip: $skip
      filters: $filters
    ) {
      total: totalNum
      questions: data {
        questionId
        questionFrontendId
        title
        titleSlug
        difficulty
        acRate
        topicTags {
          name
          slug
        }
        status
      }
    }
  }
`;

export async function searchProblems(
  query: string,
  difficulty: string | null,
  tags: string[],
  status: string | null,
  limit: number,
  skip: number,
  cookies: string,
): Promise<SearchResult> {
  const filters: Record<string, any> = {};

  if (query) {
    filters.searchKeywords = query;
  }
  if (difficulty) {
    filters.difficulty = difficulty.toUpperCase();
  }
  if (tags.length > 0) {
    filters.tags = tags;
  }
  if (status) {
    filters.status = status;
  }

  const variables = {
    categorySlug: '',
    limit,
    skip,
    filters,
  };

  try {
    const data = await graphqlRequest(PROBLEMSET_QUERY, variables, cookies);
    const list = data?.data?.problemsetQuestionList;

    if (!list) {
      return { problems: [], totalCount: 0 };
    }

    const total: number = list.total ?? 0;
    const questions: any[] = list.questions ?? [];

    const problems: ProblemInfo[] = questions.map((q: any) => {
      const topicTags: any[] = q.topicTags ?? [];
      const tagNames = topicTags.map((t: any) => t.name).filter(Boolean);
      const tagSlugs = topicTags.map((t: any) => t.slug).filter(Boolean);

      const difficultyStr: string = q.difficulty ?? '';
      let level = 0;
      if (difficultyStr === 'Easy') {
        level = 1;
      } else if (difficultyStr === 'Medium') {
        level = 2;
      } else if (difficultyStr === 'Hard') {
        level = 3;
      }

      return {
        problemId: q.questionFrontendId ?? q.questionId ?? '',
        title: q.title ?? '',
        level,
        difficulty: difficultyStr,
        tags: tagNames,
        tagsEn: tagSlugs,
        acceptedUserCount: 0,
        acRate: q.acRate != null ? Math.round(q.acRate * 100) / 100 : undefined,
        status: q.status ?? undefined,
      };
    });

    return { problems, totalCount: total };
  } catch {
    return { problems: [], totalCount: 0 };
  }
}

// --- Fetch All Problem Stats ---

export async function fetchAllProblemStats(
  cookies: string,
): Promise<Map<number, { totalAcs: number; status: string | null }>> {
  const now = Date.now();
  if (cachedProblemStats && now - problemStatsCacheTime < PROBLEM_STATS_TTL) {
    return cachedProblemStats;
  }

  const headers: Record<string, string> = {
    'User-Agent': UA,
    'Referer': 'https://leetcode.com',
  };
  if (cookies) {
    headers['Cookie'] = cookies;
  }

  try {
    const response = await axios.get(ALL_PROBLEMS_URL, {
      headers,
      timeout: TIMEOUT,
      validateStatus: () => true,
    });

    if (response.status !== 200) {
      throw new Error(`REST API returned ${response.status}`);
    }

    const data = response.data;
    const pairs: any[] = data?.stat_status_pairs ?? [];
    const statsMap = new Map<number, { totalAcs: number; status: string | null }>();

    for (const pair of pairs) {
      const stat = pair.stat;
      if (!stat) {
        continue;
      }
      const frontendId: number = stat.frontend_question_id ?? stat.question_id;
      const totalAcs: number = stat.total_acs ?? 0;
      const pairStatus: string | null = pair.status ?? null;

      statsMap.set(frontendId, { totalAcs, status: pairStatus });
    }

    cachedProblemStats = statsMap;
    problemStatsCacheTime = now;
    return statsMap;
  } catch {
    return cachedProblemStats ?? new Map();
  }
}
