// Shared files edited together over the local network. This file is the contract
// between the server and the web app for that feature, plus the small CRDT both
// sides use to turn edits into text. It's separate from types.ts on purpose, so
// the rest of the team's types don't change.
//
// How the text works: every character has a unique id, `${site}:${n}`, where
// `site` is a random id for one editor session and `n` counts up. An insert says
// which character it goes after. A delete marks characters as removed but keeps
// them as tombstones, so later inserts can still point at them. When two people
// insert at the same spot at the same time, the order is decided by
// (timestamp, site, n), the RGA rule. The result is that applying the same set
// of operations in any order that respects causality gives the same text.
// That matters twice over: Autobase may reorder the view when it merges
// writers, and the browser applies its own edits before they come back.

export type CollabOp =
  /** Names the file. The person who shares it appends this first. */
  | { t: "name"; name: string }
  /** Lets another laptop edit. `key` is the hex of its Autobase writer key. */
  | { t: "writer"; key: string }
  /** Inserts `text` after the character `after` (null means at the start). The
   *  characters get ids `${site}:${n}`, `${site}:${n + 1}` and so on. */
  | { t: "ins"; site: string; n: number; ts: number; after: string | null; text: string }
  | { t: "del"; runs: DeleteRun[] };

/** `count` characters from one site with consecutive ids, starting at `from`. */
export type DeleteRun = [site: string, from: number, count: number];

export interface CollabRoomInfo {
  /** The Autobase key, as the code people share. */
  key: string;
  name: string;
  createdAt: string;
  /** Whether this laptop may edit yet. Joiners wait for an existing editor to let them in. */
  writable: boolean;
  /** Connected laptops that have this file. */
  peers: number;
}

/** A shared file another laptop on this network is announcing. */
export interface NearbyRoom {
  key: string;
  name: string;
  /** How many nearby laptops have it. */
  peers: number;
}

export interface CollabLobby {
  rooms: CollabRoomInfo[];
  nearby: NearbyRoom[];
  /** The TCP port this laptop accepts peers on, for connecting by address. */
  port: number;
}

export interface CollabStatus {
  writable: boolean;
  peers: number;
  /** Laptops allowed to edit, including this one once it's let in. */
  writers: number;
}

export interface CreateRoomRequest {
  name: string;
  text: string;
}

export interface JoinRoomRequest {
  key: string;
}

export interface ConnectPeerRequest {
  host: string;
  port: number;
}

/** Sent by the server over the WebSocket at /api/collab/ws?room=key. */
export type CollabServerMessage =
  | { type: "snapshot"; ops: CollabOp[]; status: CollabStatus }
  | { type: "ops"; ops: CollabOp[] }
  | { type: "status"; status: CollabStatus }
  | { type: "error"; error: string };

/** Sent by the browser over the same WebSocket. */
export type CollabClientMessage = { type: "ops"; ops: CollabOp[] } | { type: "resync" };

interface Char {
  id: string;
  site: string;
  n: number;
  ts: number;
  ch: string;
  del: boolean;
}

/** Newer first, then by site and counter, so the order is total. */
function compare(a: Char, b: Char): number {
  if (a.ts !== b.ts) return a.ts - b.ts;
  if (a.site !== b.site) return a.site < b.site ? -1 : 1;
  return a.n - b.n;
}

