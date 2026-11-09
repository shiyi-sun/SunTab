import { describe, expect, it } from 'vitest';
import { stripInlineHandlers } from '../shared/markup';

describe('stripInlineHandlers', () => {
  it('removes quoted, unquoted and mixed-case handler attributes', () => {
    const html =
      '<div onclick="run()" ONLOAD=\'boot()\' onmouseenter=hover() title="x">x</div>';
    expect(stripInlineHandlers(html)).toBe('<div title="x">x</div>');
  });

  it('removes handlers from svg roots and children', () => {
    const svg =
      '<svg onload="init()" viewBox="0 0 10 10"><circle onerror="fail()" r="4"/></svg>';
    expect(stripInlineHandlers(svg)).toBe(
      '<svg viewBox="0 0 10 10"><circle r="4"/></svg>',
    );
  });

  it('keeps ordinary and data attributes', () => {
    const html =
      '<img src="/a.png" data-onclick="x" data-once="1" alt="onload=text">';
    expect(stripInlineHandlers(html)).toBe(html);
  });

  it('leaves text content untouched', () => {
    const html = '<p>onclick="run()" and onload=init()</p>';
    expect(stripInlineHandlers(html)).toBe(html);
  });

  it('skips comments and CDATA', () => {
    const markup =
      '<!-- <div onclick="x"> --><svg><![CDATA[<g onload="y">]]><g/></svg>';
    expect(stripInlineHandlers(markup)).toBe(markup);
  });

  it('handles a greater-than sign inside a quoted value', () => {
    const html = '<div title="a > b" onclick="run()">x</div>';
    expect(stripInlineHandlers(html)).toBe('<div title="a > b">x</div>');
  });

  it('removes handlers separated by a slash', () => {
    const html =
      '<body/onload="boot()"><img/onerror=fallback() /><svg/onload="init()"></svg>';
    expect(stripInlineHandlers(html)).toBe('<body><img /><svg></svg>');
  });

  it('keeps handler-like text inside attribute values', () => {
    const html =
      '<a href="/onclick=keep" title="onload=keep" data-x="/onerror=keep">x</a>';
    expect(stripInlineHandlers(html)).toBe(html);
  });

  it('removes boolean handlers without a value', () => {
    const html = '<div onload hidden>x</div>';
    expect(stripInlineHandlers(html)).toBe('<div hidden>x</div>');
  });

  it('keeps self-closing slashes and original spacing', () => {
    const html = '<img  src="a.png"  onerror="x"  alt="a"  />';
    expect(stripInlineHandlers(html)).toBe('<img  src="a.png"  alt="a"  />');
  });
});
