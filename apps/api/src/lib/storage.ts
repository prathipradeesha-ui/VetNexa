import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { createReadStream } from 'node:fs';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { env } from '../config/env';

/**
 * Where uploaded photos are kept. Two drivers share one small interface:
 *
 * - **local** – files in UPLOAD_DIR (development and single-server setups);
 * - **s3** – an S3-compatible object store such as MinIO (Docker setup), as proposed in the
 *   project. The bucket stays private: photos are streamed to the browser by the API.
 *
 * Keys look like "pets/9f2c…e1.webp" (folder + random file name), whatever the driver.
 */
export interface StoredObject {
  body: Readable;
  contentType: string;
  contentLength?: number;
  lastModified?: Date;
}

export interface ObjectStore {
  readonly driver: 'local' | 's3';
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  /** Null when the object does not exist. */
  get(key: string): Promise<StoredObject | null>;
  /** Deleting a missing object is not an error. */
  delete(key: string): Promise<void>;
  /** Prepares the store (creates the folder or bucket) and checks it is reachable. */
  ready(): Promise<void>;
}

/** Keys are always "<folder>/<file>" with safe characters, so they can never escape the store. */
export const SAFE_KEY = /^[a-z]+\/[a-z0-9-]+\.[a-z0-9]+$/;

export function assertSafeKey(key: string) {
  if (!SAFE_KEY.test(key)) throw new Error(`Unsafe storage key: ${key}`);
}

// ─────────────────────────────── Local folder ───────────────────────────────

export function localStore(root: string): ObjectStore {
  const fullPath = (key: string) => {
    assertSafeKey(key);
    return path.join(path.resolve(root), key);
  };
  return {
    driver: 'local',
    async put(key, body) {
      const file = fullPath(key);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, body);
    },
    async get(key) {
      const file = fullPath(key);
      try {
        const info = await stat(file);
        if (!info.isFile()) return null;
        return {
          body: createReadStream(file),
          contentType: key.endsWith('.webp') ? 'image/webp' : 'application/octet-stream',
          contentLength: info.size,
          lastModified: info.mtime,
        };
      } catch {
        return null;
      }
    },
    async delete(key) {
      await unlink(fullPath(key)).catch(() => undefined);
    },
    async ready() {
      await mkdir(path.resolve(root), { recursive: true });
    },
  };
}

// ─────────────────────────────── S3 / MinIO ───────────────────────────────

export interface S3Settings {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}

/** S3-compatible store. `client` can be passed in by tests. */
export function s3Store(settings: S3Settings, client?: Pick<S3Client, 'send'>): ObjectStore {
  const s3 =
    client ??
    new S3Client({
      endpoint: settings.endpoint,
      region: settings.region,
      forcePathStyle: settings.forcePathStyle, // MinIO serves buckets as paths, not subdomains
      credentials: {
        accessKeyId: settings.accessKeyId,
        secretAccessKey: settings.secretAccessKey,
      },
    });
  const Bucket = settings.bucket;

  return {
    driver: 's3',
    async put(key, body, contentType) {
      assertSafeKey(key);
      await s3.send(
        new PutObjectCommand({ Bucket, Key: key, Body: body, ContentType: contentType }),
      );
    },
    async get(key) {
      assertSafeKey(key);
      try {
        const result = await s3.send(new GetObjectCommand({ Bucket, Key: key }));
        if (!result.Body) return null;
        return {
          body: result.Body as Readable,
          contentType: result.ContentType ?? 'application/octet-stream',
          contentLength: result.ContentLength,
          lastModified: result.LastModified,
        };
      } catch (error) {
        const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata
          ?.httpStatusCode;
        if (error instanceof NoSuchKey || status === 404) return null;
        throw error;
      }
    },
    async delete(key) {
      assertSafeKey(key);
      await s3.send(new DeleteObjectCommand({ Bucket, Key: key }));
    },
    async ready() {
      try {
        await s3.send(new HeadBucketCommand({ Bucket }));
      } catch (error) {
        const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata
          ?.httpStatusCode;
        if (status !== 404) throw error;
        await s3.send(new CreateBucketCommand({ Bucket }));
      }
    },
  };
}

// ─────────────────────────────── Current store ───────────────────────────────

let current: ObjectStore | undefined;

export function storeFromEnv(): ObjectStore {
  if (env.STORAGE_DRIVER === 's3') {
    return s3Store({
      endpoint: env.S3_ENDPOINT!,
      region: env.S3_REGION,
      bucket: env.S3_BUCKET,
      accessKeyId: env.S3_ACCESS_KEY_ID!,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
    });
  }
  return localStore(env.UPLOAD_DIR);
}

/** The store used by uploads, chosen from STORAGE_DRIVER on first use. */
export function objectStore(): ObjectStore {
  current ??= storeFromEnv();
  return current;
}

/** Replaces the store (tests). */
export function useObjectStore(store: ObjectStore | undefined) {
  current = store;
}
