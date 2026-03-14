import * as vscode from 'vscode';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { ProblemSource } from '../models/models';

export { browserLogin, BrowserLoginResult } from './browserLogin';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const TIMEOUT = 15000;

// --- Secret Storage ---

let secretStorage: vscode.SecretStorage;

export function initAuthService(context: vscode.ExtensionContext): void {
  secretStorage = context.secrets;
}

// --- Key helpers ---

function cookieKey(source: ProblemSource): string {
  return `codingtestkit.cookies.${source}`;
}

function usernameKey(source: ProblemSource): string {
  return `codingtestkit.username.${source}`;
}

// --- Cookie storage ---

export async function getCookies(source: ProblemSource): Promise<string> {
  return (await secretStorage.get(cookieKey(source))) ?? '';
}

export async function setCookies(source: ProblemSource, cookies: string): Promise<void> {
  await secretStorage.store(cookieKey(source), cookies);
}

// --- Username storage ---

export async function getUsername(source: ProblemSource): Promise<string> {
  return (await secretStorage.get(usernameKey(source))) ?? '';
}

export async function setUsername(source: ProblemSource, username: string): Promise<void> {
  await secretStorage.store(usernameKey(source), username);
}

// --- Logout ---

export async function logout(source: ProblemSource): Promise<void> {
  await secretStorage.delete(cookieKey(source));
  await secretStorage.delete(usernameKey(source));
}

// --- Login check ---

export async function isLoggedIn(source: ProblemSource): Promise<boolean> {
  const cookies = await getCookies(source);
  const username = await getUsername(source);
  return cookies.length > 0 && username.length > 0;
}

// --- Fetch username by scraping each platform ---

export async function fetchUsername(source: ProblemSource, cookies: string): Promise<string> {
  if (!cookies) {
    return '';
  }

  try {
    switch (source) {
      case ProblemSource.BAEKJOON:
        return await fetchBojUsername(cookies);
      case ProblemSource.PROGRAMMERS:
        return await fetchProgrammersUsername(cookies);
      case ProblemSource.SWEA:
        return await fetchSweaUsername(cookies);
      case ProblemSource.LEETCODE:
        return await fetchLeetCodeUsername(cookies);
      case ProblemSource.CODEFORCES:
        return await fetchCodeforcesUsername(cookies);
      default:
        return '';
    }
  } catch {
    return '';
  }
}

