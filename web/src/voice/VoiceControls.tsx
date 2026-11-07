// PERSON 4: voice buttons used on the quiz page.
// Audio always goes to the local server. Don't use the browser's speech APIs,
// because they may not work offline.
import { useRef, useState } from "react";
import { api } from "../api";
import { toWav } from "./wav";

export function ReadAloudButton({ text }: { text: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function play() {
    setBusy(true);
    setError("");
    try {
      const url = URL.createObjectURL(await api.speak(text));
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that aloud.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="row">
      <button type="button" className="secondary" onClick={play} disabled={busy}>
        {busy ? "Preparing…" : "Read aloud"}
      </button>
      {error && <span className="warning">{error}</span>}
    </div>
  );
}

interface RecordProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

export function RecordAnswerButton({ onTranscript, disabled }: RecordProps) {
  const recorder = useRef<MediaRecorder | null>(null);
  const [state, setState] = useState<"idle" | "recording" | "transcribing">("idle");
  const [error, setError] = useState("");

  async function start() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      const next = new MediaRecorder(stream);
      next.ondataavailable = (event) => chunks.push(event.data);
      next.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        setState("transcribing");
        try {
          const wav = await toWav(new Blob(chunks, { type: next.mimeType }));
          const text = await api.transcribe(wav);
          if (text) onTranscript(text);
          else setError("Didn't catch that. Please try again.");
        } catch (e) {
          setError(e instanceof Error ? e.message : "Couldn't understand that.");
        } finally {
          setState("idle");
        }
      };
      next.start();
      recorder.current = next;
      setState("recording");
    } catch {
      setError("Couldn't access the microphone.");
    }
  }

  return (
    <>
      <button
        type="button"
        className="secondary"
        onClick={state === "recording" ? () => recorder.current?.stop() : start}
        disabled={disabled || state === "transcribing"}
      >
        {state === "idle" && "Speak answer"}
        {state === "recording" && "Stop recording"}
        {state === "transcribing" && "Transcribing…"}
      </button>
      {error && <span className="warning">{error}</span>}
    </>
  );
}
