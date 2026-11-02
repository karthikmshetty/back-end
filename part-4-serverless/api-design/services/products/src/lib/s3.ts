import { S3Client } from '@aws-sdk/client-s3';

/**
 * One S3 client per Lambda container. Checksums are only added when S3
 * requires them; otherwise presigned PUT URLs would demand a checksum the
 * browser doesn't send.
 */
export const s3Client = new S3Client({
  requestChecksumCalculation: 'WHEN_REQUIRED',
});

export const IMAGES_BUCKET = process.env.IMAGES_BUCKET as string;

export const REGION = process.env.AWS_REGION ?? 'ap-south-1';

/** Every product image lives under this prefix (the only public one). */
export const IMAGE_KEY_PREFIX = 'products/';

/** How long a presigned upload URL stays valid, in seconds. */
export const UPLOAD_URL_EXPIRES_IN = 300;

/** Public URL of an object in the images bucket. */
export const getPublicUrl = (key: string): string =>
  `https://${IMAGES_BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
