// PERSON 4: voice buttons used on the quiz page.
// Audio always goes to the local server. Don't use the browser's speech APIs,
// because they may not work offline.
import { useRef, useState } from "react";
import { api } from "../api";
import { Icon } from "../Icon";
import { useLanguage } from "../i18n";
import { toWav } from "./wav";

// The speech models on this laptop only handle English, so voice is hidden in other languages.
export function ReadAloudButton({
  text,
  variant = "secondary",
}: {
  text: string;
  variant?: "secondary" | "ghost";
}) {
  const { language } = useLanguage();
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

  if (language !== "en") return null;

  return (
    <div className="row">
      <button type="button" className={variant} onClick={play} disabled={busy}>
        <Icon name="speaker" />
        {busy ? "Preparing…" : "Read aloud"}
      </button>
      {error && <span className="warning">{error}</span>}
    </div>
  );
}

interface RecordProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  /** What the button says before recording. */
  label?: string;
}

export function RecordAnswerButton({
  onTranscript,
  disabled,
  label = "Speak answer",
}: RecordProps) {
  const { language } = useLanguage();
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

  if (language !== "en") return null;

  return (
    <>
      <button
        type="button"
        className={state === "recording" ? "danger" : "secondary"}
        onClick={state === "recording" ? () => recorder.current?.stop() : start}
        disabled={disabled || state === "transcribing"}
      >
        <Icon name={state === "recording" ? "stop" : "mic"} />
        {state === "idle" && label}
        {state === "recording" && "Stop recording"}
        {state === "transcribing" && "Transcribing…"}
      </button>
      {error && <span className="warning">{error}</span>}
    </>
  );
}
