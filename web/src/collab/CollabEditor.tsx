// A text file edited live with nearby laptops.
import { useEffect, useRef, useState } from "react";
import {
  CollabDoc,
  textDiff,
  type CollabOp,
  type CollabServerMessage,
  type CollabStatus,
} from "../../../shared/collab";
import { collabApi } from "./collabApi";

interface Props {
  roomKey: string;
  onBack: () => void;
}

export function CollabEditor({ roomKey, onBack }: Props) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const doc = useRef(new CollabDoc());
  const socket = useRef<WebSocket | null>(null);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<CollabStatus | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let stopped = false;
    let retry: ReturnType<typeof setTimeout> | undefined;

    /** Shows the doc's text, keeping this person's cursor on the same characters. */
    function render(update: () => void) {
      const box = textarea.current;
      if (!box) return update();
      const focused = document.activeElement === box;
      const start = doc.current.anchor(box.selectionStart);
      const end = doc.current.anchor(box.selectionEnd);
      update();
      const text = doc.current.text();
      if (box.value !== text) box.value = text;
      if (focused) {
        box.setSelectionRange(doc.current.position(start), doc.current.position(end));
      }
      setName(doc.current.name);
    }

    function open() {
      const ws = new WebSocket(collabApi.socketUrl(roomKey));
      socket.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onmessage = (event) => {
        const message = JSON.parse(event.data as string) as CollabServerMessage;
        if (message.type === "snapshot") {
          // Keep the site, so ids stay unique, but rebuild from what was saved.
          const fresh = new CollabDoc(doc.current.site);
          render(() => {
            const old = doc.current;
            doc.current = fresh;
            fresh.applyAll(message.ops);
            fresh.clock = Math.max(fresh.clock, old.clock);
            // Carry the counter over so new characters never reuse an id.
            fresh.next = old.next;
          });
          setStatus(message.status);
        } else if (message.type === "ops") {
          render(() => doc.current.applyAll(message.ops));
        } else if (message.type === "status") {
          setStatus(message.status);
        } else if (message.type === "error") {
          setError(message.error);
        }
      };
      ws.onclose = (event) => {
        setConnected(false);
        if (stopped) return;
        if (event.code === 4000) {
          onBack();
          return;
        }
        retry = setTimeout(open, 1000);
      };
    }

    open();
    return () => {
      stopped = true;
      clearTimeout(retry);
      socket.current?.close();
    };
  }, [roomKey, onBack]);

  function onInput() {
    const box = textarea.current!;
    const change = textDiff(doc.current.text(), box.value);
    if (!change) return;
    const ops: CollabOp[] = doc.current.edit(change.pos, change.removed, change.inserted);
    if (socket.current?.readyState === WebSocket.OPEN) {
      socket.current.send(JSON.stringify({ type: "ops", ops }));
    } else {
      setError("Not connected, so that change wasn't saved.");
    }
  }

  async function copyCode() {
    await navigator.clipboard.writeText(roomKey).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function download() {
    const url = URL.createObjectURL(new Blob([doc.current.text()], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name || "shared.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  const writable = status?.writable ?? false;

  return (
    <section>
      <div className="row">
        <button className="secondary" onClick={onBack}>
          Back
        </button>
        <h2 className="collab-title">{name || "Waiting for the file…"}</h2>
      </div>

      <p className="muted">
        {!connected
          ? "Reconnecting to the local server…"
          : `${status?.peers ?? 0} nearby ${status?.peers === 1 ? "laptop" : "laptops"} connected · ${
              status?.writers ?? 1
            } can edit`}
      </p>
      {connected && !writable && (
        <p className="banner">
          You can read this file. You'll be able to edit as soon as a laptop that already has it
          connects and lets you in.
        </p>
      )}
      {error && <p className="banner error">{error}</p>}

      <textarea
        ref={textarea}
        className="collab-text"
        aria-label="Shared file"
        spellCheck={false}
        readOnly={!writable || !connected}
        onInput={onInput}
      />

      <div className="row">
        <code className="collab-code">{roomKey}</code>
        <button className="secondary" onClick={copyCode}>
          {copied ? "Copied" : "Copy code"}
        </button>
        <button className="secondary" onClick={download}>
          Download
        </button>
      </div>
    </section>
  );
}
