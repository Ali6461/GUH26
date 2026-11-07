// Shared files, edited together by laptops on the same network with no internet.
//
// Each shared file is one Autobase. Every laptop that edits it has its own
// writer core, and Autobase merges them into one ordered list of operations,
// the view. The operations are CRDT edits (see shared/collab.ts), so the text
// comes out the same whatever order Autobase settles on.
//
// Finding each other: every laptop broadcasts a small UDP packet on the local
// network every few seconds, listing its shared files and its TCP port. Laptops
// with a file in common connect over TCP, wrap the socket in an encrypted
// Noise stream (the same one Hyperswarm uses) and replicate. Nothing goes
// through the internet or the public DHT, so it works on a hotspot with no data.
import { createSocket, type Socket as UdpSocket } from "node:dgram";
import { randomBytes } from "node:crypto";
import { EventEmitter } from "node:events";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer, connect, type Server, type Socket } from "node:net";
import { networkInterfaces } from "node:os";
import { resolve } from "node:path";
import Autobase from "autobase";
import Corestore from "corestore";
import SecretStream from "@hyperswarm/secret-stream";
import Protomux from "protomux";
import c from "compact-encoding";
import idEncoding from "hypercore-id-encoding";
import type {
  CollabLobby,
  CollabOp,
  CollabRoomInfo,
  CollabStatus,
  NearbyRoom,
} from "../../../shared/collab";

const APP = "guh26-collab";
const ANNOUNCE_EVERY_MS = 3000;
/** Forget a nearby laptop after this long without hearing from it. */
const NEARBY_TTL_MS = 10_000;
const MAX_NAME = 200;

interface SavedRoom {
  key: string;
  /** The Corestore namespace holding this room's cores. */
  ns: string;
  createdAt: string;
}

interface Announce {
  app: typeof APP;
  id: string;
  port: number;
  rooms: { key: string; name: string }[];
}

type PeerMessage =
  | { type: "hello"; id: string; rooms: string[] }
  | { type: "join"; room: string; writer: string };

/** Normalises a hex or z-base-32 key to hex, or returns null if it isn't one. */
export function normalizeKey(key: unknown): string | null {
  if (typeof key !== "string") return null;
  try {
    const buffer = idEncoding.decode(key.trim()) as Buffer;
    return buffer.length === 32 ? buffer.toString("hex") : null;
  } catch {
    return null;
  }
}

/** One shared file. */
export class Room extends EventEmitter {
  readonly base: any;
  readonly key: string;
  readonly createdAt: string;
  /** A copy of the view, so new browsers get every operation at once. */
  readonly ops: CollabOp[] = [];
  name = "";
  readonly writers = new Set<string>();
  /** Peers that told us they have this room. */
  readonly peers = new Set<Peer>();
  private refreshing: Promise<void> = Promise.resolve();

  constructor(base: any, createdAt: string) {
    super();
    this.base = base;
    this.key = base.key.toString("hex");
    this.createdAt = createdAt;
    this.writers.add(this.key);
    base.on("update", () => this.refresh());
    base.on("writable", () => this.emit("status"));
    base.on("error", (error: Error) => console.error("Shared file error:", error));
    // When writers merge, Autobase can rewind the view and apply it again in a
    // new order. Drop the rewound part, so it's read and sent again.
    base.view.on("truncate", (length: number) => {
      if (length >= this.ops.length) return;
      this.ops.length = length;
      this.emit("truncate", length);
    });
  }

  get writable(): boolean {
    return this.base.writable;
  }

  status(): CollabStatus {
    return { writable: this.writable, peers: this.peers.size, writers: this.writers.size };
  }

  info(): CollabRoomInfo {
    return {
      key: this.key,
      name: this.name || "Waiting for the file…",
      createdAt: this.createdAt,
      writable: this.writable,
      peers: this.peers.size,
    };
  }

  /** Reads anything new in the view into `ops`, one refresh at a time. */
  refresh(): Promise<void> {
    this.refreshing = this.refreshing.then(async () => {
      const before = this.ops.length;
      const writersBefore = this.writers.size;
      while (this.ops.length < this.base.view.length) {
        const op = (await this.base.view.get(this.ops.length)) as CollabOp;
        this.ops.push(op);
        if (op.t === "name" && !this.name) this.name = op.name;
        if (op.t === "writer") this.writers.add(op.key);
      }
      if (this.ops.length > before) this.emit("ops", before);
      if (this.writers.size !== writersBefore) this.emit("status");
    }).catch((error) => console.error("Couldn't read shared file:", error));
    return this.refreshing;
  }

