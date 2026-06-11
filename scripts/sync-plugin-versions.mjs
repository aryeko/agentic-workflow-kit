import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Single source of truth: the orchestrator package version produced by `changeset version`.
// Changesets only versions npm packages, so the plugin manifests and marketplace metadata are
// synced here to keep the published runtime and the plugin surface in lockstep.
const repoRoot = process.cwd();
const { version } = JSON.parse(
  await readFile(path.join(repoRoot, 'packages/orchestrator/package.json'), 'utf8'),
);
if (!version) throw new Error('no version found in packages/orchestrator/package.json');

// Each target carries exactly one relevant "version" field (top-level for manifests, the
// agentic-workflow-kit plugin entry for the Claude marketplace); replace the first match so file
// formatting stays byte-identical.
const targets = [
  'package.json',
  '.claude-plugin/plugin.json',
  '.codex-plugin/plugin.json',
  'plugins/agentic-workflow-kit/.codex-plugin/plugin.json',
  '.claude-plugin/marketplace.json',
];

const versionField = /("version":\s*)"[^"]*"/;
let changed = 0;
for (const relative of targets) {
  const file = path.join(repoRoot, relative);
  const source = await readFile(file, 'utf8');
  if (!versionField.test(source)) throw new Error(`no "version" field found in ${relative}`);
  const next = source.replace(versionField, `$1"${version}"`);
  if (next !== source) {
    await writeFile(file, next);
    changed += 1;
    console.log(`synced ${relative} -> ${version}`);
  }
}

for (const relative of [
  '.mcp.json',
  '.codex-plugin/.mcp.json',
  'plugins/agentic-workflow-kit/.codex-plugin/.mcp.json',
  'plugins/agentic-workflow-kit/.mcp.json',
]) {
  const packageSpecifier = /@agentic-workflow-kit\/orchestrator@[^"]*/g;
  const file = path.join(repoRoot, relative);
  const source = await readFile(file, 'utf8');
  if (!packageSpecifier.test(source)) throw new Error(`no orchestrator package specifier found in ${relative}`);
  const next = source.replace(packageSpecifier, `@agentic-workflow-kit/orchestrator@${version}`);
  if (next !== source) {
    await writeFile(file, next);
    changed += 1;
    console.log(`synced ${relative} MCP package -> ${version}`);
  }
}
console.log(`plugin version sync complete (${version}); ${changed} file(s) updated`);
