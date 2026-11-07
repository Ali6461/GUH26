// Simple local storage: one JSON file in data/, which git ignores.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Quiz, StudyDocument } from "../../shared/types";

interface Data {
  documents: StudyDocument[];
  quizzes: Quiz[];
}

const DATA_FILE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../data/store.json",
);

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
  mkdirSync(dirname(DATA_FILE), { recursive: true });
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

export const store = {
  listDocuments: () => data.documents,
  getDocument: (id: string) => data.documents.find((d) => d.id === id),
  addDocument(document: StudyDocument) {
    data.documents.push(document);
    save();
  },
  getQuiz: (id: string) => data.quizzes.find((q) => q.id === id),
  addQuiz(quiz: Quiz) {
    data.quizzes.push(quiz);
    save();
  },
};
