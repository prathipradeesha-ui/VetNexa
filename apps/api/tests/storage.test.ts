import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { text } from 'node:stream/consumers';
import sharp from 'sharp';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import {
  localStore,
  s3Store,
  useObjectStore,
  type ObjectStore,
  type S3Settings,
} from '../src/lib/storage';
import { deleteUpload, keyFromUrl, saveImage } from '../src/lib/uploads';
import { testApp } from './helpers';

const settings: S3Settings = {
  endpoint: 'http://minio:9000',
  region: 'us-east-1',
  bucket: 'vetnexa-uploads',
  accessKeyId: 'key',
  secretAccessKey: 'secret',
  forcePathStyle: true,
};

/** An in-memory stand-in for MinIO that understands the five commands the store uses. */
function fakeS3() {
  const objects = new Map<string, { body: Buffer; type: string }>();
  const buckets = new Set<string>();
  const notFound = () =>
    Object.assign(new Error('Not found'), { $metadata: { httpStatusCode: 404 } });
  const send = async (command: unknown) => {
    const input = (command as { input: Record<string, unknown> }).input;
    const key = `${input['Bucket']}/${input['Key']}`;
    if (command instanceof HeadBucketCommand) {
      if (!buckets.has(input['Bucket'] as string)) throw notFound();
      return {};
    }
    if (command instanceof CreateBucketCommand) return buckets.add(input['Bucket'] as string);
    if (command instanceof PutObjectCommand) {
      objects.set(key, { body: input['Body'] as Buffer, type: input['ContentType'] as string });
      return {};
    }
    if (command instanceof GetObjectCommand) {
      const object = objects.get(key);
      if (!object) throw notFound();
      return {
        Body: Readable.from(object.body),
        ContentType: object.type,
        ContentLength: object.body.length,
      };
    }
    if (command instanceof DeleteObjectCommand) return objects.delete(key);
    throw new Error('Unexpected command');
  };
  return { send: send as never, objects, buckets };
}

const image = () =>
  sharp({ create: { width: 300, height: 200, channels: 3, background: '#0a6c6c' } })
    .png()
    .toBuffer();

afterEach(() => useObjectStore(undefined));

describe('S3 / MinIO store', () => {
  it('creates the bucket once and stores, reads and deletes photos', async () => {
    const s3 = fakeS3();
    const store = s3Store(settings, s3);
    await store.ready();
    await store.ready();
    expect([...s3.buckets]).toEqual(['vetnexa-uploads']);

    await store.put('pets/abc.webp', Buffer.from('photo'), 'image/webp');
    const object = await store.get('pets/abc.webp');
    expect(object?.contentType).toBe('image/webp');
    expect(await text(object!.body)).toBe('photo');

    await store.delete('pets/abc.webp');
    expect(await store.get('pets/abc.webp')).toBeNull();
  });

  it('refuses unsafe keys', async () => {
    const store = s3Store(settings, fakeS3());
    await expect(store.put('../etc/passwd', Buffer.alloc(1), 'text/plain')).rejects.toThrow(
      /Unsafe storage key/,
    );
  });
});

describe('uploads through the configured store', () => {
  it('saves re-encoded photos in MinIO and serves them through the API', async () => {
    const s3 = fakeS3();
    const store: ObjectStore = s3Store(settings, s3);
    useObjectStore(store);

    const url = await saveImage(await image(), { folder: 'pets' });
    expect(url).toMatch(/^\/uploads\/pets\/[a-f0-9]{32}\.webp$/);
    expect(s3.objects.get(`vetnexa-uploads/${keyFromUrl(url)}`)?.type).toBe('image/webp');

    const res = await request(testApp()).get(url).expect(200);
    expect(res.headers['content-type']).toBe('image/webp');
    expect(res.headers['cache-control']).toContain('immutable');
    expect((await sharp(res.body).metadata()).format).toBe('webp');

    await deleteUpload(url);
    await request(testApp()).get(url).expect(404);
  });

  it('works the same with the local folder', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'vetnexa-store-'));
    useObjectStore(localStore(root));
    const url = await saveImage(await image(), { folder: 'rescue' });
    await request(testApp()).get(url).expect(200);
    await deleteUpload(url);
    await request(testApp()).get(url).expect(404);
  });

  it('never serves or deletes paths outside the store', async () => {
    expect(keyFromUrl('/uploads/../../secret.txt')).toBeNull();
    expect(keyFromUrl('/uploads/pets/../../x.webp')).toBeNull();
    expect(keyFromUrl('/elsewhere/pets/a.webp')).toBeNull();
    await request(testApp()).get('/uploads/pets/..%2F..%2Fsecret.webp').expect(404);
  });
});
