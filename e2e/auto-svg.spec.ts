import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { deflateSync } from 'node:zlib';
import {
  chromium,
  expect,
  test,
  type BrowserContext,
  type Page,
} from '@playwright/test';

const CHROME_PATH =
  process.env.SUNTAB_CHROME ??
  'C:/ruanjian/liulanqi/ungoogled-chromium_156.0.8078.79-1.1_windows_x64/chrome.exe';
const EXTENSION_ID = 'baicegclhemapbjejjkgffjelfbehifl';

const SVG_LINK =
  '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><circle cx="64" cy="64" r="48" fill="#1a7"/></svg>';
const SVG_MANIFEST =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#a17"/></svg>';
const SVG_WHITE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="22" fill="#ffffff"/></svg>';
const SVG_COLOR =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="22" fill="#169b62"/></svg>';
const SVG_EXTERNAL =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><use href="https://example.com/sprite.svg#logo"/></svg>';
const BRAND_LOCKUP_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40"><rect width="40" height="40" rx="8" fill="#c82c34"/><circle cx="20" cy="20" r="8" fill="#ffd166"/><text x="52" y="29" font-family="sans-serif" font-size="24" fill="#222222">Brand</text></svg>';
const BRAND_RIGHT_MARK_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40"><text x="0" y="29" font-family="sans-serif" font-size="24" fill="#222222">Brand</text><rect x="80" width="40" height="40" rx="8" fill="#3fae7a"/><circle cx="100" cy="20" r="8" fill="#ffd166"/></svg>';
const BRAND_STACK_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 80"><rect x="12" width="40" height="40" rx="8" fill="#3b78c9"/><text x="32" y="70" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#222222">Brand</text></svg>';
const BRAND_STACK_REVERSE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 80"><text x="32" y="16" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#222222">Brand</text><rect x="12" y="40" width="40" height="40" rx="8" fill="#7c5cff"/></svg>';
const BRAND_INTEGRATED_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><circle cx="40" cy="40" r="38" fill="#3b78c9"/><text x="40" y="46" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#ffd166">Brand</text></svg>';
const BRAND_WORDMARK_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 40"><text x="0" y="30" font-family="sans-serif" font-size="28" fill="#222222">BrandName</text></svg>';

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const name = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}

