// Turns uploaded files into page-by-page text. Everything runs on this laptop.
// A page that can't be read gets a warning. Text is never invented.
import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import { createCanvas, loadImage, type Image } from "@napi-rs/canvas";
import { ocr } from "@qvac/sdk";
import JSZip from "jszip";
import type { DocumentKind, DocumentPage, StudyDocument } from "../../../shared/types";
import { ensureModel } from "../ai/models";

export const IMPORT_IS_PLACEHOLDER = false;

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

/** Below this many characters a page probably has no text layer, so it gets OCR. */
const MIN_TEXT_LAYER_CHARS = 25;
const PDF_RENDER_SCALE = 2;
const MAX_IMAGE_SIDE = 2400;
/** Clean print averages about 0.9. Below this, the page is probably rotated or hard to read. */
const CONFIDENT = 0.7;
/** Words below this are almost always stray marks. */
const MIN_WORD_CONFIDENCE = 0.2;

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

  try {
    if (!kind) {
      document.warnings.push(`This file type isn't supported: ${file.name}`);
    } else if (kind === "text") {
      const text = file.bytes.toString("utf8").trim();
      if (text) document.pages.push({ page: 1, text });
      else document.warnings.push("This file is empty.");
    } else if (kind === "pdf") {
      document.pages = await readPdf(file.bytes, document.warnings);
    } else if (kind === "slides") {
      document.pages = await readSlides(file.bytes, document.warnings);
    } else {
      const text = await readImage(file.bytes, "This image", document.warnings);
      if (text) document.pages.push({ page: 1, text });
    }
  } catch (error) {
    console.error(`Couldn't import ${file.name}:`, error);
    const reason = error instanceof Error ? error.message : "unknown error";
    document.warnings.push(`Couldn't read this file: ${reason}`);
  }

  return document;
}

interface OcrBlock {
  text: string;
  confidence?: number;
  bbox?: [number, number, number, number];
}

/** OCR returns single words in detection order, so rebuild the lines from their positions. */
export function blocksToText(blocks: OcrBlock[]): string {
  const lines: { centre: number; height: number; words: OcrBlock[] }[] = [];
  const positioned = blocks.filter((block) => block.bbox);
  const centreOf = (block: OcrBlock) => (block.bbox![1] + block.bbox![3]) / 2;
  for (const block of [...positioned].sort((a, b) => centreOf(a) - centreOf(b))) {
    const height = block.bbox![3] - block.bbox![1];
    const line = lines.find(
      (candidate) =>
        Math.abs(candidate.centre - centreOf(block)) < Math.max(candidate.height, height) * 0.6,
    );
    if (line) line.words.push(block);
    else lines.push({ centre: centreOf(block), height, words: [block] });
  }
  return lines
    .map((line) =>
      line.words
        .sort((a, b) => a.bbox![0] - b.bbox![0])
        .map((word) => word.text.trim())
        .filter(Boolean)
        .join(" "),
    )
    .filter(Boolean)
    .join("\n");
}

function averageConfidence(blocks: OcrBlock[]): number {
  if (blocks.length === 0) return 0;
  return blocks.reduce((sum, block) => sum + (block.confidence ?? 0), 0) / blocks.length;
}

function rotatedPng(image: Image, degrees: number): Buffer {
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(image.width, image.height));
  const width = image.width * scale;
  const height = image.height * scale;
  const sideways = degrees % 180 !== 0;
  const canvas = createCanvas(
    Math.round(sideways ? height : width),
    Math.round(sideways ? width : height),
  );
  const context = canvas.getContext("2d");
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate((degrees * Math.PI) / 180);
  context.drawImage(image, -width / 2, -height / 2, width, height);
  return canvas.toBuffer("image/png");
}

