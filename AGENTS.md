# Project conventions

You are helping build a MongoDB application. Apply these conventions throughout the project.

## Context and project layout
- Read `CONTEXT.md` for the domain, source data, application access patterns,
  and constraints. Inspect existing code before changing it.
- Work in the repository root. Keep the Express API in `server.js` and CSV
  import code, when needed, in `import.js`. Do not modify source datasets.
- Keep scenario-specific requirements in `CONTEXT.md`; this file holds
  project-wide rules.

## Stack and connections
- Use Node.js, Express, and the official `mongodb` driver. Do not use Mongoose
  or any ODM. This project uses ESM imports (`"type": "module"`).
- Reuse one `MongoClient`, connected at startup. Do not create a client per request.
- Application and import code connect with the driver, not through MCP.

## Data modeling
- Model document-native. Shape collections around access patterns, not around
  normalized source files or generic CRUD operations.
- Explain embedding vs. referencing decisions and tie indexes to actual queries.
  Avoid unbounded embedded arrays.
- Use relevant MongoDB Agent Skills when available for modeling and coding guidance.

## Environment and MCP
- Read the connection string from `MONGODB_URI`; never hardcode credentials.
  Set `MDB_MCP_CONNECTION_STRING` to the same URI for the bundled plugin MCP
  server; the optional standalone configuration reads `MONGODB_URI` directly.
- Use the database `<your-db-name>` exactly, and set `MONGODB_DB` to that name.
  Ask for the intended name if this placeholder has not been configured; do
  not invent one from the domain.
- The default setup uses Atlas. Local MongoDB is also supported: match tools
  and connection settings to the actual deployment. Do not use Atlas-only
  tools against a local instance.
- Use MongoDB MCP to inspect live collections, documents, indexes, and query
  plans, and to test pipelines before integrating them into the application.
  Do not present assumptions from project files as verified database facts.

## Workflow and safety
- Present the schema for review before creating collections or writing/running
  import code. Show aggregation pipelines before adding them to the API.
- Ask before destructive operations, including dropping collections, resetting
  data, and overwriting substantial existing work. Explicit approval applies
  only to the operation requested, not to future destructive actions.
- Keep credentials and passkeys out of application code, Git, responses, and
  logs. Do not read or display credential files to troubleshoot application behavior.
- Validate API inputs, bound pagination, and return appropriate HTTP status codes.
- Preserve unrelated changes and dependencies; avoid unnecessary rewrites.

## Verification
- Run changed code and test affected endpoints. Check import counts when
  importing data and confirm responses match the intended access patterns.
- Restart the API after route changes unless the project explicitly configures
  hot reload. Do not assume generated code is running.
- Use explain plans to judge query performance. Recommend indexes only when
  the query and plan justify them; a collection scan is not automatically a defect.
- Report what you tested, the results, and anything you could not verify.
  Do not claim success solely because a file was generated.

## Git
- Never push without an explicit instruction.
- Prefer new commits over amends; do not amend pushed commits.
- Use concise, active-voice commit messages without agent attribution by default.
- Confirm before destructive operations (`push --force`, `reset --hard`, branch deletion).
