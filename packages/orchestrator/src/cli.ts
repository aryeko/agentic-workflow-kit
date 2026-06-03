#!/usr/bin/env node

import { realpathSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { analyzeWorkflowRun } from './analysis/runAnalyzer.js';
import { FileArtifactStore } from './artifacts/FileArtifactStore.js';
import { getHelpText, parseCommand, resolveInvocationCwd } from './cli/args.js';
import { SystemClock } from './clock/SystemClock.js';
import { createRunId, loadResolvedConfig, resolveCwdOnlyConfig } from './config/configLoader.js';
import { CodexMcpStoryRunner, type CodexMcpStoryRunnerOptions } from './drivers/codex-mcp/CodexMcpStoryRunner.js';
import { RealGitInspector } from './git/GitInspector.js';
import { ConsoleLogger } from './logging/ConsoleLogger.js';
import { WorkflowRunner } from './runner/WorkflowRunner.js';
import { selectDispatchableStories } from './scheduler/scheduler.js';
import { discoverMarkdownTracks, EmptyStorySource, MarkdownTrackStorySource } from './tracks/markdownTracker.js';
import type { CliOverrides, ResolvedWorkflowConfig, StorySource, WorkflowStory, WorkflowTrack } from './types.js';

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
    const analysis = await analyzeWorkflowRun(path.resolve(command.runPath), {
      sessionRoots: command.overrides.sessionRoot ? [path.resolve(command.overrides.sessionRoot)] : undefined,
    });
    stdout(JSON.stringify(analysis, null, 2));
    return;
  }

  if (command.kind === 'watch-run') {
    await printRunSnapshot(path.resolve(command.runPath), command.overrides, stdout);
    return;
  }

  const cwd = resolveInvocationCwd(command.overrides);

  if (command.kind === 'mcp-check') {
    const storyRunner = new CodexMcpStoryRunner(resolveCwdOnlyConfig(cwd), {
      ...(options.createCodexMcpClient ? { createClient: options.createCodexMcpClient } : {}),
    });
    const status = await storyRunner.checkTools();
    if (command.overrides.json) {
      stdout(JSON.stringify(status, null, 2));
    } else {
      logger.info('Codex MCP schema check passed', { tools: status.tools });
    }
    return;
  }

  const config = await loadResolvedConfig(command.overrides, cwd);
  const tracks = await discoverTracks(config, command.overrides);

  if (command.kind === 'list-tracks') {
    printTracks(tracks, command.overrides);
    return;
  }

  if (command.kind === 'list-stories') {
    const stories = command.overrides.track
      ? selectTrack(tracks, command.overrides.track).stories
      : tracks.flatMap((track) => track.stories);
    printStories(stories, command.overrides, 'No stories found.');
    return;
  }

  if (command.kind === 'list-eligible') {
    const stories = command.overrides.track
      ? selectTrack(tracks, command.overrides.track).stories
      : tracks.flatMap((track) => track.stories);
    const eligible = stories.filter((story) => story.eligible);
    printStories(eligible, command.overrides, 'No eligible stories.');
    return;
  }

  const runId = createRunId();
  const runDirectory = path.join(config.artifacts.runsDirAbs, runId);
  const storySource =
    command.kind === 'run-story'
      ? selectStorySourceForStory(config, tracks, command.storyId, command.overrides)
      : selectStorySourceForRunEligible(config, tracks, command.overrides);
  const workflowRunner = new WorkflowRunner({
    command: command.kind,
    config,
    storySource,
    storyRunner: new CodexMcpStoryRunner(config),
    gitInspector: new RealGitInspector(),
    artifactStore: new FileArtifactStore(runDirectory),
    logger,
    clock: new SystemClock(),
    runId,
  });

  const run =
    command.kind === 'run-story'
      ? workflowRunner.runStory(command.storyId, { force: command.overrides.force })
      : command.overrides.dryRun
        ? workflowRunner.dryRunEligible()
        : workflowRunner.runEligible();
  const result = command.overrides.watch ? await runWithEventWatch(run, runDirectory, command.overrides) : await run;

  if (command.overrides.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    logger.info('run finished', {
      runId: result.runId,
      status: result.status,
      completed: result.completed.map((child) => child.storyId),
      blockedStoryId: result.blockedStoryId,
      artifacts: runDirectory,
    });
  }

  if (result.status === 'blocked') {
    process.exitCode = 1;
  }
}

async function discoverTracks(config: ResolvedWorkflowConfig, overrides: CliOverrides): Promise<WorkflowTrack[]> {
  return await discoverMarkdownTracks({
    workspaceRoot: config.workspace.rootAbs,
    tracksDir: overrides.tracksDir ?? config.paths.tracksDir,
    archiveDir: config.paths.archiveDir,
    completeStatuses: config.statuses.complete,
    eligibleStatuses: config.statuses.eligible,
    idPattern: config.tracker.idPattern,
  });
}

function selectStorySourceForRunEligible(
  config: ResolvedWorkflowConfig,
  tracks: WorkflowTrack[],
  overrides: CliOverrides,
): StorySource {
  if (overrides.track) {
    const track = selectTrack(tracks, overrides.track);
    return new MarkdownTrackStorySource(trackOptions(config, overrides), track.id);
  }

  const eligibleTracks = tracks.filter((track) => track.stories.some((story) => story.eligible));
  if (eligibleTracks.length === 0) return new EmptyStorySource();
  if (eligibleTracks.length > 1) {
    throw new Error(
      `multiple tracks have eligible stories: ${eligibleTracks.map((track) => track.id).join(', ')}; pass --track <id>`,
    );
  }

  return new MarkdownTrackStorySource(trackOptions(config, overrides), eligibleTracks[0].id);
}

