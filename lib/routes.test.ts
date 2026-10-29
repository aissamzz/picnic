import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { APP_ROOTS, menuSegment } from "./routes";

describe("menuSegment", () => {
  it.each([
    ["/pizzeria-roma", "pizzeria-roma"],
    ["/pizzeria-roma-menu", "pizzeria-roma-menu"],
    ["/Pizzeria-Roma/", "pizzeria-roma"],
    ["/app", null],
    ["/connexion", null],
    ["/", null],
    ["/a/b", null],
    ["/robots.txt", null],
  ])("%s -> %s", (p, want) => expect(menuSegment(p)).toBe(want));
});

describe("APP_ROOTS", () => {
  it("are all reserved slugs (when long enough to be a slug)", () => {
    const dir = path.join(__dirname, "../supabase/migrations");
    const sql = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => readFileSync(path.join(dir, f), "utf8"))
      .join("\n");
    for (const root of APP_ROOTS.filter((r) => r.length >= 3)) {
      expect(sql.includes(`('${root}')`), root).toBe(true);
    }
  });
});