export function newSiteId(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * The text of a shared file, built from operations. Each editor session makes
 * one of these, gives it a site id, and feeds it every operation it sees,
 * including its own coming back. Applying an operation twice is harmless.
 */
export class CollabDoc {
  readonly site: string;
  /** Lamport clock: above every timestamp seen so far. */
  clock = 0;
  name = "";
  readonly writers = new Set<string>();
  /** The counter for this site's next character id. */
  next = 0;
  private chars: Char[] = [];
  private byId = new Map<string, Char>();

  constructor(site = newSiteId()) {
    this.site = site;
  }

  /** Applies one operation. Returns true if the visible text may have changed. */
  apply(op: CollabOp): boolean {
    switch (op.t) {
      case "name":
        this.name = op.name;
        return false;
      case "writer":
        this.writers.add(op.key);
        return false;
      case "ins":
        return this.insert(op);
      case "del":
        return this.remove(op.runs);
      default:
        return false;
    }
  }

  applyAll(ops: CollabOp[]): boolean {
    let changed = false;
    for (const op of ops) changed = this.apply(op) || changed;
    return changed;
  }

  /**
   * Replaces `removed` visible characters at `pos` with `inserted`, applies the
   * change here and returns the operations to send to everyone else.
   */
  edit(pos: number, removed: number, inserted: string): CollabOp[] {
    const visible = this.visible();
    const ops: CollabOp[] = [];
    if (removed > 0) {
      const runs: DeleteRun[] = [];
      for (const char of visible.slice(pos, pos + removed)) {
        const last = runs[runs.length - 1];
        if (last && last[0] === char.site && last[1] + last[2] === char.n) last[2]++;
        else runs.push([char.site, char.n, 1]);
      }
      ops.push({ t: "del", runs });
    }
    if (inserted.length > 0) {
      ops.push({
        t: "ins",
        site: this.site,
        n: this.next,
        ts: this.clock + 1,
        after: pos > 0 ? visible[pos - 1].id : null,
        text: inserted,
      });
      this.next += inserted.length;
    }
    this.applyAll(ops);
    return ops;
  }

  text(): string {
    const parts: string[] = [];
    for (const char of this.chars) if (!char.del) parts.push(char.ch);
    return parts.join("");
  }

  /** The id of the visible character just before `pos`, or null at the start.
   *  Use it to remember a cursor across other people's edits. */
  anchor(pos: number): string | null {
    if (pos <= 0) return null;
    let seen = 0;
    let last: string | null = null;
    for (const char of this.chars) {
      if (char.del) continue;
      last = char.id;
      if (++seen === pos) return last;
    }
    return last;
  }

  /** The visible position just after the character `id`, even if it was deleted since. */
  position(id: string | null): number {
    if (id === null) return 0;
    const target = this.byId.get(id);
    if (!target) return 0;
    let pos = 0;
    for (const char of this.chars) {
      if (!char.del) pos++;
      if (char === target) return pos;
    }
    return pos;
  }

  private visible(): Char[] {
    return this.chars.filter((char) => !char.del);
  }

  private insert(op: Extract<CollabOp, { t: "ins" }>): boolean {
    if (op.ts > this.clock) this.clock = op.ts;
    if (op.text.length === 0 || this.byId.has(`${op.site}:${op.n}`)) return false;
    let index = -1;
    if (op.after !== null) {
      const after = this.byId.get(op.after);
      // Can't happen when operations arrive in causal order, which Autobase guarantees.
      if (!after) return false;
      index = this.chars.indexOf(after);
    }
    // RGA: step over anything newer that was also put right here.
    const probe: Char = { id: "", site: op.site, n: op.n, ts: op.ts, ch: "", del: false };
    let at = index + 1;
    while (at < this.chars.length && compare(this.chars[at], probe) > 0) at++;

    const fresh: Char[] = [];
    for (let k = 0; k < op.text.length; k++) {
      const char: Char = {
        id: `${op.site}:${op.n + k}`,
        site: op.site,
        n: op.n + k,
        ts: op.ts,
        ch: op.text[k],
        del: false,
      };
      fresh.push(char);
      this.byId.set(char.id, char);
    }
    // Spreading a whole file into splice would overflow the call stack.
    if (fresh.length < 1000) this.chars.splice(at, 0, ...fresh);
    else this.chars = this.chars.slice(0, at).concat(fresh, this.chars.slice(at));
    return true;
  }

  private remove(runs: DeleteRun[]): boolean {
    let changed = false;
    for (const [site, from, count] of runs) {
      for (let k = 0; k < count; k++) {
        const char = this.byId.get(`${site}:${from + k}`);
        if (char && !char.del) {
          char.del = true;
          changed = true;
        }
      }
    }
    return changed;
  }
}

/** The single replacement that turns `before` into `after`, or null if they're equal. */
export function textDiff(
  before: string,
  after: string,
): { pos: number; removed: number; inserted: string } | null {
  if (before === after) return null;
  const max = Math.min(before.length, after.length);
  let start = 0;
  while (start < max && before.charCodeAt(start) === after.charCodeAt(start)) start++;
  let end = 0;
  while (
    end < max - start &&
    before.charCodeAt(before.length - 1 - end) === after.charCodeAt(after.length - 1 - end)
  ) {
    end++;
  }
  return {
    pos: start,
    removed: before.length - start - end,
    inserted: after.slice(start, after.length - end),
  };
}

const SITE = /^[0-9a-z]{1,32}$/;

/** True for an insert or delete a browser is allowed to send. */
export function isEditOp(value: unknown): value is Extract<CollabOp, { t: "ins" | "del" }> {
  if (typeof value !== "object" || value === null) return false;
  const op = value as Record<string, unknown>;
  if (op.t === "ins") {
    return (
      typeof op.site === "string" &&
      SITE.test(op.site) &&
      Number.isInteger(op.n) &&
      (op.n as number) >= 0 &&
      Number.isInteger(op.ts) &&
      (op.ts as number) >= 1 &&
      (op.after === null || typeof op.after === "string") &&
      typeof op.text === "string"
    );
  }
  if (op.t === "del") {
    return (
      Array.isArray(op.runs) &&
      op.runs.every(
        (run) =>
          Array.isArray(run) &&
          run.length === 3 &&
          typeof run[0] === "string" &&
          SITE.test(run[0]) &&
          Number.isInteger(run[1]) &&
          run[1] >= 0 &&
          Number.isInteger(run[2]) &&
          run[2] >= 1,
      )
    );
  }
  return false;
}
