/** Browser file helpers: download, open, read. */

export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function downloadText(text, filename, mime = 'text/plain;charset=utf-8') {
  download(new Blob([text], { type: mime }), filename);
}

/** Opens the system file picker and resolves with the chosen File (or null). */
export function pickFile(accept = '') {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    document.body.appendChild(input);
    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(value);
    };
    input.addEventListener('change', () => done(input.files?.[0] || null));
    window.addEventListener('focus', () => setTimeout(() => done(input.files?.[0] || null), 400), { once: true });
    input.click();
  });
}

export function readText(file) {
  return file.text();
}

export function readBuffer(file) {
  return file.arrayBuffer();
}

const TRANSLIT = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

/**
 * Download file name.
 *
 * Browsers silently drop a `download` attribute they cannot encode (which
 * would produce a file called "download" with no extension), so names are
 * transliterated to ASCII - the extension always survives, on every platform.
 */
export function safeFileName(name, extension = '') {
  const source = String(name || 'diagram').normalize('NFC');
  let base = '';
  for (const char of source) {
    const lower = char.toLowerCase();
    if (TRANSLIT[lower] !== undefined) {
      const mapped = TRANSLIT[lower];
      base += char === lower ? mapped : mapped.charAt(0).toUpperCase() + mapped.slice(1);
    } else if (/[A-Za-z0-9 ._()\[\]-]/.test(char)) {
      base += char;
    } else {
      base += '-';
    }
  }
  base = base
    .replace(/-{2,}/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
    .replace(/[-. ]+$/, '');
  return `${base || 'diagram'}${extension}`;
}
