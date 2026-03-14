import axios from 'axios';
import * as cheerio from 'cheerio';
import { Problem, ProblemInfo, ProblemSource, SearchResult, TestCase } from '../models/models';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const BASE_URL = 'https://school.programmers.co.kr';
const SEARCH_URL = `${BASE_URL}/api/v2/school/challenges/`;
const PARTS_URL = `${BASE_URL}/api/v1/school/challenges/parts/`;
const LESSON_URL = `${BASE_URL}/learn/courses/30/lessons/`;
const TIMEOUT = 15000;

const SUPPORTED_LANGUAGES = ['java', 'python3', 'cpp', 'javascript', 'kotlin'];

// --- Exam Collections Cache ---
interface ExamCollection {
  id: number;
  name: string;
}
let cachedExamCollections: ExamCollection[] | null = null;
let examCollectionsCacheTime = 0;
const EXAM_COLLECTIONS_TTL = 10 * 60 * 1000; // 10 minutes

// Result column name patterns for identifying expected output columns
const RESULT_COLUMN_PATTERNS = [
  'result', 'return', 'answer', '결과', '출력',
];

// ============================================================
// API Functions
// ============================================================

export async function fetchExamCollections(cookies?: string): Promise<ExamCollection[]> {
  const now = Date.now();
  if (cachedExamCollections && now - examCollectionsCacheTime < EXAM_COLLECTIONS_TTL) {
    return cachedExamCollections;
  }

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'User-Agent': UA,
    'Referer': `${BASE_URL}/learn/challenges`,
  };
  if (cookies) {
    headers['Cookie'] = cookies;
  }

  const response = await axios.get(PARTS_URL, {
    headers,
    timeout: TIMEOUT,
  });

  const data = response.data;
  const collections: ExamCollection[] = [];

  if (Array.isArray(data)) {
    for (const item of data) {
      collections.push({
        id: item.id ?? 0,
        name: item.title ?? item.name ?? '',
      });
    }
  }

  cachedExamCollections = collections;
  examCollectionsCacheTime = now;

  return collections;
}

export async function searchProblems(
  query: string,
  levels: number[],
  languages: string[],
  statuses: string[],
  partIds: number[],
  order: string,
  page: number,
  cookies?: string,
): Promise<SearchResult> {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'User-Agent': UA,
    'Referer': `${BASE_URL}/learn/challenges`,
  };
  if (cookies) {
    headers['Cookie'] = cookies;
  }

  // Build query parameters
  const params = new URLSearchParams();
  params.set('perPage', '200');
  params.set('order', order || 'recent');
  params.set('page', String(page || 1));

  if (query) {
    params.set('search', query);
  }

  for (const level of levels) {
    params.append('levels[]', String(level));
  }
  for (const lang of languages) {
    params.append('languages[]', lang);
  }
  for (const status of statuses) {
    params.append('statuses[]', status);
  }
  for (const partId of partIds) {
    params.append('partIds[]', String(partId));
  }

  const url = `${SEARCH_URL}?${params.toString()}`;

  try {
    const response = await axios.get(url, {
      headers,
      timeout: TIMEOUT,
    });

    const data = response.data;
    const totalCount: number = data.totalEntries ?? 0;
    const results: any[] = data.result ?? [];

    const problems: ProblemInfo[] = results.map((item: any) => {
      const level: number = item.level ?? 0;
      return {
        problemId: String(item.id ?? ''),
        title: item.title ?? '',
        level,
        difficulty: `Lv.${level}`,
        tags: item.partTitle ? [item.partTitle] : [],
        tagsEn: [],
        acceptedUserCount: item.finishedCount ?? 0,
        acRate: item.acceptanceRate != null
          ? Math.round(item.acceptanceRate * 100) / 100
          : undefined,
        status: item.status ?? undefined,
      };
    });

    return { problems, totalCount };
  } catch {
    return { problems: [], totalCount: 0 };
  }
}

// ============================================================
// Crawler Functions
// ============================================================

async function fetchLessonPage(lessonId: string, cookies?: string): Promise<cheerio.CheerioAPI> {
  const url = `${LESSON_URL}${lessonId}`;

  const headers: Record<string, string> = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    'User-Agent': UA,
    'Referer': `${BASE_URL}/learn/challenges`,
    'Cache-Control': 'no-cache',
  };
  if (cookies) {
    headers['Cookie'] = cookies;
  }

  const response = await axios.get(url, {
    headers,
    timeout: TIMEOUT,
    responseType: 'text',
  });

  return cheerio.load(response.data);
}

