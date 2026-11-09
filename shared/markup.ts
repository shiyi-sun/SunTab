const WHITESPACE = /[ \t\n\r\f]/;

function isWhitespace(character: string | undefined): boolean {
  return character !== undefined && WHITESPACE.test(character);
}

function stripTagHandlers(tag: string): string {
  let result = '<';
  let index = 1;
  if (tag[index] === '/') {
    result = '</';
    index += 1;
  }
  const nameStart = index;
  while (
    index < tag.length &&
    !isWhitespace(tag[index]) &&
    tag[index] !== '/' &&
    tag[index] !== '>'
  ) {
    index += 1;
  }
  result += tag.slice(nameStart, index);

  while (index < tag.length) {
    const spaceStart = index;
    while (
      index < tag.length &&
      (isWhitespace(tag[index]) || tag[index] === '/')
    ) {
      index += 1;
    }
    const space = tag.slice(spaceStart, index);
    if (index >= tag.length) {
      result += space;
      break;
    }
    if (tag[index] === '>') {
      result += space + tag.slice(index);
      break;
    }

    const attributeStart = index;
    while (
      index < tag.length &&
      !isWhitespace(tag[index]) &&
      tag[index] !== '/' &&
      tag[index] !== '>' &&
      tag[index] !== '='
    ) {
      index += 1;
    }
    const attributeName = tag.slice(attributeStart, index);

    let cursor = index;
    while (cursor < tag.length && isWhitespace(tag[cursor])) cursor += 1;
    let attributeEnd = index;
    if (tag[cursor] === '=') {
      cursor += 1;
      while (cursor < tag.length && isWhitespace(tag[cursor])) cursor += 1;
      const quote = tag[cursor];
      if (quote === '"' || quote === "'") {
        cursor += 1;
        while (cursor < tag.length && tag[cursor] !== quote) cursor += 1;
        if (cursor < tag.length) cursor += 1;
      } else {
        while (
          cursor < tag.length &&
          !isWhitespace(tag[cursor]) &&
          tag[cursor] !== '>'
        ) {
          cursor += 1;
        }
      }
      attributeEnd = cursor;
    }

    if (!/^on[a-z]/i.test(attributeName)) {
      result += space + tag.slice(attributeStart, attributeEnd);
    }
    index = attributeEnd;
  }

  return result;
}

/**
 * Strips inline event handler attributes before markup reaches DOMParser.
 * Chrome enforces the extension CSP when such attributes are parsed, even in
 * an inert document, and removing them afterwards is too late.
 */
export function stripInlineHandlers(markup: string): string {
  let result = '';
  let index = 0;
  while (index < markup.length) {
    const start = markup.indexOf('<', index);
    if (start < 0) {
      result += markup.slice(index);
      break;
    }
    result += markup.slice(index, start);

    if (markup.startsWith('<!--', start)) {
      const end = markup.indexOf('-->', start + 4);
      if (end < 0) {
        result += markup.slice(start);
        break;
      }
      result += markup.slice(start, end + 3);
      index = end + 3;
      continue;
    }
    if (markup.startsWith('<![CDATA[', start)) {
      const end = markup.indexOf(']]>', start + 9);
      if (end < 0) {
        result += markup.slice(start);
        break;
      }
      result += markup.slice(start, end + 3);
      index = end + 3;
      continue;
    }

    let cursor = start + 1;
    let quote = '';
    for (; cursor < markup.length; cursor += 1) {
      const character = markup[cursor]!;
      if (quote) {
        if (character === quote) quote = '';
      } else if (character === '"' || character === "'") {
        quote = character;
      } else if (character === '>') {
        break;
      }
    }
    if (cursor >= markup.length) {
      result += markup.slice(start);
      break;
    }
    result += stripTagHandlers(markup.slice(start, cursor + 1));
    index = cursor + 1;
  }
  return result;
}
