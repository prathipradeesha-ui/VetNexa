import type { RequestHandler } from 'express';
import multer from 'multer';
import { HttpError } from '../lib/http-error';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

const imageUpload = multer({
  storage: multer.memoryStorage(), // kept in memory, then processed by saveImage()
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) callback(null, true);
    else callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'type'));
  },
});

/**
 * Accepts a single image in the given form field (multipart/form-data) and turns multer's
 * errors into friendly API errors.
 */
export function singleImage(field: string): RequestHandler {
  const handler = imageUpload.single(field);
  return (req, res, next) => {
    handler(req, res, (error: unknown) => {
      if (!error) {
        if (!req.file) {
          next(HttpError.validation([{ field, message: 'Please choose a photo to upload' }]));
          return;
        }
        next();
        return;
      }
      if (error instanceof multer.MulterError) {
        const message =
          error.code === 'LIMIT_FILE_SIZE'
            ? 'Photos must be 5 MB or smaller'
            : 'Please upload a JPG, PNG or WebP image';
        next(HttpError.validation([{ field, message }], message));
        return;
      }
      next(error);
    });
  };
}
