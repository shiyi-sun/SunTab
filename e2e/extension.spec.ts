import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { PAPER_WALLPAPER } from '../shared/defaults';
import { expect, test } from './fixtures';

async function readNav(page: Page): Promise<
  Array<{
    id: string;
    name: string;
    items: Array<{ id: string; type: string; name: string }>;
  }>
> {
  return page.evaluate(() => {
    return new Promise((resolve) => {
      (globalThis as unknown as {
        chrome: {
          storage: {
            local: {
              get(
                key: string,
                callback: (value: Record<string, unknown>) => void,
              ): void;
            };
          };
        };
      }).chrome.storage.local.get('suntab:nav', (value) => {
        resolve(value['suntab:nav'] as never);
      });
    });
  });
}

async function seedNav(page: Page, groups: unknown[]): Promise<void> {
  await page.evaluate(async (value) => {
    await new Promise<void>((resolve) => {
      (
        globalThis as unknown as {
          chrome: {
            storage: {
              local: {
                set(items: Record<string, unknown>, callback: () => void): void;
              };
            };
          };
        }
      ).chrome.storage.local.set({ 'suntab:nav': value }, () => resolve());
    });
  }, groups);
  await page.reload();
  await expect(page.locator('.clock')).toBeVisible();
}

async function openSettings(page: Page) {
  await page.locator('.settings-button').click();
  await expect(page.locator('.settings-drawer')).toBeVisible();
}

async function openDataSettings(page: Page) {
  await openSettings(page);
  await page
    .locator('.settings-nav .nav-item')
    .filter({ hasText: '数据' })
    .click();
  await expect(page.getByRole('heading', { name: '数据' })).toBeVisible();
}

