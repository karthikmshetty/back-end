import { randomUUID } from 'node:crypto';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { Product } from '../entities/Product';
import { docClient, ITEM_CODE, TABLE_NAME } from '../lib/dynamodb';
import { buildResponse, handleError, parseBody } from '../lib/helper';
import { createProductSchema } from '../utils/validators';

/** Handles POST /products. */
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

    const input = createProductSchema.parse(body);

    const now = new Date().toISOString();
    const product: Product = {
      ...input,
      item_code: ITEM_CODE,
      id: randomUUID(),
      name_lowercase: input.name.toLowerCase(),
      created_at: now,
      updated_at: now,
    };

    // Never overwrite: fails with ConditionalCheckFailedException (409) if the id exists.
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: product,
        ConditionExpression: 'attribute_not_exists(id)',
      }),
    );

    return buildResponse(201, {
      message: 'Product added successfully',
      data: product,
    });
  } catch (error) {
    return handleError(error, 'creating product');
  }
};
