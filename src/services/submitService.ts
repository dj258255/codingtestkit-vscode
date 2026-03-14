import axios from 'axios';
import * as cheerio from 'cheerio';
import { ProblemSource, Language, LanguageInfo } from '../models/models';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const TIMEOUT = 30000;

// --- Language mapping for Programmers ---

const PROGRAMMERS_LANG_MAP: Record<Language, string> = {
  [Language.JAVA]: 'java',
  [Language.PYTHON]: 'python3',
  [Language.CPP]: 'cpp',
  [Language.KOTLIN]: 'kotlin',
  [Language.JAVASCRIPT]: 'javascript',
};

// --- Main entry point ---

export async function submitCode(
  source: ProblemSource,
  problemId: string,
  code: string,
  language: Language,
  cookies: string,
  contestProbId?: string,
): Promise<{ success: boolean; message: string }> {
  switch (source) {
    case ProblemSource.BAEKJOON:
      return submitBaekjoon(problemId, code, language, cookies);
    case ProblemSource.PROGRAMMERS:
      return submitProgrammers(problemId, code, language, cookies);
    case ProblemSource.SWEA:
      return submitSwea(problemId, code, language, cookies, contestProbId);
    case ProblemSource.LEETCODE:
      return {
        success: false,
        message: 'LeetCode submission is not supported via this extension. Please submit via browser at https://leetcode.com',
      };
    case ProblemSource.CODEFORCES:
      return {
        success: false,
        message: 'Codeforces submission is not supported via this extension. Please submit via browser at https://codeforces.com',
      };
    default:
      return { success: false, message: `Unsupported platform: ${source}` };
  }
}

// --- Baekjoon Submit ---

