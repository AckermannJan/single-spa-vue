import { defineProject } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

export default defineProject({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    clearMocks: true,
  },
});
