import 'server-only';
import PizZip from 'pizzip';

export interface PlaceholderCandidate {
  id: string;
  original: string;
  type: 'bracketed' | 'blank';
  context: string;
  suggestedToken?: string;
}

export interface PlaceholderReplacement {
  token: string;
  /** Exact bracketed text to replace everywhere it appears. */
  original?: string;
  /** Index of the <w:t> run to replace (used for blanks). */
  index?: number;
}

const W_T_TAG = /<w:t([^>]*)>([^<]*)<\/w:t>/g;

function tokenize(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Reads word/document.xml and returns bracketed placeholders like
 * [CLIENT_NAME] plus blank runs that could become placeholders.
 */
export function extractCandidates(buffer: ArrayBuffer): PlaceholderCandidate[] {
  const zip = new PizZip(buffer);
  const xml = zip.file('word/document.xml')?.asText() ?? '';
  const matches = Array.from(xml.matchAll(W_T_TAG));
  const candidates: PlaceholderCandidate[] = [];
  const seenBracketed = new Set<string>();

  matches.forEach((match, index) => {
    const text = match[2];
    const prev = matches[index - 1]?.[2] ?? '';
    const next = matches[index + 1]?.[2] ?? '';
    const context = `${prev.slice(-25)} … ${next.slice(0, 25)}`;

    const bracketed = text.match(/^\[([^\]]+)\]$/);
    if (bracketed) {
      if (!seenBracketed.has(text)) {
        seenBracketed.add(text);
        candidates.push({
          id: `bracket-${index}`,
          original: text,
          type: 'bracketed',
          context,
          suggestedToken: tokenize(bracketed[1]),
        });
      }
      return;
    }

    if (text.trim() === '') {
      candidates.push({
        id: `blank-${index}`,
        original: text,
        type: 'blank',
        context,
      });
    }
  });

  return candidates;
}

/**
 * Replaces bracketed placeholders and selected blanks with {{token}}
 * markers inside word/document.xml, then returns a new .docx buffer.
 */
export function replacePlaceholders(
  buffer: ArrayBuffer,
  replacements: PlaceholderReplacement[],
): ArrayBuffer {
  const zip = new PizZip(buffer);
  let xml = zip.file('word/document.xml')?.asText() ?? '';

  let runIndex = 0;
  xml = xml.replace(W_T_TAG, (fullMatch, attrs, text) => {
    const currentIndex = runIndex++;

    const byOriginal = replacements.find((r) => r.original === text);
    if (byOriginal) {
      return `<w:t${attrs}>{{${byOriginal.token}}}</w:t>`;
    }

    const byIndex = replacements.find((r) => r.index === currentIndex);
    if (byIndex) {
      return `<w:t${attrs}>{{${byIndex.token}}}</w:t>`;
    }

    return fullMatch;
  });

  zip.file('word/document.xml', xml);
  return zip.generate({ type: 'arraybuffer' });
}

/**
 * Replaces every {{token}} in the template with the supplied value and
 * returns a new .docx buffer. Values are XML-escaped.
 */
export function renderTemplate(
  buffer: ArrayBuffer,
  values: Record<string, string>,
): ArrayBuffer {
  const zip = new PizZip(buffer);
  let xml = zip.file('word/document.xml')?.asText() ?? '';

  for (const [token, value] of Object.entries(values)) {
    const safe = escapeXml(value ?? '');
    const pattern = new RegExp(escapeRegExp(`{{${token}}}`), 'g');
    xml = xml.replace(pattern, safe);
  }

  zip.file('word/document.xml', xml);
  return zip.generate({ type: 'arraybuffer' });
}

/**
 * Lists the {{token}} markers that remain in the template.
 */
export function extractTokens(buffer: ArrayBuffer): string[] {
  const zip = new PizZip(buffer);
  const xml = zip.file('word/document.xml')?.asText() ?? '';
  const tokens = new Set<string>();
  const matches = xml.matchAll(/\{\{([a-z0-9_]+)\}\}/g);
  for (const match of matches) {
    tokens.add(match[1]);
  }
  return Array.from(tokens);
}
