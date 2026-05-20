# Project context

Fill in each section before you start prompting Claude Code. The agent reads this file when reasoning about your data model, so the more specific you are, the better the schema proposals.

## Domain

What this application does, in one or two sentences. Who uses it, what they accomplish, what the business value is.

## Data sources

List the inputs (CSV files, APIs, existing tables). For each, the rough shape and the field names. Note where the data comes from in production versus development.

## Access patterns

The most frequent queries the application runs, in order of frequency. Be specific about which fields are involved and whether the read is single-document, range, or aggregation. Example: "Dashboard load: find one user by id, then list their last 20 transactions sorted by date descending."

## Constraints

Anything the agent should know that is not obvious from the access patterns: scale, latency budgets, regulatory requirements (PII, HIPAA, PCI), deployment target (Atlas region, self-hosted), team size, existing tech stack the agent should align with.
