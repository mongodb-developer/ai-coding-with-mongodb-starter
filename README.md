# AI Coding with MongoDB: starter template

Take the full workshop workflow into your own project: **project conventions →
schema design → driver import → API → live inspection and aggregation with MCP**.
The workshop uses a short `AGENTS.md`; this repo includes the full take-home
conventions for connections, modeling, safety, verification, and Git.

## The four levers

- **Project instructions:** `AGENTS.md` contains shared rules. `CLAUDE.md`
  contains only `@AGENTS.md`, importing them for this starter's current agent.
  Instructions guide behavior; they do not enforce correctness or security.
- **Project context:** `CONTEXT.md` describes the domain, data, access patterns,
  and constraints. Existing code and dependencies help the agent stay on stack.
- **Agent Skills:** reusable task-specific MongoDB guidance. Review the output
  against your requirements even when a Skill was used.
- **MCP:** lets the agent inspect and query your running database. Application
  and import code still use the MongoDB driver.

The exercises are agent-neutral. The launch and plugin commands below use
Claude Code, the workshop's current workbench; other agents need their own
instruction-loading, Skill, and MCP configuration.

## 1. Prepare your environment

Install Node.js 20+ and your coding agent. Configure model access using that
agent's supported authentication method. **The Instruqt workshop passkey and
sandbox credential scripts are not used by this starter.**

Use MongoDB Atlas or a local MongoDB instance. For Atlas, create a cluster,
database user, and appropriate network access at
https://www.mongodb.com/cloud/atlas/register. Use a disposable development
database for these exercises, not a production database.

Set the connection configuration in the shell from which you launch the agent:

```bash
# Local workshop replay:
export MONGODB_URI='mongodb://localhost:27017/workshop'
export MDB_MCP_CONNECTION_STRING="$MONGODB_URI"
export MONGODB_DB='workshop'

# Atlas alternative: set MONGODB_URI to your private connection string.
# Keep credentials outside Git and avoid placing real secrets in shell history.
```

The app uses `MONGODB_URI` and `MONGODB_DB`; the plugin's MCP server uses
`MDB_MCP_CONNECTION_STRING`. All must point to the same intended database.

Install the application dependencies:

```bash
npm install
```

The repo includes Express, the official MongoDB driver, and `csv-parse`.
Application code uses ESM imports; sample generators have their own CommonJS
package boundary.

## 2. Set conventions and select your context

Read `AGENTS.md`. Replace `<your-db-name>` with your chosen database name and
adapt its layout, stack, deployment, and verification rules. Keep `CLAUDE.md`
as the single-line import. Do not put secrets in either file.

For a workshop replay, pick a scenario:

```bash
npm run scenario -- retail
# Or: financial / healthcare
```

This generates deterministic CSVs in `samples/data/<scenario>/`, copies them
into `data/`, and replaces `CONTEXT.md` with the corresponding sample context.
It does **not** import or modify MongoDB. Save any custom `CONTEXT.md` first.
If `data/` is already populated, the command refuses to replace it unless you
explicitly pass `--replace`. That option replaces staged CSVs only, not other
files or database contents.

For your own application, instead fill in the Domain, Data sources, Access
patterns, and Constraints sections of `CONTEXT.md` and supply your source data.
Sample context and generator sources match the full workshop's datasets,
including the shared `audit_log` entity.

## 3. Enable MongoDB Agent Skills and MCP

Start the current workbench from the repository root:

```bash
claude
```

Install the MongoDB plugin inside the agent:

```text
/plugin install mongodb@claude-plugins-official
/reload-plugins
```

The current plugin bundles **both Skills and an MCP server**. With
`MDB_MCP_CONNECTION_STRING` set before launch, no project MCP configuration is
needed. Confirm the plugin is enabled with `/plugins` and connected with `/mcp`.
Ask the agent:

```text
What MongoDB Agent Skills are available? Describe what each one does.
```

Names and counts depend on the installed release. Source:
https://github.com/mongodb/agent-skills.

### Alternative: standalone MCP

`.mcp.json.example` is a standalone configuration using `npx -y mongodb-mcp-server`,
which downloads the package on first use and reads `MONGODB_URI`. Network
access is required on first launch. **Do not run it alongside the plugin's
bundled MCP server unless you intentionally want two connections.**

For the default plugin setup, leave the example inactive. For standalone MCP:

```bash
cp .mcp.json.example .mcp.json
```

Disable the bundled MongoDB plugin when using the standalone configuration;
install portable Skills separately if needed. Review the agent's project-MCP
approval prompt. Never hardcode a credential-bearing URI in the configuration.
For repeatable deployments, pin and rehearse the MCP package and plugin versions.

## 4. Design the schema, then import with the driver

Send this prompt to the agent:

```text
Read AGENTS.md and CONTEXT.md, especially the application access patterns.
Propose a MongoDB document model that serves every pattern, not one collection
per normalized CSV. Use relevant MongoDB Skills.

For each collection, show fields with types and examples, explain embedding
vs. referencing, and propose indexes tied to queries. Include at least one
compound index.

For the sample scenarios, also support the most recent 20 audit_log entries
for a subject, sorted by event_date descending. Keep audit_log append-only and
index (subject_id, event_date desc).

Ask clarifying questions. Do not write import code or change the database yet.
```

