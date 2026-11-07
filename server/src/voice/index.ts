// PERSON 4: speech-to-text and text-to-speech with QVAC.
//
// Both functions are PLACEHOLDERS with no speech models in them.
//
// To do:
// 1. Add speech-to-text and text-to-speech through QVAC.
// 2. The browser records audio/webm, so check what QVAC accepts. Converting
//    audio may need ffmpeg on the laptop.
// 3. Check memory use and delay with the Qwen3 4B model loaded at the same time.
// 4. Set VOICE_IS_PLACEHOLDER to false.

export const VOICE_IS_PLACEHOLDER = true;

export interface SpokenAudio {
  mimeType: string;
  bytes: Buffer;
}

export async function transcribe(_audio: Buffer, _mimeType: string): Promise<string> {
  return "[Placeholder] This is not a real transcript.";
}

/** Returns null until text-to-speech is connected. */
export async function speak(_text: string): Promise<SpokenAudio | null> {
  return null;
}
