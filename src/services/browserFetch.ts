import { detectChromiumBrowser } from './browserLogin';

// Fetches a page's HTML with the user's own Chromium browser, waiting for a
// selector to appear. Used when direct HTTP requests are blocked by
// Cloudflare: a real browser passes the JS challenge, an HTTP client cannot.
// Returns null when no browser/puppeteer is available or the selector never
// shows up — callers should fall back to whatever degraded path they have.
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
