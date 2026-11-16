import { describe, expect, it } from "vitest";

import { crc32, zipStore } from "./zip";

/** Reads a zip back: the entries of its central directory, each with the bytes it points at. */
async function unzip(blob: Blob): Promise<Array<{ name: string; data: Uint8Array; crc: number }>> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(bytes.buffer);
  const eocd = bytes.length - 22;
  expect(view.getUint32(eocd, true)).toBe(0x06054b50);
  const count = view.getUint16(eocd + 10, true);
  let at = view.getUint32(eocd + 16, true);
  const out: Array<{ name: string; data: Uint8Array; crc: number }> = [];
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(at, true)).toBe(0x02014b50);
    const crc = view.getUint32(at + 16, true);
    const size = view.getUint32(at + 24, true);
    const nameLen = view.getUint16(at + 28, true);
    const local = view.getUint32(at + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLen));
    expect(view.getUint32(local, true)).toBe(0x04034b50);
    expect(view.getUint16(local + 6, true) & 0x0800).toBe(0x0800);
    const dataAt = local + 30 + view.getUint16(local + 26, true);
    out.push({ name, data: bytes.slice(dataAt, dataAt + size), crc });
    at += 46 + nameLen;
  }
  return out;
}

describe("crc32", () => {
  it("is the checksum zip uses", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });
});

describe("zipStore", () => {
  it("holds every file with its name, its bytes and its checksum, names in UTF-8", async () => {
    const a = new Uint8Array([1, 2, 3, 4, 5]);
    const b = new TextEncoder().encode("hello");
    const zip = zipStore([
      { name: "01 強い信念.flac", data: a },
      { name: "02 привет.flac", data: b },
      { name: "03 empty.flac", data: new Uint8Array() },
    ]);
    expect(zip.type).toBe("application/zip");
    const entries = await unzip(zip);
    expect(entries.map((e) => e.name)).toEqual([
      "01 強い信念.flac",
      "02 привет.flac",
      "03 empty.flac",
    ]);
    expect([...(entries[0]?.data ?? [])]).toEqual([1, 2, 3, 4, 5]);
    expect(new TextDecoder().decode(entries[1]?.data)).toBe("hello");
    for (const e of entries) expect(e.crc).toBe(crc32(e.data));
  });
});
