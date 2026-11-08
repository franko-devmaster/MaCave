import { defineConfig, devices } from '@playwright/test';

const PORT = 4310;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/MaCave/`,
    trace: 'off',
  },
  projects: [
    {
      name: 'iphone-16-pro',
      // Viewport, user agent et tactile de l'iPhone 16 Pro, rendus par Chromium.
      use: { ...devices['iPhone 16 Pro'], browserName: 'chromium' },
    },
  ],
  webServer: {
    command: `node e2e/static-server.mjs`,
    env: { PORT: String(PORT) },
    url: `http://localhost:${PORT}/MaCave/`,
    reuseExistingServer: !process.env['CI'],
  },
});
