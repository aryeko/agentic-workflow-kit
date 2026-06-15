import { rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const coverageDir = process.env.AGENTIC_WORKFLOW_KIT_COVERAGE_DIR
  ? path.resolve(process.env.AGENTIC_WORKFLOW_KIT_COVERAGE_DIR)
  : path.join(repoRoot, 'coverage');

await rm(coverageDir, { recursive: true, force: true });
