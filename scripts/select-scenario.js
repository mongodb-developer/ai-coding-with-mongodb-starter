#!/usr/bin/env node
// Generate and stage a workshop scenario without changing the database.
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scenario = process.argv[2];
const replace = process.argv.includes('--replace');
if (!['financial', 'retail', 'healthcare'].includes(scenario)) {
  console.error('Usage: npm run scenario -- <financial|retail|healthcare> [--replace]');
  process.exit(1);
}
const target = join(root, 'data');
if (existsSync(target) && readdirSync(target).length && !replace) {
  console.error('data/ is not empty. Review its contents; use --replace to replace staged CSVs.');
  process.exit(1);
}
const source = join(root, 'samples', 'data', scenario);
const result = spawnSync(process.execPath, [join(source, 'generate.js')], {
  cwd: root, stdio: 'inherit',
});
if (result.status !== 0) process.exit(result.status ?? 1);
// --replace removes only staged CSVs; never delete unrelated learner files.
if (replace && existsSync(target)) {
  const { unlinkSync } = await import('node:fs');
  for (const name of readdirSync(target)) {
    if (name.endsWith('.csv')) unlinkSync(join(target, name));
  }
}
mkdirSync(target, { recursive: true });
for (const name of readdirSync(source)) {
  if (name.endsWith('.csv')) copyFileSync(join(source, name), join(target, name));
}
copyFileSync(join(root, 'samples', `CONTEXT-${scenario}.md`), join(root, 'CONTEXT.md'));
console.log(`Staged ${scenario} CSVs in data/ and updated CONTEXT.md. No database changes made.`);
