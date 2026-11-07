// Server calls for shared files.
import type { ApiError } from "../../../shared/types";
import type { CollabLobby, CollabRoomInfo } from "../../../shared/collab";

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (response.status === 204) return undefined as T;
  if (response.ok) return (await response.json()) as T;
  const body = (await response.json().catch(() => null)) as ApiError | null;
  throw new Error(body?.error ?? `Request failed (${response.status}).`);
}

const post = <T>(url: string, body: unknown) =>
  call<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

export const collabApi = {
  lobby: () => call<CollabLobby>("/api/collab"),
  create: (name: string, text: string) => post<CollabRoomInfo>("/api/collab/rooms", { name, text }),
  join: (key: string) => post<CollabRoomInfo>("/api/collab/join", { key }),
  connect: (host: string, port: number) => post<void>("/api/collab/connect", { host, port }),
  leave: (key: string) => call<void>(`/api/collab/rooms/${key}`, { method: "DELETE" }),
  socketUrl: (key: string) =>
    `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/collab/ws?room=${key}`,
};
