import { z } from 'zod';

const optionalText = z.string().trim().optional();

const optionalNonNegative = (label: string) =>
  z
    .number({ invalid_type_error: `${label} must be a number` })
    .min(0, `${label} must be 0 or more`)
    .optional();

/** Body of POST /products. Unknown fields are rejected. */
export const createProductSchema = z
  .object({
    name: z
      .string({ required_error: 'Product name is required' })
      .trim()
      .min(1, 'Product name is required')
      .max(100, 'Product name must be at most 100 characters'),
    category: z
      .string({ required_error: 'Category is required' })
      .trim()
      .min(1, 'Category is required'),
    rate_per_unit: z
      .number({
        required_error: 'Rate per unit is required',
        invalid_type_error: 'Rate per unit must be a number',
      })
      .min(0, 'Rate per unit must be 0 or more'),
    description: z
      .string()
      .trim()
      .max(1000, 'Description must be at most 1000 characters')
      .optional(),
    form: optionalText,
    safety: optionalText,
    uom: optionalText,
    product_type: optionalText,
    product_size: optionalText,
    product_variant: optionalText,
    product_color: optionalText,
    market_selling_price: optionalNonNegative('Market selling price'),
    sale_profit_margin: optionalNonNegative('Sale profit margin'),
    eco_friendly: z.boolean().default(false),
    handle_with_care: z.boolean().default(false),
    images: z
      .array(z.string().url('Each image must be a valid URL'))
      .max(5, 'At most 5 images are allowed')
      .default([]),
  })
  .strict();

export type CreateProductInput = z.infer<typeof createProductSchema>;

const PAGE_NUMBER_MESSAGE = 'Page number must be a positive integer';
const PAGE_SIZE_MESSAGE = 'Page size must be between 1 and 100';

/** Query string of GET /products. Unknown parameters are rejected. */
export const listProductsQuerySchema = z
  .object({
    search: z.string().trim().toLowerCase().optional(),
    category: z.string().trim().optional(),
    sort_order: z
      .enum(['asc', 'desc'], {
        errorMap: () => ({ message: "Sort order must be 'asc' or 'desc'" }),
      })
      .default('desc'),
    // Query string values arrive as text, so convert them to numbers first.
    page_number: z.coerce
      .number({ invalid_type_error: PAGE_NUMBER_MESSAGE })
      .int(PAGE_NUMBER_MESSAGE)
      .min(1, PAGE_NUMBER_MESSAGE)
      .default(1),
    page_size: z.coerce
      .number({ invalid_type_error: PAGE_SIZE_MESSAGE })
      .int(PAGE_SIZE_MESSAGE)
      .min(1, PAGE_SIZE_MESSAGE)
      .max(100, PAGE_SIZE_MESSAGE)
      .default(10),
  })
  .strict();

export type SortOrder = z.infer<typeof listProductsQuerySchema>['sort_order'];

const IMAGE_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** Body of POST /products/upload-url. Unknown fields are rejected. */
export const uploadUrlSchema = z
  .object({
    content_type: z.enum(IMAGE_CONTENT_TYPES, {
      errorMap: () => ({
        message: 'Content type must be image/jpeg, image/png or image/webp',
      }),
    }),
  })
  .strict();

export type ImageContentType = (typeof IMAGE_CONTENT_TYPES)[number];

/** File extension used in the S3 key for each allowed content type. */
export const CONTENT_TYPE_EXTENSIONS: Record<ImageContentType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
