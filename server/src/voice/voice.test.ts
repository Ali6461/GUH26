import assert from "node:assert/strict";
import { test } from "node:test";
import { speakableText } from "./speakable";
import { pcmToWav } from "./wav";

test("pcmToWav writes a playable header and clamps samples", () => {
  const wav = pcmToWav([0, 1000, -1000, 99999], 44100);
  assert.equal(wav.toString("ascii", 0, 4), "RIFF");
  assert.equal(wav.toString("ascii", 8, 12), "WAVE");
  assert.equal(wav.readUInt32LE(4), wav.length - 8);
  assert.equal(wav.readUInt32LE(24), 44100);
  assert.equal(wav.readUInt32LE(40), 8);
  assert.equal(wav.readInt16LE(46), 1000);
  assert.equal(wav.readInt16LE(48), -1000);
  assert.equal(wav.readInt16LE(50), 32767);
});

test("speakableText removes citations, Markdown and LaTeX", () => {
  assert.equal(speakableText("The **cell** makes ATP [1]."), "The cell makes ATP .");
  assert.equal(speakableText("So $ F = m a $ holds."), "So F = m a holds.");
  assert.equal(speakableText("It is \\( \\frac{d x}{d t} \\) here."), "It is d x over d t here.");
  assert.equal(speakableText("\\[ x^{2} \\]"), "x 2");
  assert.equal(speakableText("It costs $5."), "It costs $5.");
});
