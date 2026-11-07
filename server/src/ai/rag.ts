// Searches the student's notes. Passages and their vectors stay in data/vectors.json.
// A simple scan through every vector is plenty for one student's notes, and it
// keeps each passage tied to its document and page for citations.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { embed } from "@qvac/sdk";
import type { SourceRef, StudyDocument } from "../../../shared/types";
import { DATA_DIR } from "../store";
import { ensureModel, setActivity } from "./models";
import { cosineSimilarity, documentPassages, type Passage } from "./text";

interface IndexedPassage extends Passage {
  vector: number[];
}

const VECTORS_FILE = resolve(DATA_DIR, "vectors.json");
const BATCH_SIZE = 8;
/** Measured: related text scored about 0.55 and unrelated text below 0.2. */
const MIN_SCORE = 0.3;

// EmbeddingGemma was trained with these prefixes and retrieves better with them.
const asQuery = (text: string) => `task: search result | query: ${text}`;
const asDocument = (passage: Passage) =>
  `title: ${passage.documentName} | text: ${passage.text}`;

function load(): IndexedPassage[] {
  try {
    return JSON.parse(readFileSync(VECTORS_FILE, "utf8")) as IndexedPassage[];
  } catch {
    return [];
  }
}

let index = load();

function save(): void {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(VECTORS_FILE, JSON.stringify(index));
}

async function embedTexts(text: string[]): Promise<number[][]> {
  const modelId = await ensureModel("embeddings");
  return (await embed({ modelId, text })).embedding;
}

let indexing: Promise<unknown> = Promise.resolve();

/** Adds any of these documents that aren't indexed yet, one call at a time. */
export function ensureIndexed(documents: StudyDocument[]): Promise<void> {
  const run = indexing.then(() => indexMissing(documents));
  indexing = run.catch(() => undefined);
  return run;
}

async function indexMissing(documents: StudyDocument[]): Promise<void> {
  const known = new Set(index.map((passage) => passage.documentId));
  for (const document of documents) {
    if (known.has(document.id)) continue;
    const passages = documentPassages(document);
    const added: IndexedPassage[] = [];
    try {
      for (let start = 0; start < passages.length; start += BATCH_SIZE) {
        setActivity(`Indexing ${document.name} (${start} of ${passages.length} passages)`);
        const batch = passages.slice(start, start + BATCH_SIZE);
        const vectors = await embedTexts(batch.map(asDocument));
        batch.forEach((passage, i) => added.push({ ...passage, vector: vectors[i] }));
      }
    } finally {
      setActivity(null);
    }
    if (added.length > 0) {
      index.push(...added);
      save();
    }
  }
}

export function removeFromIndex(documentId: string): void {
  index = index.filter((passage) => passage.documentId !== documentId);
  save();
}

/** Returns the passages that best match the query, skipping anything unrelated. */
export async function search(query: string, topK: number): Promise<SourceRef[]> {
  if (index.length === 0) return [];
  const [vector] = await embedTexts([asQuery(query)]);
  return index
    .map((passage) => ({ passage, score: cosineSimilarity(vector, passage.vector) }))
    .filter(({ score }) => score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(({ passage }) => ({
      documentId: passage.documentId,
      documentName: passage.documentName,
      page: passage.page,
      quote: passage.text,
    }));
}
