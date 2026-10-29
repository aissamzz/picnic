import { brandedQrSvg, drawBrandedQr, QR_INK } from "./branded";

/**
 * Browser-side QR images for the share hub and table cards. Drawn on a canvas
 * with the page's own fonts (Nunito/Cairo), so Arabic shapes correctly. Every
 * code carries the Liinky badge (level H, see ./branded.ts).
 */

export type PosterOptions = {
  width: number;
  height: number;
  qrText: string;
  title: string;
  headline: string;
  footer: string;
  bg: string;
  fg: string;
  rtl: boolean;
};

const INK = QR_INK;

function fontFamily() {
  return getComputedStyle(document.body).fontFamily || "sans-serif";
}

/** Shrinks text until it fits `maxWidth`. */
function fitText(ctx: CanvasRenderingContext2D, text: string, weight: number, size: number, maxWidth: number) {
  let s = size;
  do {
    ctx.font = `${weight} ${s}px ${fontFamily()}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    s -= 2;
  } while (s > 12);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

/** Story / post / table card: title, white card with the QR, headline, footer. */
export async function renderPoster(o: PosterOptions): Promise<Blob> {
  await document.fonts.ready;
  const canvas = document.createElement("canvas");
  canvas.width = o.width;
  canvas.height = o.height;
  const ctx = canvas.getContext("2d")!;
  ctx.direction = o.rtl ? "rtl" : "ltr";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const cx = o.width / 2;
  const unit = Math.min(o.width, o.height);

  ctx.fillStyle = o.bg;
  ctx.fillRect(0, 0, o.width, o.height);

  const qrSize = Math.round(unit * 0.56);
  const cardPad = Math.round(unit * 0.05);
  const cardW = qrSize + cardPad * 2;
  const cardH = cardW + Math.round(unit * 0.12);
  const cardY = Math.round((o.height - cardH) / 2 + unit * 0.04);

  ctx.fillStyle = o.fg;
  fitText(ctx, o.title, 800, Math.round(unit * 0.085), o.width * 0.86);
  ctx.fillText(o.title, cx, cardY - unit * 0.1);

  ctx.fillStyle = "#FFFFFF";
  roundRect(ctx, cx - cardW / 2, cardY, cardW, cardH, Math.round(unit * 0.04));
  drawBrandedQr(ctx, o.qrText, cx - qrSize / 2, cardY + cardPad, qrSize);

  ctx.fillStyle = INK;
  fitText(ctx, o.headline, 700, Math.round(unit * 0.05), cardW - cardPad * 2);
  ctx.fillText(o.headline, cx, cardY + cardPad + qrSize + (cardH - cardPad - qrSize) / 2);

  ctx.fillStyle = o.fg;
  ctx.direction = "ltr";
  fitText(ctx, o.footer, 600, Math.round(unit * 0.04), o.width * 0.9);
  ctx.fillText(o.footer, cx, cardY + cardH + unit * 0.09);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas"))), "image/png"));
}

export async function qrPng(text: string, size = 1024): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  drawBrandedQr(canvas.getContext("2d")!, text, 0, 0, size, 2);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas"))), "image/png"));
}

export async function qrSvgBlob(text: string): Promise<Blob> {
  return new Blob([brandedQrSvg(text, { margin: 2 })], { type: "image/svg+xml" });
}

export function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
