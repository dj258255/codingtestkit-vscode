import axios from 'axios';

const TRANSLATE_URL = 'https://translate.googleapis.com/translate_a/single';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const MAX_CHUNK_SIZE = 4500;
const CHUNK_DELAY_MS = 300;
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1000;
const TIMEOUT_MS = 10000;

const PRE_PLACEHOLDER_PREFIX = '{{__PRE_BLOCK_';
const PRE_PLACEHOLDER_SUFFIX = '__}}';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function detectLanguage(text: string): string {
  if (!text) {
    return 'en';
  }

  // Count Korean characters: Hangul syllables (\uAC00-\uD7A3) and Jamo (\u3131-\u318E)
  let koreanCount = 0;
  let totalAlphanumeric = 0;

  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    // Skip whitespace and punctuation for ratio calculation
    if (/\s/.test(ch)) {
      continue;
    }

    totalAlphanumeric++;

    if (
      (code >= 0xAC00 && code <= 0xD7A3) ||
      (code >= 0x3131 && code <= 0x318E)
    ) {
      koreanCount++;
    }
  }

  if (totalAlphanumeric === 0) {
    return 'en';
  }

  const koreanRatio = koreanCount / totalAlphanumeric;
  return koreanRatio > 0.1 ? 'ko' : 'en';
}

function protectPreBlocks(html: string): { text: string; blocks: Map<string, string> } {
  const blocks = new Map<string, string>();
  const preRegex = /<pre[^>]*>[\s\S]*?<\/pre>/gi;
  let index = 0;

  const text = html.replace(preRegex, (match) => {
    const placeholder = `${PRE_PLACEHOLDER_PREFIX}${index}${PRE_PLACEHOLDER_SUFFIX}`;
    blocks.set(placeholder, match);
    index++;
    return placeholder;
  });

  return { text, blocks };
}

function restorePreBlocks(text: string, blocks: Map<string, string>): string {
  let result = text;
  blocks.forEach((original, placeholder) => {
    result = result.replace(placeholder, original);
  });
  return result;
}

function splitIntoChunks(text: string): string[] {
  if (text.length <= MAX_CHUNK_SIZE) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= MAX_CHUNK_SIZE) {
      chunks.push(remaining);
      break;
    }

    // Try to split at '>' first (HTML tag boundary)
    let splitIdx = -1;
    for (let i = MAX_CHUNK_SIZE - 1; i >= 0; i--) {
      if (remaining[i] === '>') {
        splitIdx = i + 1;
        break;
      }
    }

    // Fall back to splitting at space
    if (splitIdx === -1) {
      for (let i = MAX_CHUNK_SIZE - 1; i >= 0; i--) {
        if (remaining[i] === ' ') {
          splitIdx = i + 1;
          break;
        }
      }
    }

    // Last resort: hard split at max size
    if (splitIdx === -1 || splitIdx === 0) {
      splitIdx = MAX_CHUNK_SIZE;
    }

    chunks.push(remaining.substring(0, splitIdx));
    remaining = remaining.substring(splitIdx);
  }

  return chunks;
}

async function translateChunkWithRetry(
  text: string,
  sourceLang: string,
  targetLang: string,
): Promise<string> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await axios.get(TRANSLATE_URL, {
        params: {
          client: 'gtx',
          sl: sourceLang,
          tl: targetLang,
          dt: 't',
          dj: '1',
          ie: 'UTF-8',
          oe: 'UTF-8',
          q: text,
        },
        headers: {
          'Accept': 'application/json',
          'User-Agent': UA,
        },
        timeout: TIMEOUT_MS,
      });

      const data = response.data;
      if (!data || !data.sentences) {
        return text;
      }

      let result = '';
      for (const sentence of data.sentences) {
        if (sentence.trans) {
          result += sentence.trans;
        }
      }

      return result || text;
    } catch (err: any) {
      const status = err?.response?.status;
      const isRetryable = status === 429 || status === 500 || status === 502 || status === 503;

      if (isRetryable && attempt < MAX_RETRIES) {
        const retryDelay = BASE_RETRY_DELAY_MS * attempt;
        await delay(retryDelay);
        continue;
      }

      // Non-retryable error or exhausted retries
      if (attempt === MAX_RETRIES) {
        throw new Error(
          `Translation failed after ${MAX_RETRIES} attempts: ${err?.message ?? 'Unknown error'}`,
        );
      }
      throw err;
    }
  }

  return text;
}

export async function translate(
  text: string,
  sourceLang: string,
  targetLang: string,
): Promise<string> {
  if (!text || !text.trim()) {
    return text;
  }

  if (sourceLang === targetLang) {
    return text;
  }

  // Protect <pre> blocks from translation
  const { text: protectedText, blocks } = protectPreBlocks(text);

  // Split into chunks
  const chunks = splitIntoChunks(protectedText);

  const translatedParts: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    if (i > 0) {
      await delay(CHUNK_DELAY_MS);
    }

    const translated = await translateChunkWithRetry(chunks[i], sourceLang, targetLang);
    translatedParts.push(translated);
  }

  const translatedText = translatedParts.join('');

  // Restore <pre> blocks
  return restorePreBlocks(translatedText, blocks);
}

export async function translateToKorean(text: string): Promise<string> {
  return translate(text, 'en', 'ko');
}

export async function translateToEnglish(text: string): Promise<string> {
  return translate(text, 'ko', 'en');
}

export async function autoTranslate(text: string, targetLang: string): Promise<string> {
  const detectedLang = detectLanguage(text);
  if (detectedLang === targetLang) {
    return text;
  }
  return translate(text, detectedLang, targetLang);
}
