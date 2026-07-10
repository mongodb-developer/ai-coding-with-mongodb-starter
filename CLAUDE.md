# Project conventions

You are helping build a MongoDB application. Apply these conventions on every prompt.

## Stack
- Use the official `mongodb` Node.js driver. Do NOT use Mongoose or any ODM.
- The domain, data files, and access patterns are in `CONTEXT.md`. Read it
  before proposing a schema.

## Data modeling
- Model document-native. Shape collections around the access patterns in
  CONTEXT.md, not around the CSV files.

## Environment
- Connect to MongoDB Atlas. Read the connection string from the `MONGODB_URI`
  environment variable; never commit it. The MCP server at `.mcp.json` is
  already wired to it. Prefer the MCP server for schema introspection and
  explain plans over inventing queries.
- Use the database `<your-db-name>` exactly.

## Git
- Never push without an explicit instruction.
- Prefer new commits over amends; don't amend pushed commits.
- Commit messages are concise, active voice, no agent attribution by default.
- Confirm before destructive operations (`push --force`, `reset --hard`, branch deletion).