  async append(ops: CollabOp[]): Promise<void> {
    if (!this.writable) throw new Error("You can't edit yet. Wait for someone to let you in.");
    if (ops.length > 0) await this.base.append(ops);
  }
}

/** One connected laptop. */
class Peer {
  id: string | null = null;
  rooms = new Set<string>();
  readonly stream: any;
  private readonly message: any;

  constructor(
    readonly manager: CollabManager,
    readonly socket: Socket,
    readonly initiator: boolean,
  ) {
    this.stream = new SecretStream(initiator, socket);
    this.stream.on("error", () => {});
    this.stream.on("close", () => manager.dropPeer(this));
    // Hypercore replication and our messages share one connection.
    const mux = Protomux.from(this.stream);
    const channel = mux.createChannel({ protocol: APP });
    this.message = channel.addMessage({
      encoding: c.json,
      onmessage: (message: PeerMessage) => manager.onPeerMessage(this, message),
    });
    channel.open();
    this.sendHello();
    for (const room of manager.rooms.values()) room.base.replicate(this.stream);
  }

  send(message: PeerMessage): void {
    this.message.send(message);
  }

  sendHello(): void {
    this.send({ type: "hello", id: this.manager.id, rooms: [...this.manager.rooms.keys()] });
  }

  destroy(): void {
    this.stream.destroy();
  }
}

export class CollabManager extends EventEmitter {
  /** Random per run. Decides which side dials, so two laptops make one connection. */
  readonly id = randomBytes(8).toString("hex");
  readonly rooms = new Map<string, Room>();
  readonly peers = new Set<Peer>();
  private readonly store: any;
  private readonly saved: SavedRoom[];
  private readonly savedFile: string;
  private readonly dialing = new Set<string>();
  private readonly nearby = new Map<string, { name: string; seen: Map<string, number> }>();
  private tcp: Server | null = null;
  private udp: UdpSocket | null = null;
  private timer: NodeJS.Timeout | null = null;
  port = 0;

  constructor(
    private readonly dir: string,
    private readonly options: { port: number; discoveryPort: number | null },
  ) {
    super();
    mkdirSync(dir, { recursive: true });
    this.store = new Corestore(resolve(dir, "cores"));
    this.savedFile = resolve(dir, "rooms.json");
    try {
      this.saved = JSON.parse(readFileSync(this.savedFile, "utf8")) as SavedRoom[];
    } catch {
      this.saved = [];
    }
  }

  async start(): Promise<void> {
    await this.store.ready();
    for (const saved of this.saved) {
      await this.openRoom(saved).catch((error) => console.error("Couldn't open shared file:", error));
    }
    await this.listen();
    if (this.options.discoveryPort !== null) this.startDiscovery(this.options.discoveryPort);
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.udp?.close();
    this.tcp?.close();
    for (const peer of this.peers) peer.destroy();
    for (const room of this.rooms.values()) await room.base.close();
    await this.store.close();
  }

  lobby(): CollabLobby {
    const now = Date.now();
    const nearby: NearbyRoom[] = [];
    for (const [key, entry] of this.nearby) {
      for (const [id, seen] of entry.seen) if (now - seen > NEARBY_TTL_MS) entry.seen.delete(id);
      if (entry.seen.size === 0) this.nearby.delete(key);
      else if (!this.rooms.has(key)) nearby.push({ key, name: entry.name, peers: entry.seen.size });
    }
    return {
      rooms: [...this.rooms.values()].map((room) => room.info()),
      nearby,
      port: this.port,
    };
  }

  /** Shares a new file. This laptop becomes its first editor. */
  async create(name: string, text: string): Promise<Room> {
    const room = await this.openRoom({
      key: "",
      ns: randomBytes(16).toString("hex"),
      createdAt: new Date().toISOString(),
    });
    const ops: CollabOp[] = [{ t: "name", name: name.slice(0, MAX_NAME) || "Untitled.txt" }];
    // The first text is written by a made-up site, so it never clashes with an editor.
    if (text) ops.push({ t: "ins", site: "0", n: 0, ts: 1, after: null, text });
    await room.append(ops);
    await room.refresh();
    return room;
  }

