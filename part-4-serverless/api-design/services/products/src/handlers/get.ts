import { GetCommand } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { Product } from '../entities/Product';
import { docClient, ITEM_CODE, TABLE_NAME } from '../lib/dynamodb';
import {
  buildResponse,
  getProductId,
  handleError,
  productNotFound,
} from '../lib/helper';

/** Handles GET /products/{id}. */
export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const id = getProductId(event.pathParameters);
    if (id === undefined) {
      return productNotFound();
    }

    // A GetItem on the full primary key: one read, no Query or Scan.
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { item_code: ITEM_CODE, id },
      }),
    );
    if (!result.Item) {
      return productNotFound();
    }

    return buildResponse(200, {
      message: 'Product retrieved successfully',
      data: result.Item as Product,
    });
  } catch (error) {
    return handleError(error, 'getting product');
  }
};
