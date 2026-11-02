import type { APIGatewayProxyResult } from 'aws-lambda';
import { ZodError } from 'zod';

export const RESPONSE_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Credentials': 'true',
};

/** Success bodies are { message, data }; error bodies are only { message }. */
type ResponseBody = { message: string; data?: unknown };

export const buildResponse = (
  statusCode: number,
  body: ResponseBody,
): APIGatewayProxyResult => ({
  statusCode,
  headers: RESPONSE_HEADERS,
  body: JSON.stringify(body),
});

/** Returns the parsed JSON body, or null if it's missing or not valid JSON. */
export const parseBody = (body: string | null): unknown => {
  if (!body) return null;
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
};

const THROTTLING_ERRORS = new Set([
  'ProvisionedThroughputExceededException',
  'ThrottlingException',
  'RequestLimitExceeded',
  'TooManyRequestsException',
  'SlowDown',
]);

/**
 * Shared catch-block handler for every endpoint. Turns any error into a
 * response with a friendly message; DynamoDB/S3/AWS messages are never
 * passed on because they reveal table names, keys or internals.
 */
export const handleError = (
  error: unknown,
  context: string,
): APIGatewayProxyResult => {
  // Validation messages are written for users, so they are safe to show.
  if (error instanceof ZodError) {
    return buildResponse(400, { message: error.issues[0].message });
  }

  // Everything else is logged in full for CloudWatch.
  console.error(`Error ${context}:`, error);

  const name = (error as { name?: unknown } | null)?.name;

  if (typeof name === 'string' && THROTTLING_ERRORS.has(name)) {
    return buildResponse(429, {
      message: 'Too many requests. Please try again in a moment.',
    });
  }

  if (name === 'ConditionalCheckFailedException') {
    return buildResponse(409, {
      message: 'This record already exists. Please try again.',
    });
  }

  return buildResponse(500, {
    message: 'Oops! Something went wrong. Please try again later.',
  });
};

/** The `{id}` path parameter of /products/{id}, or undefined if it's missing or blank. */
export const getProductId = (
  pathParameters: Record<string, string | undefined> | null,
): string | undefined => {
  const id = pathParameters?.id?.trim();
  return id ? id : undefined;
};

export const productNotFound = (): APIGatewayProxyResult =>
  buildResponse(404, { message: 'Product not found' });

/**
 * True when a DynamoDB ConditionExpression failed. For update and delete the
 * condition is "the product exists", so the caller answers 404.
 */
export const isConditionFailed = (error: unknown): boolean =>
  (error as { name?: unknown } | null)?.name ===
  'ConditionalCheckFailedException';
