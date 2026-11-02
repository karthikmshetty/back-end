import { randomUUID } from 'node:crypto';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { buildResponse, handleError, parseBody } from '../lib/helper';
import {
  BROCHURE_KEY_PREFIX,
  getPublicUrl,
  IMAGE_KEY_PREFIX,
  IMAGES_BUCKET,
  s3Client,
  UPLOAD_URL_EXPIRES_IN,
} from '../lib/s3';
import { CONTENT_TYPE_EXTENSIONS, uploadUrlSchema } from '../utils/validators';

/** Handles POST /products/upload-url. */
export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const body = parseBody(event.body);
    if (body === null) {
      return buildResponse(400, {
        message: 'Request body must be valid JSON',
      });
    }

    const { content_type } = uploadUrlSchema.parse(body);

    const prefix =
      content_type === 'application/pdf'
        ? BROCHURE_KEY_PREFIX
        : IMAGE_KEY_PREFIX;
    const key = `${prefix}${randomUUID()}.${CONTENT_TYPE_EXTENSIONS[content_type]}`;

    // Sign content-type too (by default only host is signed), so S3 answers
    // 403 to a PUT whose Content-Type differs from the one requested here.
    const uploadUrl = await getSignedUrl(
      s3Client,
      new PutObjectCommand({
        Bucket: IMAGES_BUCKET,
        Key: key,
        ContentType: content_type,
      }),
      {
        expiresIn: UPLOAD_URL_EXPIRES_IN,
        signableHeaders: new Set(['content-type']),
      },
    );

    return buildResponse(200, {
      message: 'Upload URL created successfully',
      data: {
        upload_url: uploadUrl,
        file_url: getPublicUrl(key),
        key,
        expires_in: UPLOAD_URL_EXPIRES_IN,
      },
    });
  } catch (error) {
    return handleError(error, 'creating upload URL');
  }
};