Review the proposal. Check access-pattern coverage, embedding boundaries, and
index choices. Push back where the rationale is incomplete.

Once approved, request the import:

```text
Write import.js using ESM imports, the mongodb driver, and csv-parse to read
./data/*.csv and transform rows into the approved document model.
Read MONGODB_URI and MONGODB_DB from the environment. Validate both.
Create the proposed indexes and print inserted counts per collection.

Make reruns safe for this disposable development database. Show me exactly
which collections would be replaced, and ask for approval before dropping or
replacing their data. Do not touch unrelated collections or source CSVs.
Then run the approved import and report the results.
```

The driver is correct here: importing is application/ETL code. MCP's distinct
payoff comes when the agent inspects and tests against the actual database.

## 5. Build and test the API with Skills

```text
Build server.js using Express, ESM imports, and the official mongodb driver.
Use MONGODB_URI and MONGODB_DB, the approved schema and indexes, and relevant
MongoDB Skills. Listen on port 3000. Connect one MongoClient at startup.

Read CONTEXT.md and map each endpoint to an access pattern:
- GET /health: 200 with { "status": "ok" } when MongoDB is reachable.
- A primary list endpoint returning a JSON array, with filtering, sorting,
  and pagination (default 20, max 100).
- A detail endpoint returning the full document, or 404 if not found.
- A related-data endpoint serving the main read-heavy access pattern.
- A POST endpoint validating input and returning 201, or 400 on bad input.
- For sample scenarios, GET /subjects/:subject_id/audit-log returning
  log_id, event_date, event_type, actor, and details. Support event_type,
  since (ISO date), limit (default 20, max 100), and offset; sort newest first.

Match identifier types to the imported data; do not assume every id is ObjectId.
Use 400 for invalid input, 404 for missing data, and 500 for unexpected errors.
Show the route plan, implement it, start the server, and test each endpoint.
```

Review the code and test responses yourself. From another terminal:

```bash
curl -fsS http://localhost:3000/health
# Substitute routes and a real identifier returned by your API:
curl -fsS 'http://localhost:3000/<list-route>?limit=5'
curl -fsS 'http://localhost:3000/<detail-route>/<real-id>'
```

`npm start` runs the server; restart it after code changes. `npm run dev`
explicitly enables Node's watch mode if you prefer hot reload. Neither process
is started automatically just because the agent generated a file.

## 6. Use MCP to inspect real data and add an aggregation

```text
Use MongoDB MCP—not assumptions from CONTEXT.md or import.js—to list the live
collections, counts, and indexes, and sample documents. Tell me one thing you
learned that those project files could not establish.
```

For the sample scenarios:

```text
Add GET /reports/top-active-subjects to server.js. Return the 10 subjects with
the most audit_log events: subject_id, total_events, and a counts object
mapping event_type to count, sorted by total_events descending.

Use MCP to inspect the fields, construct and run the aggregation against live
data, and show me the pipeline before adding it to the API. Use MongoDB's
aggregation framework, not find() plus JavaScript reduction. After approval,
add the working pipeline, restart the API, and test the endpoint.
```

For your own domain, choose an analytical question from its access patterns.
Then review performance with evidence:

```text
Use MCP to run explain on the pipeline. Report scan counts, timing where
available, and relevant stages. Would an index actually help this query?
If justified, propose it, create it after approval, and re-run explain.
Otherwise explain why the current plan is reasonable. Do not create an index
just to replace COLLSCAN with IXSCAN.
```

A full-collection aggregation may legitimately scan all documents; sorting
computed totals after `$group` cannot usually be fixed with an input index.
Seeded data spans several years, so narrow date filters may return nothing.
Check date ranges before interpreting an empty result as a bug.

```bash
curl -fsS http://localhost:3000/reports/top-active-subjects
```

## Bonus: visualize the result

```text
Add GET /dashboard serving a self-contained HTML page that calls the
aggregation endpoint already in server.js and displays its result.
Use vanilla HTML, inline CSS and JavaScript, with no frameworks, CDN links,
or new dependencies. Use MongoDB colors: forest green #00684A, spring green
#00ED64, charcoal #001E2B, and white. Show summary cards and a ranked/grouped
bar chart. Restart the server so the route is available.
```

Open http://localhost:3000/dashboard and verify the page against the API output.

## Delegate Git work deliberately

`AGENTS.md` defines Git rules: no push without an explicit instruction, no
amending pushed commits, and confirmation before destructive operations.

```text
Stage my changes and commit with a concise explanation of why. Don't push.
```

```text
Create a feature branch called feature/<short-name>. Preserve my existing
changes and stage nothing until I ask.
```

```text
Push this branch and open a PR with a concise summary and test plan.
```

Review the diff, commit message, and test results before accepting them.

## Verification and differences from Instruqt

```bash
npm test
```

Offline tests validate the configuration and run all three scenario generators
in disposable directories. They do not call an LLM or connect to MongoDB.

This repo is a take-home starter, not a prebuilt sandbox: you provide Node,
MongoDB, agent authentication, and any editor. There is no Instruqt Check or
Skip button. Local/Atlas connection configuration replaces the fixed sandbox
connection, and ESM replaces the sandbox scaffold's default CommonJS app code.
The modeling, driver, Skills, MCP, and human-review workflow stays the same.