function extractCsrfKey($: cheerio.CheerioAPI, html: string): string | null {
  // Priority 1: form#submit_form input[name=csrf_key]
  const formInput = $('form#submit_form input[name=csrf_key]').val();
  if (formInput && typeof formInput === 'string' && formInput.trim()) {
    return formInput.trim();
  }

  // Priority 2: any input[name=csrf_key]
  const anyInput = $('input[name=csrf_key]').val();
  if (anyInput && typeof anyInput === 'string' && anyInput.trim()) {
    return anyInput.trim();
  }

  // Priority 3: JS patterns in scripts
  const jsPatterns = [
    /csrf_key\s*[=:]\s*["']([^"']+)["']/,
    /csrfKey\s*[=:]\s*["']([^"']+)["']/,
    /csrf[_-]?token\s*[=:]\s*["']([^"']+)["']/,
  ];

  $('script').each((_i, el) => {
    const scriptContent = $(el).html();
    if (!scriptContent) {
      return;
    }
    for (const pattern of jsPatterns) {
      const match = scriptContent.match(pattern);
      if (match && match[1]) {
        return false; // break
      }
    }
  });

  // Re-scan with full HTML for JS patterns
  for (const pattern of jsPatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  // Priority 4: meta[name=csrf-token]
  const metaCsrfToken = $('meta[name=csrf-token]').attr('content');
  if (metaCsrfToken && metaCsrfToken.trim()) {
    return metaCsrfToken.trim();
  }

  // Priority 5: meta[name=csrf_token]
  const metaCsrfTokenUnderscore = $('meta[name=csrf_token]').attr('content');
  if (metaCsrfTokenUnderscore && metaCsrfTokenUnderscore.trim()) {
    return metaCsrfTokenUnderscore.trim();
  }

  return null;
}

function mergeCookies(existingCookies: string, responseCookies: string[]): string {
  const cookieMap = new Map<string, string>();

  // Parse existing cookies
  if (existingCookies) {
    for (const part of existingCookies.split(';')) {
      const trimmed = part.trim();
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const name = trimmed.substring(0, eqIdx).trim();
        const value = trimmed.substring(eqIdx + 1).trim();
        cookieMap.set(name, value);
      }
    }
  }

  // Parse response Set-Cookie headers and merge
  for (const setCookie of responseCookies) {
    const firstPart = setCookie.split(';')[0].trim();
    const eqIdx = firstPart.indexOf('=');
    if (eqIdx > 0) {
      const name = firstPart.substring(0, eqIdx).trim();
      const value = firstPart.substring(eqIdx + 1).trim();
      cookieMap.set(name, value);
    }
  }

  return Array.from(cookieMap.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

async function submitBaekjoon(
  problemId: string,
  code: string,
  language: Language,
  cookies: string,
): Promise<{ success: boolean; message: string }> {
  const submitUrl = `https://www.acmicpc.net/submit/${problemId}`;

  try {
    // Step 1: GET the submit page to extract CSRF key
    const getResponse = await axios.get(submitUrl, {
      headers: {
        'User-Agent': UA,
        'Cookie': cookies,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      timeout: TIMEOUT,
      maxRedirects: 5,
      validateStatus: () => true,
    });

    const responseUrl: string = getResponse.request?.res?.responseUrl
      ?? getResponse.request?.responseURL
      ?? submitUrl;

    // Check for login redirect
    if (responseUrl.includes('/login') || responseUrl.includes('/signin')) {
      return {
        success: false,
        message: 'Login required. Please log in to Baekjoon first.',
      };
    }

    const html: string = typeof getResponse.data === 'string' ? getResponse.data : '';
    const $ = cheerio.load(html);

    const csrfKey = extractCsrfKey($, html);
    if (!csrfKey) {
      return {
        success: false,
        message: 'Failed to extract CSRF key from Baekjoon. Your session may have expired.',
      };
    }

    // Merge response cookies
    const responseCookies: string[] = getResponse.headers['set-cookie'] ?? [];
    const mergedCookies = mergeCookies(cookies, responseCookies);

    // Step 2: POST submit
    const langInfo = LanguageInfo[language];
    const formData = new URLSearchParams();
    formData.append('problem_id', problemId);
    formData.append('language', String(langInfo.baekjoonId));
    formData.append('code_open', 'open');
    formData.append('source', code);
    formData.append('csrf_key', csrfKey);

    const postResponse = await axios.post(submitUrl, formData.toString(), {
      headers: {
        'User-Agent': UA,
        'Cookie': mergedCookies,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': submitUrl,
        'Origin': 'https://www.acmicpc.net',
      },
      timeout: TIMEOUT,
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 400,
    });

    // A successful submit typically redirects (302) to the status page
    const statusCode = postResponse.status;
    if (statusCode === 302 || statusCode === 301) {
      return {
        success: true,
        message: `Code submitted successfully to Baekjoon (problem ${problemId}). Check your submission status on the website.`,
      };
    }

    // If we got a 200, check if it's the status page (success) or the submit page (error)
    const postHtml: string = typeof postResponse.data === 'string' ? postResponse.data : '';
    if (postHtml.includes('status-table') || postHtml.includes('solution-list')) {
      return {
        success: true,
        message: `Code submitted successfully to Baekjoon (problem ${problemId}). Check your submission status on the website.`,
      };
    }

    return {
      success: true,
      message: `Code submitted to Baekjoon (problem ${problemId}). Check your submission status on the website.`,
    };
  } catch (err: any) {
    // Redirect response (3xx) from axios with maxRedirects: 0 throws an error
    if (err?.response?.status === 302 || err?.response?.status === 301) {
      return {
        success: true,
        message: `Code submitted successfully to Baekjoon (problem ${problemId}). Check your submission status on the website.`,
      };
    }

    const statusCode = err?.response?.status;
    if (statusCode === 403) {
      return {
        success: false,
        message: 'Submission rejected (403 Forbidden). Your session may have expired. Please log in again.',
      };
    }

    return {
      success: false,
      message: `Baekjoon submission failed: ${err?.message ?? 'Unknown error'}`,
    };
  }
}

// --- Programmers Submit ---

async function submitProgrammers(
  lessonId: string,
  code: string,
  language: Language,
  cookies: string,
): Promise<{ success: boolean; message: string }> {
  const submitUrl = `https://school.programmers.co.kr/learn/courses/30/lessons/${lessonId}/submit`;
  const langSlug = PROGRAMMERS_LANG_MAP[language];

  if (!langSlug) {
    return {
      success: false,
      message: `Language ${language} is not supported on Programmers.`,
    };
  }

  try {
    const formData = new URLSearchParams();
    formData.append('code', code);
    formData.append('language', langSlug);

    const response = await axios.post(submitUrl, formData.toString(), {
      headers: {
        'User-Agent': UA,
        'Cookie': cookies,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json',
        'Referer': `https://school.programmers.co.kr/learn/courses/30/lessons/${lessonId}`,
        'Origin': 'https://school.programmers.co.kr',
      },
      timeout: TIMEOUT,
      validateStatus: () => true,
    });

    const statusCode = response.status;

    if (statusCode === 401 || statusCode === 403) {
      return {
        success: false,
        message: 'Login required. Please log in to Programmers first.',
      };
    }

    if (statusCode >= 200 && statusCode < 300) {
      const data = response.data;
      if (data && typeof data === 'object') {
        if (data.error) {
          return {
            success: false,
            message: `Programmers submission error: ${data.error}`,
          };
        }
        return {
          success: true,
          message: `Code submitted successfully to Programmers (lesson ${lessonId}). Check your results on the website.`,
        };
      }
      return {
        success: true,
        message: `Code submitted to Programmers (lesson ${lessonId}). Check your results on the website.`,
      };
    }

    return {
      success: false,
      message: `Programmers submission failed with status ${statusCode}.`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Programmers submission failed: ${err?.message ?? 'Unknown error'}`,
    };
  }
}

// --- SWEA Submit ---

async function submitSwea(
  problemId: string,
  code: string,
  language: Language,
  cookies: string,
  contestProbId?: string,
): Promise<{ success: boolean; message: string }> {
  const submitUrl = 'https://swexpertacademy.com/main/code/problem/problemSubmit.do';
  const langInfo = LanguageInfo[language];

  if (langInfo.sweaId < 0) {
    return {
      success: false,
      message: `Language ${language} is not supported on SWEA.`,
    };
  }

  const effectiveContestProbId = contestProbId || problemId;

  try {
    const formData = new URLSearchParams();
    formData.append('contestProbId', effectiveContestProbId);
    formData.append('language', String(langInfo.sweaId));
    formData.append('source', code);

    const response = await axios.post(submitUrl, formData.toString(), {
      headers: {
        'User-Agent': UA,
        'Cookie': cookies,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': 'https://swexpertacademy.com/main/code/problem/problemDetail.do',
        'Origin': 'https://swexpertacademy.com',
      },
      timeout: TIMEOUT,
      validateStatus: () => true,
    });

    const statusCode = response.status;

    if (statusCode === 401 || statusCode === 403) {
      return {
        success: false,
        message: 'Login required. Please log in to SWEA first.',
      };
    }

    if (statusCode >= 200 && statusCode < 300) {
      return {
        success: true,
        message: `Code submitted successfully to SWEA (problem ${problemId}). Check your submission status on the website.`,
      };
    }

    // Handle redirects as success (SWEA may redirect on successful submission)
    if (statusCode === 302 || statusCode === 301) {
      return {
        success: true,
        message: `Code submitted successfully to SWEA (problem ${problemId}). Check your submission status on the website.`,
      };
    }

    return {
      success: false,
      message: `SWEA submission failed with status ${statusCode}.`,
    };
  } catch (err: any) {
    if (err?.response?.status === 302 || err?.response?.status === 301) {
      return {
        success: true,
        message: `Code submitted successfully to SWEA (problem ${problemId}). Check your submission status on the website.`,
      };
    }

    return {
      success: false,
      message: `SWEA submission failed: ${err?.message ?? 'Unknown error'}`,
    };
  }
}
