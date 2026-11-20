import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "server-only": path.resolve("tests/stub.ts"), "@": path.resolve("src") } },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
