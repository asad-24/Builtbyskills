import { defineConfig } from "@playwright/test"
export default defineConfig({ testDir: "./e2e", fullyParallel: false, workers: 1, retries: 0, timeout: 320_000, reporter: "list", use: { trace: "off", screenshot: "off", video: "off" } })
