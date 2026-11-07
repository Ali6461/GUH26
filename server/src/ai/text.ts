// Plain text helpers with no AI in them, so they can be unit tested.
import type { StudyDocument } from "../../../shared/types";

export interface Passage {
  documentId: string;
  documentName: string;
  page: number;
  text: string;
}

const CHUNK_CHARS = 900;
const MIN_CHUNK_CHARS = 40;

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n{2,}|\n(?=\s*[-•*\d])/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

/** Splits a page into passages, keeping one sentence of overlap for context. */
export function chunkText(text: string, maxChars = CHUNK_CHARS): string[] {
  const chunks: string[] = [];
  let current: string[] = [];
  let length = 0;

  for (const sentence of splitSentences(text)) {
    if (length + sentence.length > maxChars && current.length > 0) {
      chunks.push(current.join(" "));
      const overlap = current[current.length - 1];
      current = overlap.length < maxChars / 3 ? [overlap] : [];
      length = current.join(" ").length;
    }
    // A single very long "sentence", such as OCR output with no punctuation.
    if (sentence.length > maxChars) {
      for (let start = 0; start < sentence.length; start += maxChars) {
        chunks.push(sentence.slice(start, start + maxChars));
      }
      current = [];
      length = 0;
      continue;
    }
    current.push(sentence);
    length += sentence.length + 1;
  }
  if (current.length > 0) chunks.push(current.join(" "));
  return chunks.filter((chunk) => chunk.length >= MIN_CHUNK_CHARS);
}

export function documentPassages(document: StudyDocument): Passage[] {
  return document.pages.flatMap((page) =>
    chunkText(page.text).map((text) => ({
      documentId: document.id,
      documentName: document.name,
      page: page.page,
      text,
    })),
  );
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let aSize = 0;
  let bSize = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    aSize += a[i] * a[i];
    bSize += b[i] * b[i];
  }
  return aSize && bSize ? dot / Math.sqrt(aSize * bSize) : 0;
}

/**
 * True for requests like "summarise my notes". They name no topic, so they score
 * low against every passage even though the student clearly wants their notes.
 */
export function mentionsNotes(text: string): boolean {
  return /\b(my|these|this|the|our)\s+(notes?|slides?|lectures?|documents?|files?|pdfs?|materials?)\b/i.test(
    text,
  );
}

/** Lowercases and flattens spacing, quotes and dashes, so only the wording is compared. */
function normalise(text: string): { value: string; positions: number[] } {
  let value = "";
  const positions: number[] = [];
  let lastWasSpace = true;
  for (let i = 0; i < text.length; i++) {
    let char = text[i];
    if (/\s/.test(char)) {
      if (lastWasSpace) continue;
      char = " ";
      lastWasSpace = true;
    } else {
      lastWasSpace = false;
      char = char
        .toLowerCase()
        .replace(/[‘’]/g, "'")
        .replace(/[“”]/g, '"')
        .replace(/[–—]/g, "-");
    }
    value += char;
    positions.push(i);
  }
  return { value, positions };
}

function words(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [];
}

/**
 * Finds a model's quote in the passage and returns the passage's own wording.
 * Models often paraphrase, so a close sentence counts as a match, but the text
 * returned always comes from the notes. Returns null if nothing is close enough.
 */
export function verifyQuote(quote: string, passage: string): string | null {
  const needle = normalise(quote.trim().replace(/^["'“”]+|["'“”]+$/g, "")).value.trim();
  if (needle.length >= 12) {
    const haystack = normalise(passage);
    const at = haystack.value.indexOf(needle);
    if (at >= 0) {
      const start = haystack.positions[at];
      const end = haystack.positions[at + needle.length - 1];
      return passage.slice(start, end + 1);
    }
  }

  const wanted = new Set(words(quote));
  if (wanted.size === 0) return null;
  let best: string | null = null;
  let bestScore = 0;
  for (const sentence of splitSentences(passage)) {
    const unique = new Set(words(sentence));
    const shared = [...wanted].filter((word) => unique.has(word)).length;
    const score = shared / wanted.size;
    if (score > bestScore && sentence.length >= 12) {
      best = sentence;
      bestScore = score;
    }
  }
  return bestScore >= 0.6 ? best : null;
}

/** Picks passages spread evenly through the notes, from a random starting point. */
export function pickSpread<T>(items: T[], count: number, offset = Math.random()): T[] {
  if (items.length === 0 || count <= 0) return [];
  const picked: T[] = [];
  const step = items.length / count;
  for (let i = 0; i < count; i++) {
    const position = (offset * items.length + i * step) % items.length;
    picked.push(items[Math.floor(position)]);
  }
  return picked;
}

/** Pulls a JSON object out of a model reply, ignoring any text around it. */
export function parseJsonObject(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}