  /** Opens someone else's shared file and asks to edit it. */
  async join(key: string): Promise<Room> {
    const existing = this.rooms.get(key);
    if (existing) return existing;
    const room = await this.openRoom({
      key,
      ns: randomBytes(16).toString("hex"),
      createdAt: new Date().toISOString(),
    });
    this.dialNearby(key);
    return room;
  }

  async leave(key: string): Promise<void> {
    const room = this.rooms.get(key);
    if (!room) return;
    this.rooms.delete(key);
    const index = this.saved.findIndex((saved) => saved.key === key);
    if (index >= 0) this.saved.splice(index, 1);
    this.save();
    room.emit("closed");
    await room.base.close();
    for (const peer of this.peers) peer.sendHello();
  }

  /** Connects straight to a laptop, for networks that block broadcasts. */
  connectTo(host: string, port: number): Promise<void> {
    return new Promise((done, fail) => {
      const socket = connect({ host, port });
      socket.setTimeout(5000, () => socket.destroy(new Error(`No answer from ${host}:${port}.`)));
      socket.once("connect", () => {
        socket.setTimeout(0);
        this.addPeer(socket, true);
        done();
      });
      socket.once("error", fail);
    });
  }

  private async openRoom(saved: SavedRoom): Promise<Room> {
    const base = new Autobase(this.store.namespace(saved.ns), saved.key ? Buffer.from(saved.key, "hex") : null, {
      valueEncoding: c.json,
      ackInterval: 1000,
      open: (viewStore: any) => viewStore.get({ name: "ops", valueEncoding: c.json }),
      apply,
    });
    await base.ready();
    const room = new Room(base, saved.createdAt);
    room.on("status", () => this.emit("change"));
    this.rooms.set(room.key, room);
    if (!saved.key) {
      saved.key = room.key;
    }
    if (!this.saved.some((s) => s.key === room.key)) {
      this.saved.push(saved);
      this.save();
    }
    await room.refresh();
    for (const peer of this.peers) {
      base.replicate(peer.stream);
      peer.sendHello();
      if (peer.rooms.has(room.key)) this.linkPeer(peer, room);
    }
    return room;
  }

  private save(): void {
    writeFileSync(this.savedFile, JSON.stringify(this.saved, null, 2));
  }

  private listen(): Promise<void> {
    return new Promise((done) => {
      const server = createServer((socket) => this.addPeer(socket, false));
      server.once("error", () => {
        // The usual port is taken, so let the system pick one.
        server.listen(0, "0.0.0.0", () => {
          this.port = (server.address() as { port: number }).port;
          done();
        });
      });
      server.listen(this.options.port, "0.0.0.0", () => {
        this.port = (server.address() as { port: number }).port;
        done();
      });
      this.tcp = server;
    });
  }

  private addPeer(socket: Socket, initiator: boolean): void {
    socket.setNoDelay(true);
    const peer = new Peer(this, socket, initiator);
    this.peers.add(peer);
  }

  dropPeer(peer: Peer): void {
    if (!this.peers.delete(peer)) return;
    for (const room of this.rooms.values()) {
      if (room.peers.delete(peer)) room.emit("status");
    }
    this.emit("change");
  }

  onPeerMessage(peer: Peer, message: PeerMessage): void {
    if (message.type === "hello") {
      if (message.id === this.id) {
        peer.destroy(); // Connected to ourselves.
        return;
      }
      peer.id = message.id;
      // Two laptops can dial each other at once. Both keep the connection
      // started by the smaller id, so they agree on which one to close.
      for (const other of this.peers) {
        if (other === peer || other.id !== peer.id) continue;
        const otherDialer = other.initiator ? this.id : other.id;
        const keepOther = otherDialer < (peer.initiator ? this.id : peer.id!);
        (keepOther ? peer : other).destroy();
        if (keepOther) return;
      }
      peer.rooms = new Set(message.rooms);
      for (const room of this.rooms.values()) {
        if (peer.rooms.has(room.key)) this.linkPeer(peer, room);
        else if (room.peers.delete(peer)) room.emit("status");
      }
      return;
    }
    if (message.type === "join") {
      const room = this.rooms.get(message.room);
      const writer = normalizeKey(message.writer);
      // Anyone who can already edit lets the newcomer in.
      if (room?.writable && writer && !room.writers.has(writer)) {
        room.writers.add(writer); // Stops a second request appending it twice.
        room.append([{ t: "writer", key: writer }]).catch((error) => {
          room.writers.delete(writer);
          console.error("Couldn't add an editor:", error);
        });
      }
    }
  }

