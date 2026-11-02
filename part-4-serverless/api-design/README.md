# Products API (api-design)

A products backend built with Serverless Framework v3, TypeScript and AWS
(Lambda, API Gateway, DynamoDB, S3, SSM Parameter Store).

## Folder layout

```
api-design/
├── package.json          # all build tools + types (the only package.json for services)
├── tsconfig.json         # shared base, type-check only
├── eslint.config.mjs
├── .prettierrc.json
├── resources/            # long-lived AWS resources (deploy first)
│   ├── serverless.yml    # DynamoDB table, S3 bucket, Lambda layer, SSM parameters
│   └── layer/nodejs/package.json   # runtime libraries shipped in the layer
└── services/
    └── products/         # the products API (no package.json here)
        ├── serverless.yml
        ├── tsconfig.json # compiles src/ → dist/
        ├── docs/products-swagger.yaml
        └── src/
            ├── entities/Product.ts
            ├── handlers/create.ts       # POST /products
            ├── handlers/upload-url.ts   # POST /products/upload-url
            ├── lib/{dynamodb,helper,s3}.ts
            └── utils/validators.ts
```

Build tools and types live only in the root `package.json`. The libraries
the Lambdas need at runtime come from the Lambda layer, so services have no
`package.json` and their deployment zip contains only the compiled `dist/`.

## Why resources are a separate stack

The table and bucket hold data. If they were defined inside the products
service, `serverless remove` on that service would delete them along with
every product and image. In their own `resources` stack, services can be
deployed, renamed or removed freely without touching data.

## Table design

Table `products-<stage>`, on-demand billing, point-in-time recovery on.

| Key | Attribute | Notes |
| --- | --- | --- |
| Partition key | `item_code` | Always `"product"`, so one Query returns every product; nothing needs a Scan. |
| Sort key | `id` | UUID, keeps each product unique. |
| LSI `created_at-index` | `item_code` + `created_at` | Lists products sorted by date. Projects all attributes. |

`GET /products` uses the `created_at-index` local secondary index to list
products sorted by date: a Query where `item_code` = `"product"`, so DynamoDB
returns them already in order. Category and search are filter expressions.

`name_lowercase` is stored alongside `name` because DynamoDB's `contains` is
case-sensitive.

## Routes

| Method | Path | Function | Notes |
| --- | --- | --- | --- |
| POST | `/products` | `create` | Create a product |
| GET | `/products` | `list` | Query parameters: `search`, `category`, `sort_order` (`asc`/`desc`, default `desc`), `page_number` (default 1), `page_size` (default 10, max 100). Returns `message`, `data`, `total_count`. |
| POST | `/products/upload-url` | `upload-url` | Presigned S3 upload URL |

## SSM parameters

The resources stack publishes names and ARNs so services never hard-code them:

| Parameter | Value |
| --- | --- |
| `/<stage>/dynamodb/products-table-name` | DynamoDB table name |
| `/<stage>/lambda/node-layer-arn` | Layer version ARN |
| `/<stage>/s3/product-images-bucket-name` | Images bucket name |

The products service reads them and passes `STAGE`, `TABLE_NAME` and
`IMAGES_BUCKET` to its Lambdas.

## Lambda layer

`NodeDependencies` ships the S3 client, the S3 request presigner and zod 3.
Before packaging, a hook runs `npm install --omit=dev` in
`resources/layer/nodejs`. The DynamoDB clients are left out because the
Node.js 22 Lambda runtime already includes them.

## Image upload flow

Bucket `product-images-<stage>-<account id>`. Objects under `products/` are
publicly readable so image URLs work in `<img>` tags; listing and uploading
stay private.

1. `POST /products/upload-url` with `{ "content_type": "image/jpeg" }`.
   The response has `upload_url`, `file_url`, `key` and `expires_in` (300).
2. `PUT` the file bytes to `upload_url` with the same `Content-Type` header
   and no auth header. Content-type is signed into the URL, so a different
   type gets 403 from S3.
3. Send `file_url` in `images` when calling `POST /products`.

## Errors

Every handler is wrapped in try/catch and uses one shared error handler.
Users never see DynamoDB, S3 or AWS messages; the full error is logged to
CloudWatch instead.

| Status | When |
| --- | --- |
| 400 | Missing/non-JSON body, or validation failed |
| 409 | Duplicate id (create only) |
| 429 | Throttled (also returned by API Gateway's own rate limit) |
| 500 | Anything else |

Full API reference: [services/products/docs/products-swagger.yaml](services/products/docs/products-swagger.yaml).

## Deploy

Requires the Serverless Framework v3 CLI and AWS credentials. Stage defaults
to `staging`; region is `ap-south-1`.

```bash
npm install
npm run deploy:resources   # first: table, bucket, layer, SSM parameters
npm run deploy:products    # then: the API
```

Other scripts: `typecheck`, `lint`, `lint:fix`, `build:products`,
`offline:products` (http://localhost:3000/staging, needs the resources stack
deployed for the SSM values), `remove:products`, `remove:resources`.
