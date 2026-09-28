import { defineConfig, devices } from "@playwright/test";
import {
  FAKE_STORAGE_KEY,
  FAKE_STORAGE_PORT,
  FAKE_STORAGE_URL,
} from "./tests/e2e/fake-storage";

const PORT = Number(process.env.PORT ?? 3000);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // 360 px Android is the primary target (07); WebKit mobile is added in S3.
    {
      name: "mobile",
      use: { ...devices["Galaxy S9+"], viewport: { width: 360, height: 740 } },
    },
  ],
  ...(!process.env.E2E_BASE_URL && {
    webServer: [
      // Supabase Storage stand-in for image uploads (S5-05).
      {
        command: "node tests/e2e/fake-storage.ts",
        url: `${FAKE_STORAGE_URL}/health`,
        reuseExistingServer: !process.env.CI,
        env: { FAKE_STORAGE_PORT: String(FAKE_STORAGE_PORT) },
      },
      {
        command: `pnpm start --port ${PORT}`,
        url: `${baseURL}/api/health`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        // Signed uploads go to the stand-in; the build inlines the matching
        // NEXT_PUBLIC_MEDIA_BASE_URL (ci.yml, .env.example).
        env: {
          SUPABASE_URL: FAKE_STORAGE_URL,
          SUPABASE_SERVICE_ROLE_KEY: FAKE_STORAGE_KEY,
        },
      },
    ],
  }),
});
