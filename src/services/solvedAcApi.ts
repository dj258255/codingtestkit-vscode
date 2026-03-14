import axios from 'axios';
import { ProblemInfo, SearchResult } from '../models/models';

const UA = 'Mozilla/5.0';
const BASE = 'https://solved.ac/api/v3';

const SUPERSCRIPT_MAP: Record<string, string> = {
  '0': '\u2070', '1': '\u00B9', '2': '\u00B2', '3': '\u00B3', '4': '\u2074',
  '5': '\u2075', '6': '\u2076', '7': '\u2077', '8': '\u2078', '9': '\u2079',
  '+': '\u207A', '-': '\u207B', '=': '\u207C', '(': '\u207D', ')': '\u207E',
  'n': '\u207F', 'i': '\u2071',
};

const SUBSCRIPT_MAP: Record<string, string> = {
  '0': '\u2080', '1': '\u2081', '2': '\u2082', '3': '\u2083', '4': '\u2084',
  '5': '\u2085', '6': '\u2086', '7': '\u2087', '8': '\u2088', '9': '\u2089',
  '+': '\u208A', '-': '\u208B', '=': '\u208C', '(': '\u208D', ')': '\u208E',
  'a': '\u2090', 'e': '\u2091', 'i': '\u1D62', 'o': '\u2092', 'r': '\u1D63',
  'u': '\u1D64', 'v': '\u1D65', 'x': '\u2093', 'j': '\u2C7C', 'k': '\u2096',
  'n': '\u2099', 'p': '\u209A', 's': '\u209B', 't': '\u209C',
};

const LATEX_COMMANDS: Record<string, string> = {
  '\\times': '\u00D7',
  '\\cdot': '*',
  '\\div': '\u00F7',
  '\\pm': '\u00B1',
  '\\leq': '\u2264',
  '\\le': '\u2264',
  '\\geq': '\u2265',
  '\\ge': '\u2265',
  '\\neq': '\u2260',
  '\\ne': '\u2260',
  '\\lt': '<',
  '\\gt': '>',
  '\\infty': '\u221E',
  '\\sum': '\u03A3',
  '\\prod': '\u03A0',
  '\\sqrt': '\u221A',
  '\\log': 'log',
  '\\sin': 'sin',
  '\\cos': 'cos',
  '\\tan': 'tan',
  '\\lfloor': '\u230A',
  '\\rfloor': '\u230B',
  '\\lceil': '\u2308',
  '\\rceil': '\u2309',
  '\\leftarrow': '\u2190',
  '\\rightarrow': '\u2192',
  '\\land': '\u2227',
  '\\lor': '\u2228',
  '\\lnot': '\u00AC',
  '\\oplus': '\u2295',
  '\\alpha': '\u03B1',
  '\\beta': '\u03B2',
  '\\pi': '\u03C0',
  '\\theta': '\u03B8',
  '\\sigma': '\u03C3',
};

// --- Tag List Cache ---
let cachedTagList: Array<{ id: string; ko: string; en: string }> | null = null;
let tagListCacheTime = 0;
const TAG_LIST_TTL = 10 * 60 * 1000; // 10 minutes

export async function fetchTagList(): Promise<Array<{ id: string; ko: string; en: string }>> {
  const now = Date.now();
  if (cachedTagList && now - tagListCacheTime < TAG_LIST_TTL) {
    return cachedTagList;
  }

  const tags: Array<{ id: string; ko: string; en: string }> = [];
  let page = 1;
  let totalCount = Infinity;

  while (tags.length < totalCount) {
    const response = await axios.get(`${BASE}/tag/list`, {
      params: { page, sort: 'problemCount', direction: 'desc' },
      headers: { 'User-Agent': UA },
    });
    const data = response.data;
    totalCount = data.count ?? 0;
    const items: any[] = data.items ?? [];
    if (items.length === 0) { break; }

    for (const item of items) {
      let ko = item.key;
      let en = item.key;
      const displayNames: any[] = item.displayNames ?? [];
      for (const dn of displayNames) {
        if (dn.language === 'ko') { ko = dn.short ?? dn.name ?? ko; }
        if (dn.language === 'en') { en = dn.short ?? dn.name ?? en; }
      }
      tags.push({ id: item.key, ko, en });
    }
    page++;
  }

  cachedTagList = tags;
  tagListCacheTime = now;
  return tags;
}

