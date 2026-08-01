/**
 * Downscale and re-encode an image before it leaves the phone.
 *
 * A modern camera photo is 4–8 MB. On a 2G edge connection that upload never
 * finishes, so every image the app sends is capped at ~1024 px and JPEG-encoded
 * first — typically 80–150 KB.
 */
export async function fileToCompressedBase64(
  file: File,
  maxEdge = 1024,
  quality = 0.82,
): Promise<{ dataUrl: string; base64: string; bytes: number }> {
  const bitmap = await loadBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas-unavailable');
  ctx.drawImage(bitmap, 0, 0, w, h);
  if ('close' in bitmap) (bitmap as ImageBitmap).close();

  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return { dataUrl, base64, bytes: Math.round((base64.length * 3) / 4) };
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      /* Safari on older iOS — fall through to the <img> path */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('image-decode-failed'));
      img.src = url;
    });
    return img;
  } finally {
    // The canvas has already sampled the pixels by the time this runs.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
