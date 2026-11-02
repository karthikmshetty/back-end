import { DeleteCommand } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { docClient, ITEM_CODE, TABLE_NAME } from '../lib/dynamodb';
import {
  buildResponse,
  getProductId,
  handleError,
  isConditionFailed,
  productNotFound,
} from '../lib/helper';

/**
 * Handles DELETE /products/{id}. Removes the product only; its images and
 * brochure stay in S3.
 */
export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const id = getProductId(event.pathParameters);
    if (id === undefined) {
      return productNotFound();
    }

    // The condition turns "nothing to delete" into a 404 instead of a silent success.
    await docClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { item_code: ITEM_CODE, id },
        ConditionExpression: 'attribute_exists(id)',
      }),
    );

    return buildResponse(200, { message: 'Product deleted successfully' });
  } catch (error) {
    if (isConditionFailed(error)) {
      return productNotFound();
    }
    return handleError(error, 'deleting product');
  }
};