export function levelToString(level: number): string {
  if (level === 0) {
    return 'Unrated';
  }

  const tiers = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Ruby'];
  const ranks = ['V', 'IV', 'III', 'II', 'I'];

  const tierIdx = Math.floor((level - 1) / 5);
  const rankIdx = (level - 1) % 5;

  if (tierIdx < 0 || tierIdx >= tiers.length) {
    return 'Unrated';
  }

  return `${tiers[tierIdx]} ${ranks[rankIdx]}`;
}

export async function fetchDifficulty(problemId: string): Promise<string> {
  try {
    const response = await axios.get(`${BASE}/problem/show`, {
      params: { problemId },
      headers: { 'User-Agent': UA },
    });
    const level: number = response.data.level ?? 0;
    return levelToString(level);
  } catch {
    return 'Unrated';
  }
}

export async function searchProblems(
  query: string,
  sort: string = 'id',
  direction: string = 'asc',
  page: number = 1,
): Promise<SearchResult> {
  try {
    const response = await axios.get(`${BASE}/search/problem`, {
      params: { query, sort, direction, page },
      headers: { 'User-Agent': UA },
    });

    const data = response.data;
    const items: any[] = data.items ?? [];
    const totalCount: number = data.count ?? 0;

    const problems: ProblemInfo[] = items.map((item: any) => {
      const tags: string[] = [];
      const tagsEn: string[] = [];

      if (Array.isArray(item.tags)) {
        for (const tag of item.tags) {
          const displayNames: any[] = tag.displayNames ?? [];
          for (const dn of displayNames) {
            if (dn.language === 'ko') {
              tags.push(dn.short ?? dn.name ?? '');
            } else if (dn.language === 'en') {
              tagsEn.push(dn.short ?? dn.name ?? '');
            }
          }
        }
      }

      return {
        problemId: String(item.problemId),
        title: stripLatex(item.titleKo ?? ''),
        level: item.level ?? 0,
        difficulty: levelToString(item.level ?? 0),
        tags,
        tagsEn,
        acceptedUserCount: item.acceptedUserCount ?? 0,
        acRate: item.averageTries ? Math.round((1 / item.averageTries) * 10000) / 100 : undefined,
      };
    });

    return { problems, totalCount };
  } catch {
    return { problems: [], totalCount: 0 };
  }
}

export async function searchSuggestions(query: string): Promise<ProblemInfo[]> {
  try {
    const response = await axios.get(`${BASE}/search/suggestion`, {
      params: { query },
      headers: { 'User-Agent': UA },
    });

    const data = response.data;
    const items: any[] = data.problems ?? [];

    return items.map((item: any) => ({
      problemId: String(item.id ?? item.problemId ?? ''),
      title: stripLatex(item.title ?? item.titleKo ?? ''),
      level: item.level ?? 0,
      difficulty: levelToString(item.level ?? 0),
      tags: [],
      tagsEn: [],
      acceptedUserCount: item.solved ?? item.acceptedUserCount ?? 0,
    }));
  } catch {
    return [];
  }
}

export async function searchRandomProblems(
  tierQuery: string,
  tags: string[],
  count: number,
): Promise<ProblemInfo[]> {
  const queryParts: string[] = ['solvable:true'];

  if (tierQuery) {
    queryParts.push(tierQuery);
  }

  for (const tag of tags) {
    queryParts.push(`tag:${tag}`);
  }

  const query = queryParts.join(' ');
  const result = await searchProblems(query, 'random');
  return result.problems.slice(0, count);
}

function applySuperscript(text: string): string {
  let result = '';
  for (const ch of text) {
    result += SUPERSCRIPT_MAP[ch] ?? ch;
  }
  return result;
}

