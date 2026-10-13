import { describe, expect, it } from "vitest";
import { idbPut, idbDelete } from "./db";

function transactionHarness() {
  const tx = {
    error: null as Error | null,
    oncomplete: null as (() => void) | null,
    onabort: null as (() => void) | null,
    onerror: null as (() => void) | null,
    objectStore: () => ({ put: () => ({}), delete: () => ({}) }),
  };
  const db = { transaction: () => tx } as unknown as IDBDatabase;
  return { db, tx };
}

describe("IndexedDB acknowledgement", () => {
  it("does not acknowledge a put until the transaction commits", async () => {
    const { db, tx } = transactionHarness();
    let settled = false;
    const pending = idbPut(db, "pendingMedia", { id: "asset" }).then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);
    tx.oncomplete?.();
    await pending;
    expect(settled).toBe(true);
  });

  it("rejects a delete when the transaction aborts", async () => {
    const { db, tx } = transactionHarness();
    const pending = idbDelete(db, "pendingMedia", "asset");
    tx.onabort?.();
    await expect(pending).rejects.toThrow("aborted");
  });
});
