import sharp from "sharp";
import { createHash } from "node:crypto";

const FORMAT_FOR_MIME: Record<string, string> = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heif",
  "image/heif": "heif",
};

export interface VerifiedImage {
  byteSize: number;
  width: number;
  height: number;
  sha256Hex: string;
}

export async function verifyStoredImage(bytes: Buffer, declaredMime: string): Promise<VerifiedImage> {
  if (!FORMAT_FOR_MIME[declaredMime] || bytes.length < 12 || bytes.length > 20 * 1024 * 1024) {
    throw new Error("Stored image type or size is invalid.");
  }
  try {
    const decoder = sharp(bytes, { failOn: "error", limitInputPixels: 50_000_000 });
    const metadata = await decoder.metadata();
    if (metadata.format !== FORMAT_FOR_MIME[declaredMime] || !metadata.width || !metadata.height ||
        metadata.width > 12_000 || metadata.height > 12_000) {
      throw new Error("Stored image format or dimensions are invalid.");
    }
    // Metadata alone can succeed for a truncated image. Stats decodes pixels.
    await decoder.stats();
    return {
      byteSize: bytes.length,
      width: metadata.width,
      height: metadata.height,
      sha256Hex: createHash("sha256").update(bytes).digest("hex"),
    };
  } catch {
    throw new Error("Stored image could not be decoded or does not match its declared type.");
  }
}
