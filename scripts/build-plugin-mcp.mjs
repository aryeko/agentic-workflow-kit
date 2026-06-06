import { chmod, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';

const repoRoot = process.cwd();
const outdir = path.join(repoRoot, 'mcp');
const outfile = path.join(outdir, 'server.mjs');

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

await chmod(outfile, 0o755);
