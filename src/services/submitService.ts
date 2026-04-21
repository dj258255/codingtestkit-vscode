import axios from 'axios';
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
