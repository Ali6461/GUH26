// PERSON 2: turning files into text, including OCR.
//
// .txt and .md files really work. PDFs, slides and images are PLACEHOLDERS that
// return a warning and no text.
//
// To do:
// 1. Read the text layer from PDFs, page by page. Export slides to PDF first.
// 2. Add QVAC OCR for images and scanned PDFs.
// 3. Test real photos and handwriting early, then tell the team what works.
// 4. Add a warning for any page that can't be read. Never invent text.
// 5. Set IMPORT_IS_PLACEHOLDER to false.
import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import type { DocumentKind, StudyDocument } from "../../../shared/types";

export const IMPORT_IS_PLACEHOLDER = true;

export interface UploadedFile {
  name: string;
  mimeType: string;
  bytes: Buffer;
}

const KINDS: Record<string, DocumentKind> = {
  ".txt": "text",
  ".md": "text",
  ".pdf": "pdf",
  ".pptx": "slides",
  ".png": "image",
  ".jpg": "image",
  ".jpeg": "image",
  ".webp": "image",
};

export async function importFile(file: UploadedFile): Promise<StudyDocument> {
  const kind = KINDS[extname(file.name).toLowerCase()];
  const document: StudyDocument = {
    id: randomUUID(),
    name: file.name,
    kind: kind ?? "text",
    pages: [],
    warnings: [],
    createdAt: new Date().toISOString(),
  };

  if (!kind) {
    document.warnings.push(`This file type isn't supported yet: ${file.name}`);
  } else if (kind === "text") {
    document.pages.push({ page: 1, text: file.bytes.toString("utf8") });
  } else {
    document.warnings.push(`Reading ${kind} files isn't connected yet, so no text was imported.`);
  }

  return document;
}
