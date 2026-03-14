import axios from 'axios';
import * as AdmZip from 'adm-zip';
import { Problem, ProblemSource, TestCase } from '../models/models';
import { resolveContestProbId } from './swexpertApi';
import { detectChromiumBrowser } from './browserLogin';
import { t } from './i18n';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const SWEA_BASE = 'https://swexpertacademy.com';
const DETAIL_URL = `${SWEA_BASE}/main/code/problem/problemDetail.do`;

// Known download URL patterns for test data files
const DOWNLOAD_PATTERNS = [
  (cpId: string) => ({
    input: `${SWEA_BASE}/main/common/contestProb/contestProbDown.do?downType=in&contestProbId=${cpId}`,
    output: `${SWEA_BASE}/main/common/contestProb/contestProbDown.do?downType=out&contestProbId=${cpId}`,
  }),
  (cpId: string) => ({
    input: `${SWEA_BASE}/main/code/problem/problemSampleDown.do?contestProbId=${cpId}&type=input`,
    output: `${SWEA_BASE}/main/code/problem/problemSampleDown.do?contestProbId=${cpId}&type=output`,
  }),
  (cpId: string) => ({
    input: `${SWEA_BASE}/main/code/problem/problemSampleDownload.do?contestProbId=${cpId}&type=input`,
    output: `${SWEA_BASE}/main/code/problem/problemSampleDownload.do?contestProbId=${cpId}&type=output`,
  }),
];

interface ListInfo {
  contestProbId: string;
  title: string;
  difficulty: string;
  number: string;
}

interface PuppeteerDetail {
  title: string;
  number: string;
  description: string;
  timeLimit: string;
  memoryLimit: string;
  sampleTestCases: { input: string; output: string }[];
}

/**
 * Parse user input to extract the problem ID.
 * Accepts: "19185", "AYzIZNkq-v4DFAQ9", or full URL with contestProbId param.
 */
function parseInput(input: string): string {
  // Full URL: extract contestProbId query param
  if (input.includes('swexpertacademy.com')) {
    const match = input.match(/contestProbId=([A-Za-z0-9_\-]+)/);
    if (match) { return match[1]; }
  }
  return input.trim();
}

/**
 * Fetch a SWEA problem by its number (e.g., "19185"), contestProbId, or URL.
 */
