/**
 * Re-draw a photo at most `maxSide` px wide/tall as a JPEG. This keeps
 * uploads small and drops hidden metadata (GPS location, camera details),
 * which matters for photos taken on phones. Throws if the browser can't
 * read the image (then it isn't a supported photo).
 */
export async function shrinkImage(file: File, maxSide = 2000, quality = 0.85): Promise<File> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no canvas');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', quality));
  const base = file.name.replace(/\.[^.]+$/, '') || 'photo';
  return new File([blob], `${base}.jpg`, { type: 'image/jpeg' });
}
