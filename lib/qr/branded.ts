import QRCode from "qrcode";

/**
 * Branded QR codes (brand/logo/GUIDELINES.md, "Next to a QR code"): error
 * correction H, and the white Liinky symbol on a Berry rounded square in the
 * centre, at most 9 × 9 modules. The modules under the badge are cleared; level H
 * restores up to 30% of the code, the badge covers well under 10%.
 * Works on the server (SVG, PDF) and in the browser (canvas).
 */

export const QR_INK = "#1C1433";
export const QR_BERRY = "#E5245E";

/** The symbol's shapes in a 256 × 256 box (public/brand/liinky-symbol-white.svg). */
export const SYMBOL_CIRCLES = [
  { cx: 88, cy: 56, r: 24 },
  { cx: 168, cy: 56, r: 24 },
] as const;
export const SYMBOL_PATH = "M66 118 A22 22 0 0 1 110 118 V160 A18 18 0 0 0 146 160 V118 A22 22 0 0 1 190 118 V160 A62 62 0 0 1 66 160 Z";

export type BrandedQr = {
  /** Modules per side, without the quiet zone. */
  size: number;
  /** Quiet zone in modules. */
  margin: number;
  /** SVG path (module units, quiet zone included) of the dark modules, badge area left blank. */
  path: string;
  /** Badge square in module units (quiet zone included). */
  badge: { x: number; y: number; size: number; radius: number };
};

/** Badge side in modules: about a fifth of the code, odd so it stays centred, 5 to 9. */
export function badgeModules(size: number): number {
  const n = Math.min(9, Math.max(5, Math.floor(size * 0.2)));
  return n % 2 === 0 ? n - 1 : n;
}

export function brandedQr(text: string, margin = 2): BrandedQr {
  const qr = QRCode.create(text, { errorCorrectionLevel: "H" });
  const size = qr.modules.size;
  const n = badgeModules(size);
  const start = (size - n) / 2;
  const inBadge = (x: number, y: number) => x >= start && x < start + n && y >= start && y < start + n;
  let path = "";
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (qr.modules.get(y, x) && !inBadge(x, y)) path += `M${x + margin} ${y + margin}h1v1h-1z`;
    }
  }
  // The badge sits half a module inside the cleared area, so it never touches a module.
  return { size, margin, path, badge: { x: start + margin + 0.5, y: start + margin + 0.5, size: n - 1, radius: (n - 1) * 0.22 } };
}

/** Symbol transform inside the badge, in module units (the symbol keeps ~16% padding). */
export function symbolTransform(badge: BrandedQr["badge"]) {
  const inner = badge.size * 0.7;
  const scale = inner / 256;
  return { x: badge.x + (badge.size - inner) / 2, y: badge.y + (badge.size - inner) / 2, scale };
}

/** Standalone SVG markup. */
export function brandedQrSvg(text: string, opts: { margin?: number; color?: string } = {}): string {
  const q = brandedQr(text, opts.margin ?? 2);
  const total = q.size + q.margin * 2;
  const t = symbolTransform(q.badge);
  const circles = SYMBOL_CIRCLES.map((c) => `<circle cx="${c.cx}" cy="${c.cy}" r="${c.r}"/>`).join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges">` +
    `<rect width="${total}" height="${total}" fill="#FFFFFF"/>` +
    `<path d="${q.path}" fill="${opts.color ?? QR_INK}"/>` +
    `<rect x="${q.badge.x}" y="${q.badge.y}" width="${q.badge.size}" height="${q.badge.size}" rx="${q.badge.radius}" fill="${QR_BERRY}" shape-rendering="geometricPrecision"/>` +
    `<g transform="translate(${t.x} ${t.y}) scale(${t.scale})" fill="#FFFFFF" shape-rendering="geometricPrecision">${circles}<path d="${SYMBOL_PATH}"/></g>` +
    `</svg>`
  );
}

/** Draws the code on a canvas at (x, y), `px` wide (browser). */
export function drawBrandedQr(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, px: number, margin = 1) {
  const q = brandedQr(text, margin);
  const total = q.size + q.margin * 2;
  const m = px / total;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(m, m);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, total, total);
  ctx.fillStyle = QR_INK;
  ctx.fill(new Path2D(q.path));
  ctx.fillStyle = QR_BERRY;
  ctx.beginPath();
  ctx.roundRect(q.badge.x, q.badge.y, q.badge.size, q.badge.size, q.badge.radius);
  ctx.fill();
  const t = symbolTransform(q.badge);
  ctx.translate(t.x, t.y);
  ctx.scale(t.scale, t.scale);
  ctx.fillStyle = "#FFFFFF";
  for (const c of SYMBOL_CIRCLES) {
    ctx.beginPath();
    ctx.arc(c.cx, c.cy, c.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fill(new Path2D(SYMBOL_PATH));
  ctx.restore();
}
