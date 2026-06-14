#!/usr/bin/env node

import { realpathSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  projectInspectFacade,
  runExportFacade,
  runInspectFacade,
  runPreviewFacade,
  runReportFacade,
  runStatusFacade,
  runStreamFacade,
  trackerMigrateFacade,
  trackerValidateFacade,
} from './api/facade.js';
import { getHelpText, parseCommand } from './cli/args.js';
import {
  abortRunHandler,
  analyzeRunHandler,
  listEligibleHandler,
  listStoriesHandler,
  listTracksHandler,
  mcpCheckHandler,
  printableStories,
  runWorkflowHandler,
  watchRunHandler,
} from './commands/handlers.js';
import type { CodexMcpStoryRunnerOptions } from './drivers/codex-mcp/CodexMcpStoryRunner.js';
import { ConsoleLogger } from './logging/ConsoleLogger.js';
import type { CliOverrides, WorkflowStory, WorkflowTrack } from './types.js';

export interface RunCliOptions {
  stdout?: (line: string) => void;
  createCodexMcpClient?: CodexMcpStoryRunnerOptions['createClient'];
}

export async function runCli(argv = process.argv.slice(2), options: RunCliOptions = {}): Promise<void> {
  const command = parseCommand(argv);
  const logger = new ConsoleLogger();
  const stdout = options.stdout ?? console.log;

  if (command.kind === 'help') {
    stdout(getHelpText());
    return;
  }

  if (command.kind === 'analyze-run') {
    const analysis = await analyzeRunHandler(command.runPath, command.overrides);
    stdout(JSON.stringify(analysis, null, 2));
    return;
  }

  if (command.kind === 'watch-run') {
    await printRunSnapshot(command.runPath, command.overrides, stdout);
    return;
  }

  if (command.kind === 'abort-run') {
    const result = await abortRunHandler({
      runPath: command.runPath,
      storyId: command.overrides.storyId,
      reason: command.overrides.reason,
      requestedBy: 'cli',
    });
    stdout(JSON.stringify(result, null, 2));
    return;
  }

  if (command.kind === 'mcp-check') {
    const status = await mcpCheckHandler(command.overrides, options);
    if (command.overrides.json) {
      stdout(JSON.stringify(status, null, 2));
    } else {
      logger.info('Codex MCP schema check passed', { tools: status.tools });
    }
    return;
  }

  if (command.kind === 'project-inspect') {
    const envelope = await projectInspectFacade(command.overrides);
    stdout(JSON.stringify(envelope, null, 2));
    if (!envelope.ok) process.exitCode = 1;
    return;
  }

  if (command.kind === 'list-tracks') {
    const result = await listTracksHandler(command.overrides);
    printTracks(result.tracks, command.overrides, stdout);
    return;
  }

  if (command.kind === 'list-stories') {
    const result = await listStoriesHandler(command.overrides);
    printStories(result.stories, command.overrides, 'No stories found.', stdout);
    return;
  }

  if (command.kind === 'list-eligible') {
    const result = await listEligibleHandler(command.overrides);
    printStories(result.stories, command.overrides, 'No eligible stories.', stdout);
    return;
  }

  if (command.kind === 'tracker-validate') {
    const envelope = await trackerValidateFacade(command.overrides);
    stdout(JSON.stringify(envelope, null, 2));
    if (!envelope.ok || envelope.result.report.ok === false) process.exitCode = 1;
    return;
  }

  if (command.kind === 'tracker-migrate') {
    const envelope = await trackerMigrateFacade({ ...command.overrides, from: command.from, track: command.track });
    stdout(JSON.stringify(envelope, null, 2));
    if (!envelope.ok || envelope.result.report.ok === false) process.exitCode = 1;
    return;
  }
  if (command.kind === 'run-preview') {
    const envelope = await runPreviewFacade({ ...command.overrides, target: command.target });
    stdout(JSON.stringify(envelope, null, 2));
    if (!envelope.ok) process.exitCode = 1;
    return;
  }

  if (command.kind === 'run-status') {
    const input = runRefInput(command.runRef, command.overrides);
    const envelope = await runStatusFacade({
      ...command.overrides,
      ...input,
      events: { limit: command.overrides.limit },
    });
    stdout(JSON.stringify(envelope, null, 2));
    if (!envelope.ok) process.exitCode = 1;
    return;
  }

  if (command.kind === 'run-stream') {
    const input = runRefInput(command.runRef, command.overrides);
    const envelope = await runStreamFacade({
      ...command.overrides,
      ...input,
      subscription: { replay: { lastEvents: command.overrides.limit }, timeoutMs: command.overrides.timeoutMs },
    });
    if (command.overrides.format === 'ndjson' && envelope.ok) {
      for (const event of envelope.result.events) stdout(JSON.stringify(event));
      stdout(
        JSON.stringify({
          runId: envelope.result.runId,
          status: envelope.result.status,
          terminal: envelope.result.terminal,
        }),
      );
    } else {
      stdout(JSON.stringify(envelope, null, 2));
    }
    if (!envelope.ok) process.exitCode = 1;
    return;
  }

  if (command.kind === 'run-inspect') {
    const input = runRefInput(command.runRef, command.overrides);
    const envelope = await runInspectFacade({ ...command.overrides, ...input });
    stdout(JSON.stringify(envelope, null, 2));
    if (!envelope.ok) process.exitCode = 1;
    return;
  }

  if (command.kind === 'run-report') {
    const input = runRefInput(command.runRef, command.overrides);
    const envelope = await runReportFacade({ ...command.overrides, ...input });
    if (command.overrides.format === 'markdown' && envelope.ok) {
      stdout(envelope.result.markdown);
    } else {
      stdout(JSON.stringify(envelope, null, 2));
    }
    if (!envelope.ok) process.exitCode = 1;
    return;
  }

  if (command.kind === 'run-export') {
    const input = runRefInput(command.runRef, command.overrides);
    const envelope = await runExportFacade({
      ...command.overrides,
      ...input,
      include: command.overrides.exportInclude,
    });
    stdout(JSON.stringify(envelope, null, 2));
    if (!envelope.ok) process.exitCode = 1;
    return;
  }

  const result = await runWorkflowHandler(command, {
    logger,
    stdout,
    ...(options.createCodexMcpClient ? { createCodexMcpClient: options.createCodexMcpClient } : {}),
  });

  if (command.overrides.json) {
    stdout(JSON.stringify(result, null, 2));
  } else {
    logger.info('run finished', {
      runId: result.runId,
      status: result.status,
      completed: result.completed.map((child) => child.storyId),
      blockedStoryId: result.blockedStoryId,
      artifacts: result.artifactDir,
    });
  }

  if (result.status === 'blocked') {
    process.exitCode = 1;
  }
}

