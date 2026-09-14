#!/usr/bin/env python3
"""
Builds dist/FiberModeler.html - the whole application in one file.

The app is written as plain ES modules, which browsers refuse to load over
file:// (module requests are subject to CORS).  This script inlines every
module, stylesheet and asset into a single HTML document that can simply be
double-clicked, e-mailed or put on a USB stick.

    python3 tools/build_single_file.py
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENTRY = os.path.join(ROOT, 'app', 'main.js')
OUT = os.path.join(ROOT, 'dist', 'FiberModeler.html')

IMPORT_NAMED = re.compile(r"^import\s+\{([^}]*)\}\s+from\s+'([^']+)';\s*$", re.M)
IMPORT_STAR = re.compile(r"^import\s+\*\s+as\s+(\w+)\s+from\s+'([^']+)';\s*$", re.M)
IMPORT_BARE = re.compile(r"^import\s+'([^']+)';\s*$", re.M)
EXPORT_FROM = re.compile(r"^export\s+\{([^}]*)\}\s+from\s+'([^']+)';\s*$", re.M)
EXPORT_STAR = re.compile(r"^export\s+\*\s+from\s+'([^']+)';\s*$", re.M)
EXPORT_LIST = re.compile(r"^export\s+\{([^}]*)\};\s*$", re.M)
EXPORT_DECL = re.compile(r"^export\s+(async\s+function|function|class|const|let|var)\s+(\w+)", re.M)
DYNAMIC = re.compile(r"await\s+import\('([^']+)'\)")


def module_key(path):
    return os.path.relpath(path, ROOT).replace(os.sep, '/')


def resolve(base, spec):
    return os.path.normpath(os.path.join(os.path.dirname(base), spec))


def collect(entry):
    """Returns modules in dependency order (dependencies first)."""
    order = []
    seen = set()

    def visit(path):
        if path in seen:
            return
        seen.add(path)
        source = open(path, encoding='utf-8').read()
        for match in re.finditer(r"from\s+'([^']+)'", source):
            spec = match.group(1)
            if spec.startswith('.'):
                visit(resolve(path, spec))
        for match in DYNAMIC.finditer(source):
            visit(resolve(path, match.group(1)))
        order.append(path)

    visit(entry)
    return order


def named_bindings(text):
    pairs = []
    for part in text.split(','):
        part = part.strip()
        if not part:
            continue
        if ' as ' in part:
            source, alias = [x.strip() for x in part.split(' as ')]
            pairs.append((source, alias))
        else:
            pairs.append((part, part))
    return pairs


def transform(path):
    source = open(path, encoding='utf-8').read()
    exported = []

    def named(match):
        pairs = named_bindings(match.group(1))
        target = module_key(resolve(path, match.group(2)))
        inner = ', '.join(a if a == b else f'{a}: {b}' for a, b in pairs)
        return f"const {{ {inner} }} = __fm_require('{target}');"

    source = IMPORT_NAMED.sub(named, source)
    source = IMPORT_STAR.sub(lambda m: f"const {m.group(1)} = __fm_require('{module_key(resolve(path, m.group(2)))}');", source)
    source = IMPORT_BARE.sub(lambda m: f"__fm_require('{module_key(resolve(path, m.group(1)))}');", source)

    def export_from(match):
        pairs = named_bindings(match.group(1))
        target = module_key(resolve(path, match.group(2)))
        lines = [f"{{ const __m = __fm_require('{target}');"]
        for source_name, alias in pairs:
            lines.append(f"__exports['{alias}'] = __m['{source_name}'];")
        lines.append('}')
        return ' '.join(lines)

    source = EXPORT_FROM.sub(export_from, source)
    source = EXPORT_STAR.sub(lambda m: f"Object.assign(__exports, __fm_require('{module_key(resolve(path, m.group(1)))}'));", source)

    def export_list(match):
        for name, alias in named_bindings(match.group(1)):
            exported.append((alias, name))
        return ''

    source = EXPORT_LIST.sub(export_list, source)

    def export_decl(match):
        exported.append((match.group(2), match.group(2)))
        return f"{match.group(1)} {match.group(2)}"

    source = EXPORT_DECL.sub(export_decl, source)
    source = DYNAMIC.sub(lambda m: f"await __fm_import('{module_key(resolve(path, m.group(1)))}')", source)

    if exported:
        assignments = ', '.join(f"{alias}: {name}" if alias != name else name for alias, name in exported)
        source += f"\nObject.assign(__exports, {{ {assignments} }});\n"
    return source


def build():
    modules = collect(ENTRY)
    parts = []
    for path in modules:
        parts.append(f"__fm_define('{module_key(path)}', function (__exports) {{\n{transform(path)}\n}});")

    runtime = """
const __fm_factories = Object.create(null);
const __fm_cache = Object.create(null);
function __fm_define(name, factory) { __fm_factories[name] = factory; }
function __fm_require(name) {
  if (__fm_cache[name]) return __fm_cache[name];
  const factory = __fm_factories[name];
  if (!factory) throw new Error('FiberModeler: module not bundled: ' + name);
  const exports = {};
  __fm_cache[name] = exports;
  factory(exports);
  return exports;
}
function __fm_import(name) { return Promise.resolve(__fm_require(name)); }
"""

    css = []
    for name in ('tokens.css', 'shell.css', 'canvas.css'):
        css.append(open(os.path.join(ROOT, 'app', 'styles', name), encoding='utf-8').read())

    html = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
    html = re.sub(r'\s*<link rel="stylesheet"[^>]*>', '', html)
    html = html.replace(
        '<script type="module" src="app/main.js"></script>',
        '<script type="module">\n' + runtime + '\n' + '\n'.join(parts) + f"\n__fm_require('{module_key(ENTRY)}');\n</script>",
    )
    html = html.replace('</head>', '<style>\n' + '\n'.join(css) + '\n</style>\n</head>')

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as handle:
        handle.write(html)
    print(f"{os.path.relpath(OUT, ROOT)}: {len(modules)} modules, {os.path.getsize(OUT) / 1024:.0f} KB")


if __name__ == '__main__':
    sys.exit(build())
