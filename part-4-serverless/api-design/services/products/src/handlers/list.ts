import { QueryCommand, type QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { Product } from '../entities/Product';
import {
  CREATED_AT_INDEX,
  docClient,
  ITEM_CODE,
  TABLE_NAME,
} from '../lib/dynamodb';
import { buildResponse, handleError } from '../lib/helper';
import { listProductsQuerySchema, type SortOrder } from '../utils/validators';

/**
 * Returns every matching product, sorted by created_at. Uses a Query on the
 * created_at index (never a Scan) and follows LastEvaluatedKey, because one
 * Query returns at most 1 MB.
 */
const fetchProducts = async (
  search: string | undefined,
  category: string | undefined,
  sortOrder: SortOrder,
): Promise<Product[]> => {
  const filters: string[] = [];
  const names: Record<string, string> = { '#item_code': 'item_code' };
  const values: Record<string, unknown> = { ':item_code': ITEM_CODE };

  if (category) {
    filters.push('#category = :category');
    names['#category'] = 'category';
    values[':category'] = category;
  }
  if (search) {
    filters.push('contains(#name_lowercase, :search)');
    names['#name_lowercase'] = 'name_lowercase';
    values[':search'] = search;
  }

  const params: QueryCommandInput = {
    TableName: TABLE_NAME,
    IndexName: CREATED_AT_INDEX,
    KeyConditionExpression: '#item_code = :item_code',
    // Filters run after items are read, so filtered-out items still count toward cost.
    FilterExpression: filters.length ? filters.join(' AND ') : undefined,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    ScanIndexForward: sortOrder === 'asc',
  };

  const products: Product[] = [];
  let lastKey: QueryCommandInput['ExclusiveStartKey'];
  do {
    const result = await docClient.send(
      new QueryCommand({ ...params, ExclusiveStartKey: lastKey }),
    );
    products.push(...((result.Items ?? []) as Product[]));
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return products;
};

/** Handles GET /products. */
export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const { search, category, sort_order, page_number, page_size } =
      listProductsQuerySchema.parse(event.queryStringParameters ?? {});

    const products = await fetchProducts(search, category, sort_order);

    if (products.length === 0) {
      const body = { message: 'No results found', data: [], total_count: 0 };
      return buildResponse(200, body);
    }

    const start = (page_number - 1) * page_size;
    const body = {
      message: 'Products retrieved successfully',
      data: products.slice(start, start + page_size),
      total_count: products.length,
    };
    return buildResponse(200, body);
  } catch (error) {
    return handleError(error, 'listing products');
  }
};