function applySubscript(text: string): string {
  let result = '';
  for (const ch of text) {
    result += SUBSCRIPT_MAP[ch] ?? ch;
  }
  return result;
}

/**
 * Extract the content inside balanced braces starting at position `start`.
 * `start` should point to the opening '{'.
 * Returns [content, endIndex] where endIndex is the position after the closing '}'.
 */
function extractBraceContent(text: string, start: number): [string, number] {
  if (start >= text.length || text[start] !== '{') {
    return ['', start];
  }
  let depth = 0;
  let i = start;
  while (i < text.length) {
    if (text[i] === '{') {
      depth++;
    } else if (text[i] === '}') {
      depth--;
      if (depth === 0) {
        return [text.substring(start + 1, i), i + 1];
      }
    }
    i++;
  }
  // Unbalanced braces - return what we have
  return [text.substring(start + 1), text.length];
}

export function stripLatex(text: string): string {
  if (!text) {
    return text;
  }

  // Process each $...$ block
  let result = '';
  let i = 0;
  while (i < text.length) {
    if (text[i] === '$') {
      // Find matching closing $
      const end = text.indexOf('$', i + 1);
      if (end === -1) {
        result += text.substring(i);
        break;
      }
      const latex = text.substring(i + 1, end);
      result += convertLatexFragment(latex);
      i = end + 1;
    } else {
      result += text[i];
      i++;
    }
  }

  return result.trim();
}

function convertLatexFragment(latex: string): string {
  let text = latex;

  // Handle \frac{a}{b} -> a/b
  text = text.replace(/\\frac\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g, '$1/$2');

  // Handle \binom{n}{k} -> C(n,k)
  text = text.replace(/\\binom\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g, 'C($1,$2)');

  // Handle \text{...}, \mathrm{...}, \textit{...}, \textbf{...}, \mathit{...}, \mathbf{...}, \operatorname{...}
  text = text.replace(/\\(?:text|mathrm|textit|textbf|mathit|mathbf|operatorname|mathsf|mathtt|textrm)\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g, '$1');

  // Replace known LaTeX commands (sort by length descending to match longer commands first)
  const sortedCommands = Object.keys(LATEX_COMMANDS).sort((a, b) => b.length - a.length);
  for (const cmd of sortedCommands) {
    // Use word boundary after the command to avoid partial matches
    const escaped = cmd.replace(/\\/g, '\\\\');
    const regex = new RegExp(escaped + '(?![a-zA-Z])', 'g');
    text = text.replace(regex, LATEX_COMMANDS[cmd]);
  }

  // Handle superscripts: ^{...} -> superscript characters
  let processed = '';
  let idx = 0;
  while (idx < text.length) {
    if (text[idx] === '^') {
      idx++;
      if (idx < text.length && text[idx] === '{') {
        const [content, endIdx] = extractBraceContent(text, idx);
        processed += applySuperscript(content);
        idx = endIdx;
      } else if (idx < text.length) {
        // Single character superscript
        processed += applySuperscript(text[idx]);
        idx++;
      }
    } else if (text[idx] === '_') {
      idx++;
      if (idx < text.length && text[idx] === '{') {
        const [content, endIdx] = extractBraceContent(text, idx);
        processed += applySubscript(content);
        idx = endIdx;
      } else if (idx < text.length) {
        // Single character subscript
        processed += applySubscript(text[idx]);
        idx++;
      }
    } else {
      processed += text[idx];
      idx++;
    }
  }
  text = processed;

  // Remove remaining backslash commands (e.g. \, \; \! \quad \space etc.)
  text = text.replace(/\\[a-zA-Z]+/g, '');
  // Remove remaining backslash escapes like \, \; \! etc.
  text = text.replace(/\\[^a-zA-Z]/g, '');

  // Remove remaining braces
  text = text.replace(/[{}]/g, '');

  // Collapse multiple spaces
  text = text.replace(/\s+/g, ' ');

  return text.trim();
}
