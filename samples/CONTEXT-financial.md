# Financial Portfolio Tracker

You are helping build a financial portfolio tracker. The application lets investors view their holdings across multiple asset types, record transactions, and track portfolio performance over time. It is read-heavy on the dashboard side and write-light on the transaction side.

## Source data

You have five CSV files in `~/project/data/`. They are normalized in a relational style and you are expected to reshape them into a document model that fits the application's access patterns.

**investors.csv** holds the people who use the app. Each investor has a unique `investor_id`, a name, an email, a date they joined, a base currency for reporting (always `USD` in this dataset), and a risk tolerance label (`conservative`, `moderate`, `aggressive`).

**assets.csv** holds the universe of investable assets. Each asset has a unique `asset_id`, a `symbol` (`AAPL`, `BTC`, `VTSAX`, etc.), a human-readable `name`, an `asset_type` (`stock`, `crypto`, `fund`, `bond`), a `sector` for stocks (`technology`, `healthcare`, etc.), a country of issue, and an exchange code. Crypto and funds use `sector="N/A"` and exchange codes appropriate to their type.

**transactions.csv** holds every buy, sell, dividend, and split event. Each transaction has a unique `transaction_id`, an `investor_id`, an `asset_id`, a `transaction_type` (`buy`, `sell`, `dividend`, `split`), a `quantity`, a `price_per_unit` in USD, a `total_amount` in USD, a `fee` in USD, and a `transaction_date` (ISO 8601 date). Transaction types have different field semantics: a `dividend` has `quantity=0` and `total_amount` set to the dividend payout. A `split` records the split ratio in `quantity`.

**price_snapshots.csv** holds end-of-day price snapshots for each asset. Each snapshot has an `asset_id`, a `snapshot_date`, an `open`, `high`, `low`, `close`, and `volume`. Three months of daily snapshots per asset are included.

**audit_log.csv** holds an append-only record of meaningful state changes on the investor. Each entry has a unique `log_id`, a `subject_id` (the `investor_id` it applies to), a `subject_type` (always `investor` in this scenario), an `event_type` (`risk_tolerance_changed`, `email_updated`, `address_updated`, `kyc_review_completed`, `password_reset`, `statement_emailed`, `login_failed`, and similar values), an `actor` (`user`, `system`, or `admin`), an `event_date` (ISO 8601 timestamp), and a free-text `details` summary. The collection is append-only: entries are never edited or deleted. It is universal across scenarios — the same shape exists in the retail and healthcare datasets, only the `event_type` values change.

## Application access patterns

These are the queries and operations the application performs. Your schema must serve them efficiently.

**Dashboard view.** When an investor logs in, the app loads their dashboard. The dashboard shows their full list of current holdings (one row per asset with current quantity and current market value), their portfolio total in USD, and their three most recent transactions. This is the most frequent query in the application.

**Holding detail.** When the investor clicks into a specific holding, the app shows the asset's details, the investor's current quantity, the average cost basis (weighted average buy price), the unrealized gain/loss, and a chart of the asset's price over the last 90 days.

**Transaction history.** When the investor opens their full transaction history, the app shows every transaction sorted by date descending, with filters by transaction type and date range.

**Record a transaction.** When the investor records a new buy or sell, the app inserts the transaction and updates the investor's current holding for that asset.

**Asset search.** Users can search the asset universe by symbol or name to add a new asset to their portfolio.

## Performance and scale

The application is read-heavy on the dashboard side and write-light on the transaction side. Investors check their dashboard daily but record transactions only a few times per month on average. The dashboard query must return in under 100ms at the 95th percentile. There are 1,000 investors, around 50 assets, and 30,000 to 50,000 transactions across all investors after a few years of operation. Price snapshots are written daily by a background job, not by users.

## Notes for the schema

Cardinality matters. An investor has on the order of 10 to 100 holdings, but transactions across all investors and all assets number in the tens of thousands. Asset prices grow without bound as time passes.

Transactions are polymorphic: buy, sell, dividend, and split share most fields but differ in semantics. A schema that handles them as a single collection with a discriminator field is preferable to four separate collections.

Price history is access-pattern-bound to a specific asset and date range. It does not need to be embedded in the asset document.

Dashboard performance is the success metric. If the dashboard takes more than one query to render, the schema is wrong.
