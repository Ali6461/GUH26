import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { CollabDoc, textDiff, type CollabOp } from "../../../shared/collab";
import { CollabManager, type Room } from "./index";

test("CRDT gives the same text whatever order concurrent edits arrive in", () => {
  const start: CollabOp[] = [{ t: "ins", site: "0", n: 0, ts: 1, after: null, text: "hello world" }];
  const a = new CollabDoc("a");
  const b = new CollabDoc("b");
  a.applyAll(start);
  b.applyAll(start);
  const fromA = a.edit(5, 0, ", there");
  const fromB = [...b.edit(0, 1, "H"), ...b.edit(11, 0, "!")];
  a.applyAll(fromB);
  b.applyAll(fromA);
  assert.equal(a.text(), b.text());
  assert.equal(a.text(), "Hello, there world!");
  // Applying twice changes nothing.
  a.applyAll(fromB);
  assert.equal(a.text(), "Hello, there world!");
});

test("textDiff finds the single replacement", () => {
  assert.deepEqual(textDiff("abcdef", "abXYef"), { pos: 2, removed: 2, inserted: "XY" });
  assert.equal(textDiff("same", "same"), null);
});

async function until(check: () => boolean, what: string, ms = 20_000): Promise<void> {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error(`Timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 50));
  }
}

function textOf(room: Room): string {
  const doc = new CollabDoc("reader");
  doc.applyAll(room.ops);
  return doc.text();
}

test("two laptops share a file, both edit it and end up with the same text", { timeout: 60_000 }, async () => {
  const dirA = mkdtempSync(join(tmpdir(), "collab-a-"));
  const dirB = mkdtempSync(join(tmpdir(), "collab-b-"));
  const a = new CollabManager(dirA, { port: 0, discoveryPort: null });
  const b = new CollabManager(dirB, { port: 0, discoveryPort: null });
  try {
    await a.start();
    await b.start();
    const roomA = await a.create("notes.txt", "hello world");
    await b.connectTo("127.0.0.1", a.port);
    const roomB = await b.join(roomA.key);

    await until(() => textOf(roomB) === "hello world", "B to receive the file");
    assert.equal(roomB.name, "notes.txt");
    await until(() => roomB.writable, "B to be let in as an editor");

    // Both edit at the same moment, without seeing each other's change first.
    const docA = new CollabDoc("aaaa");
    docA.applyAll(roomA.ops);
    const docB = new CollabDoc("bbbb");
    docB.applyAll(roomB.ops);
    await Promise.all([
      roomA.append(docA.edit(5, 0, " big")),
      roomB.append([...docB.edit(0, 1, "H"), ...docB.edit(11, 0, "!")]),
    ]);

    await until(
      () => textOf(roomA) === textOf(roomB) && textOf(roomA).length === "Hello big world!".length,
      "both laptops to agree",
    );
    assert.equal(textOf(roomA), "Hello big world!");
    assert.equal(roomA.peers.size, 1);
  } finally {
    await a.stop();
    await b.stop();
    rmSync(dirA, { recursive: true, force: true });
    rmSync(dirB, { recursive: true, force: true });
  }
});
