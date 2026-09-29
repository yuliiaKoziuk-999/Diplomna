import { defineConfig } from "@playwright/test"

/**
 * End-to-end demo walk-through. Expects both servers running:
 *   backend:  npm run demo:db  (or docker compose up -d)  +  npm run start
 *   frontend: npm run dev
 * npm run e2e:demo   headless, screenshots + video in e2e/demo-output/
 * npm run e2e:watch  visible, slowed-down browser with step banners
 */
const shared = {
  baseURL: "http://localhost:5173",
  actionTimeout: 15_000,
  viewport: { width: 1366, height: 820 },
  locale: "uk-UA",
  video: { mode: "on" as const, size: { width: 1366, height: 820 } },
}

export default defineConfig({
  testDir: "e2e",
  timeout: 10 * 60_000,
  workers: 1,
  reporter: [["list"]],
  outputDir: "e2e/demo-output/artifacts",
  projects: [
    { name: "demo", use: { ...shared, headless: true, launchOptions: { slowMo: 120 } } },
    {
      name: "watch",
      metadata: { watch: true },
      use: { ...shared, headless: false, launchOptions: { slowMo: 650 } },
    },
  ],
})
