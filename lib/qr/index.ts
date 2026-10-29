import "server-only";
import { brandedQrSvg } from "./branded";

/** SVG markup for a branded QR code (level H, Liinky badge in the centre). */
export async function qrSvg(text: string, opts: { margin?: number; color?: string } = {}): Promise<string> {
  return brandedQrSvg(text, { margin: opts.margin ?? 1, color: opts.color });
}
