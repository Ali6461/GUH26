// Shared files: share a text file, or open one from a nearby laptop.
import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import type { CollabLobby } from "../../../shared/collab";
import { useLanguage } from "../i18n";
import { collabApi } from "./collabApi";
import { CollabEditor } from "./CollabEditor";

const REFRESH_MS = 2000;

export function CollabPage() {
  const { t } = useLanguage();
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
      setError(e instanceof Error ? e.message : t("somethingWrong"));
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
      <h2>{t("modeShared")}</h2>
      <p className="muted">{t("collabIntro")}</p>

      <div className="row">
        <label className={busy ? "attach muted" : "attach"} aria-disabled={busy}>
          {t("collabShareFile")}
          <input type="file" accept=".txt,.md,.csv,.json,text/*" onChange={shareFile} disabled={busy} hidden />
        </label>
        <button type="button" className="secondary" onClick={newFile} disabled={busy}>
          {t("collabNewFile")}
        </button>
      </div>

      <h3>{t("collabYourFiles")}</h3>
      {lobby?.rooms.length === 0 && <p className="muted">{t("collabNoneYet")}</p>}
      <ul className="documents">
        {lobby?.rooms.map((room) => (
          <li key={room.key} className="row">
            <button type="button" onClick={() => setOpen(room.key)}>{room.name}</button>
            <span className="muted">
              {t("collabConnected", { n: room.peers })}
              {room.writable ? "" : ` · ${t("collabReadOnly")}`}
            </span>
            <button type="button" className="secondary" onClick={() => leave(room.key)} disabled={busy}>
              {t("collabRemove")}
            </button>
          </li>
        ))}
      </ul>

      <h3>{t("collabNearby")}</h3>
      {lobby?.nearby.length === 0 && <p className="muted">{t("collabNoNearby")}</p>}
      <ul className="documents">
        {lobby?.nearby.map((room) => (
          <li key={room.key} className="row">
            <button type="button" onClick={() => join(room.key)} disabled={busy}>
              {room.name ? t("collabOpen", { name: room.name }) : t("collabOpenUnnamed")}
            </button>
            <span className="muted">
              {room.peers === 1
                ? t("collabOnLaptop")
                : t("collabOnLaptops", { n: room.peers })}
            </span>
          </li>
        ))}
      </ul>

      <h3>{t("collabJoinCode")}</h3>
      <form
        className="row"
        onSubmit={(event) => {
          event.preventDefault();
          join(code.trim());
        }}
      >
        <input
          className="collab-input"
          placeholder={t("collabCodePlaceholder")}
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
        <button type="submit" disabled={busy || !code.trim()}>
          {t("collabJoin")}
        </button>
      </form>

      <details>
        <summary>{t("collabNotShowing")}</summary>
        <p className="muted">{t("collabConnectHint", { port: lobby?.port ?? "…" })}</p>
        <form className="row" onSubmit={connect}>
          <input
            className="collab-input"
            placeholder="192.168.1.20:49737"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
          />
          <button type="submit" disabled={busy || !address.trim()}>
            {t("collabConnect")}
          </button>
        </form>
      </details>

      {error && <p className="banner error">{error}</p>}
    </section>
  );
}
