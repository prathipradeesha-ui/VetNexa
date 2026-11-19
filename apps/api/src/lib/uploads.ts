import { randomBytes } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { env } from '../config/env';
import { HttpError } from './http-error';

/** Public URL prefix for uploaded files, e.g. /uploads/pets/ab12….webp */
export const UPLOADS_URL_PREFIX = '/uploads';

export const uploadRoot = () => path.resolve(env.UPLOAD_DIR);

interface SaveImageOptions {
  folder: 'pets' | 'wounds' | 'adoption' | 'rescue' | 'clinics';
  /** Longest side in pixels after resizing. */
  size?: number;
}

/**
 * Validates, resizes and stores an uploaded image.
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

  const fileName = `${randomBytes(16).toString('hex')}.webp`;
  const directory = path.join(uploadRoot(), folder);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, fileName), output);
  return `${UPLOADS_URL_PREFIX}/${folder}/${fileName}`;
}

/** Removes a previously stored upload. Missing files are ignored. */
export async function deleteUpload(url: string | null | undefined) {
  if (!url?.startsWith(`${UPLOADS_URL_PREFIX}/`)) return;
  const relative = url.slice(UPLOADS_URL_PREFIX.length + 1);
  const fullPath = path.resolve(uploadRoot(), relative);
  // Never delete anything outside the uploads folder, even if the stored URL was tampered with.
  if (!fullPath.startsWith(uploadRoot() + path.sep)) return;
  await unlink(fullPath).catch(() => undefined);
}
