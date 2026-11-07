// Speech-to-text and text-to-speech through QVAC.
// The browser converts recordings to 16 kHz WAV first, so ffmpeg isn't needed.
import { textToSpeech, transcribe as qvacTranscribe } from "@qvac/sdk";
import { ensureModel } from "../ai/models";
import { pcmToWav } from "./wav";

export const VOICE_IS_PLACEHOLDER = false;

const MAX_SPOKEN_CHARS = 4000;

export interface SpokenAudio {
  mimeType: string;
  bytes: Buffer;
}

export async function transcribe(audio: Buffer, _mimeType: string): Promise<string> {
  if (audio.subarray(0, 4).toString("ascii") !== "RIFF") {
    throw new Error("The recording must be sent as a WAV file.");
  }
  const modelId = await ensureModel("stt");
  // The SDK's Buffer type comes from its own copy of the Node types.
  const text = await qvacTranscribe({ modelId, audioChunk: audio as never });
  // Whisper labels silence and noise like [BLANK_AUDIO] instead of leaving it empty.
  return text.replace(/\[[^\]]*\]|\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
}

/** Citations and markdown symbols shouldn't be read out. */
export function speakableText(text: string): string {
  return text
    .replace(/\[\d+\]/g, "")
    .replace(/[*_#`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SPOKEN_CHARS);
}

/** Returns null when there is nothing to say, such as text made only of symbols. */
export async function speak(text: string): Promise<SpokenAudio | null> {
  const spoken = speakableText(text);
  if (!/[\p{L}\p{N}]/u.test(spoken)) return null;
  const modelId = await ensureModel("tts");
  const result = textToSpeech({
    modelId,
    text: spoken,
    inputType: "text",
    stream: false,
  });
  const samples = await result.buffer;
  const sampleRate = await result.sampleRate;
  if (!sampleRate || samples.length === 0) return null;
  return { mimeType: "audio/wav", bytes: pcmToWav(samples, sampleRate) };
}
