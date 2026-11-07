// Shared files: share a text file, or open one from a nearby laptop.
import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import type { CollabLobby } from "../../../shared/collab";
import { collabApi } from "./collabApi";
import { CollabEditor } from "./CollabEditor";

const REFRESH_MS = 2000;

export function CollabPage() {
  const [open, setOpen] = useState<string | null>(null);
  const [lobby, setLobby] = useState<CollabLobby | null>(null);
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const back = useCallback(() => setOpen(null), []);

  useEffect(() => {
    if (open) return;
    let live = true;
    const load = () =>
      collabApi.lobby().then(
        (next) => live && setLobby(next),
        (e: Error) => live && setError(e.message),
      );
    void load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [open]);

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function shareFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    void run(async () => {
      const room = await collabApi.create(file.name, await file.text());
      setOpen(room.key);
    });
  }

  function newFile() {
    void run(async () => {
      const room = await collabApi.create("Untitled.txt", "");
      setOpen(room.key);
    });
  }

  function join(key: string) {
    void run(async () => {
      const room = await collabApi.join(key);
      setCode("");
      setOpen(room.key);
    });
  }

  function connect(event: FormEvent) {
    event.preventDefault();
    const [host, port] = address.trim().split(":");
    void run(async () => {
      await collabApi.connect(host, Number(port) || lobby?.port || 49737);
      setAddress("");
    });
  }

  function leave(key: string) {
    void run(async () => {
      await collabApi.leave(key);
      setLobby((current) =>
        current && { ...current, rooms: current.rooms.filter((room) => room.key !== key) },
      );
    });
  }

  if (open) return <CollabEditor roomKey={open} onBack={back} />;

  return (
    <section>
      <h2>Shared files</h2>
      <p className="muted">
        Edit a text file together with classmates on the same Wi-Fi or hotspot. No internet
        needed: laptops talk to each other directly.
      </p>

      <div className="row">
        <label className="file-button">
          Share a text file
          <input type="file" accept=".txt,.md,.csv,.json,text/*" onChange={shareFile} disabled={busy} hidden />
        </label>
        <button className="secondary" onClick={newFile} disabled={busy}>
          New blank file
        </button>
      </div>

      <h3>Your shared files</h3>
      {lobby?.rooms.length === 0 && <p className="muted">None yet.</p>}
      <ul className="documents">
        {lobby?.rooms.map((room) => (
          <li key={room.key} className="row">
            <button onClick={() => setOpen(room.key)}>{room.name}</button>
            <span className="muted">
              {room.peers} connected{room.writable ? "" : " · read only for now"}
            </span>
            <button className="secondary" onClick={() => leave(room.key)} disabled={busy}>
              Remove
            </button>
          </li>
        ))}
      </ul>

      <h3>Nearby</h3>
      {lobby?.nearby.length === 0 && (
        <p className="muted">No one nearby is sharing a file yet. Looking…</p>
      )}
      <ul className="documents">
        {lobby?.nearby.map((room) => (
          <li key={room.key} className="row">
            <button onClick={() => join(room.key)} disabled={busy}>
              Open {room.name || "a shared file"}
            </button>
            <span className="muted">
              on {room.peers} {room.peers === 1 ? "laptop" : "laptops"}
            </span>
          </li>
        ))}
      </ul>

      <h3>Join with a code</h3>
      <form
        className="row"
        onSubmit={(event) => {
          event.preventDefault();
          join(code.trim());
        }}
      >
        <input
          className="collab-input"
          placeholder="Paste the code from the other laptop"
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
        <button type="submit" disabled={busy || !code.trim()}>
          Join
        </button>
      </form>

      <details>
        <summary>Laptop not showing up?</summary>
        <p className="muted">
          Some networks block the broadcasts used to find laptops. Connect straight to the other
          laptop's IP address instead. This laptop accepts connections on port {lobby?.port ?? "…"}.
        </p>
        <form className="row" onSubmit={connect}>
          <input
            className="collab-input"
            placeholder="192.168.1.20:49737"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
          />
          <button type="submit" disabled={busy || !address.trim()}>
            Connect
          </button>
        </form>
      </details>

      {error && <p className="banner error">{error}</p>}
    </section>
  );
}
