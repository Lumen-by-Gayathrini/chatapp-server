import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    // mongodb-memory-server may download a binary on first run.
    testTimeout: 30_000,
    hookTimeout: 120_000,
    pool: "forks",
    poolOptions: {
      // Single long-lived worker (shared in-memory Mongo). Extra heap headroom guards
      // against intermittent worker crashes under memory pressure.
      forks: { singleFork: true, execArgv: ["--max-old-space-size=1024"] },
    },
    // Share a single module graph (and thus one mongoose instance + cached connection)
    // across test files. The setup file resets DB state between tests.
    isolate: false,
    fileParallelism: false,
  },
});
