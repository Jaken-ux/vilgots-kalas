import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "qa",
  timeout: 60000,
  use: {
    baseURL: "http://localhost:4173/vilgots-kalas/",
    headless: true,
  },
  webServer: {
    command: "npm run preview",
    port: 4173,
    reuseExistingServer: true,
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
      },
    },
  ],
});
