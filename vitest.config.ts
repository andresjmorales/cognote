import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    // Pure-logic unit tests only — colocated next to the code they cover.
    // No jsdom/browser environment: everything under lib/ runs in plain Node.
    include: ["lib/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
});
