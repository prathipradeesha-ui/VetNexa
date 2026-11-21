import { randomBytes } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import type { RequestHandler } from 'express';
import sharp from 'sharp';
import { HttpError } from './http-error';
import { logger } from './logger';
import { assertSafeKey, objectStore, SAFE_KEY } from './storage';

/** Public URL prefix for uploaded files, e.g. /uploads/pets/ab12….webp */
export const UPLOADS_URL_PREFIX = '/uploads';

interface SaveImageOptions {
  folder: 'pets' | 'wounds' | 'adoption' | 'rescue' | 'clinics';
  /** Longest side in pixels after resizing. */
  size?: number;
}

/**
 * Validates, resizes and stores an uploaded image in the configured object store.
 *
 * - The file is decoded with sharp, so anything that is not a real image is rejected even if
 *   its name or MIME type claims otherwise.
 * - It is re-encoded as WebP, which removes embedded metadata such as GPS location (EXIF)
 *   that phone photos often contain, and reduces the file size.
 * - The stored name is random, so file names cannot be guessed or collide.
 */
export async function saveImage(buffer: Buffer, { folder, size = 800 }: SaveImageOptions) {
  let output: Buffer;
  try {
    output = await sharp(buffer, { limitInputPixels: 40_000_000 })
      .rotate() // respect the camera orientation before metadata is removed
      .resize(size, size, { fit: 'cover', position: 'attention', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw HttpError.validation(
      [{ field: 'photo', message: 'This file is not a valid image' }],
      'This file is not a valid image',
    );
  }

  const key = `${folder}/${randomBytes(16).toString('hex')}.webp`;
  await objectStore().put(key, output, 'image/webp');
  return `${UPLOADS_URL_PREFIX}/${key}`;
}

/** The storage key of an /uploads URL, or null if the URL is not a valid upload. */
export function keyFromUrl(url: string | null | undefined) {
  if (!url?.startsWith(`${UPLOADS_URL_PREFIX}/`)) return null;
  const key = url.slice(UPLOADS_URL_PREFIX.length + 1);
  // Never touch anything outside the store, even if a stored URL was tampered with.
  return SAFE_KEY.test(key) ? key : null;
}

/** Removes a previously stored upload. Missing files are ignored. */
export async function deleteUpload(url: string | null | undefined) {
  const key = keyFromUrl(url);
  if (!key) return;
  await objectStore()
    .delete(key)
    .catch((error: unknown) => logger.warn({ err: error, key }, 'Could not delete upload'));
}

/**
 * GET /uploads/<folder>/<file> – streams a photo from the object store, whichever driver is in
 * use. Names are random and every file is a re-encoded image, so they are safe to serve; the
 * store itself (e.g. the MinIO bucket) is never exposed.
 */
export const serveUpload: RequestHandler = async (req, res, next) => {
  const key = `${req.params['folder']}/${req.params['file']}`;
  try {
    assertSafeKey(key);
  } catch {
    next(HttpError.notFound('File not found'));
    return;
  }
  try {
    const object = await objectStore().get(key);
    if (!object) {
      next(HttpError.notFound('File not found'));
      return;
    }
    res.setHeader('Content-Type', object.contentType);
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    if (object.contentLength !== undefined) res.setHeader('Content-Length', object.contentLength);
    if (object.lastModified) res.setHeader('Last-Modified', object.lastModified.toUTCString());
    await pipeline(object.body, res);
  } catch (error) {
    if (!res.headersSent) next(error);
    else res.destroy(error as Error);
  }
};