async function fetchBojUsername(cookies: string): Promise<string> {
  const response = await axios.get('https://www.acmicpc.net/', {
    headers: { 'User-Agent': UA, Cookie: cookies },
    timeout: TIMEOUT,
    maxRedirects: 5,
    validateStatus: () => true,
  });

  const html: string = typeof response.data === 'string' ? response.data : '';
  const $ = cheerio.load(html);

  // Try the global JS variable a.username
  const scriptMatch = html.match(/a\.username\s*=\s*["']([^"']+)["']/);
  if (scriptMatch && scriptMatch[1]) {
    return scriptMatch[1];
  }

  // Try .loginbar a[href^="/user/"]
  const userLink = $('.loginbar a[href^="/user/"]');
  if (userLink.length > 0) {
    const href = userLink.attr('href') ?? '';
    const match = href.match(/\/user\/([^/?#]+)/);
    if (match) {
      return match[1];
    }
    const text = userLink.text().trim();
    if (text) {
      return text;
    }
  }

  return '';
}

async function fetchProgrammersUsername(cookies: string): Promise<string> {
  const response = await axios.get('https://school.programmers.co.kr/', {
    headers: { 'User-Agent': UA, Cookie: cookies },
    timeout: TIMEOUT,
    maxRedirects: 5,
    validateStatus: () => true,
  });

  const html: string = typeof response.data === 'string' ? response.data : '';
  const $ = cheerio.load(html);

  const selectors = ['.header-user-name', '.user-name', '.nav-user-name'];
  for (const selector of selectors) {
    const el = $(selector);
    if (el.length > 0) {
      const text = el.text().trim();
      if (text) {
        return text;
      }
    }
  }

  return '';
}

async function fetchSweaUsername(cookies: string): Promise<string> {
  const response = await axios.get('https://swexpertacademy.com/main/main.do', {
    headers: { 'User-Agent': UA, Cookie: cookies },
    timeout: TIMEOUT,
    maxRedirects: 5,
    validateStatus: () => true,
  });

  const html: string = typeof response.data === 'string' ? response.data : '';
  const $ = cheerio.load(html);

  const selectors = ['.user_name', '.member_name', '#userName'];
  for (const selector of selectors) {
    const el = $(selector);
    if (el.length > 0) {
      const text = el.text().trim();
      if (text) {
        return text;
      }
    }
  }

  return '';
}

async function fetchLeetCodeUsername(cookies: string): Promise<string> {
  const query = '{ userStatus { username } }';

  const response = await axios.post(
    'https://leetcode.com/graphql/',
    { query },
    {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': UA,
        Cookie: cookies,
        Referer: 'https://leetcode.com',
        Origin: 'https://leetcode.com',
      },
      timeout: TIMEOUT,
      validateStatus: () => true,
    },
  );

  const data = response.data;
  const username: string = data?.data?.userStatus?.username ?? '';
  return username;
}

async function fetchCodeforcesUsername(cookies: string): Promise<string> {
  const response = await axios.get('https://codeforces.com/', {
    headers: { 'User-Agent': UA, Cookie: cookies },
    timeout: TIMEOUT,
    maxRedirects: 5,
    validateStatus: () => true,
  });

  const html: string = typeof response.data === 'string' ? response.data : '';
  const $ = cheerio.load(html);

  const profileLink = $('a[href^="/profile/"]');
  if (profileLink.length > 0) {
    const href = profileLink.attr('href') ?? '';
    const match = href.match(/\/profile\/([^/?#]+)/);
    if (match) {
      return match[1];
    }
    const text = profileLink.text().trim();
    if (text) {
      return text;
    }
  }

  return '';
}

// --- Login URLs ---

export function getLoginUrl(source: ProblemSource): string {
  switch (source) {
    case ProblemSource.BAEKJOON:
      return 'https://www.acmicpc.net/login';
    case ProblemSource.PROGRAMMERS:
      return 'https://programmers.co.kr/account/sign_in?referer=https://school.programmers.co.kr/';
    case ProblemSource.SWEA:
      return 'https://swexpertacademy.com/main/identity/anonymous/loginPage.do';
    case ProblemSource.LEETCODE:
      return 'https://leetcode.com/accounts/login/';
    case ProblemSource.CODEFORCES:
      return 'https://codeforces.com/enter';
    default:
      return '';
  }
}

// --- Direct login (form-based) ---

export function isDirectLoginSupported(source: ProblemSource): boolean {
  // BOJ: reCAPTCHA blocks direct login
  // LeetCode: bot protection blocks direct login
  return source === ProblemSource.CODEFORCES
    || source === ProblemSource.SWEA;
}

export async function directLogin(
  source: ProblemSource,
  username: string,
  password: string,
): Promise<{ success: boolean; cookies: string; error?: string }> {
  switch (source) {
    case ProblemSource.BAEKJOON:
      return directLoginBoj(username, password);
    case ProblemSource.CODEFORCES:
      return directLoginCf(username, password);
    case ProblemSource.LEETCODE:
      return directLoginLeetCode(username, password);
    case ProblemSource.SWEA:
      return directLoginSwea(username, password);
    default:
      return { success: false, cookies: '', error: 'Direct login not supported for this platform.' };
  }
}

async function directLoginBoj(
  username: string,
  password: string,
): Promise<{ success: boolean; cookies: string; error?: string }> {
  try {
    // Step 1: Get login page to extract CSRF token
    const loginPageRes = await axios.get('https://www.acmicpc.net/login', {
      headers: { 'User-Agent': UA },
      timeout: TIMEOUT,
      maxRedirects: 5,
      validateStatus: () => true,
    });

    const $ = cheerio.load(loginPageRes.data);
    const csrfToken = $('input[name="csrf_key"]').val() as string || '';

    // Collect cookies from the login page response
    const pageCookies = extractSetCookies(loginPageRes.headers['set-cookie']);

    // Step 2: POST login credentials
    const formData = new URLSearchParams();
    formData.set('login_user_id', username);
    formData.set('login_password', password);
    if (csrfToken) {
      formData.set('csrf_key', csrfToken);
    }
    formData.set('auto_login', '');

    const loginRes = await axios.post('https://www.acmicpc.net/signin', formData.toString(), {
      headers: {
        'User-Agent': UA,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': pageCookies,
        'Referer': 'https://www.acmicpc.net/login',
        'Origin': 'https://www.acmicpc.net',
      },
      timeout: TIMEOUT,
      maxRedirects: 0,
      validateStatus: () => true,
    });

    // Merge cookies from login response
    const loginCookies = extractSetCookies(loginRes.headers['set-cookie']);
    const allCookies = mergeCookies(pageCookies, loginCookies);

    // Check if login succeeded (302 redirect to / or has OnlineJudge cookie)
    if (loginRes.status === 302 || allCookies.includes('OnlineJudge')) {
      return { success: true, cookies: allCookies };
    }

    return { success: false, cookies: '', error: 'Invalid credentials' };
  } catch (err: any) {
    return { success: false, cookies: '', error: err?.message || 'Login request failed' };
  }
}

async function directLoginCf(
  handleOrEmail: string,
  password: string,
): Promise<{ success: boolean; cookies: string; error?: string }> {
  try {
    // Step 1: Get the login page to extract CSRF token and cookies
    const enterPageRes = await axios.get('https://codeforces.com/enter', {
      headers: { 'User-Agent': UA },
      timeout: TIMEOUT,
      maxRedirects: 5,
      validateStatus: () => true,
    });

    const $ = cheerio.load(enterPageRes.data);
    const csrfToken = $('input[name="csrf_token"]').val() as string
      || $('meta[name="X-Csrf-Token"]').attr('content') || '';

    const pageCookies = extractSetCookies(enterPageRes.headers['set-cookie']);

    // Step 2: POST login credentials
    const formData = new URLSearchParams();
    formData.set('csrf_token', csrfToken);
    formData.set('action', 'enter');
    formData.set('ftaa', '');
    formData.set('bfaa', '');
    formData.set('handleOrEmail', handleOrEmail);
    formData.set('password', password);
    formData.set('remember', 'on');

    const loginRes = await axios.post('https://codeforces.com/enter', formData.toString(), {
      headers: {
        'User-Agent': UA,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': pageCookies,
        'Referer': 'https://codeforces.com/enter',
        'Origin': 'https://codeforces.com',
      },
      timeout: TIMEOUT,
      maxRedirects: 0,
      validateStatus: () => true,
    });

    const loginCookies = extractSetCookies(loginRes.headers['set-cookie']);
    const allCookies = mergeCookies(pageCookies, loginCookies);

    // 302 redirect means success
    if (loginRes.status === 302) {
      return { success: true, cookies: allCookies };
    }

    return { success: false, cookies: '', error: 'Invalid credentials' };
  } catch (err: any) {
    return { success: false, cookies: '', error: err?.message || 'Login request failed' };
  }
}

async function directLoginLeetCode(
  username: string,
  password: string,
): Promise<{ success: boolean; cookies: string; error?: string }> {
  try {
    // Step 1: GET login page to obtain csrftoken cookie
    const loginPageRes = await axios.get('https://leetcode.com/accounts/login/', {
      headers: { 'User-Agent': UA },
      timeout: TIMEOUT,
      maxRedirects: 5,
      validateStatus: () => true,
    });

    const pageCookies = extractSetCookies(loginPageRes.headers['set-cookie']);

    // Extract csrftoken value from cookies
    const csrfMatch = pageCookies.match(/csrftoken=([^;]+)/);
    const csrfToken = csrfMatch ? csrfMatch[1] : '';

    // Step 2: POST login credentials
    const formData = new URLSearchParams();
    formData.set('login', username);
    formData.set('password', password);
    formData.set('csrfmiddlewaretoken', csrfToken);

    const loginRes = await axios.post('https://leetcode.com/accounts/login/', formData.toString(), {
      headers: {
        'User-Agent': UA,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': pageCookies,
        'Referer': 'https://leetcode.com/accounts/login/',
        'Origin': 'https://leetcode.com',
      },
      timeout: TIMEOUT,
      maxRedirects: 0,
      validateStatus: () => true,
    });

    const loginCookies = extractSetCookies(loginRes.headers['set-cookie']);
    const allCookies = mergeCookies(pageCookies, loginCookies);

    // Success if redirected or LEETCODE_SESSION cookie is present
    if (loginRes.status === 302 || allCookies.includes('LEETCODE_SESSION')) {
      return { success: true, cookies: allCookies };
    }

    return { success: false, cookies: '', error: 'Invalid credentials' };
  } catch (err: any) {
    return { success: false, cookies: '', error: err?.message || 'Login request failed' };
  }
}

async function directLoginSwea(
  userId: string,
  password: string,
): Promise<{ success: boolean; cookies: string; error?: string }> {
  try {
    // POST login credentials directly
    const formData = new URLSearchParams();
    formData.set('userId', userId);
    formData.set('userPwd', password);

    const loginRes = await axios.post(
      'https://swexpertacademy.com/main/identity/anonymous/loginProc.do',
      formData.toString(),
      {
        headers: {
          'User-Agent': UA,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': 'https://swexpertacademy.com/main/identity/anonymous/loginPage.do',
        },
        timeout: TIMEOUT,
        maxRedirects: 0,
        validateStatus: () => true,
      },
    );

    const loginCookies = extractSetCookies(loginRes.headers['set-cookie']);

    // Success if we received session cookies or got a redirect
    if (loginRes.status === 302 || loginCookies.length > 0) {
      return { success: true, cookies: loginCookies };
    }

    return { success: false, cookies: '', error: 'Invalid credentials' };
  } catch (err: any) {
    return { success: false, cookies: '', error: err?.message || 'Login request failed' };
  }
}

function extractSetCookies(setCookieHeaders: string[] | undefined): string {
  if (!setCookieHeaders) { return ''; }
  const cookies: string[] = [];
  for (const header of setCookieHeaders) {
    const nameValue = header.split(';')[0].trim();
    if (nameValue) {
      cookies.push(nameValue);
    }
  }
  return cookies.join('; ');
}

function mergeCookies(existing: string, incoming: string): string {
  const map = new Map<string, string>();
  for (const part of existing.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) { continue; }
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      map.set(trimmed.substring(0, eqIdx), trimmed);
    }
  }
  for (const part of incoming.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) { continue; }
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      map.set(trimmed.substring(0, eqIdx), trimmed);
    }
  }
  return Array.from(map.values()).join('; ');
}

// --- Session validation ---

export async function validateSession(source: ProblemSource): Promise<boolean> {
  const cookies = await getCookies(source);
  if (!cookies) {
    return false;
  }

  const username = await fetchUsername(source, cookies);
  if (!username) {
    await logout(source);
    return false;
  }

  await setUsername(source, username);
  return true;
}