function extractTitle($: cheerio.CheerioAPI): string {
  // Priority 1: breadcrumb active item
  const breadcrumb = $('ol.breadcrumb li.active').text().trim();
  if (breadcrumb) {
    return breadcrumb;
  }

  // Priority 2: challenge-title h3
  const challengeTitle = $('.challenge-title h3').text().trim();
  if (challengeTitle) {
    return challengeTitle;
  }

  // Priority 3: lesson-title
  const lessonTitle = $('.lesson-title').text().trim();
  if (lessonTitle) {
    return lessonTitle;
  }

  // Priority 4: title tag
  const pageTitle = $('title').text().trim();
  if (pageTitle) {
    // Clean up title like "문제 이름 | 프로그래머스" -> "문제 이름"
    const parts = pageTitle.split('|');
    return parts[0].trim();
  }

  return '';
}

function extractDescription($: cheerio.CheerioAPI): string {
  // Priority 1: guide-section-description .markdown
  const guide = $('.guide-section-description .markdown').html();
  if (guide && guide.trim()) {
    return guide.trim();
  }

  // Priority 2: challenge-description .markdown
  const challenge = $('.challenge-description .markdown').html();
  if (challenge && challenge.trim()) {
    return challenge.trim();
  }

  // Priority 3: #tour2 .description
  const tour2 = $('#tour2 .description').html();
  if (tour2 && tour2.trim()) {
    return tour2.trim();
  }

  // Priority 4: .description .markdown
  const descMarkdown = $('.description .markdown').html();
  if (descMarkdown && descMarkdown.trim()) {
    return descMarkdown.trim();
  }

  // Priority 5: .description
  const desc = $('.description').html();
  if (desc && desc.trim()) {
    return desc.trim();
  }

  // Priority 6: script tag fallback
  const scriptData = extractScriptJson($);
  if (scriptData) {
    if (scriptData.description) {
      return String(scriptData.description);
    }
  }

  return '';
}

