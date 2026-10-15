import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

const systemChromium = '/repl/tools/bin/chromium';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  reporter: 'list',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: process.env.GLOBUS_VIEWPORT_BASE_URL ?? 'http://127.0.0.1:24083',
    headless: true,
    launchOptions: {
      ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
        ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
        : existsSync(systemChromium)
          ? { executablePath: systemChromium }
          : {}),
      args: ['--no-sandbox'],
    },
    reducedMotion: 'reduce',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
