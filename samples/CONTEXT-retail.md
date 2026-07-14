# Retail Catalog & Orders

You are helping build a retail e-commerce backend. The application powers a product catalog, customer accounts, and an order system. It is read-heavy on the catalog side and read-write on the order side.

## Source data

You have six CSV files in `~/project/data/`. They are normalized in a relational style and you are expected to reshape them into a document model that fits the application's access patterns.

**categories.csv** holds the product taxonomy. Each category has a unique `category_id`, a `name`, a `slug`, and a `parent_category_id` for hierarchical categories. The hierarchy is at most three levels deep (department > category > subcategory).

**products.csv** holds the catalog. Each product has a unique `product_id`, a `sku`, a `name`, a `description`, a `category_id`, a `brand`, a `base_price` in USD, a `currency` (always `USD` in this dataset), a current `inventory_count`, a `weight_oz`, and a JSON-formatted `attributes` field. The `attributes` field varies by category. An apparel product has `size`, `color`, `material`. An electronics product has `screen_size`, `battery_life_hours`, `connectivity`. A home goods product has `dimensions`, `room`, `style`. The CSV stores attributes as a JSON string.

**customers.csv** holds account information. Each customer has a unique `customer_id`, an `email`, a `first_name`, a `last_name`, a `created_at` date, a `phone`, and a default shipping address (`address_line1`, `address_line2`, `city`, `state`, `postal_code`, `country`).

**orders.csv** holds order headers. Each order has a unique `order_id`, a `customer_id`, an `order_date`, an `order_status` (`pending`, `confirmed`, `shipped`, `delivered`, `cancelled`, `returned`), a `subtotal`, a `tax`, a `shipping_cost`, a `total`, a `payment_method` (`credit_card`, `debit_card`, `paypal`, `apple_pay`), and a `shipping_address` snapshot at the time of order (which may differ from the customer's current default address).

**order_items.csv** holds the line items. Each line item has a `line_item_id`, an `order_id`, a `product_id`, a snapshot of the `product_name` and `sku` at order time, a `quantity`, a `unit_price` at order time, and a `line_total`. Snapshots are deliberately preserved so price changes after the order do not retroactively rewrite history.

**audit_log.csv** holds an append-only record of meaningful state changes on the customer. Each entry has a unique `log_id`, a `subject_id` (the `customer_id` it applies to), a `subject_type` (always `customer` in this scenario), an `event_type` (`email_updated`, `address_updated`, `password_reset`, `payment_method_added`, `shipping_address_changed`, `subscription_started`, `marketing_opt_in_changed`, `login_failed`, and similar values), an `actor` (`user`, `system`, or `admin`), an `event_date` (ISO 8601 timestamp), and a free-text `details` summary. The collection is append-only: entries are never edited or deleted. It is universal across scenarios — the same shape exists in the financial and healthcare datasets, only the `event_type` values change.

## Application access patterns

These are the queries and operations the application performs. Your schema must serve them efficiently.

**Product detail page.** When a shopper views a product, the app loads the product, its category breadcrumb, and any variant attributes. This is the highest-traffic query in the application.

**Catalog browse.** When a shopper browses a category, the app loads the products in that category, sorted by relevance or price, with filters on brand, price range, and category-specific attributes.

**Search.** Users search by keyword across product name, description, and brand. Search must support filtering and sorting.

**Customer order history.** When a customer views their order history, the app loads all orders for that customer, sorted by date descending, showing the order summary and line item count. Clicking into an order shows all line items.

**Place an order.** When a customer checks out, the app creates a new order with line items, decrements product inventory, and confirms the order.

**Order lookup by status.** Operations queries: list all pending orders for fulfillment, list all orders shipped today, list all orders for a specific customer.

## Performance and scale

The catalog is read-heavy. The product detail page and category browse account for the majority of traffic. Order placement is write-heavy in bursts (Black Friday) but light on average. There are 1,000 customers and roughly 200 products. Orders accumulate over time; expect tens of thousands after a year of operation, with 1 to 10 line items per order.

## Notes for the schema

Order line items are immutable once the order is placed and are always accessed with the order. They are a textbook embed candidate.

Product attributes vary by category. A flat schema with every possible attribute as a top-level field is wrong. The shape should accommodate new categories with new attribute sets without schema change.

Customer address at order time is captured as a snapshot in the order. The customer's current address can change after the order. Do not link orders to the live customer address record.

Category hierarchy is shallow and stable. The hierarchy is a candidate for either a denormalized breadcrumb on the product or a reference to a category document with the breadcrumb pre-computed.

Inventory is a single fast-changing number per product. Updates to inventory are frequent and should not require rewriting other product fields.
