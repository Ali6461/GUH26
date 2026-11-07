// HTTP routes and the editor WebSocket for shared files.
import type { Server } from "node:http";
import { resolve } from "node:path";
import { Router } from "express";
import { WebSocketServer, type WebSocket } from "ws";
import {
  isEditOp,
  type CollabClientMessage,
  type CollabServerMessage,
  type ConnectPeerRequest,
  type CreateRoomRequest,
  type JoinRoomRequest,
} from "../../../shared/collab";
import { DATA_DIR } from "../store";
import { CollabManager, normalizeKey, type Room } from "./index";

const MAX_TEXT = 1_000_000;

export const collab = new CollabManager(resolve(DATA_DIR, "collab"), {
  port: Number(process.env.COLLAB_PORT) || 49737,
  discoveryPort: Number(process.env.COLLAB_DISCOVERY_PORT) || 49737,
});

export class CollabBadRequest extends Error {}

export const collabRouter = Router();

collabRouter.get("/", (_req, res) => {
  res.json(collab.lobby());
});

collabRouter.post("/rooms", async (req, res) => {
  const { name, text } = req.body as CreateRoomRequest;
  if (typeof name !== "string" || !name.trim()) throw new CollabBadRequest("Give the file a name.");
  if (typeof text !== "string" || text.length > MAX_TEXT) {
    throw new CollabBadRequest("That file is too big to share.");
  }
  const room = await collab.create(name.trim(), text.replace(/\r\n/g, "\n"));
  res.status(201).json(room.info());
});

collabRouter.post("/join", async (req, res) => {
  const key = normalizeKey((req.body as JoinRoomRequest).key);
  if (!key) throw new CollabBadRequest("That code isn't right. Check it and try again.");
  res.json((await collab.join(key)).info());
});

collabRouter.post("/connect", async (req, res) => {
  const { host, port } = req.body as ConnectPeerRequest;
  if (typeof host !== "string" || !host.trim() || !Number.isInteger(port)) {
    throw new CollabBadRequest("Enter an address and port.");
  }
  try {
    await collab.connectTo(host.trim(), port);
  } catch (error) {
    throw new CollabBadRequest(
      error instanceof Error ? `Couldn't connect: ${error.message}` : "Couldn't connect.",
    );
  }
  res.status(204).end();
});

collabRouter.delete("/rooms/:key", async (req, res) => {
  await collab.leave(req.params.key);
  res.status(204).end();
});

/** Streams one shared file to a browser editor and takes its edits. */
export function attachCollabSockets(server: Server, isAllowed: (host?: string, origin?: string) => boolean) {
  const wss = new WebSocketServer({ noServer: true });
  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname !== "/api/collab/ws") return;
    const room = collab.rooms.get(normalizeKey(url.searchParams.get("room")) ?? "");
    if (!isAllowed(req.headers.host, req.headers.origin) || !room) {
      socket.end("HTTP/1.1 403 Forbidden\r\n\r\n");
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => serveEditor(ws, room));
  });
}

function serveEditor(ws: WebSocket, room: Room): void {
  let sent = 0;
  const send = (message: CollabServerMessage) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message));
  };
  const snapshot = () => {
    sent = room.ops.length;
    send({ type: "snapshot", ops: room.ops.slice(0, sent), status: room.status() });
  };
  const onOps = () => {
    if (room.ops.length <= sent) return;
    send({ type: "ops", ops: room.ops.slice(sent) });
    sent = room.ops.length;
  };
  // Re-sent operations are harmless: the editor ignores ones it already has.
  const onTruncate = (length: number) => {
    sent = Math.min(sent, length);
  };
  const onStatus = () => send({ type: "status", status: room.status() });
  const onClosed = () => ws.close(4000, "File closed");

  room.on("ops", onOps);
  room.on("truncate", onTruncate);
  room.on("status", onStatus);
  room.on("closed", onClosed);
  ws.on("close", () => {
    room.off("ops", onOps);
    room.off("truncate", onTruncate);
    room.off("status", onStatus);
    room.off("closed", onClosed);
  });

  ws.on("message", (data) => {
    let message: CollabClientMessage;
    try {
      message = JSON.parse(data.toString()) as CollabClientMessage;
    } catch {
      return;
    }
    if (message.type === "resync") {
      snapshot();
      return;
    }
    if (message.type !== "ops" || !Array.isArray(message.ops) || !message.ops.every(isEditOp)) {
      send({ type: "error", error: "That edit couldn't be read." });
      return;
    }
    room.append(message.ops).catch((error: Error) => {
      send({ type: "error", error: error.message });
      snapshot(); // Puts the editor back in step with what was really saved.
    });
  });

  snapshot();
}
