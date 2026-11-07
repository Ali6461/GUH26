import assert from "node:assert/strict";
import { test } from "node:test";
import {
  chunkText,
  cosineSimilarity,
  parseJsonObject,
  pickSpread,
  verifyQuote,
} from "./text";

const NOTES =
  "The mitochondrion produces ATP through oxidative phosphorylation. " +
  "Glycolysis occurs in the cytoplasm  and yields\ntwo pyruvate molecules. " +
  "The Krebs cycle takes place in the mitochondrial matrix.";

test("verifyQuote returns the notes' own wording for an exact quote", () => {
  assert.equal(
    verifyQuote("glycolysis occurs in the cytoplasm and yields two pyruvate molecules", NOTES),
    "Glycolysis occurs in the cytoplasm  and yields\ntwo pyruvate molecules",
  );
});

test("verifyQuote maps a close paraphrase back to the real sentence", () => {
  assert.equal(
    verifyQuote("the Krebs cycle takes place inside the matrix of the mitochondrial", NOTES),
    "The Krebs cycle takes place in the mitochondrial matrix.",
  );
});

test("verifyQuote rejects text that isn't in the notes", () => {
  assert.equal(verifyQuote("The French Revolution began in 1789 in Paris.", NOTES), null);
  assert.equal(verifyQuote("", NOTES), null);
});

test("chunkText keeps short text whole and drops scraps", () => {
  assert.deepEqual(chunkText("Too short."), []);
  const text = "A sentence that is long enough to keep as a passage on its own.";
  assert.deepEqual(chunkText(text), [text]);
});

test("chunkText respects the size limit, overlaps sentences and loses no words", () => {
  const sentences = Array.from({ length: 30 }, (_, i) => `Sentence number ${i} says something.`);
  const chunks = chunkText(sentences.join(" "), 200);
  assert.ok(chunks.length > 1);
  for (const chunk of chunks) assert.ok(chunk.length <= 240, `too long: ${chunk.length}`);
  for (const sentence of sentences) {
    assert.ok(chunks.some((chunk) => chunk.includes(sentence)), `lost: ${sentence}`);
  }
  const lastOfFirst = chunks[0].split(/(?<=\.)\s/).pop()!;
  assert.ok(chunks[1].startsWith(lastOfFirst));
});

test("chunkText splits text with no punctuation, such as OCR output", () => {
  const chunks = chunkText("word ".repeat(600).trim(), 500);
  assert.ok(chunks.length >= 6);
  for (const chunk of chunks) assert.ok(chunk.length <= 500);
});

test("cosineSimilarity ranks matching directions above others", () => {
  assert.equal(cosineSimilarity([1, 0], [2, 0]), 1);
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
  assert.equal(cosineSimilarity([0, 0], [1, 1]), 0);
});

test("pickSpread spreads picks across the notes and repeats only when it must", () => {
  const items = Array.from({ length: 100 }, (_, i) => i);
  assert.deepEqual(pickSpread(items, 4, 0), [0, 25, 50, 75]);
  assert.deepEqual(pickSpread(["a", "b"], 4, 0), ["a", "a", "b", "b"]);
  assert.deepEqual(pickSpread([], 3), []);
});

test("parseJsonObject ignores text around the JSON and survives bad JSON", () => {
  assert.deepEqual(parseJsonObject('<think></think>\n{"correct": true}\n'), { correct: true });
  assert.equal(parseJsonObject('{"correct": tru'), null);
  assert.equal(parseJsonObject("no json"), null);
});
