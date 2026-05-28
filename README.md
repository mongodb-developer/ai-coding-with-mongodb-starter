# AI Coding with MongoDB: starter template for Claude Code

This template gives you the same shape of project artifacts you built and used during the AI Coding with MongoDB Workshop. Clone it, customize four files, and Claude Code will use the same defaults in every prompt.

## The four levers

You influence what Claude Code reaches for through, in decreasing order of strength:

1. **A `CLAUDE.md` in the project root.** The agent reads it on every prompt. This is the strongest lever.
2. **Repo artifacts the agent reads first.** The `mongodb` driver in `package.json` (already here); no stray `prisma/schema.prisma` or `postgres` services in `docker-compose.yml`.
3. **An MCP server wired to your database.** Lives at `.claude/mcp_servers.json`. Lets Claude Code talk to your actual MongoDB instance.
4. **Domain skills.** Install the official MongoDB plugin with `/plugin install mongodb` from inside Claude Code.

This template ships the first three. Step 6 below enables the fourth.

## Quick start

### 1. Provision MongoDB Atlas (free forever)

Sign up at https://www.mongodb.com/cloud/atlas/register. The M0 tier is free forever, no credit card required. Create a cluster, create a database user, allow your IP, and grab the connection string.

For purely local development, MongoDB Community Edition on `mongodb://localhost:27017` works as well, but Atlas is recommended once you go beyond a single-machine prototype.

### 2. Set the connection string

```bash
export MONGODB_URI="mongodb+srv://USER:PASS@CLUSTER.mongodb.net/YOUR_DB_NAME"
```

Persist it in your shell profile so Claude Code's MCP server inherits it.

### 3. Customize `CLAUDE.md`

Open `CLAUDE.md` and replace `<your-db-name>` with the actual database name your application will use. Add any project-specific conventions (folder layout, error format, auth approach, team coding standards).

### 4. Customize `CONTEXT.md`

Fill in the four sections (Domain, Data sources, Access patterns, Constraints). The agent uses this to reason about your schema before it proposes one. The more specific you are about access patterns, the better the schema you get back.

### 5. Confirm the MCP wiring

`.claude/mcp_servers.json` reads the connection string from your shell's `MONGODB_URI`, which you set in Step 2. No edits needed in the default case. If you'd rather hardcode the URI inline (not recommended; easy to commit by accident), replace `${MONGODB_URI}` in the file with your Atlas connection string.

### 6. Install the MongoDB plugin

```bash
npm install
claude
```

Inside Claude Code:

```
/plugin install mongodb
```

That gives Claude Code seven MongoDB skills: schema design, natural language querying, query optimization, MCP setup, search with AI, connection configuration, and Atlas Stream Processing. Source at https://github.com/mongodb/agent-skills.

### 7. Start prompting
```
Read CLAUDE.md and CONTEXT.md, then propose a MongoDB schema for this application.
```

### 8. Scaffold an API

This step assumes you've filled in `CONTEXT.md`'s access patterns section. The prompt below asks Claude Code to build endpoints around those patterns; if the section is empty, you'll get generic CRUD instead.

Paste this:

```
Now build a working API on top of the schema you proposed.

1. Use the MongoDB MCP server to create the collections in my database
   and seed them with realistic sample data so I have something to
   query.

2. Scaffold an Express API in `server.js`. Use the official `mongodb`
   driver (already in package.json), ESM imports (the project is
   `"type": "module"`), and listen on port 3000.

3. Add one endpoint per access pattern listed in CONTEXT.md. Include
   at least one aggregation endpoint that answers an analytical
   question for this domain.

4. Add `express` to package.json and run `npm install`.

Show me the route list and the seed-data plan before you write any
code or run any MCP write operations.
```

Reading the plan before code lets you catch wrong sample-data assumptions or missing endpoints early. After you accept it, Claude Code creates the collections, writes the server, and starts it. The bonus below assumes this step ran and the server is on port 3000.

## Bonus: visualize what you build

Once you have a schema, a couple of endpoints, and an analytical query that returns interesting data, you are one prompt away from a working dashboard. The prompt below assumes you have at least one aggregation endpoint already in your API; if not, ask Claude Code to add one first (top-N by some field is a good starting point), then come back here.

Paste this into Claude Code exactly as written:

```
Add a GET /dashboard route to my Express server that serves a single
self-contained HTML page. The page should call the aggregation endpoint
I added to this API (read the server file to find the route path and
the response shape) and render the results as a small dashboard.

Use vanilla HTML, CSS, and JavaScript only. No build tools, no npm
installs, no external frameworks, no CDN links. Inline all CSS and
JavaScript in the HTML file. Serve the HTML as a string from the
route handler.

Style it with MongoDB's brand colors:
- forest green #00684A for primary elements
- spring green #00ED64 for accents
- charcoal #001E2B for text
- white background

Render summary numbers as cards at the top and any ranked or grouped
data as a simple HTML/CSS bar chart. Make it look polished and ready
to demo. Restart the server so Express picks up the new route.
```

Open `http://localhost:3000/dashboard` in your browser. The page should render with the data your aggregation returned. The leverage moment is in how little this prompt has to specify: the agent reads the existing server file, finds the route, infers the response shape, and writes the matching UI.


