// Where the banner is kept. Same shape for both: getBanner() / putBanner(banner).
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

// Local file -- the site serves this same file at /content/banner.json.
export function fileStore(path) {
  return {
    async getBanner() {
      try { return JSON.parse(await readFile(path, 'utf8')); } catch { return { enabled: false }; }
    },
    async putBanner(banner) {
      await mkdir(dirname(path), { recursive: true });
      const tmp = `${path}.${process.pid}.tmp`;
      await writeFile(tmp, JSON.stringify(banner, null, 2) + '\n');
      await rename(tmp, path); // atomic, so a visitor never reads a half-written file
    },
  };
}

// S3 object -- the site bucket's content/banner.json, read by visitors through CloudFront.
// Uses the AWS SDK v3 that the Lambda Node.js runtime already includes, so it needs no
// install in Lambda. Not exercised by this repo's tests; verify on the AWS setup.
export function s3Store({ bucket, key = 'content/banner.json', region }) {
  let client;
  const s3 = async () => {
    if (!client) {
      const { S3Client } = await import('@aws-sdk/client-s3');
      client = new S3Client({ region });
    }
    return client;
  };
  return {
    async getBanner() {
      const { GetObjectCommand } = await import('@aws-sdk/client-s3');
      try {
        const res = await (await s3()).send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        return JSON.parse(await res.Body.transformToString());
      } catch (err) {
        if (err?.name === 'NoSuchKey') return { enabled: false };
        throw err;
      }
    },
    async putBanner(banner) {
      const { PutObjectCommand } = await import('@aws-sdk/client-s3');
      await (await s3()).send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: JSON.stringify(banner, null, 2),
        ContentType: 'application/json',
        CacheControl: 'no-cache', // CloudFront and browsers recheck it, so edits show quickly
      }));
    },
  };
}
