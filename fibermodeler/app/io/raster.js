/** SVG -> PNG / JPEG conversion through an offscreen canvas. */

export function svgToBlobUrl(svg) {
  return URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
}

export async function svgToRaster(svg, { type = 'image/png', scale = 2, background = null, quality = 0.92 } = {}) {
  const url = svgToBlobUrl(svg);
  try {
    const image = await loadImage(url);
    const width = Math.max(1, Math.round((image.naturalWidth || 800) * scale));
    const height = Math.max(1, Math.round((image.naturalHeight || 600) * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(image, 0, 0, width, height);
    return await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Canvas export failed'))), type, quality);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not rasterise the diagram'));
    image.src = url;
  });
}
