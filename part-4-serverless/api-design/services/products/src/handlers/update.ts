import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { Product } from '../entities/Product';
import { docClient, ITEM_CODE, TABLE_NAME } from '../lib/dynamodb';
import {
  buildResponse,
  getProductId,
  handleError,
  isConditionFailed,
  parseBody,
  productNotFound,
} from '../lib/helper';
import {
  updateProductSchema,
  type UpdateProductInput,
} from '../utils/validators';

/** Optional fields: when left out of a PUT they are removed from the product. */
const OPTIONAL_FIELDS = [
  'description',
  'form',
  'safety',
  'uom',
  'product_type',
  'product_size',
  'product_variant',
  'product_color',
  'market_selling_price',
  'sale_profit_margin',
  'brochure',
] as const satisfies readonly (keyof UpdateProductInput)[];

/**
 * Builds "SET #name = :name, ... REMOVE #brochure, ..." for a full replace.
 * Attribute names go through #placeholders because some (e.g. name) are
 * DynamoDB reserved words.
 */
const buildUpdate = (input: UpdateProductInput, now: string) => {
  const fields: Record<string, unknown> = {
    ...input,
    name_lowercase: input.name.toLowerCase(),
    updated_at: now,
  };
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};
  const sets: string[] = [];
  const removes: string[] = [];

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    names[`#${key}`] = key;
    values[`:${key}`] = value;
    sets.push(`#${key} = :${key}`);
  }
  for (const key of OPTIONAL_FIELDS) {
    if (input[key] === undefined) {
      names[`#${key}`] = key;
      removes.push(`#${key}`);
    }
  }

  const expression =
    `SET ${sets.join(', ')}` +
    (removes.length ? ` REMOVE ${removes.join(', ')}` : '');
  return { expression, names, values };
};

/** Handles PUT /products/{id}. */
export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const id = getProductId(event.pathParameters);
    if (id === undefined) {
      return productNotFound();
    }

    const body = parseBody(event.body);
    if (body === null) {
      return buildResponse(400, {
        message: 'Request body must be valid JSON',
      });
    }

    const input = updateProductSchema.parse(body);
    const { expression, names, values } = buildUpdate(
      input,
      new Date().toISOString(),
    );

    // The condition stops UpdateItem from creating a new item for an unknown id.
    const result = await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { item_code: ITEM_CODE, id },
        UpdateExpression: expression,
        ConditionExpression: 'attribute_exists(id)',
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ReturnValues: 'ALL_NEW',
      }),
    );

    return buildResponse(200, {
      message: 'Product updated successfully',
      data: result.Attributes as Product,
    });
  } catch (error) {
    if (isConditionFailed(error)) {
      return productNotFound();
    }
    return handleError(error, 'updating product');
  }
};