function makePng(
  width: number,
  height: number,
  pixel: (x: number, y: number) => [number, number, number, number],
): Buffer {
  const stride = width * 4 + 1;
  const rows = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * stride;
    for (let x = 0; x < width; x += 1) {
      const [red, green, blue, alpha] = pixel(x, y);
      const offset = row + 1 + x * 4;
      rows[offset] = red;
      rows[offset + 1] = green;
      rows[offset + 2] = blue;
      rows[offset + 3] = alpha;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(rows)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

const RASTER_ICON = makePng(192, 192, (x, y) => {
  const dx = x - 96;
  const dy = y - 96;
  return dx * dx + dy * dy <= 78 * 78
    ? [22, 155, 98, 255]
    : [0, 0, 0, 0];
});

const BRAND_RASTER = makePng(242, 150, (x, y) => {
  const dx = x - 46;
  const dy = y - 68;
  if (dx * dx + dy * dy <= 32 * 32) return [200, 40, 50, 255];
  const inText =
    y >= 20 &&
    y <= 119 &&
    ((x >= 100 && x <= 129) ||
      (x >= 140 && x <= 189) ||
      (x >= 200 && x <= 229));
  return inText ? [30, 90, 200, 255] : [0, 0, 0, 0];
});

const WIDE_BANNER = makePng(600, 100, (x, y) =>
  x >= 10 && x <= 589 && y >= 10 && y <= 89
    ? [200, 40, 50, 255]
    : [0, 0, 0, 0],
);

const TINY_RASTER = makePng(32, 32, (x, y) => {
  const dx = x - 16;
  const dy = y - 16;
  return dx * dx + dy * dy <= 14 * 14
    ? [22, 155, 98, 255]
    : [0, 0, 0, 0];
});

let server: http.Server;
let base = '';

test.beforeAll(async () => {
  server = http.createServer((request, response) => {
    const url = request.url ?? '/';
    if (url === '/icon.svg') {
      response.setHeader('Content-Type', 'image/svg+xml');
      response.end(SVG_LINK);
      return;
    }
    if (url === '/white.svg' || url === '/color.svg' || url === '/external.svg') {
      response.setHeader('Content-Type', 'image/svg+xml');
      response.end(
        url === '/white.svg'
          ? SVG_WHITE
          : url === '/color.svg'
            ? SVG_COLOR
            : SVG_EXTERNAL,
      );
      return;
    }
    if (url === '/manifest-icon.svg') {
      response.setHeader('Content-Type', 'image/svg+xml');
      response.end(SVG_MANIFEST);
      return;
    }
    const brandSvgs: Record<string, string> = {
      '/brand-lockup.svg': BRAND_LOCKUP_SVG,
      '/brand-right-mark.svg': BRAND_RIGHT_MARK_SVG,
      '/brand-stack.svg': BRAND_STACK_SVG,
      '/brand-stack-reverse.svg': BRAND_STACK_REVERSE_SVG,
      '/brand-integrated.svg': BRAND_INTEGRATED_SVG,
      '/brand-wordmark.svg': BRAND_WORDMARK_SVG,
    };
    if (brandSvgs[url]) {
      response.setHeader('Content-Type', 'image/svg+xml');
      response.end(brandSvgs[url]);
      return;
    }
    const rasterAssets: Record<string, Buffer> = {
      '/touch.png': RASTER_ICON,
      '/brand-raster.png': BRAND_RASTER,
      '/wide-banner.png': WIDE_BANNER,
      '/tiny.png': TINY_RASTER,
    };
    if (rasterAssets[url]) {
      response.setHeader('Content-Type', 'image/png');
      response.end(rasterAssets[url]);
      return;
    }
    if (url === '/app.webmanifest') {
      response.setHeader('Content-Type', 'application/manifest+json');
      response.end(
        JSON.stringify({
          icons: [
            { src: '/manifest-icon.svg', type: 'image/svg+xml', sizes: 'any' },
          ],
        }),
      );
      return;
    }
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (url === '/link' || url === '/link2') {
      response.end(
        '<!doctype html><title>link icon</title><link rel="icon" type="image/svg+xml" href="/icon.svg"><h1>link</h1>',
      );
      return;
    }
    if (url === '/manifest') {
      response.end(
        '<!doctype html><title>manifest icon</title><link rel="manifest" href="/app.webmanifest"><h1>manifest</h1>',
      );
      return;
    }
    if (url === '/white-theme') {
      response.end(
        '<!doctype html><title>white theme</title><meta name="theme-color" content="#102030"><link rel="icon" type="image/svg+xml" href="/white.svg"><h1>w</h1>',
      );
      return;
    }
    if (url === '/white-plain') {
      response.end(
        '<!doctype html><title>white plain</title><link rel="icon" type="image/svg+xml" href="/white.svg"><h1>w</h1>',
      );
      return;
    }
    if (url === '/mask-order') {
      response.end(
        '<!doctype html><title>mask order</title><link rel="mask-icon" href="/white.svg"><link rel="icon" type="image/svg+xml" href="/color.svg"><h1>m</h1>',
      );
      return;
    }
    if (url === '/blank-first') {
      response.end(
        '<!doctype html><title>blank first</title><link rel="icon" type="image/svg+xml" href="/external.svg"><link rel="icon" type="image/svg+xml" href="/color.svg"><h1>b</h1>',
      );
      return;
    }
    const brandPages: Record<string, string> = {
      '/brand-lockup': '/brand-lockup.svg',
      '/brand-right-mark': '/brand-right-mark.svg',
      '/brand-stack': '/brand-stack.svg',
      '/brand-stack-reverse': '/brand-stack-reverse.svg',
      '/brand-integrated': '/brand-integrated.svg',
      '/brand-wordmark': '/brand-wordmark.svg',
    };
    if (brandPages[url]) {
      response.end(
        `<!doctype html><title>brand</title><header><a class="logo" href="/"><img src="${brandPages[url]}" alt="品牌"></a></header><h1>brand</h1>`,
      );
      return;
    }
    if (url === '/raster') {
      response.end(
        '<!doctype html><title>raster icon</title><link rel="apple-touch-icon" href="/touch.png"><h1>raster</h1>',
      );
      return;
    }
    if (url === '/brand-raster' || url === '/brand-raster-hint') {
      response.end(
        '<!doctype html><title>brand raster</title><header><a class="logo" href="/"><img src="/brand-raster.png" alt="品牌"></a></header><h1>brand</h1>',
      );
      return;
    }
    if (url === '/wide-banner') {
      response.end(
        '<!doctype html><title>wide banner</title><header><a class="logo" href="/"><img src="/wide-banner.png" alt="品牌"></a></header><h1>banner</h1>',
      );
      return;
    }
    if (url === '/tiny-raster') {
      response.end(
        '<!doctype html><title>tiny raster</title><link rel="icon" type="image/png" sizes="32x32" href="/tiny.png"><h1>tiny</h1>',
      );
      return;
    }
    response.end('<!doctype html><title>plain</title><h1>plain</h1>');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function patchedExtension(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'suntab-svg-ext-'));
  fs.cpSync('.output/chrome-mv3', path.join(dir, 'ext'), { recursive: true });
  const manifestPath = path.join(dir, 'ext', 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  // Pre-grant site access so the permission bubble never blocks the test.
  manifest.host_permissions = ['http://*/*', 'https://*/*'];
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  return path.join(dir, 'ext');
}

async function addIcon(page: Page, name: string, url: string) {
  await page.locator('.add-tile').click();
  const dialog = page.getByRole('dialog', { name: '添加图标' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('名称', { exact: true }).fill(name);
  await dialog.getByLabel('网址', { exact: true }).fill(url);
  await dialog.locator('.dialog-footer .panel-btn.primary').click();
  await expect(dialog).toBeHidden({ timeout: 15_000 });
  return page.locator(`.icon-tile[title="${name}"] img`);
}

async function readNav(
  page: Page,
): Promise<Array<{ name: string; kind: string; bg: string; value: string }>> {
  return page.evaluate(
    () =>
      new Promise((resolve) => {
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
            items: Array<{
              name?: string;
              type?: string;
              icon?: { kind?: string; bg?: string; value?: string };
            }>;
          }>;
          resolve(
            groups.flatMap((group) =>
              group.items.flatMap((item) =>
                item.type === 'icon'
                  ? [
                      {
                        name: item.name ?? '',
                        kind: item.icon?.kind ?? '',
                        bg: item.icon?.bg ?? '',
                        value: item.icon?.value ?? '',
                      },
                    ]
                  : [],
              ),
            ),
          );
        });
      }),
  ) as Promise<
    Array<{ name: string; kind: string; bg: string; value: string }>
  >;
}

async function readIconSvg(page: Page, id: string): Promise<string> {
  return page.evaluate(
    (blobId) =>
      new Promise<string>((resolve, reject) => {
        const request = indexedDB.open('suntab');
        request.onsuccess = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('icons')) {
            resolve('');
            return;
          }
          const get = db
            .transaction('icons', 'readonly')
            .objectStore('icons')
            .get(blobId);
          get.onsuccess = async () => {
            const record = get.result as { blob?: Blob } | undefined;
            resolve(record?.blob ? await record.blob.text() : '');
          };
          get.onerror = () => reject(get.error);
        };
        request.onerror = () => reject(request.error);
      }),
    id,
  );
}

async function readIconPixels(
  page: Page,
  id: string,
): Promise<{ red: number; blue: number }> {
  return page.evaluate(
    (blobId) =>
      new Promise<{ red: number; blue: number }>((resolve, reject) => {
        const request = indexedDB.open('suntab');
        request.onsuccess = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('icons')) {
            resolve({ red: 0, blue: 0 });
            return;
          }
          const get = db
            .transaction('icons', 'readonly')
            .objectStore('icons')
            .get(blobId);
          get.onsuccess = async () => {
            const record = get.result as { blob?: Blob } | undefined;
            if (!record?.blob) {
              resolve({ red: 0, blue: 0 });
              return;
            }
            try {
              const bitmap = await createImageBitmap(record.blob);
              const canvas = document.createElement('canvas');
              canvas.width = 128;
              canvas.height = 128;
              const context = canvas.getContext('2d', {
                willReadFrequently: true,
              });
              if (!context) {
                resolve({ red: 0, blue: 0 });
                return;
              }
              context.drawImage(bitmap, 0, 0, 128, 128);
              bitmap.close();
              const data = context.getImageData(0, 0, 128, 128).data;
              let red = 0;
              let blue = 0;
              for (let index = 0; index < data.length; index += 4) {
                if (data[index + 3]! < 20) continue;
                if (data[index]! > 150 && data[index + 2]! < 100) red += 1;
                if (data[index + 2]! > 150 && data[index]! < 100) blue += 1;
              }
              resolve({ red, blue });
            } catch (error) {
              reject(error);
            }
          };
          get.onerror = () => reject(get.error);
        };
        request.onerror = () => reject(request.error);
      }),
    id,
  );
}

