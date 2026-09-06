import { createHash } from 'node:crypto';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../env.js';

/**
 * Object storage. Two namespaces with different rules:
 *
 *   public/   optimized models, LODs, previews — world-readable, cached
 *   private/  originals as the supplier uploaded them — presigned URLs only
 *
 * Everything user-uploaded is served with an explicit Content-Type and
 * `Content-Disposition: attachment` so a file that lies about what it is cannot
 * execute in the application's origin. In production this bucket belongs on a
 * separate domain; see docs/architecture.md.
 */

/**
 * Built on first use rather than at import time: a unit test that touches a
 * module which happens to import this one should not open a connection pool.
 */
let s3: S3Client | null = null;

function client(): S3Client {
  s3 ??= new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY,
      secretAccessKey: env.S3_SECRET_KEY,
    },
  });

  return s3;
}

export type StorageVisibility = 'public' | 'private';

export interface StoredObject {
  key: string;
  byteSize: number;
  checksum: string;
  contentType: string;
}

export function checksumOf(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export function buildKey(
  visibility: StorageVisibility,
  productId: string,
  filename: string,
): string {
  return `${visibility}/products/${productId}/${filename}`;
}

export async function putObject(
  key: string,
  body: Uint8Array,
  contentType: string,
): Promise<StoredObject> {
  await client().send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      // Never let a browser render an uploaded file inline.
      ContentDisposition: 'attachment',
      CacheControl: key.startsWith('public/')
        ? 'public, max-age=31536000, immutable'
        : 'private, no-store',
    }),
  );

  return { key, byteSize: body.byteLength, checksum: checksumOf(body), contentType };
}

/** Reads an object back into memory. Used when a job retries after a restart. */
export async function getObject(key: string): Promise<Uint8Array> {
  const response = await client().send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));

  if (!response.Body) throw new Error(`Object ${key} has no body`);
  return new Uint8Array(await response.Body.transformToByteArray());
}

export async function deleteObject(key: string): Promise<void> {
  await client().send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
}

/** Stable URL for anything under `public/`. */
export function publicUrl(key: string): string {
  return `${env.ASSET_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
}

/** Short-lived link to a private object. Fifteen minutes is plenty for a download. */
export function signedUrl(key: string, expiresInSeconds = 900): Promise<string> {
  return getSignedUrl(client(), new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }), {
    expiresIn: expiresInSeconds,
  });
}

/** Resolves the right kind of URL for a stored object. */
export function urlFor(key: string): string | Promise<string> {
  return key.startsWith('public/') ? publicUrl(key) : signedUrl(key);
}

export async function storageHealthy(): Promise<boolean> {
  try {
    await client().send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: '.health-probe' }));
    return true;
  } catch (error) {
    // A missing probe object still proves the endpoint answers; only transport
    // failures mean the storage is actually down.
    const name = error instanceof Error ? error.name : '';
    return name === 'NoSuchKey' || name === 'NotFound';
  }
}
