// Browsers record compressed audio. The speech model on the server takes WAV, so
// convert here using the browser's own decoder, which means ffmpeg isn't needed.
const SAMPLE_RATE = 16000;

export async function toWav(recording: Blob): Promise<Blob> {
  const decoder = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await decoder.decodeAudioData(await recording.arrayBuffer());
  } finally {
    void decoder.close();
  }

  const offline = new OfflineAudioContext(
    1,
    Math.ceil(decoded.duration * SAMPLE_RATE),
    SAMPLE_RATE,
  );
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const samples = (await offline.startRendering()).getChannelData(0);

  const wav = new DataView(new ArrayBuffer(44 + samples.length * 2));
  const writeText = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) wav.setUint8(offset + i, text.charCodeAt(i));
  };
  writeText(0, "RIFF");
  wav.setUint32(4, 36 + samples.length * 2, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  wav.setUint32(16, 16, true);
  wav.setUint16(20, 1, true); // PCM
  wav.setUint16(22, 1, true); // mono
  wav.setUint32(24, SAMPLE_RATE, true);
  wav.setUint32(28, SAMPLE_RATE * 2, true);
  wav.setUint16(32, 2, true);
  wav.setUint16(34, 16, true);
  writeText(36, "data");
  wav.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, i) => {
    const clamped = Math.max(-1, Math.min(1, sample));
    wav.setInt16(44 + i * 2, clamped * 32767, true);
  });
  return new Blob([wav], { type: "audio/wav" });
}