async function recognise(image: Image, label: string, warnings: string[]): Promise<string> {
  const modelId = await ensureModel("ocr");
  const read = async (degrees: number): Promise<OcrBlock[]> =>
    // The SDK's Buffer type comes from its own copy of the Node types.
    ocr({ modelId, image: rotatedPng(image, degrees) as never }).blocks;

  // Phone photos are often sideways, and that shows up as low confidence.
  let best = await read(0);
  if (averageConfidence(best) < CONFIDENT) {
    for (const degrees of [-90, 90, 180]) {
      const blocks = await read(degrees);
      if (averageConfidence(blocks) > averageConfidence(best)) best = blocks;
    }
  }

  const kept = best.filter((block) => (block.confidence ?? 1) >= MIN_WORD_CONFIDENCE);
  const text = blocksToText(kept);
  if (!text) {
    warnings.push(`${label} could not be read: no text was found.`);
    return "";
  }
  if (averageConfidence(kept) < CONFIDENT) {
    warnings.push(`${label} was hard to read, so its text may contain mistakes.`);
  }
  return text;
}

async function readImage(bytes: Buffer, label: string, warnings: string[]): Promise<string> {
  return recognise(await loadImage(bytes), label, warnings);
}

async function readPdf(bytes: Buffer, warnings: string[]): Promise<DocumentPage[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loading = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: true,
    verbosity: pdfjs.VerbosityLevel.ERRORS,
  });
  const pdf = await loading.promise;

  const pages: DocumentPage[] = [];
  try {
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      let text = "";
      for (const item of content.items) {
        if ("str" in item) text += item.str + (item.hasEOL ? "\n" : " ");
      }
      text = text.replace(/[ \t]+/g, " ").trim();

      if (text.length < MIN_TEXT_LAYER_CHARS) {
        const viewport = page.getViewport({ scale: PDF_RENDER_SCALE });
        const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
        const context = canvas.getContext("2d");
        await page.render({
          canvas: canvas as unknown as HTMLCanvasElement,
          canvasContext: context as unknown as CanvasRenderingContext2D,
          viewport,
        }).promise;
        const image = await loadImage(canvas.toBuffer("image/png"));
        text = await recognise(image, `Page ${number}`, warnings);
      }
      page.cleanup();
      if (text) pages.push({ page: number, text });
    }
  } finally {
    await loading.destroy();
  }
  return pages;
}

function decodeXml(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, "&");
}

/** Reads one slide XML file, keeping each paragraph on its own line. */
export function slideXmlToText(xml: string): string {
  const paragraphs = xml.match(/<a:p>.*?<\/a:p>|<a:p\s.*?<\/a:p>/gs) ?? [];
  return paragraphs
    .map((paragraph) =>
      [...paragraph.matchAll(/<a:t>(.*?)<\/a:t>/gs)]
        .map((match) => decodeXml(match[1]))
        .join(""),
    )
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

async function readSlides(bytes: Buffer, warnings: string[]): Promise<DocumentPage[]> {
  const zip = await JSZip.loadAsync(bytes);
  const slideNumbers = Object.keys(zip.files)
    .flatMap((path) => path.match(/^ppt\/slides\/slide(\d+)\.xml$/)?.[1] ?? [])
    .map(Number)
    .sort((a, b) => a - b);

  const pages: DocumentPage[] = [];
  for (const number of slideNumbers) {
    const label = `Slide ${number}`;
    const xml = await zip.file(`ppt/slides/slide${number}.xml`)!.async("string");
    const rels = await zip.file(`ppt/slides/_rels/slide${number}.xml.rels`)?.async("string");
    const parts = [slideXmlToText(xml)];

    const notesPath = rels?.match(/Target="\.\.\/notesSlides\/(notesSlide\d+\.xml)"/)?.[1];
    if (notesPath) {
      const notes = await zip.file(`ppt/notesSlides/${notesPath}`)?.async("string");
      // Notes pages also repeat the slide number as a text field, so skip very short lines.
      const text = notes ? slideXmlToText(notes).split("\n").filter((l) => l.length > 3) : [];
      if (text.length > 0) parts.push(`Speaker notes: ${text.join("\n")}`);
    }

    // A slide with no typed text is usually a picture of text, so OCR its images.
    if (!parts[0] && rels) {
      for (const match of rels.matchAll(/Target="\.\.\/media\/([^"]+\.(?:png|jpe?g|webp))"/gi)) {
        const image = await zip.file(`ppt/media/${match[1]}`)?.async("nodebuffer");
        if (image) parts.push(await readImage(image, label, warnings));
      }
    }

    const text = parts.filter(Boolean).join("\n").trim();
    if (text) pages.push({ page: number, text });
    else warnings.push(`${label} has no text that could be read.`);
  }
  return pages;
}
