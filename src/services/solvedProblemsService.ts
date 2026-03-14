import axios from 'axios';
import { ProblemSource, ProblemInfo } from '../models/models';
import { searchProblems as solvedAcSearchProblems } from './solvedAcApi';
import { searchProblems as leetCodeSearchProblems } from './leetCodeApi';

const PAGE_SIZE = 50;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// --- Codeforces submission cache (per-handle, 5min TTL) ---

interface CfSubmission {
  id: number;
  contestId: number;
  problem: {
    contestId: number;
    index: string;
    name: string;
    rating?: number;
    tags?: string[];
  };
  verdict?: string;
  creationTimeSeconds: number;
}

interface CfSolvedCacheEntry {
  submissions: CfSubmission[];
  timestamp: number;
}

const cfSolvedCache = new Map<string, CfSolvedCacheEntry>();

// --- Supported sources ---

const SUPPORTED_SOURCES: ProblemSource[] = [
  ProblemSource.BAEKJOON,
  ProblemSource.CODEFORCES,
  ProblemSource.LEETCODE,
];

export function isSupported(source: ProblemSource): boolean {
  return SUPPORTED_SOURCES.includes(source);
}

// --- Main entry point ---

export async function fetchSolvedProblems(
  source: ProblemSource,
  handle: string,
  query: string,
  page: number,
  cookies?: string,
): Promise<{ problems: ProblemInfo[]; totalCount: number }> {
  switch (source) {
    case ProblemSource.BAEKJOON:
      return fetchBaekjoonSolved(handle, query, page);
    case ProblemSource.CODEFORCES:
      return fetchCodeforcesSolved(handle, query, page);
    case ProblemSource.LEETCODE:
      return fetchLeetCodeSolved(query, page, cookies ?? '');
    default:
      return { problems: [], totalCount: 0 };
  }
}

// --- Baekjoon (via solved.ac) ---

async function fetchBaekjoonSolved(
  handle: string,
  query: string,
  page: number,
): Promise<{ problems: ProblemInfo[]; totalCount: number }> {
  const solvedQuery = query
    ? `solved_by:${handle} ${query}`
    : `solved_by:${handle}`;

  const result = await solvedAcSearchProblems(solvedQuery, 'id', 'desc', page);
  return { problems: result.problems, totalCount: result.totalCount };
}

// --- Codeforces ---

function formatDate(epochSeconds: number): string {
  const d = new Date(epochSeconds * 1000);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function cfRatingToDifficulty(rating: number): string {
  if (rating === 0) {
    return 'Unrated';
  }
  if (rating <= 800) {
    return 'Newbie';
  }
  if (rating <= 1200) {
    return 'Pupil';
  }
  if (rating <= 1400) {
    return 'Specialist';
  }
  if (rating <= 1600) {
    return 'Expert';
  }
  if (rating <= 1900) {
    return 'Candidate Master';
  }
  if (rating <= 2100) {
    return 'Master';
  }
  if (rating <= 2300) {
    return 'International Master';
  }
  if (rating <= 2400) {
    return 'Grandmaster';
  }
  if (rating <= 2600) {
    return 'International Grandmaster';
  }
  return 'Legendary Grandmaster';
}

async function fetchCfSubmissions(handle: string): Promise<CfSubmission[]> {
  const now = Date.now();
  const cached = cfSolvedCache.get(handle);
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.submissions;
  }

  const response = await axios.get('https://codeforces.com/api/user.status', {
    params: { handle },
    timeout: 15000,
  });

  const submissions: CfSubmission[] = response.data.result ?? [];
  cfSolvedCache.set(handle, { submissions, timestamp: now });
  return submissions;
}

async function fetchCodeforcesSolved(
  handle: string,
  query: string,
  page: number,
): Promise<{ problems: ProblemInfo[]; totalCount: number }> {
  try {
    const submissions = await fetchCfSubmissions(handle);

    // Filter verdict=="OK" and deduplicate by contestId+index
    const seen = new Set<string>();
    const solvedProblems: ProblemInfo[] = [];

    for (const sub of submissions) {
      if (sub.verdict !== 'OK') {
        continue;
      }

      const p = sub.problem;
      if (!p || p.contestId === undefined || !p.index) {
        continue;
      }

      const key = `${p.contestId}${p.index}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      const rating = p.rating ?? 0;
      const ratingDisplay = rating > 0 ? `*${rating}` : 'Unrated';
      const difficulty = rating > 0
        ? `${rating} (${cfRatingToDifficulty(rating)})`
        : 'Unrated';
      const tags = p.tags ?? [];
      const solvedDate = formatDate(sub.creationTimeSeconds);

      solvedProblems.push({
        problemId: key,
        title: p.name,
        level: rating,
        difficulty,
        tags,
        tagsEn: tags,
        acceptedUserCount: 0,
        solvedDate,
      });
    }

    // Client-side filtering by query
    let filtered = solvedProblems;
    if (query && query.trim().length > 0) {
      const q = query.trim().toLowerCase();
      filtered = solvedProblems.filter((p) => {
        const id = p.problemId.toLowerCase();
        const name = p.title.toLowerCase();
        const tagMatch = p.tags.some((t) => t.toLowerCase().includes(q));
        return id.includes(q) || name.includes(q) || tagMatch;
      });
    }

    // Pagination
    const totalCount = filtered.length;
    const startIndex = (page - 1) * PAGE_SIZE;
    const paged = filtered.slice(startIndex, startIndex + PAGE_SIZE);

    return { problems: paged, totalCount };
  } catch {
    return { problems: [], totalCount: 0 };
  }
}

// --- LeetCode ---

async function fetchLeetCodeSolved(
  query: string,
  page: number,
  cookies: string,
): Promise<{ problems: ProblemInfo[]; totalCount: number }> {
  try {
    const skip = (page - 1) * PAGE_SIZE;
    const result = await leetCodeSearchProblems(
      query,
      null,   // difficulty
      [],     // tags
      'AC',   // status - solved problems only
      PAGE_SIZE,
      skip,
      cookies,
    );
    return { problems: result.problems, totalCount: result.totalCount };
  } catch {
    return { problems: [], totalCount: 0 };
  }
}