export async function fetchSweaProblem(problemId: string, cookies: string = ''): Promise<Problem> {
  if (!cookies) {
    throw new Error(t('SWEA 로그인이 필요합니다. 설정에서 SWEA 계정으로 로그인해주세요.', 'SWEA login required. Please log in with your SWEA account in settings.'));
  }

  const parsed = parseInput(problemId);
  const headers: Record<string, string> = {
    'User-Agent': UA,
    'Cookie': cookies,
  };

  // Step 1: Resolve contestProbId and basic info
  const isNumeric = /^\d+$/.test(parsed);
  let listInfo: ListInfo | null = null;

  if (isNumeric) {
    listInfo = await resolveContestProbId(parsed);
  }

  const contestProbId = listInfo?.contestProbId || parsed;
  let title = listInfo?.title || '';
  let difficulty = listInfo?.difficulty || 'Unrated';
  let problemNumber = listInfo?.number || (isNumeric ? parsed : '');

  // Step 2: Try puppeteer to render the SPA and extract real content
  let description = '';
  let timeLimit = '';
  let memoryLimit = '';

  let puppeteerDetail: PuppeteerDetail | null = null;
  try {
    puppeteerDetail = await fetchDetailViaPuppeteer(contestProbId, cookies);
  } catch (err: any) {
    if (err?.message === 'SWEA_LOGIN_REQUIRED') {
      throw new Error(t(
        'SWEA 로그인이 만료되었거나 유효하지 않습니다. 설정에서 다시 로그인해주세요.',
        'SWEA login has expired or is invalid. Please log in again in settings.'
      ));
    }
    // Other errors: continue without puppeteer content
  }
  if (puppeteerDetail) {
    description = puppeteerDetail.description;
    timeLimit = puppeteerDetail.timeLimit;
    memoryLimit = puppeteerDetail.memoryLimit;
    if (!title && puppeteerDetail.title) {
      title = puppeteerDetail.title;
    }
    if (!problemNumber && puppeteerDetail.number) {
      problemNumber = puppeteerDetail.number;
    }
  }

  // Step 2-b: If we got the number from puppeteer but still missing title,
  // resolve via the list API (handles URL-input case where hash was given)
  if (!title && problemNumber) {
    const resolved = await resolveContestProbId(problemNumber);
    if (resolved) {
      title = resolved.title;
      if (resolved.difficulty !== 'Unrated') { difficulty = resolved.difficulty; }
    }
  }

  // Step 3: Download test data files (HTTP), then fallback to puppeteer-extracted samples
  let testCases = await downloadTestFiles(contestProbId, headers);

  // If HTTP download yielded nothing, use sample I/O extracted from the rendered page
  if (testCases.length === 0 && puppeteerDetail?.sampleTestCases.length) {
    testCases = puppeteerDetail.sampleTestCases.map(tc => ({
      input: tc.input.replace(/\r\n/g, '\n').trim(),
      expectedOutput: tc.output.replace(/\r\n/g, '\n').trim(),
      actualOutput: '',
      passed: null,
    }));
  }

  // Append styled sample I/O boxes to description (SWEA 사이트의 입력/출력 박스 재현)
  // Use puppeteer-extracted samples first, fallback to first 2 downloaded test cases
  const samplesToShow = puppeteerDetail?.sampleTestCases.length
    ? puppeteerDetail.sampleTestCases
    : testCases.slice(0, 2).map(tc => ({ input: tc.input, output: tc.expectedOutput }));

  if (samplesToShow.length > 0 && description) {
    let sampleHtml = '<div style="margin-top:24px;">';
    sampleHtml += `<h3 style="margin-bottom:12px;">${t('[예제]', '[Sample]')}</h3>`;
    for (const tc of samplesToShow) {
      sampleHtml += '<div style="background:rgba(128,128,128,0.12);padding:16px;border-radius:6px;margin-bottom:16px;">';
      sampleHtml += `<strong style="display:block;margin-bottom:8px;">${t('입력', 'Input')}</strong>`;
      sampleHtml += `<pre style="margin:0 0 16px;white-space:pre-wrap;word-break:break-all;background:rgba(128,128,128,0.1);padding:12px;border-radius:4px;">${escapeHtml(tc.input)}</pre>`;
      sampleHtml += `<strong style="display:block;margin-bottom:8px;">${t('출력', 'Output')}</strong>`;
      sampleHtml += `<pre style="margin:0;white-space:pre-wrap;word-break:break-all;background:rgba(128,128,128,0.1);padding:12px;border-radius:4px;">${escapeHtml(tc.output)}</pre>`;
      sampleHtml += '</div>';
    }
    sampleHtml += '</div>';
    description += sampleHtml;
  }

  // Build problem URL
  const problemUrl = `${SWEA_BASE}/main/code/problem/problemDetail.do?contestProbId=${contestProbId}`;

  // If no description was extracted, provide a link
  if (!description || description.length < 50) {
    description = `<p>${t('SWEA는 AngularJS 기반이라 문제 설명을 자동으로 가져올 수 없습니다.', 'SWEA uses AngularJS, so the problem description cannot be fetched automatically.')}</p>`
      + `<p>${t('아래 링크에서 문제를 확인해주세요:', 'Please check the problem at the link below:')}</p>`
      + `<p><a href="${problemUrl}" style="color:#589df6;">${problemUrl}</a></p>`
      + (testCases.length > 0
        ? `<p style="color:#4ec9b0;">${t('테스트 데이터는 성공적으로 다운로드되었습니다.', 'Test data downloaded successfully.')}</p>`
        : `<p style="color:#ce9178;">${t('테스트 데이터를 다운로드할 수 없었습니다.', 'Failed to download test data.')}</p>`);
  }

  // Source attribution is handled by the webview frontend (mainWebview.ts) for ALL platforms.
  // No need to add it here — the frontend's #problemAttribution div covers SWEA too.

  return {
    source: ProblemSource.SWEA,
    id: problemNumber || parsed,
    title: title || `SWEA #${problemNumber || parsed}`,
    description,
    testCases,
    timeLimit,
    memoryLimit,
    difficulty,
    parameterNames: [],
    initialCode: '',
    contestProbId,
  };
}

/**
 * Use puppeteer headless to render the SWEA detail page and extract content.
 * SWEA loads detail via POST form submission, so we simulate that.
 */
