// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
  extractManifestUrl,
  extractSvgIconCandidates,
  extractThemeColor,
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
