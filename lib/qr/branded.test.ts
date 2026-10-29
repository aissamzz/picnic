import { describe, expect, it } from "vitest";
import { badgeModules, brandedQr, brandedQrSvg } from "./branded";

describe("branded QR", () => {
  it("keeps the badge between 5 and 9 modules, odd", () => {
    expect(badgeModules(21)).toBe(5);
    expect(badgeModules(33)).toBe(5);
    expect(badgeModules(37)).toBe(7);
    expect(badgeModules(57)).toBe(9);
    expect(badgeModules(177)).toBe(9);
  });

  it("uses level H and clears the centre", () => {
    const q = brandedQr("https://liinky.app/pizzeria-roma-menu?t=T3", 2);
    // Version for this URL at H is at least 29 modules.
    expect(q.size).toBeGreaterThanOrEqual(29);
    const cx = Math.floor(q.size / 2) + 2;
    expect(q.path).not.toContain(`M${cx} ${cx}h1`);
    expect(q.badge.size).toBeLessThanOrEqual(8);
  });

  it("renders an SVG with the berry badge", () => {
    const svg = brandedQrSvg("https://liinky.app/x");
    expect(svg).toContain('fill="#E5245E"');
    expect(svg.startsWith("<svg")).toBe(true);
  });
});