async function fetchDetailViaPuppeteer(contestProbId: string, cookies: string): Promise<PuppeteerDetail | null> {
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
      headless: true,
      defaultViewport: { width: 1200, height: 800 },
      args: ['--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-gpu'],
    });

    const page = await browser.newPage();

    // Inject cookies
    const cookieDomain = '.swexpertacademy.com';
    const cookieObjects = cookies.split(';').map(part => {
      const trimmed = part.trim();
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx <= 0) { return null; }
      return {
        name: trimmed.substring(0, eqIdx).trim(),
        value: trimmed.substring(eqIdx + 1).trim(),
        domain: cookieDomain,
      };
    }).filter(Boolean);

    if (cookieObjects.length > 0) {
      await page.setCookie(...cookieObjects);
    }

    // SWEA loads detail pages via POST form submission.
    // We need to navigate to the list page first to establish the session context,
    // then submit a POST form to load the detail page.
    // First, go to the SWEA main page to set up the session
    await page.goto(`${SWEA_BASE}/main/code/problem/problemList.do`, {
      waitUntil: 'networkidle2',
      timeout: 15000,
    });

    // Check if we're logged in (not redirected to login)
    const currentUrl = page.url();
    if (currentUrl.includes('login') || currentUrl.includes('signUp')) {
      await browser.close();
      throw new Error('SWEA_LOGIN_REQUIRED');
    }

    // Simulate the SWEA form POST navigation to the detail page.
    // CRITICAL: Register waitForNavigation BEFORE triggering the navigation
    // to avoid a race condition where navigation completes before the listener is set up.
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }),
      page.evaluate((cpId: string, detailUrl: string) => {
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = detailUrl;

        const fields: Record<string, string> = {
          contestProbId: cpId,
          categoryId: cpId,
          categoryType: 'CODE',
        };

        for (const [name, value] of Object.entries(fields)) {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = name;
          input.value = value;
          form.appendChild(input);
        }

        document.body.appendChild(form);
        form.submit();
      }, contestProbId, DETAIL_URL),
    ]).catch(() => {});

    // Wait for AngularJS to render content
    // First, check if we actually navigated to the detail page
    await new Promise(r => setTimeout(r, 2000));

    // Verify the page URL contains problemDetail (not still on list page)
    const detailUrl = page.url();
    if (!detailUrl.includes('problemDetail')) {
      // Navigation may have failed — try direct GET as fallback
      await page.goto(`${DETAIL_URL}?contestProbId=${contestProbId}`, {
        waitUntil: 'networkidle2',
        timeout: 15000,
      }).catch(() => {});
      await new Promise(r => setTimeout(r, 2000));
    }

    // Wait for AngularJS to finish rendering
    try {
      await page.waitForFunction(() => {
        // Check for rendered content: ng-bind-html with actual content, or known page elements
        const ngBindEls = document.querySelectorAll('[ng-bind-html]');
        for (const el of ngBindEls) {
          if (el.innerHTML && el.innerHTML.trim().length > 30) { return true; }
        }
        const body = document.body?.innerText || '';
        return body.includes('시간') || body.includes('메모리') || body.length > 3000;
      }, { timeout: 10000 });
    } catch {
      // Give extra time for slow renders
      await new Promise(r => setTimeout(r, 3000));
    }

    // Convert images to base64 data URIs (SWEA images require login cookies)
    await page.evaluate(async () => {
      const imgs = document.querySelectorAll('img[src]');
      for (const img of imgs) {
        try {
          const src = img.getAttribute('src');
          if (!src) { continue; }
          const resp = await fetch(src, { credentials: 'include' });
          if (!resp.ok) { continue; }
          const blob = await resp.blob();
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
          img.setAttribute('src', dataUrl);
        } catch { /* skip failed images */ }
      }
    });

    // Extract content from rendered DOM
    const detail: PuppeteerDetail = await page.evaluate(() => {
      let title = '';
      let number = '';
      let timeLimit = '';
      let memoryLimit = '';
      const sampleTestCases: { input: string; output: string }[] = [];

      // Extract title from DOM or document.title
      const titleSelectors = [
        '.contest_name', '.problem-title', 'h3.title',
        '.title_area h3', '.txt_area h3', '.head_info h4',
        'h2', 'h1', '.problem_title', '.prob_title',
        '.head_info .title', '.problem-detail-title',
      ];
      for (const sel of titleSelectors) {
        const el = document.querySelector(sel);
        if (el?.textContent?.trim()) {
          const t = el.textContent.trim();
          // Skip very short or navigation-like text
          if (t.length > 1 && !t.startsWith('SW Expert') && !t.includes('로그인')) {
            title = t;
            break;
          }
        }
      }

      // Fallback: extract from document.title (SWEA often puts problem name in page title)
      if (!title) {
        const docTitle = document.title?.trim() || '';
        // Remove "SW Expert Academy" prefix/suffix
        const cleaned = docTitle.replace(/SW\s*Expert\s*Academy/gi, '').replace(/[-|–]/g, '').trim();
        if (cleaned.length > 1) {
          title = cleaned;
        }
      }

      // Extract problem number from page content
      const allText = document.body?.innerText || '';

      // Method 1: Look for number in the URL itself
      const urlMatch = window.location.href.match(/contestProbId=([A-Za-z0-9_\-]+)/);
      // Not useful for number extraction — the URL has the hash, not the number

      // Method 2: Look for explicit number patterns in text
      const numPatterns = [
        /문제\s*(?:번호)?\s*[:：]\s*(\d{4,})/,
        /Problem\s*(?:No|Number|#)?\s*[:：]?\s*(\d{4,})/i,
        /No\.\s*(\d{4,})/,
      ];
      for (const pat of numPatterns) {
        const match = allText.match(pat);
        if (match) { number = match[1]; break; }
      }

      // Method 3: Look for "NNNNN. Title" pattern in headings
      if (!number) {
        const headings = document.querySelectorAll('h1, h2, h3, h4, .contest_name, .problem-title');
        for (const h of headings) {
          const hText = h.textContent?.trim() || '';
          const numMatch = hText.match(/^(\d{4,})\.\s*/);
          if (numMatch) {
            number = numMatch[1];
            // Also fix title to remove number prefix
            if (title === hText) {
              title = hText.replace(/^\d+\.\s*/, '');
            }
            break;
          }
        }
      }

      if (!number && title) {
        const numMatch = title.match(/^(\d+)\.\s*/);
        if (numMatch) {
          number = numMatch[1];
          title = title.replace(/^\d+\.\s*/, '');
        }
      }

      // --- Collect content from ng-bind-html sections (SWEA's AngularJS rendered content) ---
      // Each section (description, constraints, input, output, sample I/O) is in a separate ng-bind-html.
      // We collect them in DOM order, deduplicate, and join.
      const ngBindEls = document.querySelectorAll('[ng-bind-html]');
      const seenTexts = new Set<string>();
      const contentParts: string[] = [];

      for (const el of ngBindEls) {
        const html = el.innerHTML?.trim();
        if (!html || html.length < 15 || html.includes('ng-include')) { continue; }

        // Skip copyright/attribution sections
        const text = el.textContent?.trim() || '';
        if (/※.*무단\s*복제/.test(text)) { continue; }
        if (/저작권.*SW\s*Expert/i.test(text) && text.length < 200) { continue; }

        // Deduplicate by text content (not HTML, to handle formatting differences)
        const textKey = text.substring(0, 100);
        if (seenTexts.has(textKey)) { continue; }
        seenTexts.add(textKey);

        contentParts.push(html);
      }

      // Fallback: if no ng-bind-html found, try broader selectors
      if (contentParts.length === 0) {
        const fallbackSelectors = ['.problemContent', '#problemContent', '.box4', '.problem-content'];
        for (const sel of fallbackSelectors) {
          const el = document.querySelector(sel);
          if (el) {
            const html = el.innerHTML?.trim();
            if (html && html.length > 50 && !html.includes('ng-include')) {
              contentParts.push(html);
              break;
            }
          }
        }
      }

      const description = contentParts.join('');

      // --- Extract sample I/O as test cases ---
      // Look for <pre> tags or table cells containing sample data
      // SWEA typically shows sample I/O in <pre> blocks or tables

      // Method 1: Look for pre tags that appear after "입력" / "출력" headers in sample section
      const allPres = document.querySelectorAll('pre');
      const preTexts: string[] = [];
      for (const pre of allPres) {
        const text = pre.textContent?.trim();
        if (text && text.length > 0) {
          preTexts.push(text);
        }
      }

      // If we have exactly 2 pre blocks (input, output), treat them as a sample
      if (preTexts.length === 2) {
        sampleTestCases.push({ input: preTexts[0], output: preTexts[1] });
      } else if (preTexts.length > 2 && preTexts.length % 2 === 0) {
        // Paired pre blocks
        for (let i = 0; i < preTexts.length; i += 2) {
          sampleTestCases.push({ input: preTexts[i], output: preTexts[i + 1] });
        }
      }

      // Method 2: Look for table-based sample I/O
      if (sampleTestCases.length === 0) {
        const tables = document.querySelectorAll('table');
        for (const table of tables) {
          const rows = table.querySelectorAll('tr');
          // Check if header row has "입력" and "출력" or "Input" and "Output"
          if (rows.length >= 2) {
            const headerText = rows[0]?.textContent?.toLowerCase() || '';
            if ((headerText.includes('입력') && headerText.includes('출력'))
              || (headerText.includes('input') && headerText.includes('output'))) {
              for (let i = 1; i < rows.length; i++) {
                const cells = rows[i].querySelectorAll('td');
                if (cells.length >= 2) {
                  const inp = cells[0].textContent?.trim() || '';
                  const out = cells[1].textContent?.trim() || '';
                  if (inp && out) {
                    sampleTestCases.push({ input: inp, output: out });
                  }
                }
              }
              break;
            }
          }
        }
      }

      // --- Extract time & memory limits from full page text ---
      const lines = allText.split('\n');
      for (const line of lines) {
        const trimLine = line.trim();

        if (!timeLimit && /시간/.test(trimLine) && /초|sec/i.test(trimLine)) {
          const match = trimLine.match(/시간\s*[:：]?\s*(.*)/i);
          if (match && match[1].trim()) {
            timeLimit = match[1].trim();
          }
        }

        if (!memoryLimit && /메모리/.test(trimLine) && /MB|KB|GB/i.test(trimLine)) {
          const match = trimLine.match(/메모리\s*[:：]?\s*(.*)/i);
          if (match && match[1].trim()) {
            memoryLimit = match[1].trim();
          }
        }
      }

      return { title, number, description, timeLimit, memoryLimit, sampleTestCases };
    });

    await browser.close();

    // Clean up description HTML
    if (detail.description) {
      detail.description = cleanSweaHtml(detail.description);
    }

    return detail;
  } catch (err: any) {
    console.error('[SWEA] fetchDetailViaPuppeteer error:', err?.message || err);
    browser?.close().catch(() => {});
    return null;
  }
}

