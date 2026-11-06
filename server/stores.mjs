// Where the banner and cultivar edits are kept. Same shape for both stores:
// getBanner() / putBanner(banner) and getEdits() / putEdits(edits).
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const NO_BANNER = { enabled: false };
const noEdits = () => ({ cultivars: {} });
// a stored edits file that's missing or malformed counts as no edits
const asEdits = (v) => (v && typeof v.cultivars === 'object' && !Array.isArray(v.cultivars) ? v : noEdits());

// Local files -- the site serves these same files at /content/banner.json and
// /content/cultivar-edits.json. The edits file sits next to the banner unless given.
export function fileStore(path, editsPath = join(dirname(path), 'cultivar-edits.json')) {
  const read = async (p, fallback) => {
    try { return JSON.parse(await readFile(p, 'utf8')); } catch { return fallback; }
  };
  const write = async (p, value) => {
    await mkdir(dirname(p), { recursive: true });
    const tmp = `${p}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(value, null, 2) + '\n');
    await rename(tmp, p); // atomic, so a visitor never reads a half-written file
  };
  return {
    getBanner: () => read(path, NO_BANNER),
    putBanner: (banner) => write(path, banner),
    getEdits: async () => asEdits(await read(editsPath, null)),
    putEdits: (edits) => write(editsPath, edits),
  };
}

// S3 objects -- the site bucket's content/banner.json and content/cultivar-edits.json, read
// by visitors through CloudFront. Uses the AWS SDK v3 that the Lambda Node.js runtime already
// includes, so it needs no install in Lambda. Not exercised by this repo's tests; verify on
// the AWS setup.
export function s3Store({ bucket, key = 'content/banner.json', editsKey = 'content/cultivar-edits.json', region }) {
  let client;
  const s3 = async () => {
    if (!client) {
      const { S3Client } = await import('@aws-sdk/client-s3');
      client = new S3Client({ region });
    }
    return client;
  };
  const read = async (Key, fallback) => {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    try {
      const res = await (await s3()).send(new GetObjectCommand({ Bucket: bucket, Key }));
      return JSON.parse(await res.Body.transformToString());
    } catch (err) {
      if (err?.name === 'NoSuchKey') return fallback;
      throw err;
    }
  };
  const write = async (Key, value) => {
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    await (await s3()).send(new PutObjectCommand({
      Bucket: bucket,
      Key,
      Body: JSON.stringify(value, null, 2),
      ContentType: 'application/json',
      CacheControl: 'no-cache', // CloudFront and browsers recheck it, so edits show quickly
    }));
  };
  return {
    getBanner: () => read(key, NO_BANNER),
    putBanner: (banner) => write(key, banner),
    getEdits: async () => asEdits(await read(editsKey, null)),
    putEdits: (edits) => write(editsKey, edits),
  };
}
