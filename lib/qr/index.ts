import "server-only";
import QRCode from "qrcode";

/** SVG markup for a QR code (error correction M, ink on white). */
export async function qrSvg(text: string, opts: { margin?: number; color?: string } = {}): Promise<string> {
  return QRCode.toString(text, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: opts.margin ?? 1,
    color: { dark: opts.color ?? "#1C1B19", light: "#FFFFFF" },
  });
}
