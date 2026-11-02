/** A product as stored in the products table. */
export interface Product {
  /** Partition key; always "product" so one Query returns every product. */
  item_code: string;
  /** Sort key; a UUID that keeps each product unique. */
  id: string;
  name: string;
  /** Lowercase copy of name for case-insensitive search (DynamoDB's contains is case-sensitive). */
  name_lowercase: string;
  category: string;
  rate_per_unit: number;
  description?: string;
  form?: string;
  safety?: string;
  uom?: string;
  product_type?: string;
  product_size?: string;
  product_variant?: string;
  product_color?: string;
  market_selling_price?: number;
  sale_profit_margin?: number;
  eco_friendly: boolean;
  handle_with_care: boolean;
  /** Image URLs; the first one is the main image. */
  images: string[];
  /** URL of the product brochure (PDF). */
  brochure?: string;
  /** ISO date string. */
  created_at: string;
  /** ISO date string. */
  updated_at: string;
}
