import axios from 'axios';
import * as cheerio from 'cheerio';
import { Problem, ProblemSource, TestCase } from '../models/models';
import { fetchAllProblems } from './codeforcesApi';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const CF_BASE = 'https://codeforces.com';

interface ParsedProblemId {
  contestId: string;
  letter: string;
}

function parseProblemId(id: string): ParsedProblemId | null {
  const match = id.match(/^(\d+)([A-Za-z]\d?)$/);
  if (!match) {
    return null;
  }
  return { contestId: match[1], letter: match[2] };
}

function fixImages($: cheerio.CheerioAPI): void {
  $('img[src]').each((_i, el) => {
    const img = $(el);
    const src = img.attr('src');
    if (src && !src.startsWith('http')) {
      img.attr('src', `${CF_BASE}${src.startsWith('/') ? '' : '/'}${src}`);
    }
    img.removeAttr('width');
    img.removeAttr('height');
  });
}

function convertCodeforcesLatex(html: string): string {
  // Convert Codeforces-specific LaTeX delimiters:
  // $$$$$$ (display math) -> $$ ... $$
  // $$$ (inline math) -> $ ... $
  // Process display math first (6 dollar signs -> 2 dollar signs)
  let result = html.replace(/\$\$\$\$\$\$/g, '$$$$');
  // Then process inline math (3 dollar signs -> 1 dollar sign)
  result = result.replace(/\$\$\$/g, '$');
  // Render LaTeX to MathML for proper display
  const { renderLatexInHtml } = require('../utils/latexRenderer');
  result = renderLatexInHtml(result);
  return result;
}

function extractTextContent(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .trim();
}

