import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const EXTENSION_PATH = path.resolve('.output/chrome-mv3');
const CHROME_PATH =
  process.env.SUNTAB_CHROME ??
  'C:/ruanjian/liulanqi/ungoogled-chromium_156.0.8078.79-1.1_windows_x64/chrome.exe';
const IS_EDGE = /msedge(\.exe)?$/i.test(CHROME_PATH);
const EDGE_EXTENSION_ID = 'baicegclhemapbjejjkgffjelfbehifl';

type Fixtures = {
  context: BrowserContext;
  extensionId: string;
  newtab: Page;
};

export const test = base.extend<Fixtures>({
  context: async ({}, use) => {
    if (!fs.existsSync(EXTENSION_PATH)) {
      throw new Error('未找到构建产物，请先运行 pnpm build');
    }
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'suntab-e2e-'));
    const context = await chromium.launchPersistentContext(profile, {
      executablePath: fs.existsSync(CHROME_PATH) ? CHROME_PATH : undefined,
      headless: false,
      viewport: { width: 1280, height: 752 },
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--window-size=1280,800',
        '--lang=zh-CN',
      ],
    });
    // Playwright cannot answer Chrome's extension permission bubble; run tests
    // as if the user declined site access so icon adds stay offline and fast.
    await context.addInitScript(() => {
      const chromeApi = (
        globalThis as unknown as {
          chrome?: {
            permissions?: {
              request(
                details: unknown,
                callback: (granted: boolean) => void,
              ): void;
            };
          };
        }
      ).chrome;
      if (chromeApi?.permissions?.request) {
        chromeApi.permissions.request = (_details, callback) => callback(false);
      }
    });
    await use(context);
    await context.close();
    try {
      fs.rmSync(profile, { recursive: true, force: true });
    } catch {
      // Chromium may still hold profile files briefly on Windows.
    }
  },

  extensionId: async ({ context }, use) => {
    if (IS_EDGE) {
      await use(EDGE_EXTENSION_ID);
      return;
    }
    const page = await context.newPage();
    await page.goto('chrome://extensions');
    await page.waitForFunction(() => {
      const manager = document.querySelector('extensions-manager');
      const list = manager?.shadowRoot?.querySelector('extensions-item-list');
      return Boolean(list?.shadowRoot?.querySelector('extensions-item'));
    });
    const id = await page.evaluate(() => {
      const manager = document.querySelector('extensions-manager') as HTMLElement | null;
      const list = manager?.shadowRoot?.querySelector(
        'extensions-item-list',
      ) as HTMLElement | null;
      const item = list?.shadowRoot?.querySelector('extensions-item') as HTMLElement | null;
      const name = item?.shadowRoot?.querySelector('#name')?.textContent?.trim();
      return item && name === 'SunTab' ? (item.getAttribute('id') ?? '') : '';
    });
    await page.close();
    if (!id) throw new Error('未能找到 SunTab 扩展 ID');
    await use(id);
  },

  newtab: async ({ context, extensionId }, use) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/newtab.html`);
    await page.locator('.clock').waitFor({ state: 'visible' });
    await use(page);
  },
});

export { expect } from '@playwright/test';