async function thumbBackground(page: Page, name: string): Promise<string> {
  return page
    .locator(`.icon-tile[title="${name}"] .thumb`)
    .evaluate((element) => getComputedStyle(element).backgroundColor);
}

async function readIcons(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('suntab');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (!db.objectStoreNames.contains('icons')) return [];
    const records = await new Promise<Array<{ blob: Blob }>>((resolve) => {
      const request = db
        .transaction('icons', 'readonly')
        .objectStore('icons')
        .getAll();
      request.onsuccess = () => resolve(request.result);
    });
    return Promise.all(
      records.map(async (record) => ({
        type: record.blob.type,
        text: (await record.blob.text()).slice(0, 400),
      })),
    );
  });
}

test('automatic icons resolve site svg from link, manifest and fall back', async () => {
  test.setTimeout(120_000);
  const extensionPath = patchedExtension();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'suntab-svg-profile-'));
  let context: BrowserContext | undefined;
  try {
    context = await chromium.launchPersistentContext(profile, {
      executablePath: fs.existsSync(CHROME_PATH) ? CHROME_PATH : undefined,
      headless: false,
      viewport: { width: 1280, height: 752 },
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--lang=zh-CN',
      ],
    });
    const page = await context.newPage();
    await page.goto(`chrome-extension://${EXTENSION_ID}/newtab.html`);
    await page.locator('.clock').waitFor();

    const linkImg = await addIcon(page, '链接 SVG', `${base}/link`);
    await expect(linkImg).toHaveAttribute('src', /^blob:/);

    const manifestImg = await addIcon(page, '清单 SVG', `${base}/manifest`);
    await expect(manifestImg).toHaveAttribute('src', /^blob:/);

    await addIcon(page, '无 SVG', `${base}/plain`);
    await addIcon(page, '品牌裁标志', `${base}/brand-lockup`);
    await addIcon(page, '品牌右标志', `${base}/brand-right-mark`);
    await addIcon(page, '品牌上标志', `${base}/brand-stack`);
    await addIcon(page, '品牌下标志', `${base}/brand-stack-reverse`);
    await addIcon(page, '品牌整体', `${base}/brand-integrated`);
    await addIcon(page, '纯文字品牌', `${base}/brand-wordmark`);
    const rasterImg = await addIcon(page, '声明位图', `${base}/raster`);
    await expect(rasterImg).toHaveAttribute('src', /^blob:/);
    const brandRasterImg = await addIcon(page, '品牌位图', `${base}/brand-raster`);
    await expect(brandRasterImg).toHaveAttribute('src', /^blob:/);
    await addIcon(page, '宽横幅', `${base}/wide-banner`);
    await addIcon(page, '小位图', `${base}/tiny-raster`);

    const whiteThemeImg = await addIcon(
      page,
      '白色主题色',
      `${base}/white-theme`,
    );
    await expect(whiteThemeImg).toHaveAttribute('src', /^blob:/);
    const whitePlainImg = await addIcon(
      page,
      '白色无主题',
      `${base}/white-plain`,
    );
    await expect(whitePlainImg).toHaveAttribute('src', /^blob:/);
    const maskImg = await addIcon(page, 'mask 顺序', `${base}/mask-order`);
    await expect(maskImg).toHaveAttribute('src', /^blob:/);
    const blankImg = await addIcon(page, '空白优先', `${base}/blank-first`);
    await expect(blankImg).toHaveAttribute('src', /^blob:/);

    await expect.poll(async () => (await readNav(page)).length).toBe(17);
    const nav = await readNav(page);
    expect(nav.find((item) => item.name === '链接 SVG')?.kind).toBe('upload');
    expect(nav.find((item) => item.name === '清单 SVG')?.kind).toBe('upload');
    expect(nav.find((item) => item.name === '无 SVG')?.kind).toBe('favicon');
    expect(nav.find((item) => item.name === '品牌裁标志')?.kind).toBe('upload');
    expect(nav.find((item) => item.name === '品牌右标志')?.kind).toBe('upload');
    expect(nav.find((item) => item.name === '品牌上标志')?.kind).toBe('upload');
    expect(nav.find((item) => item.name === '品牌下标志')?.kind).toBe('upload');
    expect(nav.find((item) => item.name === '品牌整体')?.kind).toBe('upload');
    expect(nav.find((item) => item.name === '纯文字品牌')?.kind).toBe('favicon');
    expect(nav.find((item) => item.name === '声明位图')?.kind).toBe('upload');
    expect(nav.find((item) => item.name === '品牌位图')?.kind).toBe('upload');
    expect(nav.find((item) => item.name === '宽横幅')?.kind).toBe('favicon');
    expect(nav.find((item) => item.name === '小位图')?.kind).toBe('favicon');
    expect(nav.find((item) => item.name === '白色主题色')?.bg).toBe('#102030');
    expect(nav.find((item) => item.name === '白色无主题')?.bg).toBe('#1f1f1f');
    expect(nav.find((item) => item.name === 'mask 顺序')?.bg).toBe('#ffffff');
    expect(nav.find((item) => item.name === '空白优先')?.bg).toBe('#ffffff');

    for (const name of ['品牌裁标志', '品牌右标志', '品牌上标志', '品牌下标志']) {
      const item = nav.find((entry) => entry.name === name);
      const svg = await readIconSvg(page, item?.value ?? '');
      expect(svg).toContain('<svg');
      expect(svg).toContain('viewBox');
      expect(svg).not.toContain('Brand');
      expect(svg).not.toContain('<text');
    }

    const integrated = nav.find((item) => item.name === '品牌整体');
    const integratedSvg = await readIconSvg(page, integrated?.value ?? '');
    expect(integratedSvg).toContain('Brand');
    expect(integratedSvg).toContain('0 0 80 80');

    for (const name of ['纯文字品牌', '无 SVG']) {
      const tile = page.locator(`.icon-tile[title="${name}"]`);
      await expect(
        tile.locator('.thumb-img').or(tile.locator('.thumb-text')),
      ).toBeVisible();
    }

    const brandRaster = nav.find((item) => item.name === '品牌位图');
    const pixels = await readIconPixels(page, brandRaster?.value ?? '');
    expect(pixels.red).toBeGreaterThan(100);
    expect(pixels.blue).toBe(0);

    await expect
      .poll(() => thumbBackground(page, '白色主题色'))
      .toBe('rgb(16, 32, 48)');
    await expect
      .poll(() => thumbBackground(page, '白色无主题'))
      .toBe('rgb(31, 31, 31)');
    await expect
      .poll(() => thumbBackground(page, 'mask 顺序'))
      .toBe('rgb(255, 255, 255)');
    await expect
      .poll(() => thumbBackground(page, '空白优先'))
      .toBe('rgb(255, 255, 255)');

    const icons = await readIcons(page);
    const svgIcons = icons.filter((icon) => icon.type === 'image/svg+xml');
    const webpIcons = icons.filter((icon) => icon.type === 'image/webp');
    expect(svgIcons.some((icon) => icon.text.includes('<svg'))).toBe(true);
    expect(webpIcons).toHaveLength(2);
    expect(svgIcons.filter((icon) => icon.text.includes('#ffffff')).length).toBe(2);
    expect(svgIcons.filter((icon) => icon.text.includes('#169b62')).length).toBe(2);

    const popup = await context.newPage();
    await popup.addInitScript(
      ({ url, title }) => {
        const api = (
          globalThis as unknown as {
            chrome?: {
              tabs?: {
                query(
                  info: { active?: boolean },
                  callback: (tabs: unknown[]) => void,
                ): void;
              };
            };
          }
        ).chrome;
        if (!api?.tabs) return;
        api.tabs.query = (info, callback) => {
          if (info?.active) {
            callback([{ id: 999, url, title }]);
            return;
          }
          callback([]);
        };
      },
      { url: `${base}/link2`, title: '快速添加 SVG' },
    );
    await popup.goto(`chrome-extension://${EXTENSION_ID}/popup.html`);
    await expect(popup.locator('.quick-form')).toBeVisible();
    await popup.getByRole('button', { name: '添加到 SunTab' }).click();
    await expect(popup.locator('.saved')).toContainText('已添加');

    await expect.poll(async () => (await readNav(page)).length).toBe(18);
    const navAfterPopup = await readNav(page);
    expect(
      navAfterPopup.find((item) => item.name === '快速添加 SVG')?.kind,
    ).toBe('upload');

    const source = await context.newPage();
    await source.goto(`${base}/brand-raster-hint`);
    const hintedPopup = await context.newPage();
    await hintedPopup.addInitScript(
      ({ url, title }) => {
        const api = (
          globalThis as unknown as {
            chrome?: {
              tabs?: {
                query(
                  info: { active?: boolean },
                  callback: (tabs: Array<Record<string, unknown>>) => void,
                ): void;
              };
            };
          }
        ).chrome;
        if (!api?.tabs) return;
        const original = api.tabs.query.bind(api.tabs);
        api.tabs.query = (info, callback) => {
          if (!info?.active) {
            original(info, callback);
            return;
          }
          original({}, (tabs) => {
            const target = tabs.find((tab) => tab.url === url);
            callback([target ? { ...target, title } : { id: 999, url, title }]);
          });
        };
      },
      { url: `${base}/brand-raster-hint`, title: '快速添加品牌位图' },
    );
    await hintedPopup.goto(`chrome-extension://${EXTENSION_ID}/popup.html`);
    await expect(hintedPopup.locator('.quick-form')).toBeVisible();
    await hintedPopup.getByRole('button', { name: '添加到 SunTab' }).click();
    await expect(hintedPopup.locator('.saved')).toContainText('已添加');
    await expect(hintedPopup.locator('.saved-fallback')).toHaveCount(0);

    await expect.poll(async () => (await readNav(page)).length).toBe(19);
    const navAfterHints = await readNav(page);
    const hintedItem = navAfterHints.find(
      (item) => item.name === '快速添加品牌位图',
    );
    expect(hintedItem?.kind).toBe('upload');
    const hintedPixels = await readIconPixels(page, hintedItem?.value ?? '');
    expect(hintedPixels.red).toBeGreaterThan(100);
    expect(hintedPixels.blue).toBe(0);
  } finally {
    await context?.close();
    try {
      fs.rmSync(profile, { recursive: true, force: true });
      fs.rmSync(path.dirname(extensionPath), { recursive: true, force: true });
    } catch {
      // ignore temp cleanup races on Windows
    }
  }
});
