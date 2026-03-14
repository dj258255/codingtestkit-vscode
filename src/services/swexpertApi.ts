import axios from 'axios';
import * as cheerio from 'cheerio';
import { ProblemInfo } from '../models/models';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const BASE_URL = 'https://swexpertacademy.com/main/code/problem/problemList.do';

export const SWEA_SUPPORTED_LANGUAGES = ['ALL', 'CCPP', 'JAVA', 'PYTHON'] as const;
export type SweaLanguage = (typeof SWEA_SUPPORTED_LANGUAGES)[number];

export const SWEA_DIFFICULTY_LEVELS = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8'] as const;
export type SweaDifficulty = (typeof SWEA_DIFFICULTY_LEVELS)[number];

export const SWEA_SORT_OPTIONS = [
  'INQUERY_COUNT',
  'FIRST_REG_DATETIME',
  'SUBMIT_COUNT',
  'PASS_RATE',
  'RECOMMEND_COUNT',
] as const;
export type SweaSortOption = (typeof SWEA_SORT_OPTIONS)[number];

interface SweaProblemRaw {
  id: string;
  number: string;
  title: string;
  difficulty: string;
  participants: number;
  submissions: number;
  rate: number;
  recommendations: number;
}

export interface SweaSearchResult {
  problems: ProblemInfo[];
  totalPages: number;
  totalCount: number;
}

function parseCount(text: string): number {
  if (!text) {
    return 0;
  }

  const trimmed = text.trim().replace(/,/g, '');

  const matchM = trimmed.match(/^([\d.]+)\s*M$/i);
  if (matchM) {
    return Math.round(parseFloat(matchM[1]) * 1_000_000);
  }

  const matchK = trimmed.match(/^([\d.]+)\s*K$/i);
  if (matchK) {
    return Math.round(parseFloat(matchK[1]) * 1_000);
  }

  const num = parseFloat(trimmed);
  return isNaN(num) ? 0 : Math.round(num);
}

