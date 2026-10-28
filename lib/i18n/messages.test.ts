import { describe, expect, it } from "vitest";
import ar from "@/messages/ar.json";
import fr from "@/messages/fr.json";

function keys(obj: unknown, prefix = ""): string[] {
  if (Array.isArray(obj)) return [`${prefix}[${obj.length}]`];
  if (obj && typeof obj === "object")
    return Object.entries(obj).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
  return [prefix];
}

describe("messages", () => {
  it("fr and ar have the same keys", () => {
    expect(keys(ar).sort()).toEqual(keys(fr).sort());
  });
  it("has no empty strings", () => {
    const empty = (o: unknown): boolean =>
      typeof o === "string" ? o.trim() === "" : o && typeof o === "object" ? Object.values(o).some(empty) : false;
    expect(empty(fr)).toBe(false);
    expect(empty(ar)).toBe(false);
  });
});
