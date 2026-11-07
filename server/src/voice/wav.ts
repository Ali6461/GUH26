// QVAC returns speech as raw 16-bit samples, and browsers need a WAV header to play them.
export function pcmToWav(samples: ArrayLike<number>, sampleRate: number): Buffer {
  const dataBytes = samples.length * 2;
  const wav = Buffer.alloc(44 + dataBytes);
  wav.write("RIFF", 0, "ascii");
  wav.writeUInt32LE(36 + dataBytes, 4);
  wav.write("WAVE", 8, "ascii");
  wav.write("fmt ", 12, "ascii");
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20); // PCM
  wav.writeUInt16LE(1, 22); // mono
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36, "ascii");
  wav.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-32768, Math.min(32767, Math.round(samples[i])));
    wav.writeInt16LE(sample, 44 + i * 2);
  }
  return wav;
}
