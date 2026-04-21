import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';
import * as puppeteer from 'puppeteer-core';
import { ProblemSource } from '../models/models';
import { getLoginUrl } from './authService';

// Shared browser profile directory — cookies persist between login and submit
export function getBrowserProfileDir(): string {
  const dir = path.join(os.homedir(), '.codingtestkit', 'chromium-profile');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export interface BrowserLoginResult {
  success: boolean;
  cookies?: string;
  username?: string;
  error?: 'NO_BROWSER' | 'USER_CLOSED' | 'TIMEOUT' | 'UNKNOWN';
}

// --- Browser detection ---

let cachedBrowserPath: string | null | undefined;

const CHROME_PATHS: Record<string, string[]> = {
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ],
  win32: [
    path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
  ],
  linux: [
    '/opt/google/chrome/chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/microsoft-edge',
    '/usr/bin/microsoft-edge-stable',
    '/usr/bin/brave-browser',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ],
};

export async function detectChromiumBrowser(): Promise<string | null> {
  if (cachedBrowserPath !== undefined) {
    return cachedBrowserPath;
  }

  const platform = process.platform;
  const paths = CHROME_PATHS[platform] || CHROME_PATHS.linux;

  for (const p of paths) {
    try {
      await fs.promises.access(p, fs.constants.X_OK);
      cachedBrowserPath = p;
      return p;
    } catch {
      // not found, try next
    }
  }

  // Linux: fallback to `which`
  if (platform === 'linux') {
    const candidates = ['google-chrome', 'google-chrome-stable', 'microsoft-edge', 'brave-browser', 'chromium', 'chromium-browser'];
    for (const cmd of candidates) {
      try {
        const result = execFileSync('which', [cmd], { encoding: 'utf8', timeout: 3000 }).trim();
        if (result) {
          cachedBrowserPath = result;
          return result;
        }
      } catch {
        // not found
      }
    }
  }

  cachedBrowserPath = null;
  return null;
}

// --- Login URL detection ---

export function isLoggedInUrl(source: ProblemSource, url: string): boolean {
  const lowerUrl = url.toLowerCase();

  switch (source) {
    case ProblemSource.PROGRAMMERS:
      return lowerUrl.includes('programmers.co.kr')
        && !lowerUrl.includes('/sign_in')
        && !lowerUrl.includes('/login');

    case ProblemSource.SWEA:
      return lowerUrl.includes('swexpertacademy')
        && !lowerUrl.includes('login')
        && !lowerUrl.includes('signup');

    case ProblemSource.LEETCODE:
      return lowerUrl.includes('leetcode.com')
        && !lowerUrl.includes('/accounts/login')
        && !lowerUrl.includes('/accounts/signup');

    case ProblemSource.CODEFORCES:
      return lowerUrl.includes('codeforces.com')
        && !lowerUrl.includes('/enter')
        && !lowerUrl.includes('/register');

    default:
      return false;
  }
}

// --- Relevant cookie domains per platform ---

function getRelevantDomains(source: ProblemSource): string[] {
  switch (source) {
    case ProblemSource.PROGRAMMERS:
      return ['programmers.co.kr'];
    case ProblemSource.SWEA:
      return ['swexpertacademy.com'];
    case ProblemSource.LEETCODE:
      return ['leetcode.com'];
    case ProblemSource.CODEFORCES:
      return ['codeforces.com'];
    default:
      return [];
  }
}

// --- Username extraction from DOM ---

