import path from 'node:path';
import type { WorkflowRunAnalysis } from '../analysis/runAnalyzer.js';
import { analyzeWorkflowRun } from '../analysis/runAnalyzer.js';
import { exportWorkflowRunArtifacts } from '../analysis/runExport.js';
import { buildWorkflowRunReportMarkdown } from '../analysis/runReport.js';
import { resolveInvocationCwd } from '../cli/args.js';
import type { CliOverrides } from '../types.js';

import {
  assertRunExists,
  resolveRunDirectory,
  resolveSessionRoots,
  writeJsonFile,
  writeTextFile,
} from './handlerRuntimeUtils.js';
import type {
  WorkflowRunExportInput,
  WorkflowRunExportResult,
  WorkflowRunReportInput,
  WorkflowRunReportResult,
} from './handlerTypes.js';

export async function analyzeRunHandler(runPath: string, overrides: CliOverrides = {}): Promise<WorkflowRunAnalysis> {
  const resolvedRunPath = path.resolve(runPath);
  return await analyzeWorkflowRun(resolvedRunPath, {
    sessionRoots: await resolveSessionRoots(overrides, resolvedRunPath),
  });
}

export async function runReportHandler(input: WorkflowRunReportInput = {}): Promise<WorkflowRunReportResult> {
  const runDirectory = await resolveRunDirectory(input);
  await assertRunExists(runDirectory);
  const analysis = await analyzeWorkflowRun(runDirectory, {
    sessionRoots: await resolveSessionRoots(input, runDirectory),
  });
  const markdown = buildWorkflowRunReportMarkdown(analysis, runDirectory);
  const shouldWrite = input.write ?? true;
  if (shouldWrite) {
    await writeJsonFile(path.join(runDirectory, 'analysis.json'), analysis);
    await writeTextFile(path.join(runDirectory, 'report.md'), markdown);
  }
  return {
    runId: analysis.runId,
    artifactDir: runDirectory,
    format: input.format === 'markdown' ? 'markdown' : 'json',
    analysis,
    markdown,
    artifacts: {
      analysis: 'analysis.json',
      report: 'report.md',
    },
    written: shouldWrite,
  };
}

export async function runExportHandler(input: WorkflowRunExportInput = {}): Promise<WorkflowRunExportResult> {
  const runDirectory = await resolveRunDirectory(input);
  await assertRunExists(runDirectory);
  const report = await runReportHandler({ ...input, runPath: runDirectory, write: true });
  const outDirectory = input.out
    ? path.resolve(resolveInvocationCwd(input), input.out)
    : path.join(runDirectory, 'exports', 'latest');
  const include = input.include ?? 'summary';
  const files = await exportWorkflowRunArtifacts({ runDirectory, outDirectory, include });
  return {
    runId: report.runId,
    artifactDir: runDirectory,
    bundleDir: outDirectory,
    include,
    files,
  };
}
