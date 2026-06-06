import { chmod, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';

const repoRoot = process.cwd();
const outdir = path.join(repoRoot, 'mcp');
const outfile = path.join(outdir, 'server.mjs');
const fixtureOutdir = path.join(repoRoot, 'plugins/agentic-workflow-kit/mcp');
const fixtureOutfile = path.join(fixtureOutdir, 'server.mjs');

await mkdir(outdir, { recursive: true });

await build({
  entryPoints: [path.join(repoRoot, 'packages/orchestrator/src/mcp/server.ts')],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: ['node24'],
  banner: {
    js: 'import { createRequire as __agenticWorkflowKitCreateRequire } from "node:module"; const require = __agenticWorkflowKitCreateRequire(import.meta.url);',
  },
  sourcemap: false,
});

await trimTrailingWhitespace(outfile);
await chmod(outfile, 0o755);
await mkdir(fixtureOutdir, { recursive: true });
await copyFile(outfile, fixtureOutfile);
await chmod(fixtureOutfile, 0o755);

async function trimTrailingWhitespace(file) {
  const source = await readFile(file, 'utf8');
  await writeFile(file, source.replace(/[ \t]+$/gm, ''));
}
