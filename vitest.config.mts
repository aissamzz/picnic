import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: { include: ["lib/**/*.test.ts", "components/**/*.test.{ts,tsx}"], environment: "node" },
});
