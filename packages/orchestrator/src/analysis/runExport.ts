import { copyFile, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface RunExportCopyResult {
  source: string;
  target: string | null;
  status: 'copied' | 'missing' | 'skipped' | 'truncated';
  reason: string | null;
  sizeBytes: number | null;
}

const ROOT_ARTIFACTS = [
  'run.json',
  'config.resolved.json',
  'state.json',
  'metrics.live.json',
  'events.ndjson',
  'summary.json',
  'rows.json',
  'budgets.json',
  'transcripts.json',
  'analysis.json',
  'report.md',
];

const MAX_EXPORT_FILE_BYTES = 1_000_000;

export async function exportWorkflowRunArtifacts(input: {
  runDirectory: string;
  outDirectory: string;
  include: 'summary' | 'full-bounded';
}): Promise<RunExportCopyResult[]> {
  const results: RunExportCopyResult[] = [];
  await mkdir(input.outDirectory, { recursive: true });
  await clearKnownExportOutputs(input.outDirectory);
  for (const relativePath of ROOT_ARTIFACTS) {
    results.push(await copyApprovedArtifact(input.runDirectory, input.outDirectory, relativePath, input.include));
  }
  const childDirectory = path.join(input.runDirectory, 'children');
  let childEntries: string[];
  try {
    childEntries = await readdir(childDirectory);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return results;
    throw error;
  }
  for (const entry of childEntries.sort()) {
    const relativePath = path.join('children', entry);
    if (!entry.endsWith('.json') || entry.endsWith('.raw.json')) {
      results.push({
        source: relativePath,
        target: null,
        status: 'skipped',
        reason: 'export excludes raw child payloads and non-json child artifacts by default',
        sizeBytes: null,
      });
      continue;
    }
    results.push(await copyApprovedArtifact(input.runDirectory, input.outDirectory, relativePath, input.include));
  }
  return results;
}

async function clearKnownExportOutputs(outDirectory: string): Promise<void> {
  await Promise.all([
    ...ROOT_ARTIFACTS.map((relativePath) => rm(path.join(outDirectory, relativePath), { force: true })),
    rm(path.join(outDirectory, 'children'), { recursive: true, force: true }),
  ]);
}

async function copyApprovedArtifact(
  runDirectory: string,
  outDirectory: string,
  relativePath: string,
  include: 'summary' | 'full-bounded',
): Promise<RunExportCopyResult> {
  const sourcePath = path.join(runDirectory, relativePath);
  const targetPath = path.join(outDirectory, relativePath);
  let stats: { size: number };
  try {
    stats = await stat(sourcePath);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return { source: relativePath, target: null, status: 'missing', reason: 'artifact is absent', sizeBytes: null };
    }
    throw error;
  }
  if (include === 'summary' && relativePath === 'events.ndjson') {
    return {
      source: relativePath,
      target: null,
      status: 'skipped',
      reason: 'summary export omits event log; use full-bounded to include bounded events',
      sizeBytes: stats.size,
    };
  }
  await mkdir(path.dirname(targetPath), { recursive: true });
  if (stats.size > MAX_EXPORT_FILE_BYTES) {
    await writeFile(targetPath, `{"truncated":true,"source":"${relativePath}","originalSizeBytes":${stats.size}}\n`);
    return {
      source: relativePath,
      target: path.relative(outDirectory, targetPath),
      status: 'truncated',
      reason: `artifact exceeded ${MAX_EXPORT_FILE_BYTES} bytes`,
      sizeBytes: stats.size,
    };
  }
  await copyFile(sourcePath, targetPath);
  return {
    source: relativePath,
    target: path.relative(outDirectory, targetPath),
    status: 'copied',
    reason: null,
    sizeBytes: stats.size,
  };
}