export async function fetchCodeforcesProblem(problemId: string, cookies: string = ''): Promise<Problem> {
  const parsed = parseProblemId(problemId);
  if (!parsed) {
    throw new Error(`Invalid Codeforces problem ID: ${problemId}. Expected format: 1234A or 1234B1`);
  }

  const url = `${CF_BASE}/problemset/problem/${parsed.contestId}/${parsed.letter}?locale=en`;

  const headers: Record<string, string> = { 'User-Agent': UA };
  if (cookies) {
    headers['Cookie'] = cookies;
  }

  const response = await axios.get(url, {
    headers,
    responseType: 'text',
    timeout: 15000,
    validateStatus: () => true,
  });

  // Cloudflare challenge detection: 403 or no .problem-statement in HTML
  const html: string = typeof response.data === 'string' ? response.data : '';
  if (response.status === 403 || !html.includes('problem-statement')) {
    return fetchCodeforcesProblemViaApi(parsed, problemId);
  }

  const $ = cheerio.load(html);

  fixImages($);

  // Extract title: .problem-statement .title, strip the letter prefix (e.g., "A. ")
  let title = '';
  const titleEl = $('.problem-statement .title').first();
  if (titleEl.length) {
    title = titleEl.text().trim();
    // Strip letter prefix like "A. " or "B1. "
    title = title.replace(/^[A-Za-z]\d?\.\s*/, '');
  }

  // Extract time limit
  let timeLimit = '';
  const timeLimitEl = $('.problem-statement .time-limit').first();
  if (timeLimitEl.length) {
    timeLimit = timeLimitEl.text().trim();
    timeLimit = timeLimit.replace(/time limit per test/i, '').trim();
  }

  // Extract memory limit
  let memoryLimit = '';
  const memoryLimitEl = $('.problem-statement .memory-limit').first();
  if (memoryLimitEl.length) {
    memoryLimit = memoryLimitEl.text().trim();
    memoryLimit = memoryLimit.replace(/memory limit per test/i, '').trim();
  }

  // Build description from problem-statement sections
  const sections: string[] = [];

  // Collect all direct child divs of .problem-statement
  const problemStatement = $('.problem-statement');

  // Main problem text (the div without a special class, usually the first div after header)
  problemStatement.children('div').each((_i, el) => {
    const div = $(el);
    const cls = div.attr('class') || '';

    if (cls.includes('header')) {
      // Skip the header div (contains title, time/memory limits)
      return;
    }

    if (cls.includes('input-specification')) {
      const heading = div.find('.section-title').text().trim() || 'Input';
      div.find('.section-title').remove();
      const content = div.html()?.trim() ?? '';
      sections.push(`<h2>${heading}</h2>\n${content}`);
    } else if (cls.includes('output-specification')) {
      const heading = div.find('.section-title').text().trim() || 'Output';
      div.find('.section-title').remove();
      const content = div.html()?.trim() ?? '';
      sections.push(`<h2>${heading}</h2>\n${content}`);
    } else if (cls.includes('sample-tests')) {
      // Sample tests will be extracted separately for TestCase[]
      const sampleHtml = div.html()?.trim() ?? '';
      if (sampleHtml) {
        sections.push(`<h2>Examples</h2>\n${sampleHtml}`);
      }
    } else if (cls.includes('note')) {
      const heading = div.find('.section-title').text().trim() || 'Note';
      div.find('.section-title').remove();
      const content = div.html()?.trim() ?? '';
      if (content) {
        sections.push(`<h2>${heading}</h2>\n${content}`);
      }
    } else {
      // Other sections (problem statement body)
      const content = div.html()?.trim() ?? '';
      if (content) {
        sections.push(`<h2>Problem</h2>\n${content}`);
      }
    }
  });

  // Extract test cases from .sample-test
  const testCases: TestCase[] = [];
  const inputPres = $('.sample-test .input pre');
  const outputPres = $('.sample-test .output pre');
  const numCases = Math.min(inputPres.length, outputPres.length);

  for (let i = 0; i < numCases; i++) {
    const inputEl = $(inputPres[i]);
    const outputEl = $(outputPres[i]);

    // Replace <br> with newlines before stripping tags
    let inputHtml = inputEl.html() ?? '';
    inputHtml = inputHtml.replace(/<br\s*\/?>/gi, '\n');
    const inputText = inputHtml.replace(/<[^>]+>/g, '').trim();

    let outputHtml = outputEl.html() ?? '';
    outputHtml = outputHtml.replace(/<br\s*\/?>/gi, '\n');
    const outputText = outputHtml.replace(/<[^>]+>/g, '').trim();

    testCases.push({
      input: inputText,
      expectedOutput: outputText,
      actualOutput: '',
      passed: null,
    });
  }

  // Convert Codeforces LaTeX delimiters
  let description = sections.join('\n');
  description = convertCodeforcesLatex(description);

  // Fetch difficulty from cached API data
  let difficulty = 'Unrated';
  try {
    const allProblems = await fetchAllProblems();
    const key = `${parsed.contestId}${parsed.letter}`;
    const found = allProblems.find(
      (p) => `${p.contestId}${p.index}` === key,
    );
    if (found && found.rating > 0) {
      difficulty = `${found.rating}`;
    }
  } catch {
    // If API fails, keep Unrated
  }

  return {
    source: ProblemSource.CODEFORCES,
    id: problemId,
    title,
    description,
    testCases,
    timeLimit,
    memoryLimit,
    difficulty,
    parameterNames: [],
    initialCode: '',
    contestProbId: '',
  };
}

async function fetchCodeforcesProblemViaApi(
  parsed: ParsedProblemId,
  problemId: string,
): Promise<Problem> {
  const allProblems = await fetchAllProblems();
  const key = `${parsed.contestId}${parsed.letter}`;
  const found = allProblems.find((p) => `${p.contestId}${p.index}` === key);

  if (!found) {
    throw new Error(`Codeforces problem ${problemId} not found. (Cloudflare blocked direct access)`);
  }

  const difficulty = found.rating > 0 ? `${found.rating}` : 'Unrated';
  const tags = found.tags?.length > 0 ? `<p><strong>Tags:</strong> ${found.tags.join(', ')}</p>` : '';
  const description = `<p><em>Direct page access was blocked by Cloudflare. Showing metadata from API.</em></p>\n`
    + `<p>Open in browser: <a href="https://codeforces.com/problemset/problem/${parsed.contestId}/${parsed.letter}">Problem ${problemId}</a></p>\n`
    + tags;

  return {
    source: ProblemSource.CODEFORCES,
    id: problemId,
    title: found.name ?? problemId,
    description,
    testCases: [],
    timeLimit: '',
    memoryLimit: '',
    difficulty,
    parameterNames: [],
    initialCode: '',
    contestProbId: '',
  };
}
