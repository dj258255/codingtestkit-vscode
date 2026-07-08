import * as vscode from 'vscode';
import { detectChromiumBrowser } from './browserLogin';

// Cookies earned by passing a Cloudflare challenge (cf_clearance) are tied to
// the User-Agent that earned them, so both are persisted together. Reusing
// them lets the next fetch go straight over HTTP instead of launching a
// browser and sitting through the challenge again.
const CLEARANCE_KEY = 'codingtestkit.cfClearance';

interface ClearanceRecord {
  cookieHeader: string;
  userAgent: string;
  savedAt: number;
}

let globalState: vscode.Memento | undefined;

export function initBrowserFetch(context: vscode.ExtensionContext): void {
  globalState = context.globalState;
}

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function getSavedClearance(url: string): ClearanceRecord | null {
  const origin = originOf(url);
  if (!origin || !globalState) { return null; }
  const all = globalState.get<Record<string, ClearanceRecord>>(CLEARANCE_KEY) ?? {};
  return all[origin] ?? null;
}

function saveClearance(url: string, record: ClearanceRecord): void {
  const origin = originOf(url);
  if (!origin || !globalState) { return; }
  const all = globalState.get<Record<string, ClearanceRecord>>(CLEARANCE_KEY) ?? {};
  all[origin] = record;
  globalState.update(CLEARANCE_KEY, all);
}

// Fetches a page's HTML with the user's own Chromium browser, waiting for a
// selector to appear. Used when direct HTTP requests are blocked by
// Cloudflare: a real browser passes the JS challenge, an HTTP client cannot.
// Returns null when no browser/puppeteer is available or the selector never
// shows up — callers should fall back to whatever degraded path they have.
// On success, the challenge cookies + UA are saved so getSavedClearance()
// can skip the browser next time.
export async function fetchHtmlViaBrowser(
  url: string,
  waitSelector: string,
  timeoutMs: number = 60000,
): Promise<string | null> {
  const executablePath = await detectChromiumBrowser();
  if (!executablePath) { return null; }

  let puppeteer: any;
  try {
    puppeteer = require('puppeteer-core');
  } catch {
    return null;
  }

  let browser: any;
  try {
    browser = await puppeteer.launch({
      executablePath,
      // Cloudflare blocks headless browsers, so a real window is required.
      // Park it offscreen where the OS allows negative coordinates.
      headless: false,
      defaultViewport: { width: 1200, height: 800 },
      args: [
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-extensions',
        '--disable-blink-features=AutomationControlled',
        '--window-position=-2400,-2400',
        '--window-size=1200,800',
      ],
    });

    const pages = await browser.pages();
    const page = pages[0] || await browser.newPage();

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    } catch {
      // The Cloudflare interstitial can interrupt navigation; keep polling below
    }

    // Poll instead of waitForSelector: the challenge page navigates while it
    // resolves, which would abort a pending waitForSelector.
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const found = await page.$(waitSelector);
        if (found) {
          await persistClearance(browser, page, url);
          return await page.content();
        }
      } catch {
        // Navigation in flight — retry on the next tick
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    return null;
  } catch {
    return null;
  } finally {
    try { await browser?.close(); } catch { /* ignore */ }
  }
}

async function persistClearance(browser: any, page: any, url: string): Promise<void> {
  try {
    // The launch uses a fresh profile, so page.cookies() holds only what this
    // site set during the challenge (cf_clearance and friends) — safe to
    // replay wholesale on future HTTP requests.
    const cookies: Array<{ name: string; value: string }> = await page.cookies(url);
    if (!cookies || cookies.length === 0) { return; }
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
    const userAgent: string = await browser.userAgent();
    saveClearance(url, { cookieHeader, userAgent, savedAt: Date.now() });
  } catch {
    // Cookie capture is a best-effort speedup — never fail the fetch over it
  }
}
