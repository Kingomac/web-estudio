import { defineConfig } from '@playwright/test';
const base = `${(process.env.BASE_PATH || '/web-estudio').replace(/\/$/, '')}/`;
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: `http://127.0.0.1:4322${base}`, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'firefox', use: { browserName: 'firefox', viewport: { width: 1440, height: 1000 } } }],
  webServer: { command: 'bun scripts/serve-built.ts --port 4322', url: `http://127.0.0.1:4322${base}`, reuseExistingServer: false },
});