async function extractUsernameFromPage(source: ProblemSource, page: any): Promise<string> {
  try {
    switch (source) {
      case ProblemSource.PROGRAMMERS:
        return await page.evaluate(() => {
          for (const sel of ['.header-user-name', '.user-name', '.nav-user-name']) {
            const el = document.querySelector(sel);
            if (el?.textContent?.trim()) { return el.textContent.trim(); }
          }
          return '';
        });

      case ProblemSource.SWEA:
        return await page.evaluate(() => {
          for (const sel of ['.user_name', '.member_name', '#userName']) {
            const el = document.querySelector(sel);
            if (el?.textContent?.trim()) { return el.textContent.trim(); }
          }
          return '';
        });

      case ProblemSource.LEETCODE:
        return await page.evaluate(() => {
          const link = document.querySelector('a[href^="/u/"], a[href^="/profile/"]');
          if (link) {
            const match = link.getAttribute('href')?.match(/\/(?:u|profile)\/([^/?#]+)/);
            if (match) { return match[1]; }
          }
          return '';
        });

      case ProblemSource.CODEFORCES:
        return await page.evaluate(() => {
          const link = document.querySelector('a[href^="/profile/"]');
          if (link) {
            const match = link.getAttribute('href')?.match(/\/profile\/([^/?#]+)/);
            if (match) { return match[1]; }
            return link.textContent?.trim() || '';
          }
          return '';
        });

      default:
        return '';
    }
  } catch {
    return '';
  }
}

// --- Main browser login ---

export async function browserLogin(
  source: ProblemSource,
  onCancel?: () => void,
): Promise<BrowserLoginResult> {
  const executablePath = await detectChromiumBrowser();
  if (!executablePath) {
    console.warn('[CodingTestKit] No Chromium browser found');
    return { success: false, error: 'NO_BROWSER' };
  }

  console.log('[CodingTestKit] Using browser:', executablePath);

  const loginUrl = getLoginUrl(source);
  let browser: any;

  try {
    browser = await puppeteer.launch({
      executablePath,
      headless: false,
      defaultViewport: { width: 900, height: 700 },
      args: [
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-extensions',
        '--disable-blink-features=AutomationControlled',
      ],
    });

    const pages = await browser.pages();
    const page = pages[0] || await browser.newPage();
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });

    return await new Promise<BrowserLoginResult>((resolve) => {
      let resolved = false;
      const done = (result: BrowserLoginResult) => {
        if (resolved) { return; }
        resolved = true;
        clearInterval(pollInterval);
        clearTimeout(timeout);
        browser?.close().catch(() => {});
        resolve(result);
      };

      // User closed browser
      browser.on('disconnected', () => {
        done({ success: false, error: 'USER_CLOSED' });
      });

      // VS Code cancel button
      if (onCancel) {
        const origCancel = onCancel;
        onCancel = () => {
          done({ success: false, error: 'USER_CLOSED' });
          origCancel();
        };
      }

      // URL monitor via framenavigated + polling
      const checkUrl = async () => {
        try {
          const currentUrl = page.url();
          if (isLoggedInUrl(source, currentUrl)) {
            // Wait for page to settle after redirect
            await new Promise(r => setTimeout(r, 500));

            // Extract ALL cookies via CDP (not just current page domain)
            const cdp = await page.createCDPSession();
            const { cookies: allCookies } = await cdp.send('Network.getAllCookies');
            await cdp.detach();

            // Filter to relevant domains only
            const relevantDomains = getRelevantDomains(source);
            const filtered = allCookies.filter((c: any) =>
              relevantDomains.some((d: string) => c.domain.endsWith(d))
            );

            const cookieStr = filtered
              .map((c: any) => `${c.name}=${c.value}`)
              .join('; ');

            // Extract username from DOM
            const username = await extractUsernameFromPage(source, page);

            done({ success: true, cookies: cookieStr, username });
          }
        } catch {
          // page might be navigating
        }
      };

      page.on('framenavigated', () => {
        setTimeout(checkUrl, 300);
      });

      const pollInterval = setInterval(checkUrl, 2000);

      // 5 minute timeout
      const timeout = setTimeout(() => {
        done({ success: false, error: 'TIMEOUT' });
      }, 5 * 60 * 1000);
    });
  } catch (err) {
    console.error('[CodingTestKit] Browser login failed:', err);
    browser?.close().catch(() => {});
    return { success: false, error: 'UNKNOWN' };
  }
}