function extractScriptJson($: cheerio.CheerioAPI): any {
  let result: any = null;

  $('script').each((_i, el) => {
    const content = $(el).html();
    if (!content) {
      return;
    }

    // Try __NEXT_DATA__
    const nextDataMatch = content.match(/__NEXT_DATA__\s*=\s*({[\s\S]*?})\s*;?\s*$/m);
    if (nextDataMatch) {
      try {
        const parsed = JSON.parse(nextDataMatch[1]);
        const props = parsed?.props?.pageProps;
        if (props) {
          result = props;
          return false; // break
        }
      } catch {
        // ignore parse errors
      }
    }

    // Try to find JSON with "description" key
    const descMatch = content.match(/\{[\s\S]*"description"\s*:\s*"[\s\S]*?\}/);
    if (descMatch) {
      try {
        const parsed = JSON.parse(descMatch[0]);
        if (parsed.description) {
          result = parsed;
          return false; // break
        }
      } catch {
        // ignore parse errors
      }
    }
  });

  return result;
}

function extractTestCases($: cheerio.CheerioAPI): { testCases: TestCase[]; parameterNames: string[] } {
  const testCases: TestCase[] = [];
  const parameterNames: string[] = [];

  // Find the I/O example section header
  // Look for "입출력 예" text in heading/strong elements
  let ioTable: any = null;

  const headerSelectors = ['h5', 'h4', 'h3', 'h2', 'p strong'];
  for (const selector of headerSelectors) {
    $(selector).each((_i, el) => {
      const text = $(el).text().trim();
      if (text.includes('입출력 예') && !ioTable) {
        // Walk siblings to find the table
        let sibling = $(el).is('strong') ? $(el).parent() : $(el);
        let next = sibling.next();
        for (let attempts = 0; attempts < 10 && next.length > 0; attempts++) {
          if (next.is('table') || next.find('table').length > 0) {
            ioTable = next.is('table') ? next : next.find('table').first();
            return false; // break
          }
          next = next.next();
        }
      }
    });
    if (ioTable) {
      break;
    }
  }

  if (!ioTable || ioTable.length === 0) {
    // Fallback: find any table with result-like column header
    $('table').each((_i, el) => {
      const headerText = $(el).find('thead th, tr:first-child th, tr:first-child td')
        .map((_j, th) => $(th).text().trim().toLowerCase())
        .get();
      const hasResultCol = headerText.some((h) =>
        RESULT_COLUMN_PATTERNS.some((p) => h.includes(p)),
      );
      if (hasResultCol && !ioTable) {
        ioTable = $(el);
        return false;
      }
    });
  }

  if (!ioTable || ioTable.length === 0) {
    return { testCases, parameterNames };
  }

  // Parse table headers
  const headers: string[] = [];
  ioTable.find('thead th, tr:first-child th').each((_i: number, el: any) => {
    headers.push($(el).text().trim());
  });

  // If no thead, use first row td
  if (headers.length === 0) {
    ioTable.find('tr:first-child td').each((_i: number, el: any) => {
      headers.push($(el).text().trim());
    });
  }

  if (headers.length === 0) {
    return { testCases, parameterNames };
  }

  // Find the result column (last column matching result patterns)
  let resultColIdx = -1;
  for (let i = headers.length - 1; i >= 0; i--) {
    const headerLower = headers[i].toLowerCase();
    if (RESULT_COLUMN_PATTERNS.some((p) => headerLower.includes(p))) {
      resultColIdx = i;
      break;
    }
  }

  // If no result column found, assume last column is result
  if (resultColIdx === -1) {
    resultColIdx = headers.length - 1;
  }

  // Parameter names are all columns except the result column
  for (let i = 0; i < headers.length; i++) {
    if (i !== resultColIdx) {
      parameterNames.push(headers[i]);
    }
  }

  // Parse data rows
  const dataRows = ioTable.find('tbody tr');
  const rows = dataRows.length > 0 ? dataRows : ioTable.find('tr').slice(1);

  rows.each((_i: number, el: any) => {
    const cells: string[] = [];
    $(el).find('td').each((_j: number, td: any) => {
      cells.push($(td).text().trim());
    });

    if (cells.length < headers.length) {
      return; // skip incomplete rows
    }

    const inputParts: string[] = [];
    for (let j = 0; j < cells.length; j++) {
      if (j !== resultColIdx) {
        inputParts.push(cells[j]);
      }
    }

    const expectedOutput = resultColIdx < cells.length ? cells[resultColIdx] : '';

    testCases.push({
      input: inputParts.join('\n'),
      expectedOutput,
      actualOutput: '',
      passed: null,
    });
  });

  return { testCases, parameterNames };
}

function extractInitialCode($: cheerio.CheerioAPI): string {
  // Priority 1: code/pre tags with meaningful content
  const codeElements = $('code, pre');
  for (let i = 0; i < codeElements.length; i++) {
    const text = $(codeElements[i]).text().trim();
    // Check if it looks like actual code (has function/def/class keywords)
    if (text && (
      text.includes('function ') ||
      text.includes('def ') ||
      text.includes('class ') ||
      text.includes('public ') ||
      text.includes('fun ') ||
      text.includes('#include') ||
      text.includes('solution')
    )) {
      return text;
    }
  }

  // Priority 2: script JSON keys
  const scriptData = extractScriptJson($);
  if (scriptData) {
    const codeKeys = ['code', 'solution_code', 'default_code', 'initial_code', 'initialCode'];
    for (const key of codeKeys) {
      if (scriptData[key] && typeof scriptData[key] === 'string') {
        return scriptData[key];
      }
    }

    // Nested search in challenge/question objects
    const nested = scriptData.challenge ?? scriptData.question ?? scriptData.lesson ?? {};
    for (const key of codeKeys) {
      if (nested[key] && typeof nested[key] === 'string') {
        return nested[key];
      }
    }
  }

  return '';
}

function extractDifficulty($: cheerio.CheerioAPI): string {
  // Priority 1: data-challenge-level attribute
  const levelAttr = $('[data-challenge-level]').attr('data-challenge-level');
  if (levelAttr) {
    return `Lv.${levelAttr}`;
  }

  // Priority 2: script JSON
  const scriptData = extractScriptJson($);
  if (scriptData) {
    const level = scriptData.level ?? scriptData.difficulty ??
      scriptData.challenge?.level ?? scriptData.question?.level;
    if (level != null) {
      return `Lv.${level}`;
    }
  }

  // Priority 3: Lv.\d regex in various elements
  const candidates = [
    '.challenge-title', '.lesson-title', '.breadcrumb',
    'h2', 'h3', '.badge', '.level', '.difficulty',
  ];
  for (const selector of candidates) {
    const text = $(selector).text();
    const match = text.match(/Lv\.\s*(\d)/);
    if (match) {
      return `Lv.${match[1]}`;
    }
  }

  // Broader search across the page
  const bodyText = $('body').text();
  const lvMatch = bodyText.match(/Lv\.\s*(\d)/);
  if (lvMatch) {
    return `Lv.${lvMatch[1]}`;
  }

  return '';
}

export async function fetchProgrammersProblem(
  lessonId: string,
  cookies?: string,
): Promise<Problem> {
  const $ = await fetchLessonPage(lessonId, cookies);

  const title = extractTitle($);
  const description = extractDescription($);
  const { testCases, parameterNames } = extractTestCases($);
  const initialCode = extractInitialCode($);
  const difficulty = extractDifficulty($);

  return {
    source: ProblemSource.PROGRAMMERS,
    id: lessonId,
    title,
    description,
    testCases,
    timeLimit: '',
    memoryLimit: '',
    difficulty,
    parameterNames,
    initialCode,
    contestProbId: '',
  };
}