// --- Test case download ---

async function downloadTestFiles(contestProbId: string, headers: Record<string, string>): Promise<TestCase[]> {
  for (const patternFn of DOWNLOAD_PATTERNS) {
    const urls = patternFn(contestProbId);
    try {
      const [inputRes, outputRes] = await Promise.all([
        axios.get(urls.input, {
          headers,
          responseType: 'arraybuffer',
          timeout: 10000,
          maxRedirects: 5,
          validateStatus: () => true,
        }),
        axios.get(urls.output, {
          headers,
          responseType: 'arraybuffer',
          timeout: 10000,
          maxRedirects: 5,
          validateStatus: () => true,
        }),
      ]);

      const inputData = Buffer.from(inputRes.data);
      const outputData = Buffer.from(outputRes.data);

      // Check if either is HTML (login redirect)
      if (isHtmlBuffer(inputData) || isHtmlBuffer(outputData)) {
        continue;
      }

      // Extract content (handles both plain text and ZIP)
      const inputTexts = extractContent(inputData, 'input');
      const outputTexts = extractContent(outputData, 'output');

      if (inputTexts.length > 0 && outputTexts.length > 0) {
        const testCases: TestCase[] = [];
        const count = Math.min(inputTexts.length, outputTexts.length);
        for (let i = 0; i < count; i++) {
          testCases.push({
            input: inputTexts[i].replace(/\r\n/g, '\n').trim(),
            expectedOutput: outputTexts[i].replace(/\r\n/g, '\n').trim(),
            actualOutput: '',
            passed: null,
          });
        }
        return testCases;
      }
    } catch {
      // Pattern failed, try next
    }
  }
  return [];
}

