import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => readFileSync(join(root, name), 'utf8');

test('instructions, dependencies and optional MCP configuration align', () => {
  assert.equal(read('CLAUDE.md'), '@AGENTS.md\n');
  assert.match(read('AGENTS.md'), /MONGODB_DB/);
  const pkg = JSON.parse(read('package.json'));
  for (const dep of ['express', 'mongodb', 'csv-parse']) assert.ok(pkg.dependencies[dep]);
  assert.equal(pkg.type, 'module');
  assert.equal(JSON.parse(read('samples/data/package.json')).type, 'commonjs');
  const mcp = JSON.parse(read('.mcp.json.example')).mcpServers.mongodb;
  assert.equal(mcp.command, 'npx');
  assert.deepEqual(mcp.args, ['-y', 'mongodb-mcp-server']);
  assert.equal(mcp.env.MDB_MCP_CONNECTION_STRING, '${MONGODB_URI}');
  assert.equal(existsSync(join(root, '.mcp.json')), false, 'standalone MCP should be opt-in');
});

for (const scenario of ['financial', 'retail', 'healthcare']) {
  test(`${scenario} generation and staging work under the ESM root`, () => {
    const temp = mkdtempSync(join(tmpdir(), 'mongodb-starter-'));
    try {
      for (const item of ['package.json', 'scripts', 'samples']) {
        cpSync(join(root, item), join(temp, item), { recursive: true });
      }
      const run = (...args) => spawnSync(process.execPath,
        [join(temp, 'scripts/select-scenario.js'), ...args], { cwd: temp, encoding: 'utf8' });
      const result = run(scenario);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(readFileSync(join(temp, 'CONTEXT.md'), 'utf8'), read(`samples/CONTEXT-${scenario}.md`));
      const csvs = readdirSync(join(temp, 'data')).filter(n => n.endsWith('.csv'));
      assert.ok(csvs.includes('audit_log.csv'));
      assert.ok(csvs.length >= 5);
      for (const file of csvs) {
        assert.equal(readFileSync(join(temp, 'data', file), 'utf8'),
          readFileSync(join(temp, 'samples/data', scenario, file), 'utf8'));
      }
      const first = readFileSync(join(temp, 'data/audit_log.csv'), 'utf8');
      assert.notEqual(run(scenario).status, 0, 'populated data must require approval');
      writeFileSync(join(temp, 'data/notes.txt'), 'preserve me');
      writeFileSync(join(temp, 'data/stale.csv'), 'old dataset');
      assert.equal(run(scenario, '--replace').status, 0);
      assert.equal(readFileSync(join(temp, 'data/notes.txt'), 'utf8'), 'preserve me');
      assert.equal(existsSync(join(temp, 'data/stale.csv')), false);
      assert.equal(readFileSync(join(temp, 'data/audit_log.csv'), 'utf8'), first);
      assert.notEqual(run('invalid').status, 0);
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });
}
