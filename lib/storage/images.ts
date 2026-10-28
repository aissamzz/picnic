import "server-only";
import sharp from "sharp";

const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp"]);
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Validates and normalizes an uploaded image to WebP within `size`. Throws on bad input. */
export async function toWebp(file: File, size: { width: number; height: number; fit?: "cover" | "inside" }): Promise<Buffer> {
  if (!ACCEPTED.has(file.type) || file.size > MAX_UPLOAD_BYTES) throw new Error("invalid_image");
  const input = Buffer.from(await file.arrayBuffer());
  return sharp(input, { failOn: "error" })
    .rotate()
    .resize({ width: size.width, height: size.height, fit: size.fit ?? "cover", withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();
}