/**
 * Extract text content from a buffer.
 * If ZIP, extract .txt files matching the type (input/output).
 * Otherwise treat as plain text.
 */
function extractContent(data: Buffer, type: 'input' | 'output'): string[] {
  if (data.length < 2) { return []; }

  // Check for ZIP magic bytes (PK = 0x50 0x4B)
  if (data[0] === 0x50 && data[1] === 0x4B) {
    return extractFromZip(data, type);
  }

  // Plain text
  const text = data.toString('utf-8').trim();
  if (text) {
    return [text];
  }
  return [];
}

/**
 * Extract input/output text files from a ZIP buffer.
 * Input files: filename contains "input" and ends with .txt
 * Output files: filename contains "output" and ends with .txt
 */
function extractFromZip(data: Buffer, type: 'input' | 'output'): string[] {
  try {
    const zip = new AdmZip(data);
    const entries = zip.getEntries();
    const results: { name: string; text: string }[] = [];

    for (const entry of entries) {
      if (entry.isDirectory) { continue; }
      const name = entry.entryName.toLowerCase();

      // Skip macOS metadata and hidden files
      if (name.includes('__macosx') || name.startsWith('.')) { continue; }

      if (!name.endsWith('.txt')) { continue; }

      const hasInput = name.includes('input');
      const hasOutput = name.includes('output');

      if ((type === 'input' && hasInput) || (type === 'output' && hasOutput)) {
        const text = entry.getData().toString('utf-8').trim();
        if (text) {
          results.push({ name: entry.entryName, text });
        }
      }
    }

    // Sort by filename for consistent ordering
    results.sort((a, b) => a.name.localeCompare(b.name));
    return results.map(r => r.text);
  } catch {
    return [];
  }
}

