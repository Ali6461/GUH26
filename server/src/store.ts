// Simple local storage: one JSON file in data/, which git ignores.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Quiz, StudyDocument } from "../../shared/types";

interface Data {
  documents: StudyDocument[];
  quizzes: Quiz[];
}

export const DATA_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../data");
const DATA_FILE = resolve(DATA_DIR, "store.json");

function load(): Data {
  try {
    return JSON.parse(readFileSync(DATA_FILE, "utf8")) as Data;
  } catch {
    // No saved data yet.
    return { documents: [], quizzes: [] };
  }
}

const data = load();

function save(): void {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

export const store = {
  listDocuments: () => data.documents,
  getDocument: (id: string) => data.documents.find((d) => d.id === id),
  addDocument(document: StudyDocument) {
    data.documents.push(document);
    save();
  },
  /** Also removes quizzes built from it, because they quote the notes. */
  removeDocument(id: string) {
    data.documents = data.documents.filter((d) => d.id !== id);
    data.quizzes = data.quizzes.filter((q) => !q.documentIds.includes(id));
    save();
  },
  getQuiz: (id: string) => data.quizzes.find((q) => q.id === id),
  addQuiz(quiz: Quiz) {
    data.quizzes.push(quiz);
    save();
  },
};