  private linkPeer(peer: Peer, room: Room): void {
    if (!room.peers.has(peer)) {
      room.peers.add(peer);
      room.emit("status");
    }
    if (!room.writable) {
      peer.send({ type: "join", room: room.key, writer: room.base.local.key.toString("hex") });
    }
  }

  private startDiscovery(port: number): void {
    const udp = createSocket({ type: "udp4", reuseAddr: true });
    udp.on("error", (error) => console.error("Local network discovery stopped:", error.message));
    udp.on("message", (data, from) => this.onAnnounce(data, from.address));
    udp.bind(port, () => {
      udp.setBroadcast(true);
      this.announce(port);
      this.timer = setInterval(() => this.announce(port), ANNOUNCE_EVERY_MS);
    });
    this.udp = udp;
  }

  private announce(port: number): void {
    const message: Announce = {
      app: APP,
      id: this.id,
      port: this.port,
      rooms: [...this.rooms.values()].map((room) => ({ key: room.key, name: room.name })),
    };
    const data = Buffer.from(JSON.stringify(message));
    for (const address of broadcastAddresses()) {
      this.udp?.send(data, port, address, () => {});
    }
  }

  /** Where each nearby laptop was last heard, so joining can dial straight away. */
  private readonly addresses = new Map<string, { host: string; port: number; rooms: Set<string> }>();

  private onAnnounce(data: Buffer, host: string): void {
    let message: Announce;
    try {
      message = JSON.parse(data.toString("utf8")) as Announce;
    } catch {
      return;
    }
    if (message.app !== APP || message.id === this.id || !Array.isArray(message.rooms)) return;
    const rooms = new Set<string>();
    for (const room of message.rooms) {
      const key = normalizeKey(room?.key);
      if (!key) continue;
      rooms.add(key);
      const entry = this.nearby.get(key) ?? { name: "", seen: new Map<string, number>() };
      if (typeof room.name === "string" && room.name) entry.name = room.name.slice(0, MAX_NAME);
      entry.seen.set(message.id, Date.now());
      this.nearby.set(key, entry);
    }
    this.addresses.set(message.id, { host, port: message.port, rooms });
    if ([...rooms].some((key) => this.rooms.has(key))) this.dial(message.id);
  }

  private dialNearby(key: string): void {
    for (const [id, address] of this.addresses) if (address.rooms.has(key)) this.dial(id);
  }

  private dial(id: string): void {
    // The smaller id dials, so two laptops don't both connect.
    if (this.id > id || this.dialing.has(id)) return;
    if ([...this.peers].some((peer) => peer.id === id)) return;
    const address = this.addresses.get(id);
    if (!address || !Number.isInteger(address.port)) return;
    this.dialing.add(id);
    this.connectTo(address.host, address.port)
      .catch(() => {}) // Try again on the next announcement.
      .finally(() => this.dialing.delete(id));
  }
}

/** Builds the view. It must give the same result on every laptop, so it only
 *  looks at the nodes it's given. */
async function apply(nodes: { value: unknown }[], view: any, host: any): Promise<void> {
  for (const node of nodes) {
    const values = Array.isArray(node.value) ? node.value : [node.value];
    for (const op of values as CollabOp[]) {
      if (!op || typeof op !== "object") continue; // Acks are null.
      if (op.t === "writer") {
        const key = normalizeKey(op.key);
        if (!key) continue;
        await host.addWriter(Buffer.from(key, "hex"), { indexer: true });
      }
      await view.append(op);
    }
  }
}

/** The broadcast address of each local network, plus the general one. */
function broadcastAddresses(): string[] {
  const addresses = new Set(["255.255.255.255"]);
  for (const list of Object.values(networkInterfaces())) {
    for (const item of list ?? []) {
      if (item.family !== "IPv4" || item.internal) continue;
      const ip = item.address.split(".").map(Number);
      const mask = item.netmask.split(".").map(Number);
      addresses.add(ip.map((part, i) => (part | (~mask[i] & 255)) >>> 0).join("."));
    }
  }
  return [...addresses];
}
