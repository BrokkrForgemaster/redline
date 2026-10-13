import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { verifyStoredImage } from "./verify-image";

describe("stored evidence decoding", () => {
  it("derives dimensions and checksum from decoded bytes", async () => {
    const bytes = await sharp({ create: { width: 640, height: 480, channels: 3,
      background: "#228833" } }).png().toBuffer();
    const result = await verifyStoredImage(bytes, "image/png");
    expect(result).toMatchObject({ byteSize: bytes.length, width: 640, height: 480 });
    expect(result.sha256Hex).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects a false declared type and truncated image bytes", async () => {
    const bytes = await sharp({ create: { width: 640, height: 480, channels: 3,
      background: "#228833" } }).png().toBuffer();
    await expect(verifyStoredImage(bytes, "image/jpeg")).rejects.toThrow();
    await expect(verifyStoredImage(bytes.subarray(0, 30), "image/png")).rejects.toThrow();
  });
});
