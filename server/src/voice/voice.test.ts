import assert from "node:assert/strict";
import { test } from "node:test";
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