function parseRate(text: string): number {
  if (!text) {
    return 0;
  }
  const cleaned = text.trim().replace(/%/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function buildFormData(params: {
  problemTitle?: string;
  orderBy?: SweaSortOption;
  selectCodeLang?: SweaLanguage;
  pageSize?: number;
  pageIndex?: number;
  passFilterYn?: string;
  problemLevels?: SweaDifficulty[];
}): URLSearchParams {
  const form = new URLSearchParams();
  form.append('categoryType', 'CODE');

  if (params.problemTitle) {
    form.append('problemTitle', params.problemTitle);
  }

  if (params.orderBy) {
    form.append('orderBy', params.orderBy);
  }

  if (params.selectCodeLang) {
    form.append('selectCodeLang', params.selectCodeLang);
  }

  form.append('pageSize', String(params.pageSize ?? 20));
  form.append('pageIndex', String(params.pageIndex ?? 1));

  if (params.passFilterYn) {
    form.append('passFilterYn', params.passFilterYn);
  }

  if (params.problemLevels && params.problemLevels.length > 0) {
    for (const level of params.problemLevels) {
      // SWEA API expects numeric level (1-8), not "D1"-"D8"
      form.append('problemLevel', level.replace(/\D/g, ''));
    }
  }

  return form;
}

async function fetchProblemListPage(params: {
  problemTitle?: string;
  orderBy?: SweaSortOption;
  selectCodeLang?: SweaLanguage;
  pageSize?: number;
  pageIndex?: number;
  passFilterYn?: string;
  problemLevels?: SweaDifficulty[];
}): Promise<{ problems: SweaProblemRaw[]; totalPages: number }> {
  const formData = buildFormData(params);

  const response = await axios.post(BASE_URL, formData.toString(), {
    headers: {
      'User-Agent': UA,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'text/html,application/xhtml+xml',
    },
    responseType: 'text',
    timeout: 15000,
  });

  const $ = cheerio.load(response.data);
  const problems: SweaProblemRaw[] = [];

  $('.problem-list .widget-box-sub').each((_i, el) => {
    const box = $(el);

    // Extract ID from onclick handler
    let id = '';
    const linkEl = box.find('a[onclick*=fn_move_page]');
    if (linkEl.length) {
      const onclick = linkEl.attr('onclick') ?? '';
      const idMatch = onclick.match(/['"]([A-Za-z0-9_\-]+)['"]/);
      if (idMatch) {
        id = idMatch[1];
      }
    }

    // Number: span.week_num, remove trailing dot
    let number = '';
    const numEl = box.find('span.week_num');
    if (numEl.length) {
      number = numEl.text().trim().replace(/\.$/, '');
    }

    // Title: span.week_text a ownText (strip badges)
    let title = '';
    const titleLink = box.find('span.week_text a');
    if (titleLink.length) {
      // Get own text (excluding child element text like badges)
      title = titleLink
        .contents()
        .filter(function () {
          return this.type === 'text';
        })
        .text()
        .trim();
    }

    // Difficulty from span.badge matching D\d+
    let difficulty = '';
    box.find('span.badge').each((_j, badgeEl) => {
      const badgeText = $(badgeEl).text().trim();
      if (/^D\d+$/.test(badgeText)) {
        difficulty = badgeText;
      }
    });

    // Stats from span.code-sub-mum elements
    const statEls = box.find('span.code-sub-mum');
    const statTexts: string[] = [];
    statEls.each((_j, statEl) => {
      statTexts.push($(statEl).text().trim());
    });

    const participants = statTexts.length > 0 ? parseCount(statTexts[0]) : 0;
    const submissions = statTexts.length > 1 ? parseCount(statTexts[1]) : 0;
    const rate = statTexts.length > 2 ? parseRate(statTexts[2]) : 0;
    const recommendations = statTexts.length > 3 ? parseCount(statTexts[3]) : 0;

    if (id || number) {
      problems.push({
        id: id || number,
        number,
        title,
        difficulty,
        participants,
        submissions,
        rate,
        recommendations,
      });
    }
  });

  // Parse total pages from pagination
  let totalPages = 1;
  const paginationLinks = $('a[href*=pageIndex], .pagination a, .paging a');
  paginationLinks.each((_i, el) => {
    const text = $(el).text().trim();
    const pageNum = parseInt(text, 10);
    if (!isNaN(pageNum) && pageNum > totalPages) {
      totalPages = pageNum;
    }
  });

  // Also check for last-page type links
  $('a[onclick*=pageIndex]').each((_i, el) => {
    const onclick = $(el).attr('onclick') ?? '';
    const match = onclick.match(/pageIndex[.'"\s:]*(?:value\s*=\s*)?(\d+)/);
    if (match) {
      const pageNum = parseInt(match[1], 10);
      if (!isNaN(pageNum) && pageNum > totalPages) {
        totalPages = pageNum;
      }
    }
  });

  return { problems, totalPages };
}

function rawToProblemInfo(raw: SweaProblemRaw): ProblemInfo {
  const levelNum = raw.difficulty ? parseInt(raw.difficulty.replace('D', ''), 10) : 0;

  return {
    problemId: raw.number || raw.id,
    title: raw.title,
    level: levelNum,
    difficulty: raw.difficulty || 'Unrated',
    tags: [],
    tagsEn: [],
    acceptedUserCount: raw.participants,
    acRate: raw.rate,
  };
}

export async function searchProblems(params: {
  problemTitle?: string;
  orderBy?: SweaSortOption;
  selectCodeLang?: SweaLanguage;
  pageSize?: number;
  pageIndex?: number;
  passFilterYn?: boolean;
  problemLevels?: SweaDifficulty[];
}): Promise<SweaSearchResult> {
  try {
    const result = await fetchProblemListPage({
      problemTitle: params.problemTitle,
      orderBy: params.orderBy,
      selectCodeLang: params.selectCodeLang,
      pageSize: params.pageSize ?? 20,
      pageIndex: params.pageIndex ?? 1,
      passFilterYn: params.passFilterYn ? 'Y' : undefined,
      problemLevels: params.problemLevels,
    });

    const problems = result.problems.map(rawToProblemInfo);
    const pageSize = params.pageSize ?? 20;

    return {
      problems,
      totalPages: result.totalPages,
      totalCount: result.totalPages * pageSize,
    };
  } catch {
    return { problems: [], totalPages: 0, totalCount: 0 };
  }
}

export async function randomProblems(params: {
  selectCodeLang?: SweaLanguage;
  problemLevels?: SweaDifficulty[];
  count?: number;
  minParticipants?: number;
}): Promise<ProblemInfo[]> {
  const count = params.count ?? 1;
  const minPart = params.minParticipants ?? 0;

  try {
    let all: SweaProblemRaw[] = [];

    if (!params.problemLevels || params.problemLevels.length === 0) {
      // No levels selected: fetch D1-D8 individually in parallel (like IntelliJ fetchPerLevel)
      const levelResults = await Promise.all(
        SWEA_DIFFICULTY_LEVELS.map(d =>
          fetchProblemListPage({
            selectCodeLang: params.selectCodeLang,
            pageSize: 30,
            pageIndex: 1,
            problemLevels: [d],
          }).catch(() => ({ problems: [] as SweaProblemRaw[], totalPages: 1 }))
        )
      );
      for (const r of levelResults) {
        all.push(...r.problems);
      }
    } else {
      // Levels selected: fetch each level separately to ensure even distribution across difficulties
      const levelResults = await Promise.all(
        params.problemLevels.map(d =>
          fetchProblemListPage({
            selectCodeLang: params.selectCodeLang,
            pageSize: 30,
            pageIndex: 1,
            problemLevels: [d],
          }).catch(() => ({ problems: [] as SweaProblemRaw[], totalPages: 1 }))
        )
      );
      for (const r of levelResults) {
        all.push(...r.problems);
      }
    }

    // Filter by minimum participants
    if (minPart > 0) {
      all = all.filter(p => p.participants >= minPart);
    }

    // Fisher-Yates shuffle
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }

    return all.slice(0, count).map(rawToProblemInfo);
  } catch {
    return [];
  }
}

/**
 * Resolve a problem number to its contestProbId + metadata from the list page.
 * Returns the internal contestProbId hash needed for detail page URL and downloads.
 */
export async function resolveContestProbId(problemNumber: string): Promise<{
  contestProbId: string;
  title: string;
  difficulty: string;
  number: string;
} | null> {
  try {
    const result = await fetchProblemListPage({
      problemTitle: problemNumber,
      pageSize: 10,
      pageIndex: 1,
    });

    for (const raw of result.problems) {
      if (raw.number === problemNumber) {
        return {
          contestProbId: raw.id,
          title: raw.title,
          difficulty: raw.difficulty || 'Unrated',
          number: raw.number,
        };
      }
    }
  } catch {
    // Search failed
  }
  return null;
}