function runRefInput(runRef: string, overrides: CliOverrides): { runId?: string; runPath?: string } {
  if (path.isAbsolute(runRef) || runRef.includes('/') || runRef.startsWith('.')) {
    return { runPath: path.resolve(resolveCwdForRunRef(overrides), runRef) };
  }
  return { runId: runRef };
}

function resolveCwdForRunRef(overrides: CliOverrides): string {
  return overrides.cwd ? path.resolve(overrides.cwd) : process.cwd();
}

function printTracks(tracks: WorkflowTrack[], overrides: CliOverrides, stdout: (line: string) => void): void {
  if (overrides.json) {
    stdout(JSON.stringify(tracks, null, 2));
    return;
  }
  if (tracks.length === 0) {
    stdout('No tracks found.');
    return;
  }
  for (const track of tracks) {
    const eligibleCount = track.stories.filter((story) => story.eligible).length;
    stdout(`${track.id} ${track.title} (${eligibleCount}/${track.stories.length} eligible)`);
  }
}

function printStories(
  stories: WorkflowStory[],
  overrides: CliOverrides,
  emptyMessage: string,
  stdout: (line: string) => void,
): void {
  const printable = printableStories(stories, overrides);
  if (overrides.json) {
    stdout(JSON.stringify(printable, null, 2));
    return;
  }
  if (printable.length === 0) {
    stdout(emptyMessage);
    return;
  }
  for (const story of printable) {
    const title = story.title ? ` ${story.title}` : '';
    stdout(`${story.id}${title} [${story.status}]`);
  }
}

async function printRunSnapshot(
  runDirectory: string,
  overrides: CliOverrides,
  stdout: (line: string) => void,
): Promise<void> {
  const snapshot = await watchRunHandler(runDirectory, overrides);
  if (overrides.json) {
    stdout(JSON.stringify(snapshot, null, 2));
    return;
  }
  stdout(`Run: ${runDirectory}`);
  stdout(JSON.stringify(snapshot, null, 2));
}

if (isDirectCliExecution()) {
  runCli().catch((error: unknown) => {
    const logger = new ConsoleLogger();
    logger.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

export function isDirectCliExecution(entrypoint = process.argv[1], moduleUrl = import.meta.url): boolean {
  if (entrypoint === undefined) return false;
  try {
    return realpathSync(entrypoint) === realpathSync(fileURLToPath(moduleUrl));
  } catch {
    return false;
  }
}