async function addIcon(page: Page, name: string, url: string) {
  await page.locator('.add-tile').click();
  const dialog = page.getByRole('dialog', { name: '添加图标' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('名称', { exact: true }).fill(name);
  await dialog.getByLabel('网址', { exact: true }).fill(url);
  await dialog.locator('.dialog-footer .panel-btn.primary').click();
  await expect(dialog).toBeHidden();
  await expect(page.locator(`.icon-tile[title="${name}"]`)).toBeVisible();
}

let server: http.Server;
let localPageUrl = '';

test.beforeAll(async () => {
  server = http.createServer((_request, response) => {
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end('<!doctype html><title>本地测试页</title><h1>SunTab E2E</h1>');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  localPageUrl = `http://127.0.0.1:${address.port}/page`;
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test('newtab override renders without console errors or external requests', async ({
  context,
  newtab,
}) => {
  const errors: string[] = [];
  const external: string[] = [];
  newtab.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  newtab.on('pageerror', (error) => errors.push(error.message));
  context.on('request', (request) => {
    if (/^https?:\/\//i.test(request.url())) external.push(request.url());
  });

  await newtab.goto('chrome://newtab');
  await expect(newtab.locator('.clock')).toBeVisible();
  await expect(newtab.locator('.grid > .icon-tile')).toHaveCount(0);
  await expect(newtab.locator('.add-tile')).toBeVisible();
  await expect(newtab.locator('.group-btn')).toHaveCount(2);
  await newtab.waitForTimeout(700);

  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('local search matches pinyin initials and opens the icon', async ({
  context,
  newtab,
}) => {
  await seedNav(newtab, [
    {
      id: 'group-home',
      name: '主页',
      icon: 'home',
      items: [
        {
          id: 'seed-medlive',
          type: 'icon',
          name: '医脉通',
          url: 'https://www.medlive.cn/',
          icon: { kind: 'text', value: '医', bg: '#3b78c9' },
        },
      ],
    },
    { id: 'group-ai', name: 'AI', icon: 'ai', items: [] },
  ]);
  const input = newtab.locator('.search-input');
  await input.fill('ymt');
  await expect(newtab.locator('.suggest-item').first()).toContainText('医脉通', {
    timeout: 8_000,
  });

  await input.fill('医脉');
  await expect(newtab.locator('.suggest-item').first()).toContainText('医脉通');

  await input.fill('ymt');
  await expect(newtab.locator('.suggest-item').first()).toContainText('医脉通');
  await input.press('ArrowDown');
  const openedPromise = context.waitForEvent('page');
  await input.press('Enter');
  const opened = await openedPromise;
  await expect(opened).toHaveURL(/medlive\.cn/i);
  await opened.close();
});

test('moves an icon to another group from the context menu', async ({ newtab }) => {
  await seedNav(newtab, [
    {
      id: 'group-home',
      name: '主页',
      icon: 'home',
      items: [
        {
          id: 'seed-nutrition',
          type: 'icon',
          name: '营养知识库',
          url: 'https://hishiyi.cn',
          icon: { kind: 'text', value: '营', bg: '#2f8f6b' },
        },
      ],
    },
    { id: 'group-ai', name: 'AI', icon: 'ai', items: [] },
  ]);
  const source = newtab.locator('.icon-tile[title="营养知识库"]');
  await source.click({ button: 'right' });
  const menu = newtab.getByRole('menu');
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: '移动到文件夹' })).toHaveCount(0);
  await menu.getByRole('menuitem', { name: '移动到分组' }).hover();
  await menu.getByRole('menuitem', { name: 'AI', exact: true }).click();
  await expect(source).toHaveCount(0);

  await newtab.locator('.group-btn').filter({ hasText: 'AI' }).click();
  await expect(newtab.locator('.icon-tile[title="营养知识库"]')).toBeVisible();
  await newtab.waitForTimeout(500);

  await newtab.reload();
  await expect(newtab.locator('.clock')).toBeVisible();
  await newtab.locator('.group-btn').filter({ hasText: 'AI' }).click();
  await expect(newtab.locator('.icon-tile[title="营养知识库"]')).toBeVisible();
});

test('opens the SunTab menu from any blank area of the page', async ({ newtab }) => {
  await newtab.mouse.click(1200, 640, { button: 'right' });
  const menu = newtab.getByRole('menu');
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: '添加图标' })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: '换壁纸' })).toBeVisible();
  await newtab.keyboard.press('Escape');
  await expect(menu).toBeHidden();

  await newtab.locator('.search-input').dispatchEvent('contextmenu');
  await expect(menu).toBeHidden();
});

test('uses night as the default wallpaper', async ({ newtab }) => {
  const background = await newtab
    .locator('.wallpaper')
    .evaluate((element) => getComputedStyle(element).backgroundImage);
  expect(background).toContain('rgb(17, 29, 48)');
  expect(background).not.toContain('data:image/svg');
});

test('moves an existing paper default to night after the update', async ({ newtab }) => {
  await newtab.evaluate(async (paper) => {
    await new Promise<void>((resolve) => {
      (
        globalThis as unknown as {
          chrome: {
            storage: {
              local: {
                set(items: Record<string, unknown>, callback: () => void): void;
              };
            };
          };
        }
      ).chrome.storage.local.set(
        {
          'suntab:config': {
            wallpaper: { kind: 'gradient', value: paper, blur: 0, dim: 10 },
          },
        },
        () => resolve(),
      );
    });
    localStorage.removeItem('suntab:migrated-default-night');
  }, PAPER_WALLPAPER);

  await newtab.reload();
  await expect(newtab.locator('.clock')).toBeVisible();

  const background = await newtab
    .locator('.wallpaper')
    .evaluate((element) => getComputedStyle(element).backgroundImage);
  expect(background).toContain('rgb(17, 29, 48)');
  expect(background).not.toContain('data:image/svg');
  expect(
    await newtab.evaluate(() =>
      localStorage.getItem('suntab:migrated-default-night'),
    ),
  ).toBe('1');
});

test('shows a favicon or globe without duplicating the name', async ({ newtab }) => {
  await addIcon(newtab, '无缓存图标', 'https://no-cached-icon.example');
  const tile = newtab.locator('.icon-tile[title="无缓存图标"]');
  await expect(tile.locator('.thumb-text')).toHaveCount(0);
  await expect(tile.locator('.thumb-img, .thumb-globe').first()).toBeVisible();
});

test('renders the favicon inside the tile with padding', async ({ newtab }) => {
  const dot = `data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="22" fill="#111111"/></svg>',
  )}`;

  await seedNav(newtab, [
    {
      id: 'group-home',
      name: '主页',
      icon: 'home',
      items: [
        {
          id: 'dark-icon',
          type: 'icon',
          name: '深色图标',
          url: 'https://dark.example/',
          icon: { kind: 'url', value: dot },
        },
      ],
    },
    { id: 'group-ai', name: 'AI', icon: 'ai', items: [] },
  ]);

  const tile = newtab.locator('.icon-tile[title="深色图标"]');
  const layout = await tile.evaluate((element) => {
    const card = element.querySelector('.icon-image');
    const thumb = element.querySelector('.thumb');
    const image = element.querySelector('.thumb-img');
    const width = (target: Element | null) =>
      target ? target.getBoundingClientRect().width : 0;
    return {
      tile: width(card),
      thumb: width(thumb),
      image: width(image),
      glyphs: element.querySelectorAll('.icon-glyph').length,
    };
  });
  expect(layout).toEqual({ tile: 60, thumb: 60, image: 48, glyphs: 0 });
});

test('gives image icons a white default and allows changing it', async ({
  newtab,
}) => {
  const transparentGlyph = `data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M16 16h32v32H16z" fill="#000"/></svg>',
  )}`;

  await seedNav(newtab, [
    {
      id: 'group-home',
      name: '主页',
      icon: 'home',
      items: [
        {
          id: 'default-bg',
          type: 'icon',
          name: '默认白底',
          url: 'https://default-bg.example/',
          icon: { kind: 'url', value: transparentGlyph },
        },
        {
          id: 'fixed-bg',
          type: 'icon',
          name: '指定底色',
          url: 'https://fixed-bg.example/',
          icon: { kind: 'url', value: transparentGlyph, bg: '#c82c34' },
        },
        {
          id: 'clear-bg',
          type: 'icon',
          name: '透明底色',
          url: 'https://clear-bg.example/',
          icon: { kind: 'url', value: transparentGlyph, bg: '#00000000' },
        },
      ],
    },
    { id: 'group-ai', name: 'AI', icon: 'ai', items: [] },
  ]);

  const backgroundOf = (title: string) =>
    newtab
      .locator(`.icon-tile[title="${title}"] .thumb`)
      .evaluate((element) => getComputedStyle(element).backgroundColor);

  expect(await backgroundOf('默认白底')).toBe('rgb(255, 255, 255)');
  expect(await backgroundOf('指定底色')).toBe('rgb(200, 44, 52)');
  expect(await backgroundOf('透明底色')).toBe('rgba(0, 0, 0, 0)');

  const defaultImage = newtab.locator(
    '.icon-tile[title="默认白底"] .icon-image',
  );
  expect(
    await defaultImage.evaluate((element) => getComputedStyle(element).boxShadow),
  ).toContain('0px 0px 5px');
  await newtab.locator('.icon-tile[title="默认白底"]').hover();
  await newtab.waitForTimeout(250);
  const hoverState = await defaultImage.evaluate((element) => ({
    shadow: getComputedStyle(element).boxShadow,
    transform: getComputedStyle(element).transform,
  }));
  expect(hoverState.shadow).toContain('0px 0px 10px');
  expect(hoverState.transform).toBe('none');
});

test('centers short groups on the search axis', async ({ newtab }) => {
  await seedNav(newtab, [
    {
      id: 'group-home',
      name: '主页',
      icon: 'home',
      items: Array.from({ length: 4 }, (_, index) => ({
        id: `center-${index}`,
        type: 'icon',
        name: `站点 ${index + 1}`,
        url: `https://center-${index}.example/`,
        icon: { kind: 'text', value: String(index + 1) },
      })),
    },
    { id: 'group-ai', name: 'AI', icon: 'ai', items: [] },
  ]);

  const metrics = await newtab.evaluate(() => {
    const box = (selector: string) => {
      const rect = document.querySelector(selector)!.getBoundingClientRect();
      return {
        width: rect.width,
        center: rect.left + rect.width / 2,
      };
    };
    return { search: box('.search'), grid: box('.grid'), clock: box('.clock') };
  });
  expect(Math.abs(metrics.grid.center - metrics.search.center)).toBeLessThanOrEqual(1);
  expect(Math.abs(metrics.clock.center - metrics.search.center)).toBeLessThanOrEqual(1);
  expect(metrics.grid.width).toBeLessThan(metrics.search.width);
});

test('drag indicator stays a clean line without glow', async ({ newtab }) => {
  await seedNav(newtab, [
    {
      id: 'group-home',
      name: '主页',
      icon: 'home',
      items: ['甲', '乙', '丙'].map((name, index) => ({
        id: `drag-${index}`,
        type: 'icon',
        name,
        url: `https://drag-${index}.example/`,
        icon: { kind: 'text', value: name, bg: '#24292f' },
      })),
    },
    { id: 'group-ai', name: 'AI', icon: 'ai', items: [] },
  ]);

  const first = await newtab.locator('.icon-tile').nth(0).boundingBox();
  const second = await newtab.locator('.icon-tile').nth(1).boundingBox();
  if (!first || !second) throw new Error('missing drag tiles');

  await newtab.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
  await newtab.mouse.down();
  await newtab.mouse.move(first.x + first.width / 2 + 10, first.y + first.height / 2, {
    steps: 4,
  });
  await newtab.mouse.move(second.x + second.width * 0.3, second.y + second.height / 2, {
    steps: 8,
  });

  const indicator = newtab.locator('.drag-indicator');
  await expect(indicator).toBeVisible();
  const style = await indicator.evaluate((element) => ({
    boxShadow: getComputedStyle(element).boxShadow,
    width: element.getBoundingClientRect().width,
  }));
  expect(style.boxShadow).toBe('none');
  expect(style.width).toBeLessThanOrEqual(4);

  const gapX = (first.x + first.width + second.x) / 2;
  await newtab.mouse.move(gapX, first.y + first.height / 2, { steps: 6 });
  await newtab.waitForTimeout(180);
  const gapLeft = await indicator.evaluate(
    (element) => element.getBoundingClientRect().left,
  );
  expect(Math.abs(gapLeft + 1.5 - gapX)).toBeLessThan(3);
  expect(gapLeft).toBeLessThan(second.x);

  await newtab.mouse.up();
});

test('light wallpaper adds a 1px card edge', async ({ newtab }) => {
  await seedNav(newtab, [
    {
      id: 'group-home',
      name: '主页',
      icon: 'home',
      items: [
        {
          id: 'light-card',
          type: 'icon',
          name: '浅色卡片',
          url: 'https://light-card.example/',
          icon: {
            kind: 'url',
            value: `data:image/svg+xml,${encodeURIComponent(
              '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="22" fill="#111"/></svg>',
            )}`,
          },
        },
        {
          id: 'dark-card',
          type: 'icon',
          name: '彩色卡片',
          url: 'https://dark-card.example/',
          icon: { kind: 'text', value: '彩', bg: '#1681ff' },
        },
        {
          id: 'cover-blue',
          type: 'icon',
          name: '彩色满底',
          url: 'https://cover-blue.example/',
          icon: {
            kind: 'url',
            value: `data:image/svg+xml,${encodeURIComponent(
              '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#1681ff"/></svg>',
            )}`,
          },
        },
        {
          id: 'cover-white',
          type: 'icon',
          name: '白色满底',
          url: 'https://cover-white.example/',
          icon: {
            kind: 'url',
            value: `data:image/svg+xml,${encodeURIComponent(
              '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#ffffff"/><circle cx="32" cy="32" r="16" fill="#111111"/></svg>',
            )}`,
          },
        },
      ],
    },
    { id: 'group-ai', name: 'AI', icon: 'ai', items: [] },
  ]);

  await newtab.locator('.wallpaper-button').click();
  await expect(newtab.locator('.wp-panel')).toBeVisible();
  await newtab.getByRole('button', { name: '使用初雪壁纸' }).click();
  await newtab.keyboard.press('Escape');
  await expect(newtab.locator('.wp-panel')).toBeHidden();

  await expect(newtab.locator('.icon-tile[title="彩色满底"] .thumb')).toHaveClass(
    /is-cover/,
  );
  await expect(newtab.locator('.icon-tile[title="白色满底"] .thumb')).toHaveClass(
    /is-cover/,
  );

  const styles = await newtab.evaluate(() => {
    const shadowOf = (title: string) => {
      const tile = document.querySelector(`.icon-tile[title="${title}"]`);
      return getComputedStyle(tile!.querySelector('.icon-image')!).boxShadow;
    };
    const search = document.querySelector('.search')!;
    return {
      lightShadow: shadowOf('浅色卡片'),
      darkShadow: shadowOf('彩色卡片'),
      coverShadow: shadowOf('彩色满底'),
      whiteCoverShadow: shadowOf('白色满底'),
      textCardBg: getComputedStyle(
        document.querySelector('.icon-tile[title="彩色卡片"] .icon-image')!,
      ).backgroundColor,
      searchBg: getComputedStyle(search).backgroundColor,
    };
  });
  expect(styles.lightShadow).toContain('0px 0px 0px 1px');
  expect(styles.lightShadow).toContain('0px 0px 5px');
  expect(styles.darkShadow).toContain('0px 0px 0px 1px');
  expect(styles.coverShadow).toContain('0px 0px 0px 1px');
  expect(styles.whiteCoverShadow).toContain('0px 0px 0px 1px');
  expect(styles.textCardBg).toBe('rgb(22, 129, 255)');
  expect(styles.searchBg).toBe('rgba(255, 255, 255, 0.62)');

  await newtab.locator('.icon-tile[title="彩色卡片"]').hover();
  await newtab.waitForTimeout(250);
  const hoverShadow = await newtab
    .locator('.icon-tile[title="彩色卡片"] .icon-image')
    .evaluate((element) => getComputedStyle(element).boxShadow);
  expect(hoverShadow).toContain('0px 0px 0px 1px');
  expect(hoverShadow).toContain('0px 0px 10px');

  await newtab.locator('.search-input').click();
  const focusShadow = await newtab
    .locator('.search')
    .evaluate((element) => getComputedStyle(element).boxShadow);
  expect(focusShadow).not.toContain('4px');
});

test('settings drawer shows nav labels at a wider size', async ({ newtab }) => {
  await openSettings(newtab);

  const width = await newtab
    .locator('.settings-drawer')
    .evaluate((element) => element.getBoundingClientRect().width);
  expect(width).toBeGreaterThanOrEqual(440);
  await expect(newtab.locator('.settings-nav .nav-item span').first()).toBeVisible();
  await expect(newtab.locator('.settings-nav .nav-item').first()).toContainText('外观');
});

test('about panel shows the brand account', async ({ newtab }) => {
  await openSettings(newtab);
  await newtab
    .locator('.settings-nav .nav-item')
    .filter({ hasText: '关于' })
    .click();
  await expect(newtab.getByRole('heading', { name: '关于' })).toBeVisible();
  await expect(newtab.locator('.about-author')).toContainText('公众号：十一营养师');
});

test('fills the tile when the icon image has its own background', async ({ newtab }) => {
  const transparentDot = `data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="22" fill="#111111"/></svg>',
  )}`;
  const opaqueSquare = `data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#3b78c9"/></svg>',
  )}`;
  const roundedSquare = `data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#2f8f6b"/></svg>',
  )}`;

  await seedNav(newtab, [
    {
      id: 'group-home',
      name: '主页',
      icon: 'home',
      items: [
        {
          id: 'transparent-dot',
          type: 'icon',
          name: '透明图标',
          url: 'https://transparent.example/',
          icon: { kind: 'url', value: transparentDot },
        },
        {
          id: 'opaque-square',
          type: 'icon',
          name: '满底图标',
          url: 'https://opaque.example/',
          icon: { kind: 'url', value: opaqueSquare },
        },
        {
          id: 'rounded-square',
          type: 'icon',
          name: '圆角满底图标',
          url: 'https://rounded.example/',
          icon: { kind: 'url', value: roundedSquare },
        },
      ],
    },
    { id: 'group-ai', name: 'AI', icon: 'ai', items: [] },
  ]);

  const imageWidth = (title: string) =>
    newtab
      .locator(`.icon-tile[title="${title}"] .thumb-img`)
      .evaluate((element) => element.getBoundingClientRect().width);

  await expect.poll(() => imageWidth('透明图标')).toBe(48);
  await expect.poll(() => imageWidth('满底图标')).toBe(60);
  await expect.poll(() => imageWidth('圆角满底图标')).toBe(60);

  const cardBackground = (title: string) =>
    newtab
      .locator(`.icon-tile[title="${title}"] .icon-image`)
      .evaluate((element) => getComputedStyle(element).backgroundColor);
  await expect.poll(() => cardBackground('透明图标')).toBe('rgb(255, 255, 255)');
  await expect.poll(() => cardBackground('满底图标')).toBe('rgba(0, 0, 0, 0)');
  await expect.poll(() => cardBackground('圆角满底图标')).toBe('rgba(0, 0, 0, 0)');

  await expect
    .poll(() =>
      newtab
        .locator('.icon-tile[title="透明图标"] .icon-image')
        .evaluate((element) => getComputedStyle(element).boxShadow),
    )
    .toContain('0px 0px 5px');
  await expect
    .poll(() =>
      newtab
        .locator('.icon-tile[title="透明图标"] .icon-image')
        .evaluate((element) => getComputedStyle(element).boxShadow),
    )
    .not.toContain('0px 0px 0px 1px');
});

test('settings persist and focus returns to the opener', async ({ newtab }) => {
  const settingsButton = newtab.locator('.settings-button');
  await openSettings(newtab);
  const drawer = newtab.locator('.settings-drawer');
  await drawer.locator('.segment').filter({ hasText: '深色' }).click();
  await expect(newtab.locator('html')).toHaveAttribute('data-theme', 'dark');

  await newtab.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await expect(settingsButton).toBeFocused();

  await newtab.reload();
  await expect(newtab.locator('.clock')).toBeVisible();
  await expect(newtab.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('adds, edits, drags and deletes icons with persistence', async ({ newtab }) => {
  await seedNav(newtab, [
    {
      id: 'group-home',
      name: '主页',
      icon: 'home',
      items: [
        {
          id: 'seed-target',
          type: 'icon',
          name: 'E2E 目标',
          url: 'https://target.example.com/',
          icon: { kind: 'text', value: '目', bg: '#4c8dff' },
        },
      ],
    },
    { id: 'group-ai', name: 'AI', icon: 'ai', items: [] },
  ]);
  await addIcon(newtab, 'E2E 站点', 'e2e.example.com');

  await newtab.reload();
  await expect(newtab.locator('.clock')).toBeVisible();
  await expect(newtab.locator('.icon-tile[title="E2E 站点"]')).toBeVisible();

  await newtab.locator('.icon-tile[title="E2E 站点"]').click({ button: 'right' });
  const menu = newtab.getByRole('menu');
  await expect(menu).toBeVisible();
  await menu.getByRole('menuitem', { name: '编辑' }).click();
  const editor = newtab.getByRole('dialog', { name: '编辑图标' });
  await expect(editor).toBeVisible();
  await editor.getByLabel('名称', { exact: true }).fill('E2E 改名');
  await editor.locator('.dialog-footer .panel-btn.primary').click();
  await expect(editor).toBeHidden();
  await expect(newtab.locator('.icon-tile[title="E2E 改名"]')).toBeVisible();

  const source = newtab.locator('.icon-tile[title="E2E 改名"]');
  const first = newtab.locator('.grid > [data-nav-id]').first();
  const sourceBox = await source.boundingBox();
  const targetBox = await first.boundingBox();
  if (!sourceBox || !targetBox) throw new Error('无法获取拖拽位置');
  await newtab.mouse.move(
    sourceBox.x + sourceBox.width / 2,
    sourceBox.y + sourceBox.height / 2,
  );
  await newtab.mouse.down();
  await newtab.mouse.move(targetBox.x + 6, targetBox.y + targetBox.height / 2, {
    steps: 14,
  });
  await newtab.mouse.up();

  await expect
    .poll(async () => (await readNav(newtab))[0]?.items[0]?.name)
    .toBe('E2E 改名');

  await newtab.reload();
  await expect(newtab.locator('.clock')).toBeVisible();
  await expect(
    newtab.locator('.grid > [data-nav-id]').first().locator('.icon-label'),
  ).toHaveText('E2E 改名');

  await newtab.locator('.icon-tile[title="E2E 改名"]').click({ button: 'right' });
  await newtab.getByRole('menu').getByRole('menuitem', { name: '删除' }).click();
  const confirm = newtab.getByRole('dialog', { name: '删除图标' });
  await expect(confirm).toBeVisible();
  await confirm.locator('.panel-btn.danger-solid').click();
  await expect(newtab.locator('.icon-tile[title="E2E 改名"]')).toHaveCount(0);
  await expect(newtab.locator('.grid > .icon-tile')).toHaveCount(1);
});

test('uploads an icon to IndexedDB and cleans the blob on delete', async ({
  newtab,
}) => {
  const iconBlobCount = () =>
    newtab.evaluate(
      () =>
        new Promise<number>((resolve) => {
          const request = indexedDB.open('suntab');
          request.onsuccess = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains('icons')) {
              resolve(0);
              return;
            }
            const count = db
              .transaction('icons', 'readonly')
              .objectStore('icons')
              .count();
            count.onsuccess = () => resolve(count.result);
            count.onerror = () => resolve(-1);
          };
          request.onerror = () => resolve(-1);
        }),
    );

  await newtab.locator('.add-tile').click();
  const dialog = newtab.getByRole('dialog', { name: '添加图标' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('名称', { exact: true }).fill('上传测试');
  await dialog.getByLabel('网址', { exact: true }).fill('upload.example.com');
  await dialog.getByRole('tab', { name: '上传' }).click();
  await dialog
    .locator('input[type="file"]')
    .setInputFiles(path.resolve('public/icon/128.png'));
  await expect(dialog.locator('.upload-thumb img')).toBeVisible();
  await dialog.locator('.dialog-footer .panel-btn.primary').click();
  await expect(dialog).toBeHidden();

  const tile = newtab.locator('.icon-tile[title="上传测试"]');
  await expect(tile.locator('img')).toHaveAttribute('src', /^blob:/);
  await expect.poll(iconBlobCount).toBe(1);

  await newtab.reload();
  await expect(newtab.locator('.clock')).toBeVisible();
  const restored = newtab.locator('.icon-tile[title="上传测试"] img');
  await expect(restored).toHaveAttribute('src', /^blob:/);

  await newtab.locator('.icon-tile[title="上传测试"]').click({ button: 'right' });
  await newtab.getByRole('menu').getByRole('menuitem', { name: '删除' }).click();
  const confirm = newtab.getByRole('dialog', { name: '删除图标' });
  await confirm.locator('.panel-btn.danger-solid').click();
  await expect(newtab.locator('.icon-tile[title="上传测试"]')).toHaveCount(0);
  await expect.poll(iconBlobCount).toBe(0);
});

test('uploads an svg icon without rasterizing it', async ({ newtab }) => {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="22" fill="#c33"/></svg>';

  await newtab.locator('.add-tile').click();
  const dialog = newtab.getByRole('dialog', { name: '添加图标' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('名称', { exact: true }).fill('SVG 上传');
  await dialog.getByLabel('网址', { exact: true }).fill('svg.example.com');
  await dialog.getByRole('tab', { name: '上传' }).click();
  await dialog.locator('input[type="file"]').setInputFiles({
    name: 'brand.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from(svg),
  });
  await expect(dialog.locator('.upload-thumb img')).toBeVisible();
  await dialog.locator('.dialog-footer .panel-btn.primary').click();
  await expect(dialog).toBeHidden();

  await expect(
    newtab.locator('.icon-tile[title="SVG 上传"] img'),
  ).toBeVisible();

  const stored = await newtab.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('suntab');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const records = await new Promise<Array<{ blob: Blob }>>((resolve) => {
      const request = db
        .transaction('icons', 'readonly')
        .objectStore('icons')
        .getAll();
      request.onsuccess = () => resolve(request.result);
    });
    const blob = records[0]!.blob;
    return { type: blob.type, size: blob.size, text: await blob.text() };
  });
  expect(stored.type).toBe('image/svg+xml');
  expect(stored.text).toContain('<svg');
  expect(stored.size).toBe(Buffer.byteLength(svg));
});

test('gives a white svg upload a dark backdrop', async ({ newtab }) => {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="22" fill="#ffffff"/></svg>';

  await newtab.locator('.add-tile').click();
  const dialog = newtab.getByRole('dialog', { name: '添加图标' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('名称', { exact: true }).fill('白色上传');
  await dialog.getByLabel('网址', { exact: true }).fill('white-upload.example.com');
  await dialog.getByRole('tab', { name: '上传' }).click();
  await dialog.locator('input[type="file"]').setInputFiles({
    name: 'white.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from(svg),
  });
  await expect(dialog.locator('.upload-thumb img')).toBeVisible();
  await expect(dialog.getByLabel('自定义图标底色')).toHaveValue('#1f1f1f');
  await dialog.locator('.dialog-footer .panel-btn.primary').click();
  await expect(dialog).toBeHidden();

  const tile = newtab.locator('.icon-tile[title="白色上传"]');
  await expect(tile.locator('img')).toBeVisible();
  await expect(tile.locator('.thumb')).toHaveCSS(
    'background-color',
    'rgb(31, 31, 31)',
  );

  const readBg = () =>
    newtab.evaluate(
      () =>
        new Promise<string>((resolve) => {
          (
            globalThis as unknown as {
              chrome: {
                storage: {
                  local: {
                    get(
                      key: string,
                      callback: (value: Record<string, unknown>) => void,
                    ): void;
                  };
                };
              };
            }
          ).chrome.storage.local.get('suntab:nav', (value) => {
            const groups = (value['suntab:nav'] ?? []) as Array<{
              items: Array<{ name?: string; icon?: { bg?: string } }>;
            }>;
            const item = groups
              .flatMap((group) => group.items)
              .find((entry) => entry.name === '白色上传');
            resolve(item?.icon?.bg ?? '');
          });
        }),
    );
  await expect.poll(readBg).toBe('#1f1f1f');
});

test('exports an svg upload in the backup', async ({ newtab }) => {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#0a7"/></svg>';

  await newtab.locator('.add-tile').click();
  const dialog = newtab.getByRole('dialog', { name: '添加图标' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('名称', { exact: true }).fill('SVG 备份');
  await dialog.getByLabel('网址', { exact: true }).fill('svg-backup.example.com');
  await dialog.getByRole('tab', { name: '上传' }).click();
  await dialog.locator('input[type="file"]').setInputFiles({
    name: 'brand-nosize.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from(svg),
  });
  await expect(dialog.locator('.upload-thumb img')).toBeVisible();
  await dialog.locator('.dialog-footer .panel-btn.primary').click();
  await expect(dialog).toBeHidden();

  await openDataSettings(newtab);
  const downloadPromise = newtab.waitForEvent('download');
  await newtab.getByRole('button', { name: '导出 JSON' }).click();
  const download = await downloadPromise;
  const backupPath = await download.path();
  if (!backupPath) throw new Error('没有拿到备份文件');
  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8')) as {
    icons?: Array<{ type?: string; dataUrl: string }>;
  };
  expect(backup.icons).toHaveLength(1);
  expect(backup.icons?.[0]?.dataUrl).toMatch(/^data:image\/svg\+xml;base64,/);
});

test('exports uploaded icons and restores them from a backup', async ({ newtab }) => {
  const iconBlobCount = () =>
    newtab.evaluate(
      () =>
        new Promise<number>((resolve) => {
          const request = indexedDB.open('suntab');
          request.onsuccess = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains('icons')) {
              resolve(0);
              return;
            }
            const count = db
              .transaction('icons', 'readonly')
              .objectStore('icons')
              .count();
            count.onsuccess = () => resolve(count.result);
            count.onerror = () => resolve(-1);
          };
          request.onerror = () => resolve(-1);
        }),
    );

  await newtab.locator('.add-tile').click();
  const dialog = newtab.getByRole('dialog', { name: '添加图标' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('名称', { exact: true }).fill('备份图标测试');
  await dialog.getByLabel('网址', { exact: true }).fill('backup-icon.example.com');
  await dialog.getByRole('tab', { name: '上传' }).click();
  await dialog
    .locator('input[type="file"]')
    .setInputFiles(path.resolve('public/icon/128.png'));
  await expect(dialog.locator('.upload-thumb img')).toBeVisible();
  await dialog.locator('.dialog-footer .panel-btn.primary').click();
  await expect(dialog).toBeHidden();
  await expect.poll(iconBlobCount).toBe(1);

  await openDataSettings(newtab);
  const downloadPromise = newtab.waitForEvent('download');
  await newtab.getByRole('button', { name: '导出 JSON' }).click();
  const download = await downloadPromise;
  const backupPath = await download.path();
  if (!backupPath) throw new Error('没有拿到备份文件');
  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8')) as {
    icons?: Array<{ id: string; dataUrl: string }>;
    iconsIncluded?: boolean;
    nav: Array<{
      items: Array<{
        type: string;
        icon?: { kind: string; value: string };
        children?: Array<{ type: string; icon?: { kind: string; value: string } }>;
      }>;
    }>;
  };
  expect(backup.iconsIncluded).toBe(true);
  expect(backup.icons).toHaveLength(1);
  expect(backup.icons?.[0]?.dataUrl).toMatch(/^data:image\//);
  const uploadItems = backup.nav
    .flatMap((group) => group.items)
    .flatMap((item) => (item.type === 'folder' ? (item.children ?? []) : [item]))
    .filter((item) => item.icon?.kind === 'upload');
  expect(uploadItems).toHaveLength(1);
  expect(uploadItems[0]?.icon?.value).toBe(backup.icons?.[0]?.id);

  await newtab.keyboard.press('Escape');
  await newtab
    .locator('.icon-tile[title="备份图标测试"]')
    .click({ button: 'right' });
  await newtab.getByRole('menu').getByRole('menuitem', { name: '删除' }).click();
  const confirm = newtab.getByRole('dialog', { name: '删除图标' });
  await confirm.locator('.panel-btn.danger-solid').click();
  await expect(newtab.locator('.icon-tile[title="备份图标测试"]')).toHaveCount(0);
  await expect.poll(iconBlobCount).toBe(0);

  await openDataSettings(newtab);
  await newtab.locator('.data-card input[type="file"]').setInputFiles(backupPath);
  await expect(newtab.locator('.import-preview')).toContainText('1 个上传图标');
  await newtab.getByRole('button', { name: '确认导入' }).click();
  await expect(newtab.locator('.status')).toContainText('已恢复 1 个上传图标');
  await newtab.keyboard.press('Escape');

  const restored = newtab.locator('.icon-tile[title="备份图标测试"]');
  await expect(restored).toBeVisible();
  await expect(restored.locator('img')).toHaveAttribute('src', /^blob:/);
  await expect.poll(iconBlobCount).toBe(1);
});

test('exports a backup and restores it after changes', async ({ newtab }) => {
  await openDataSettings(newtab);
  const downloadPromise = newtab.waitForEvent('download');
  await newtab.getByRole('button', { name: '导出 JSON' }).click();
  const download = await downloadPromise;
  const backupPath = await download.path();
  if (!backupPath) throw new Error('没有拿到备份文件');
  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8')) as {
    app: string;
    nav: Array<{ items: unknown[] }>;
  };
  expect(backup.app).toBe('SunTab');
  expect(backup.nav[0]?.items).toHaveLength(0);

  await newtab.keyboard.press('Escape');
  await addIcon(newtab, '临时图标', 'temporary.example.com');
  await expect(newtab.locator('.icon-tile[title="临时图标"]')).toBeVisible();

  await openDataSettings(newtab);
  await newtab.locator('.data-card input[type="file"]').setInputFiles(backupPath);
  await expect(newtab.locator('.import-preview')).toBeVisible();
  await newtab.getByRole('button', { name: '确认导入' }).click();
  await newtab.keyboard.press('Escape');

  await expect(newtab.locator('.icon-tile[title="临时图标"]')).toHaveCount(0);
  await expect(newtab.locator('.grid > .icon-tile')).toHaveCount(0);
});

test('long grids and group lists scroll instead of clipping', async ({ newtab }) => {
  await newtab.evaluate(() => {
    return new Promise<void>((resolve) => {
      const chromeApi = (globalThis as unknown as {
        chrome: {
          storage: {
            local: {
              get(key: string, callback: (value: Record<string, unknown>) => void): void;
              set(value: Record<string, unknown>, callback: () => void): void;
            };
          };
        };
      }).chrome;
      chromeApi.storage.local.get('suntab:nav', (stored) => {
        const saved = stored['suntab:nav'];
        const nav = (Array.isArray(saved) && saved.length
          ? saved
          : [
              { id: 'group-home', name: '主页', icon: 'home', items: [] },
              { id: 'group-ai', name: 'AI', icon: 'ai', items: [] },
            ]) as Array<{
          id: string;
          name: string;
          icon: string;
          items: unknown[];
        }>;
        nav[0]!.items = Array.from({ length: 90 }, (_, index) => ({
          id: `bulk-${index}`,
          type: 'icon',
          name: `站点 ${index + 1}`,
          url: `https://example.com/${index}`,
          icon: { kind: 'text', value: String(index + 1) },
        }));
        for (let index = 0; index < 11; index += 1) {
          nav.push({
            id: `bulk-group-${index}`,
            name: `分组 ${index + 1}`,
            icon: 'folder',
            items: [],
          });
        }
        chromeApi.storage.local.set({ 'suntab:nav': nav }, () => resolve());
      });
    });
  });

  await expect(newtab.locator('.grid > .icon-tile')).toHaveCount(90);
  await expect(newtab.locator('.group-btn')).toHaveCount(13);

  const gridMetrics = await newtab.evaluate(() => {
    const groups = document.querySelector('.groups');
    return {
      height: document.documentElement.scrollHeight,
      viewport: window.innerHeight,
      sidebarScrollable: groups ? groups.scrollHeight > groups.clientHeight : false,
    };
  });
  expect(gridMetrics.height).toBeGreaterThan(gridMetrics.viewport);
  expect(gridMetrics.sidebarScrollable).toBe(true);

  await newtab.locator('.group-btn').last().click();
  await expect(newtab.locator('.group-btn').last()).toHaveClass(/active/);
  await newtab.locator('.group-btn').first().click();
  await expect(newtab.locator('.grid > .icon-tile')).toHaveCount(90);

  const lastTile = newtab.locator('.grid > .icon-tile').last();
  await lastTile.scrollIntoViewIfNeeded();
  await expect(lastTile).toBeVisible();
});

test('popup adds the current page and rejects duplicates', async ({
  context,
  extensionId,
  newtab,
}) => {
  const webPage = await context.newPage();
  await webPage.goto(localPageUrl);

  const openQuickAdd = async () => {
    const popup = await context.newPage();
    await popup.addInitScript(
      ({ url, title }) => {
        const chromeApi = (globalThis as unknown as {
          chrome?: {
            tabs?: {
              query(info: { active?: boolean }, callback: (tabs: unknown[]) => void): void;
            };
          };
        }).chrome;
        if (!chromeApi?.tabs) return;
        const original = chromeApi.tabs.query.bind(chromeApi.tabs);
        chromeApi.tabs.query = (info, callback) => {
          if (info?.active) {
            callback([{ id: 999, url, title }]);
            return;
          }
          original(info, callback);
        };
      },
      { url: localPageUrl, title: '本地测试页' },
    );
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(popup.locator('.quick-form')).toBeVisible();
    return popup;
  };

  const popup = await openQuickAdd();
  await expect(popup.locator('input.popup-input')).toHaveValue('本地测试页');
  await popup.getByRole('button', { name: '添加到 SunTab' }).click();
  await expect(popup.locator('.saved')).toContainText('已添加');
  await expect(popup.locator('.saved')).toContainText('主页');

  await newtab.reload();
  await expect(newtab.locator('.clock')).toBeVisible();
  await expect(newtab.locator('.icon-tile[title="本地测试页"]')).toBeVisible();

  const duplicatePopup = await openQuickAdd();
  await expect(duplicatePopup.locator('.hint.warn')).toContainText('已经有这个网址');
  await expect(
    duplicatePopup.getByRole('button', { name: '添加到 SunTab' }),
  ).toBeDisabled();
});
