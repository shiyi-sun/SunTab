// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
  documentFromHints,
  extractBrandRasterCandidates,
  extractManifestUrl,
  extractRasterIconCandidates,
  extractSvgIconCandidates,
  extractThemeColor,
  hasSiteAccess,
  parseManifestRasterIcons,
  parseManifestSvgIcons,
  requestSiteAccess,
} from '../shared/siteIcon';

describe('site svg icon discovery', () => {
  it('finds svg link icons and resolves relative urls', () => {
    const html = `
      <link rel="icon" type="image/svg+xml" href="/assets/logo.svg">
      <link rel="shortcut icon" href="/favicon.svg?v=2">
      <link rel="icon" href="/favicon.ico">
    `;
    expect(extractSvgIconCandidates(html, 'https://example.com/page')).toEqual([
      'https://example.com/assets/logo.svg',
      'https://example.com/favicon.svg?v=2',
    ]);
  });

  it('respects the base element and mask-icon links', () => {
    const html =
      '<base href="https://cdn.example.com/ui/"><link rel="mask-icon" href="pinned.svg">';
    expect(extractSvgIconCandidates(html, 'https://example.com/')).toEqual([
      'https://cdn.example.com/ui/pinned.svg',
    ]);
  });

  it('ignores data urls and non-svg icons', () => {
    const html =
      '<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,PHN2Zy8+">' +
      '<link rel="apple-touch-icon" href="/touch.png">';
    expect(extractSvgIconCandidates(html, 'https://example.com/')).toEqual([]);
  });

  it('prefers light icons over dark media variants and puts mask icons last', () => {
    const html = `
      <link rel="mask-icon" href="/mask.svg">
      <link rel="icon" type="image/svg+xml" href="/dark.svg" media="(prefers-color-scheme: dark)">
      <link rel="icon" type="image/svg+xml" href="/light.svg">
    `;
    expect(extractSvgIconCandidates(html, 'https://example.com/')).toEqual([
      'https://example.com/light.svg',
      'https://example.com/dark.svg',
      'https://example.com/mask.svg',
    ]);
  });

  it('picks a dark theme color for white artwork', () => {
    expect(
      extractThemeColor(
        '<meta name="theme-color" content="#ffffff"><meta name="theme-color" content="#123456">',
      ),
    ).toBe('#123456');
    expect(
      extractThemeColor('<meta name="theme-color" content="rgb(250, 250, 250)">'),
    ).toBeNull();
  });

  it('reads the manifest url and svg icons from the manifest', () => {
    const html = '<link rel="manifest" href="/site.webmanifest">';
    expect(extractManifestUrl(html, 'https://example.com/a')).toBe(
      'https://example.com/site.webmanifest',
    );

    const manifest = JSON.stringify({
      icons: [
        { src: '/icons/app.svg', type: 'image/svg+xml' },
        { src: 'icons/large.svg' },
        { src: '/icons/app-192.png', type: 'image/png' },
        { src: 'https://cdn.example.com/x.svg?x=1' },
      ],
    });
    expect(
      parseManifestSvgIcons(manifest, 'https://example.com/site.webmanifest'),
    ).toEqual([
      'https://example.com/icons/app.svg',
      'https://example.com/icons/large.svg',
      'https://cdn.example.com/x.svg?x=1',
    ]);
  });

  it('finds declared high-resolution raster icons and ignores ico and svg', () => {
    const html = `
      <link rel="apple-touch-icon" href="/touch.png">
      <link rel="icon" type="image/png" sizes="32x32" href="/icon-32.png">
      <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png">
      <link rel="icon" href="/favicon.ico">
      <link rel="icon" type="image/svg+xml" href="/icon.svg">
      <link rel="mask-icon" href="/mask.png">
    `;
    expect(extractRasterIconCandidates(html, 'https://example.com/')).toEqual([
      'https://example.com/icon-192.png',
      'https://example.com/touch.png',
      'https://example.com/icon-32.png',
    ]);
  });

  it('reads raster icons from the manifest and drops tiny declared sizes', () => {
    const manifest = JSON.stringify({
      icons: [
        { src: '/m192.png', type: 'image/png', sizes: '192x192' },
        { src: '/m48.png', type: 'image/png', sizes: '48x48' },
        { src: '/m.webp', type: 'image/webp', sizes: '512x512' },
        { src: '/m.svg', type: 'image/svg+xml', sizes: 'any' },
        { src: '/m.ico', type: 'image/x-icon' },
        { src: '/m-no-size.png', type: 'image/png' },
      ],
    });
    expect(
      parseManifestRasterIcons(manifest, 'https://example.com/site.webmanifest'),
    ).toEqual([
      'https://example.com/m.webp',
      'https://example.com/m192.png',
      'https://example.com/m-no-size.png',
    ]);
  });

  it('only takes brand rasters from logo context, not page content', () => {
    const html = `
      <header><a class="logo"><img src="/brand-lockup.png" alt="品牌"></a></header>
      <header><a class="home"><img src="/banner.jpg" alt="品牌"></a></header>
      <main><img src="/content-logo.png" alt="logo"></main>
    `;
    expect(
      extractBrandRasterCandidates(html, 'https://example.com/'),
    ).toEqual(['https://example.com/brand-lockup.png']);
  });

  it('rebuilds a page document from active-tab hints', () => {
    const doc = documentFromHints(
      {
        themeColor: '#102030',
        links: [
          {
            rel: 'icon',
            type: 'image/png',
            sizes: '192x192',
            href: 'https://example.com/icon.png',
            media: '',
          },
        ],
        brandImages: [
          {
            src: 'https://example.com/logo.png',
            className: 'left',
            id: '',
            alt: '品牌',
            contextClass: 'logo',
            contextId: '',
          },
        ],
      },
      'https://example.com/page',
    );
    expect(doc.querySelector('base')?.getAttribute('href')).toBe(
      'https://example.com/page',
    );
    expect(
      doc.querySelector('meta[name="theme-color"]')?.getAttribute('content'),
    ).toBe('#102030');
    expect(doc.querySelector('link[rel="icon"]')?.getAttribute('href')).toBe(
      'https://example.com/icon.png',
    );
    expect(doc.querySelector('header a.logo img')?.getAttribute('src')).toBe(
      'https://example.com/logo.png',
    );
  });

  it('reports whether all-site access is already granted', async () => {
    const contains = vi.fn(
      (
        _details: { origins: string[] },
        callback: (granted: boolean) => void,
      ) => callback(true),
    );
    vi.stubGlobal('chrome', { permissions: { contains } });
    await expect(hasSiteAccess()).resolves.toBe(true);
    expect(contains.mock.calls[0]?.[0].origins).toEqual([
      'https://*/*',
      'http://*/*',
    ]);
    vi.unstubAllGlobals();
  });

  it('requests all-site access once so later icons do not prompt again', async () => {
    const request = vi.fn(
      (
        _details: { origins: string[] },
        callback: (granted: boolean) => void,
      ) => callback(true),
    );
    vi.stubGlobal('chrome', { permissions: { request } });
    await expect(requestSiteAccess()).resolves.toBe(true);
    expect(request.mock.calls[0]?.[0].origins).toEqual([
      'https://*/*',
      'http://*/*',
    ]);
    vi.unstubAllGlobals();
  });
});