function isHtmlBuffer(data: Buffer): boolean {
  const preview = data.slice(0, 200).toString('utf-8').toLowerCase();
  return preview.startsWith('<!') || preview.startsWith('<html')
    || preview.includes('<!doctype') || preview.includes('<script')
    || (preview.includes('<head>') && preview.includes('<body'));
}

/**
 * Clean SWEA description HTML:
 * - Fix relative image paths to absolute SWEA URLs
 * - Strip inline color/background styles (clash with VS Code theme)
 * - Remove SWEA-specific class attributes that don't apply
 * - Keep structural styles (font-weight, text-align, etc.)
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function cleanSweaHtml(html: string): string {
  let cleaned = html;

  // Fix relative image paths
  cleaned = cleaned.replace(/src="\/([^"]*?)"/g, `src="${SWEA_BASE}/$1"`);

  // Remove inline style attributes entirely, OR selectively strip color-related properties.
  // We strip the problematic CSS properties but keep structural ones.
  cleaned = cleaned.replace(/\sstyle="([^"]*)"/gi, (_match, styleContent: string) => {
    // Parse individual CSS properties
    const props = styleContent.split(';').map((p: string) => p.trim()).filter(Boolean);
    const kept: string[] = [];

    for (const prop of props) {
      const lower = prop.toLowerCase();
      // Remove color-related properties that clash with dark theme
      if (
        lower.startsWith('color') ||
        lower.startsWith('background-color') ||
        lower.startsWith('background:') ||
        lower.startsWith('border-color') ||
        lower.startsWith('font-family') ||
        lower.startsWith('-webkit-') ||
        lower.startsWith('-moz-')
      ) {
        continue;
      }
      kept.push(prop);
    }

    if (kept.length === 0) {
      return '';
    }
    return ` style="${kept.join('; ')}"`;
  });

  // Remove empty style attributes
  cleaned = cleaned.replace(/\sstyle=""/g, '');

  // Remove <font> tags but keep their content
  cleaned = cleaned.replace(/<font[^>]*>/gi, '');
  cleaned = cleaned.replace(/<\/font>/gi, '');

  // Remove all SWEA copyright/attribution notices
  cleaned = cleaned.replace(/※\s*SW\s*Expert\s*아카데미의\s*문제를\s*무단\s*복제하는\s*것을\s*금지합니다\.?/g, '');
  cleaned = cleaned.replace(/※\s*SW\s*expert\s*아카데미의\s*문제를\s*무단\s*복제하는\s*것을\s*금지합니다\.?/gi, '');
  cleaned = cleaned.replace(/<p[^>]*>\s*※[^<]*무단\s*복제[^<]*<\/p>/gi, '');
  cleaned = cleaned.replace(/<[^>]*>\s*출처\s*:?\s*SW\s*Expert\s*Academy[^<]*<\/[^>]*>/gi, '');

  return cleaned;
}
