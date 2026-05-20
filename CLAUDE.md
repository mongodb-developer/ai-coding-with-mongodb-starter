# Project conventions

This project uses MongoDB. Apply these conventions when writing code or making schema decisions:

- Database: `<your-db-name>` (set this once; the agent should not derive a name from the domain)
- Driver: official `mongodb` Node driver. Do not use Mongoose.
- Connection: MongoDB Atlas. Read the connection string from the `MONGODB_URI` environment variable; never commit it. A free-forever M0 cluster is available at https://www.mongodb.com/cloud/atlas/register.
- Schema style: document-native. Embed where read access patterns favor it. Use references when data is independently queried or grows unbounded. Avoid one-collection-per-source-table translation.
- MCP: a MongoDB MCP Server is configured at `.claude/mcp_servers.json`. Prefer it for schema introspection and explain plans over inventing queries.
- Domain context: see `CONTEXT.md` in this directory.