function selectStorySourceForStory(
  config: ResolvedWorkflowConfig,
  tracks: WorkflowTrack[],
  storyId: string,
  overrides: CliOverrides,
): StorySource {
  if (overrides.track) {
    const track = selectTrack(tracks, overrides.track);
    return new MarkdownTrackStorySource(trackOptions(config, overrides), track.id);
  }

  const matchingTracks = tracks.filter((track) => track.stories.some((story) => story.id === storyId));
  if (matchingTracks.length === 0) return new EmptyStorySource();
  if (matchingTracks.length > 1) {
    throw new Error(
      `story ${storyId} exists in multiple tracks: ${matchingTracks.map((track) => track.id).join(', ')}; pass --track <id>`,
    );
  }

  return new MarkdownTrackStorySource(trackOptions(config, overrides), matchingTracks[0].id);
}

function selectTrack(tracks: WorkflowTrack[], trackId: string): WorkflowTrack {
  const track = tracks.find((entry) => entry.id === trackId);
  if (!track) throw new Error(`track ${trackId} was not found`);
  return track;
}

function trackOptions(
  config: ResolvedWorkflowConfig,
  overrides: CliOverrides,
): {
  workspaceRoot: string;
  tracksDir: string;
  archiveDir: string;
  completeStatuses: string[];
  eligibleStatuses: string[];
  idPattern: string;
} {
  return {
    workspaceRoot: config.workspace.rootAbs,
    tracksDir: overrides.tracksDir ?? config.paths.tracksDir,
    archiveDir: config.paths.archiveDir,
    completeStatuses: config.statuses.complete,
    eligibleStatuses: config.statuses.eligible,
    idPattern: config.tracker.idPattern,
  };
}

function printTracks(tracks: WorkflowTrack[], overrides: CliOverrides): void {
  if (overrides.json) {
    console.log(JSON.stringify(tracks, null, 2));
    return;
  }
  if (tracks.length === 0) {
    console.log('No tracks found.');
    return;
  }
  for (const track of tracks) {
    const eligibleCount = track.stories.filter((story) => story.eligible).length;
    console.log(`${track.id} ${track.title} (${eligibleCount}/${track.stories.length} eligible)`);
  }
}

function printStories(stories: WorkflowStory[], overrides: CliOverrides, emptyMessage: string): void {
  const limited = selectDispatchableStories(stories, {
    maxParallel: overrides.maxParallel ?? stories.length,
  });
  const printable = overrides.maxParallel ? limited : stories;
  if (overrides.json) {
    console.log(JSON.stringify(printable, null, 2));
    return;
  }
  if (printable.length === 0) {
    console.log(emptyMessage);
    return;
  }
  for (const story of printable) {
    const title = story.title ? ` ${story.title}` : '';
    console.log(`${story.id}${title} [${story.status}]`);
  }
}

async function printRunSnapshot(
  runDirectory: string,
  overrides: CliOverrides,
  stdout: (line: string) => void,
): Promise<void> {
  const [state, metrics] = await Promise.all([
    readJsonIfExists(path.join(runDirectory, 'state.json')),
    readJsonIfExists(path.join(runDirectory, 'metrics.live.json')),
  ]);
  const snapshot = { state, metrics };
  if (overrides.json) {
    stdout(JSON.stringify(snapshot, null, 2));
    return;
  }
  stdout(`Run: ${runDirectory}`);
  stdout(JSON.stringify(snapshot, null, 2));
}

async function runWithEventWatch<T>(run: Promise<T>, runDirectory: string, overrides: CliOverrides): Promise<T> {
  let done = false;
  const watch = watchRunEvents(runDirectory, overrides, () => done);
  try {
    const result = await run;
    done = true;
    await watch;
    return result;
  } catch (error) {
    done = true;
    await watch;
    throw error;
  }
}

async function watchRunEvents(runDirectory: string, overrides: CliOverrides, isDone: () => boolean): Promise<void> {
  const eventPath = path.join(runDirectory, 'events.ndjson');
  let printed = 0;
  while (!isDone()) {
    printed = await printNewEvents(eventPath, printed, overrides);
    await delay(250);
  }
  await printNewEvents(eventPath, printed, overrides);
}

async function printNewEvents(eventPath: string, printed: number, overrides: CliOverrides): Promise<number> {
  let content: string;
  try {
    content = await readFile(eventPath, 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return printed;
    throw error;
  }
  const lines = content.trimEnd().split('\n').filter(Boolean);
  for (const line of lines.slice(printed)) {
    if (overrides.json) {
      console.log(line);
    } else {
      const event = JSON.parse(line) as { type?: unknown; ts?: unknown; storyId?: unknown; status?: unknown };
      const story = typeof event.storyId === 'string' ? ` ${event.storyId}` : '';
      const status = typeof event.status === 'string' ? ` ${event.status}` : '';
      console.log(`${String(event.ts ?? '')} ${String(event.type ?? 'event')}${story}${status}`.trim());
    }
  }
  return lines.length;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readJsonIfExists(filePath: string): Promise<unknown | null> {
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as unknown;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }
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
