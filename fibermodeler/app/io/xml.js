/**
 * Tiny XML parser / writer.
 *
 * Deliberately dependency free and DOM free so that import works identically
 * in the browser and in the test runner.
 */

export function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function unescapeXml(value) {
  return String(value).replace(/&(#x?[0-9a-fA-F]+|\w+);/g, (match, code) => {
    if (code[0] === '#') {
      const num = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(num) ? String.fromCodePoint(num) : match;
    }
    return ENTITIES[code] !== undefined ? ENTITIES[code] : match;
  });
}

/**
 * @typedef {{tag: string, ns: string, attrs: Object, children: XmlNode[], text: string, parent: XmlNode|null}} XmlNode
 */

export function parseXml(source) {
  const text = String(source);
  const root = { tag: '#root', ns: '', attrs: {}, children: [], text: '', parent: null };
  let current = root;
  let i = 0;

  while (i < text.length) {
    const lt = text.indexOf('<', i);
    if (lt < 0) {
      current.text += unescapeXml(text.slice(i));
      break;
    }
    if (lt > i) current.text += unescapeXml(text.slice(i, lt));

    if (text.startsWith('<!--', lt)) {
      const end = text.indexOf('-->', lt);
      i = end < 0 ? text.length : end + 3;
      continue;
    }
    if (text.startsWith('<![CDATA[', lt)) {
      const end = text.indexOf(']]>', lt);
      current.text += text.slice(lt + 9, end < 0 ? text.length : end);
      i = end < 0 ? text.length : end + 3;
      continue;
    }
    if (text.startsWith('<?', lt) || text.startsWith('<!', lt)) {
      const end = text.indexOf('>', lt);
      i = end < 0 ? text.length : end + 1;
      continue;
    }

    const gt = findTagEnd(text, lt);
    if (gt < 0) break;
    const raw = text.slice(lt + 1, gt).trim();
    if (raw.startsWith('/')) {
      if (current.parent) current = current.parent;
      i = gt + 1;
      continue;
    }
    const selfClosing = raw.endsWith('/');
    const body = selfClosing ? raw.slice(0, -1).trim() : raw;
    const spaceIndex = body.search(/[\s]/);
    const name = spaceIndex < 0 ? body : body.slice(0, spaceIndex);
    const attrText = spaceIndex < 0 ? '' : body.slice(spaceIndex + 1);
    const [ns, local] = splitName(name);
    const node = { tag: local, ns, attrs: parseAttrs(attrText), children: [], text: '', parent: current };
    current.children.push(node);
    if (!selfClosing) current = node;
    i = gt + 1;
  }
  return root;
}

function findTagEnd(text, from) {
  let quote = null;
  for (let i = from + 1; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '>') return i;
  }
  return -1;
}

function splitName(name) {
  const index = name.indexOf(':');
  return index < 0 ? ['', name] : [name.slice(0, index), name.slice(index + 1)];
}

function parseAttrs(source) {
  const attrs = {};
  const re = /([\w:.\-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let match;
  while ((match = re.exec(source))) {
    const [, rawName, , dq, sq] = match;
    const [, local] = splitName(rawName);
    attrs[local] = unescapeXml(dq !== undefined ? dq : sq || '');
    attrs[rawName] = attrs[local];
  }
  return attrs;
}

/* --------------------------------------------------------------- queries */

export function findAll(node, tag) {
  const out = [];
  const walk = (current) => {
    for (const child of current.children) {
      if (child.tag === tag) out.push(child);
      walk(child);
    }
  };
  walk(node);
  return out;
}

export function findFirst(node, tag) {
  return findAll(node, tag)[0] || null;
}

export function children(node, tag) {
  return tag ? node.children.filter((c) => c.tag === tag) : node.children;
}

export function textOf(node) {
  if (!node) return '';
  let text = node.text || '';
  for (const child of node.children) text += textOf(child);
  return text.trim();
}

/* --------------------------------------------------------------- writing */

export class XmlWriter {
  constructor({ indent = '  ', declaration = true } = {}) {
    this.parts = declaration ? ['<?xml version="1.0" encoding="UTF-8"?>\n'] : [];
    this.stack = [];
    this.indentUnit = indent;
  }

  get indent() {
    return this.indentUnit.repeat(this.stack.length);
  }

  open(tag, attrs = {}) {
    this.parts.push(`${this.indent}<${tag}${attrString(attrs)}>\n`);
    this.stack.push(tag);
    return this;
  }

  leaf(tag, attrs = {}, text) {
    if (text === undefined || text === null || text === '') {
      this.parts.push(`${this.indent}<${tag}${attrString(attrs)}/>\n`);
    } else {
      this.parts.push(`${this.indent}<${tag}${attrString(attrs)}>${escapeXml(text)}</${tag}>\n`);
    }
    return this;
  }

  close() {
    const tag = this.stack.pop();
    this.parts.push(`${this.indentUnit.repeat(this.stack.length)}</${tag}>\n`);
    return this;
  }

  toString() {
    while (this.stack.length) this.close();
    return this.parts.join('');
  }
}

function attrString(attrs) {
  return Object.entries(attrs)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => ` ${k}="${escapeXml(v)}"`)
    .join('');
}
