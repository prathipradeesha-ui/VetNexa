/**
 * Copies photos from the local upload folder into the configured object store (MinIO / S3).
 *
 *   npm run storage:migrate -w @vetnexa/api            (development, with tsx)
 *   docker compose exec api node dist/migrate-uploads.js   (Docker)
 *   … add --dry-run to only list what would be copied.
 *
 * Photo URLs (/uploads/<folder>/<file>) do not change, so nothing in the database needs to be
 * updated. Files already in the bucket are skipped, so the script can safely run again.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env';
import { objectStore, SAFE_KEY } from '../lib/storage';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const store = objectStore();
  if (store.driver !== 's3') {
    console.error('Set STORAGE_DRIVER=s3 (and the S3_* settings) to migrate photos to MinIO.');
    process.exit(1);
  }
  await store.ready();

  const root = path.resolve(env.UPLOAD_DIR);
  const folders = await readdir(root, { withFileTypes: true }).catch(() => []);
  let copied = 0;
  let skipped = 0;
  for (const folder of folders.filter((entry) => entry.isDirectory())) {
    for (const file of await readdir(path.join(root, folder.name))) {
      const key = `${folder.name}/${file}`;
      if (!SAFE_KEY.test(key)) continue;
      if (await store.get(key)) {
        skipped += 1;
        continue;
      }
      if (!dryRun) {
        const body = await readFile(path.join(root, key));
        await store.put(
          key,
          body,
          key.endsWith('.webp') ? 'image/webp' : 'application/octet-stream',
        );
      }
      copied += 1;
      console.log(`${dryRun ? 'would copy' : 'copied'} ${key}`);
    }
  }
  console.log(
    `${dryRun ? 'Would copy' : 'Copied'} ${copied} photo(s); ${skipped} already in the bucket.`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
