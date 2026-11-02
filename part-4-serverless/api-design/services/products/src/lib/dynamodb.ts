import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

/** One document client per Lambda container, reused across invocations. */
export const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

export const TABLE_NAME = process.env.TABLE_NAME as string;

/** Partition key value shared by every product. */
export const ITEM_CODE = 'product';

/** Local secondary index for listing products sorted by created_at. */
export const CREATED_AT_INDEX = 'created_at-index';
