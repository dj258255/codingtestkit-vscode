import axios from 'axios';
import * as cheerio from 'cheerio';
import { Problem, ProblemSource, TestCase } from '../models/models';
import { fetchDifficulty } from './solvedAcApi';
import { renderLatexInHtml } from '../utils/latexRenderer';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

export async function fetchBaekjoonProblem(problemId: string): Promise<Problem> {
  const url = `https://www.acmicpc.net/problem/${problemId}`;

  const response = await axios.get(url, {
    headers: { 'User-Agent': UA },
    responseType: 'text',
  });

  const $ = cheerio.load(response.data);

  // Extract title
  const title = $('#problem_title').text().trim();

  // Extract time limit and memory limit from the info table
  const infoCells = $('#problem-info tbody tr td');
  const timeLimit = infoCells.eq(0).text().trim();
  const memoryLimit = infoCells.eq(1).text().trim();

  // Fix image paths: convert relative to absolute, remove width/height
  $('img[src]').each((_i, el) => {
    const img = $(el);
    const src = img.attr('src');
    if (src && !src.startsWith('http')) {
      img.attr('src', `https://www.acmicpc.net${src.startsWith('/') ? '' : '/'}${src}`);
    }
    img.removeAttr('width');
    img.removeAttr('height');
  });

  // Extract sections
  const descriptionHtml = $('#problem_description').html()?.trim() ?? '';
  const inputHtml = $('#problem_input').html()?.trim() ?? '';
  const outputHtml = $('#problem_output').html()?.trim() ?? '';
  const limitHtml = $('#problem_limit').html()?.trim() ?? '';
  const hintHtml = $('#problem_hint').html()?.trim() ?? '';

  // Extract test cases
  const testCases: TestCase[] = [];
  let sampleIdx = 1;
  while (true) {
    const inputEl = $(`#sample-input-${sampleIdx}`);
    const outputEl = $(`#sample-output-${sampleIdx}`);

    if (inputEl.length === 0 || outputEl.length === 0) {
      break;
    }

    const input = inputEl.text().replace(/\r\n/g, '\n').trim();
    const expectedOutput = outputEl.text().replace(/\r\n/g, '\n').trim();

    testCases.push({
      input,
      expectedOutput,
      actualOutput: '',
      passed: null,
    });

    sampleIdx++;
  }

  // Build full description HTML
  const sections: string[] = [];

  if (descriptionHtml) {
    sections.push(`<h2>문제</h2>\n${descriptionHtml}`);
  }
  if (inputHtml) {
    sections.push(`<h2>입력</h2>\n${inputHtml}`);
  }
  if (outputHtml) {
    sections.push(`<h2>출력</h2>\n${outputHtml}`);
  }
  if (limitHtml) {
    sections.push(`<h2>제한</h2>\n${limitHtml}`);
  }

  // Add sample input/output sections from parent HTML (already contains headers)
  for (let i = 1; i < sampleIdx; i++) {
    const sampleInputParent = $(`#sample-input-${i}`).parent();
    const sampleOutputParent = $(`#sample-output-${i}`).parent();

    if (sampleInputParent.length) {
      sections.push(sampleInputParent.html()?.trim() ?? '');
    }
    if (sampleOutputParent.length) {
      sections.push(sampleOutputParent.html()?.trim() ?? '');
    }
  }

  if (hintHtml) {
    sections.push(`<h2>힌트</h2>\n${hintHtml}`);
  }

  const description = renderLatexInHtml(sections.join('\n'));

  // Fetch difficulty from solved.ac
  const difficulty = await fetchDifficulty(problemId);

  return {
    source: ProblemSource.BAEKJOON,
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
