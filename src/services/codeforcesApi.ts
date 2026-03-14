import axios from 'axios';
import { ProblemInfo } from '../models/models';

const BASE = 'https://codeforces.com/api';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const CODEFORCES_TAGS = [
  'implementation', 'math', 'greedy', 'dp', 'data structures',
  'brute force', 'constructive algorithms', 'graphs', 'sortings',
  'binary search', 'dfs and similar', 'trees', 'strings',
  'number theory', 'geometry', 'combinatorics', 'two pointers',
  'bitmasks', 'dsu', 'shortest paths',
];

// --- Tag List Cache ---
let cachedTagListArr: Array<{ id: string; en: string }> | null = null;
let tagListCacheTimestamp = 0;
const TAG_LIST_TTL = 10 * 60 * 1000; // 10 minutes

export async function fetchAllTags(): Promise<Array<{ id: string; en: string }>> {
  const now = Date.now();
  if (cachedTagListArr && now - tagListCacheTimestamp < TAG_LIST_TTL) {
    return cachedTagListArr;
  }

  const problems = await fetchAllProblems();
  const tagSet = new Set<string>();
  for (const p of problems) {
    for (const tag of p.tags) {
      tagSet.add(tag);
    }
  }

  cachedTagListArr = Array.from(tagSet).sort().map((tag) => ({ id: tag, en: tag }));
  tagListCacheTimestamp = now;
  return cachedTagListArr;
}

interface CfProblem {
  contestId: number;
  index: string;
  name: string;
  rating?: number;
  tags: string[];
}

interface CfProblemStatistic {
  contestId: number;
  index: string;
  solvedCount: number;
}

export interface CfProblemInfo {
  contestId: number;
  index: string;
  name: string;
  rating: number;
  tags: string[];
  solvedCount: number;
}

let cachedProblems: CfProblemInfo[] | null = null;
let cacheTimestamp = 0;

let cachedSolvedMap: Map<string, { data: Set<string>; timestamp: number }> = new Map();

function problemKey(contestId: number, index: string): string {
  return `${contestId}${index}`;
}

export async function fetchAllProblems(): Promise<CfProblemInfo[]> {
  const now = Date.now();
  if (cachedProblems && now - cacheTimestamp < CACHE_TTL) {
    return cachedProblems;
  }

  const response = await axios.get(`${BASE}/problemset.problems`, {
    params: { lang: 'en' },
    timeout: 15000,
  });

  const result = response.data.result;
  const problems: CfProblem[] = result.problems ?? [];
  const statistics: CfProblemStatistic[] = result.problemStatistics ?? [];

  const statsMap = new Map<string, number>();
  for (const stat of statistics) {
    statsMap.set(problemKey(stat.contestId, stat.index), stat.solvedCount);
  }

  const merged: CfProblemInfo[] = problems.map((p) => ({
    contestId: p.contestId,
    index: p.index,
    name: p.name,
    rating: p.rating ?? 0,
    tags: p.tags ?? [],
    solvedCount: statsMap.get(problemKey(p.contestId, p.index)) ?? 0,
  }));

  cachedProblems = merged;
  cacheTimestamp = now;
  return merged;
}

export async function searchProblems(
  query?: string,
  tags?: string[],
  ratingMin?: number,
  ratingMax?: number,
  minSolved?: number,
  limit?: number,
): Promise<ProblemInfo[]> {
  const all = await fetchAllProblems();
  let filtered = all;

  if (query && query.trim().length > 0) {
    const q = query.trim().toLowerCase();
    filtered = filtered.filter((p) => {
      const id = problemKey(p.contestId, p.index).toLowerCase();
      const name = p.name.toLowerCase();
      return name.includes(q) || id.includes(q);
    });
  }

  if (tags && tags.length > 0) {
    filtered = filtered.filter((p) =>
      tags.every((tag) => p.tags.includes(tag)),
    );
  }

  if (ratingMin !== undefined && ratingMin > 0) {
    filtered = filtered.filter((p) => p.rating >= ratingMin);
  }

  if (ratingMax !== undefined && ratingMax > 0) {
    filtered = filtered.filter((p) => p.rating <= ratingMax);
  }

  if (minSolved !== undefined && minSolved > 0) {
    filtered = filtered.filter((p) => p.solvedCount >= minSolved);
  }

  const capped = limit && limit > 0 ? filtered.slice(0, limit) : filtered;

  return capped.map(cfToProblemInfo);
}

export async function randomProblems(
  tags?: string[],
  ratingMin?: number,
  ratingMax?: number,
  minSolved?: number,
  count: number = 1,
): Promise<ProblemInfo[]> {
  const all = await fetchAllProblems();
  let filtered = [...all];

  if (tags && tags.length > 0) {
    filtered = filtered.filter((p) =>
      tags.every((tag) => p.tags.includes(tag)),
    );
  }

  if (ratingMin !== undefined && ratingMin > 0) {
    filtered = filtered.filter((p) => p.rating >= ratingMin);
  }

  if (ratingMax !== undefined && ratingMax > 0) {
    filtered = filtered.filter((p) => p.rating <= ratingMax);
  }

  if (minSolved !== undefined && minSolved > 0) {
    filtered = filtered.filter((p) => p.solvedCount >= minSolved);
  }

  // Fisher-Yates shuffle
  for (let i = filtered.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [filtered[i], filtered[j]] = [filtered[j], filtered[i]];
  }

  return filtered.slice(0, count).map(cfToProblemInfo);
}

export async function fetchSolvedIds(handle: string): Promise<Set<string>> {
  const now = Date.now();
  const cached = cachedSolvedMap.get(handle);
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const response = await axios.get(`${BASE}/user.status`, {
    params: { handle },
    timeout: 15000,
  });

  const submissions: any[] = response.data.result ?? [];
  const solvedSet = new Set<string>();

  for (const sub of submissions) {
    if (sub.verdict === 'OK') {
      const p = sub.problem;
      if (p && p.contestId !== undefined && p.index) {
        solvedSet.add(problemKey(p.contestId, p.index));
      }
    }
  }

  cachedSolvedMap.set(handle, { data: solvedSet, timestamp: now });
  return solvedSet;
}

function ratingToDifficulty(rating: number): string {
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

function cfToProblemInfo(p: CfProblemInfo): ProblemInfo {
  return {
    problemId: problemKey(p.contestId, p.index),
    title: p.name,
    level: p.rating,
    difficulty: p.rating > 0 ? `${p.rating} (${ratingToDifficulty(p.rating)})` : 'Unrated',
    tags: p.tags,
    tagsEn: p.tags,
    acceptedUserCount: p.solvedCount,
  };
}
