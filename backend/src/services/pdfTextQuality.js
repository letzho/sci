/**
 * Detects and removes garbled text from pdf-parse output. Insurer PDFs often
 * use custom font encodings that decode as mojibake (ĂďůŐŽ…, □ symbols).
 */

const REPLACEMENT_CHARS = /[\uFFFD\u25A1\u25A0]/g;

function normalizeForCheck(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

/**
 * 0–1 score: higher means more likely readable English policy text.
 */
function readabilityScore(text) {
  const sample = normalizeForCheck(text);
  if (!sample) return 0;

  const chars = [...sample.replace(/\s/g, '')];
  if (chars.length === 0) return 0;

  const asciiLetters = chars.filter((c) => /[a-zA-Z]/.test(c)).length;
  const digits = chars.filter((c) => /[0-9]/.test(c)).length;
  const safePunct = chars.filter((c) => /[.,;:'"()\-/%$]/.test(c)).length;
  const highUnicode = chars.filter((c) => {
    const code = c.charCodeAt(0);
    return code > 127 && code < 0x024f;
  }).length;
  const replacements = (sample.match(REPLACEMENT_CHARS) || []).length;

  const goodRatio = (asciiLetters + digits + safePunct) / chars.length;
  const latinNoisePenalty = (highUnicode / chars.length) * 1.2;
  const replacementPenalty = Math.min(replacements * 0.15, 0.4);

  const tokens = sample.split(/\s+/).filter(Boolean);
  const englishWords = tokens.filter((w) => /^[a-zA-Z][a-zA-Z'-]{2,}$/.test(w)).length;
  const wordRatio = tokens.length > 0 ? englishWords / tokens.length : 0;

  const score = goodRatio * 0.55 + wordRatio * 0.45 - latinNoisePenalty - replacementPenalty;
  return Math.max(0, Math.min(1, score));
}

function isReadableText(text, minScore = 0.52) {
  const sample = normalizeForCheck(text);
  if (!sample || sample.length < 8) return false;
  return readabilityScore(sample) >= minScore;
}

/**
 * Strip garbled lines/paragraphs while keeping readable policy clauses.
 */
function cleanExtractedText(raw) {
  if (!raw?.trim()) return '';

  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const kept = [];
  let paragraph = [];

  function flushParagraph() {
    if (paragraph.length === 0) return;
    const block = paragraph.join(' ').replace(/\s+/g, ' ').trim();
    paragraph = [];
    if (block.length >= 12 && isReadableText(block, 0.48)) {
      kept.push(block);
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      continue;
    }
    if (isReadableText(trimmed, 0.45) || (trimmed.length >= 20 && readabilityScore(trimmed) >= 0.4)) {
      paragraph.push(trimmed);
    } else {
      flushParagraph();
    }
  }
  flushParagraph();

  return kept.join('\n\n').trim();
}

/** Lines with dollar amounts or benefit/table keywords — kept even when font encoding is messy. */
function salvageTableContent(raw) {
  if (!raw?.trim()) return '';

  const parts = new Set();
  const lines = raw.replace(/\r\n/g, '\n').split('\n');

  for (const line of lines) {
    const t = line.replace(/\s+/g, ' ').trim();
    if (!t || t.length < 6) continue;
    const hasMoney = /(?:S\s*\$|\$)\s*[\d,]+/.test(t) || /\b\d{1,3}(?:,\d{3})+\b/.test(t);
    const hasKeyword =
      /accidental|death|disability|family support|medical expenses|table of cover|section\s*\d|basic|classic|superior|premium|prestige/i.test(
        t
      );
    if (hasMoney && hasKeyword) parts.add(t);
    if (/accidental\s+death/i.test(t) && hasMoney) parts.add(t);
  }

  const tableBlock = raw.match(/table\s+of\s+cover[\s\S]{0,20000}/i);
  if (tableBlock) {
    for (const line of tableBlock[0].split('\n')) {
      const t = line.replace(/\s+/g, ' ').trim();
      if (t && /(?:S\s*\$|\$)\s*[\d,]+/.test(t)) parts.add(t);
    }
  }

  for (const { pattern, name } of [
    { pattern: /accidental\s+death/i, name: 'Accidental death' },
    { pattern: /family\s+support\s+fund/i, name: 'Family support fund' },
    { pattern: /permanent\s+disability/i, name: 'Permanent disability' },
  ]) {
    const re = new RegExp(`${pattern.source}[\\s\\S]{0,400}`, 'gi');
    let match;
    while ((match = re.exec(raw)) !== null) {
      const amounts = [...match[0].matchAll(/(?:S\s*\$|\$)\s*([\d,]+)/gi)].map((m) => m[1]);
      if (amounts.length >= 5) {
        parts.add(`${name} ${amounts.map((a) => `$${a}`).join(' ')}`);
      }
    }
  }

  return [...parts].join('\n');
}

/** Merge readable prose + salvaged table rows for indexing and benefit parsing. */
function buildMergedExtractionText(raw) {
  const cleaned = cleanExtractedText(raw);
  const salvaged = salvageTableContent(raw);
  const text = [cleaned, salvaged].filter(Boolean).join('\n\n');
  return { text, cleaned, salvaged };
}

function assessExtractionQuality(rawText, cleanedText) {
  const rawLen = (rawText || '').replace(/\s/g, '').length;
  const cleanLen = (cleanedText || '').replace(/\s/g, '').length;
  const readableRatio = rawLen > 0 ? cleanLen / rawLen : 0;

  let warning = null;
  if (readableRatio < 0.35 && rawLen > 200) {
    warning =
      'Large parts of this PDF could not be read as plain text (custom fonts or scanned pages). Open the original file for any sections that look missing or garbled.';
  } else if (readableRatio < 0.65 && rawLen > 100) {
    warning =
      'Some pages in this PDF may not have extracted cleanly. Verify important figures against the original document.';
  }

  return { readableRatio: Number(readableRatio.toFixed(2)), warning };
}

/** Drop chunks that are still garbled after document-level cleaning. */
function filterReadableChunks(chunks) {
  if (!Array.isArray(chunks)) return [];
  return chunks
    .filter((c) => {
      if (!c?.content) return false;
      if (isReadableText(c.content, 0.5)) return true;
      return /(?:S\s*\$|\$)\s*[\d,]+/.test(c.content) && /accidental|death|disability|section|benefit|cover/i.test(c.content);
    })
    .map((c, i) => ({
      ...c,
      topic: isReadableText(c.topic, 0.4) ? c.topic : `Policy section ${i + 1}`,
    }));
}

module.exports = {
  readabilityScore,
  isReadableText,
  cleanExtractedText,
  salvageTableContent,
  buildMergedExtractionText,
  assessExtractionQuality,
  filterReadableChunks,
};
