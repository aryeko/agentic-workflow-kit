import path from 'node:path';
import process from 'node:process';
import { Command, CommanderError, InvalidArgumentError, Option } from 'commander';
import { assertRepoRelativePath } from '../config/schema.js';
import type { ApprovalPolicy, CliOverrides, SandboxMode, WorkflowCommand, WorkflowRunPreviewTarget } from '../types.js';

const APPROVAL_POLICIES = new Set<ApprovalPolicy>(['untrusted', 'on-failure', 'on-request', 'never']);
const SANDBOX_MODES = new Set<SandboxMode>(['read-only', 'workspace-write', 'danger-full-access']);

export function parseCommand(argv: string[]): WorkflowCommand {
  const args = argv.filter((arg) => arg !== '--');
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    return { kind: 'help' };
  }
  if (args.length === 1 && args[0] === '--version') {
    return { kind: 'version', overrides: {} };
  }
  if (args[0].startsWith('-')) {
    throw new Error(`Unknown command: ${args[0]}`);
  }
  if (args[0] === 'mcp' && args[1] !== 'check') {
    throw new Error('Expected `mcp check`');
  }
  if (args[0] === 'tracker' && args[1] !== 'validate' && args[1] !== 'migrate') {
    throw new Error('Expected `tracker validate` or `tracker migrate`');
  }
  if (args[0] === 'config' && args[1] !== 'status' && args[1] !== 'upgrade') {
    throw new Error('Expected `config status` or `config upgrade`');
  }
  if (args[0] === 'project' && args[1] !== 'inspect') {
    throw new Error('Expected `project inspect`');
  }
  if (args[0] === 'run' && !['preview', 'status', 'stream', 'inspect', 'report', 'export'].includes(args[1] ?? '')) {
    throw new Error('Expected `run preview`, `run status`, `run stream`, `run inspect`, `run report`, or `run export`');
  }
  if (args[0] === 'run-story' && (!args[1] || args[1].startsWith('-'))) {
    throw new Error('run-story requires a story id');
  }
  if (args[0] === 'watch-run' && (!args[1] || args[1].startsWith('-'))) {
    throw new Error('watch-run requires a run directory');
  }
  if (args[0] === 'abort-run' && (!args[1] || args[1].startsWith('-'))) {
    throw new Error('abort-run requires a run directory');
  }
  if (args[0] === 'analyze-run' && (!args[1] || args[1].startsWith('-'))) {
    throw new Error('analyze-run requires a run directory');
  }

  let parsed: WorkflowCommand | undefined;
  const program = buildProgram((command) => {
    parsed = command;
  });

  try {
    program.parse(args, { from: 'user' });
  } catch (error) {
    throw mapCommanderError(error);
  }

  if (parsed) return parsed;
  throw new Error(`Unknown command: ${args[0]}`);
}

export function getHelpText(): string {
  return buildProgram(() => undefined).helpInformation();
}

function buildProgram(setParsed: (command: WorkflowCommand) => void): Command {
  const program = new Command('agentic-workflow-kit')
    .exitOverride()
    .configureOutput({ writeOut: () => undefined, writeErr: () => undefined })
    .helpOption(false)
    .allowUnknownOption(false)
    .allowExcessArguments(false);

  withOptions(program.command('list-tracks')).action((options: CommanderOptions) => {
    setParsed({ kind: 'list-tracks', overrides: toOverrides(options) });
  });
  withOptions(program.command('list-stories')).action((options: CommanderOptions) => {
    setParsed({ kind: 'list-stories', overrides: toOverrides(options) });
  });
  withOptions(program.command('list-eligible')).action((options: CommanderOptions) => {
    setParsed({ kind: 'list-eligible', overrides: toOverrides(options) });
  });
  withOptions(program.command('version')).action((options: CommanderOptions) => {
    setParsed({ kind: 'version', overrides: toOverrides(options) });
  });
  const project = program.command('project').allowExcessArguments(false);
  withOptions(project.command('inspect')).action((options: CommanderOptions) => {
    setParsed({ kind: 'project-inspect', overrides: toOverrides(options) });
  });
  const run = program.command('run').allowExcessArguments(false);
  withOptions(run.command('preview'))
    .option('--story <id>')
    .addOption(new Option('--mode <mode>').choices(['eligible']))
    .action((options: CommanderOptions) => {
      setParsed({ kind: 'run-preview', target: toRunPreviewTarget(options), overrides: toProductOverrides(options) });
    });
  withOptions(run.command('status').argument('<runRef>')).action((runRef: string, options: CommanderOptions) => {
    setParsed({ kind: 'run-status', runRef, overrides: toProductOverrides(options) });
  });
  withOptions(run.command('stream').argument('<runRef>')).action((runRef: string, options: CommanderOptions) => {
    setParsed({ kind: 'run-stream', runRef, overrides: toProductOverrides(options) });
  });
  withOptions(run.command('inspect').argument('<runRef>')).action((runRef: string, options: CommanderOptions) => {
    setParsed({ kind: 'run-inspect', runRef, overrides: toProductOverrides(options) });
  });
  withOptions(run.command('report').argument('<runRef>')).action((runRef: string, options: CommanderOptions) => {
    setParsed({ kind: 'run-report', runRef, overrides: toProductOverrides(options) });
  });
  withOptions(run.command('export').argument('<runRef>')).action((runRef: string, options: CommanderOptions) => {
    setParsed({ kind: 'run-export', runRef, overrides: toProductOverrides(options) });
  });
  const tracker = program.command('tracker').allowExcessArguments(false);
  withOptions(tracker.command('validate')).action((options: CommanderOptions) => {
    setParsed({ kind: 'tracker-validate', overrides: toOverrides(options) });
  });
  withOptions(tracker.command('migrate')).action((options: CommanderOptions) => {
    if (!options.from) throw new Error('tracker migrate requires --from');
    if (!options.track) throw new Error('tracker migrate requires --track');
    setParsed({
      kind: 'tracker-migrate',
      from: options.from,
      track: options.track,
      overrides: toProductOverrides(options),
    });
  });
  const config = program.command('config').allowExcessArguments(false);
  withOptions(config.command('status')).action((options: CommanderOptions) => {
    setParsed({ kind: 'config-status', overrides: toOverrides(options) });
  });
  withOptions(config.command('upgrade')).action((options: CommanderOptions) => {
    setParsed({ kind: 'config-upgrade', overrides: toOverrides(options) });
  });
  withOptions(program.command('run-story').argument('<storyId>')).action(
    (storyId: string, options: CommanderOptions) => {
      setParsed({ kind: 'run-story', storyId, overrides: toOverrides(options) });
    },
  );
  withOptions(program.command('run-eligible')).action((options: CommanderOptions) => {
    setParsed({ kind: 'run-eligible', overrides: toOverrides(options) });
  });
  withOptions(program.command('watch-run').argument('<runPath>')).action(
    (runPath: string, options: CommanderOptions) => {
      setParsed({ kind: 'watch-run', runPath, overrides: toOverrides(options) });
    },
  );
  withOptions(program.command('abort-run').argument('<runPath>'))
    .option('--story <id>')
    .action((runPath: string, options: CommanderOptions) => {
      setParsed({ kind: 'abort-run', runPath, overrides: toOverrides(options) });
    });
  withOptions(program.command('analyze-run').argument('<runPath>')).action(
    (runPath: string, options: CommanderOptions) => {
      setParsed({ kind: 'analyze-run', runPath, overrides: toOverrides(options) });
    },
  );

  const mcp = program.command('mcp').allowExcessArguments(false);
  withOptions(mcp.command('check')).action((options: CommanderOptions) => {
    setParsed({ kind: 'mcp-check', overrides: toOverrides(options) });
  });

  return program;
}

function withOptions(command: Command): Command {
  return command
    .allowUnknownOption(false)
    .allowExcessArguments(false)
    .option('--config <path>')
    .option('--json')
    .option('--force')
    .option('--dry-run')
    .option('--yes')
    .option('--watch')
    .option('--no-watch')
    .option('--wait')
    .option('--no-wait')
    .addOption(new Option('--max-parallel <n>').argParser(parsePositiveInteger))
    .addOption(new Option('--child-timeout-ms <n>').argParser(parseChildTimeoutMs))
    .addOption(new Option('--interval-ms <n>').argParser((value) => parsePositiveIntegerFlag(value, '--interval-ms')))
    .addOption(new Option('--timeout-ms <n>').argParser((value) => parsePositiveIntegerFlag(value, '--timeout-ms')))
    .option('--track <id>')
    .addOption(new Option('--tracks-dir <path>').argParser(parseRepoRelativePathFlag('--tracks-dir')))
    .option('--reason <text>')
    .option('--from <path>')
    .option('--out <path>')
    .addOption(new Option('--include <mode>').choices(['summary', 'full-bounded']))
    .addOption(new Option('--limit <n>').argParser((value) => parsePositiveIntegerFlag(value, '--limit')))
    .addOption(new Option('--format <format>').choices(['table', 'json', 'ndjson', 'markdown']))
    .option('--model <model>')
    .option('--reasoning <effort>')
    .addOption(new Option('--approval-policy <policy>').argParser(parseApprovalPolicy))
    .addOption(new Option('--sandbox <mode>').argParser(parseSandbox))
    .option('--cwd <path>')
    .option('--session-root <path>');
}

interface CommanderOptions {
  config?: string;
  json?: boolean;
  force?: boolean;
  dryRun?: boolean;
  yes?: boolean;
  watch?: boolean;
  wait?: boolean;
  intervalMs?: number;
  timeoutMs?: number;
  maxParallel?: number;
  childTimeoutMs?: number;
  track?: string;
  tracksDir?: string;
  model?: string;
  reasoning?: string;
  approvalPolicy?: ApprovalPolicy;
  sandbox?: SandboxMode;
  cwd?: string;
  sessionRoot?: string;
  story?: string;
  reason?: string;
  mode?: 'eligible';
  from?: string;
  out?: string;
  include?: 'summary' | 'full-bounded';
  limit?: number;
  format?: 'table' | 'json' | 'ndjson' | 'markdown';
}

function toOverrides(options: CommanderOptions): CliOverrides {
  const overrides: CliOverrides = {};
  if (options.config !== undefined) overrides.configPath = options.config;
  if (options.json) overrides.json = true;
  if (options.force) overrides.force = true;
  if (options.dryRun) overrides.dryRun = true;
  if (options.yes) overrides.confirmNonDryRun = true;
  if (options.watch !== undefined) overrides.watch = options.watch;
  if (options.wait !== undefined) overrides.wait = options.wait;
  if (options.intervalMs !== undefined) overrides.intervalMs = options.intervalMs;
  if (options.timeoutMs !== undefined) overrides.timeoutMs = options.timeoutMs;
  if (options.maxParallel !== undefined) overrides.maxParallel = options.maxParallel;
  if (options.childTimeoutMs !== undefined) overrides.childTimeoutMs = options.childTimeoutMs;
  if (options.track !== undefined) overrides.track = options.track;
  if (options.tracksDir !== undefined) overrides.tracksDir = options.tracksDir;
  if (options.model !== undefined) overrides.model = options.model;
  if (options.reasoning !== undefined) overrides.reasoning = options.reasoning;
  if (options.approvalPolicy !== undefined) overrides.approvalPolicy = options.approvalPolicy;
  if (options.sandbox !== undefined) overrides.sandbox = options.sandbox;
  if (options.cwd !== undefined) overrides.cwd = options.cwd;
  if (options.sessionRoot !== undefined) overrides.sessionRoot = options.sessionRoot;
  if (options.story !== undefined) overrides.storyId = options.story;
  if (options.reason !== undefined) overrides.reason = options.reason;
  if (options.out !== undefined) overrides.out = options.out;
  if (options.include !== undefined) overrides.exportInclude = options.include;
  if (options.limit !== undefined) overrides.limit = options.limit;
  if (options.format !== undefined) overrides.format = options.format;
  return overrides;
}

function toRunPreviewTarget(options: CommanderOptions): WorkflowRunPreviewTarget {
  if (options.story !== undefined && options.mode !== undefined) {
    throw new Error('run preview cannot combine --story with --mode');
  }
  if (options.story !== undefined) {
    return {
      type: 'story',
      ...(options.track !== undefined ? { trackId: options.track } : {}),
      storyId: options.story,
    };
  }
  return { type: 'track', ...(options.track !== undefined ? { trackId: options.track } : {}), mode: 'eligible' };
}

function toProductOverrides(options: CommanderOptions): CliOverrides {
  const { track: _track, story: _story, mode: _mode, from: _from, ...baseOptions } = options;
  return toOverrides(baseOptions);
}

function parseApprovalPolicy(value: string): ApprovalPolicy {
  if (!APPROVAL_POLICIES.has(value as ApprovalPolicy)) {
    throw new InvalidArgumentError('--approval-policy must be one of untrusted, on-failure, on-request, never');
  }
  return value as ApprovalPolicy;
}

function parseSandbox(value: string): SandboxMode {
  if (!SANDBOX_MODES.has(value as SandboxMode)) {
    throw new InvalidArgumentError('--sandbox must be one of read-only, workspace-write, danger-full-access');
  }
  return value as SandboxMode;
}

function parseRepoRelativePathFlag(flag: string): (value: string) => string {
  return (value: string) => {
    try {
      assertRepoRelativePath(value, flag);
      return value;
    } catch (error) {
      throw new InvalidArgumentError(error instanceof Error ? error.message : String(error));
    }
  };
}

function parsePositiveInteger(value: string): number {
  if (value === '') {
    throw new InvalidArgumentError('--max-parallel requires a value');
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || String(parsed) !== value) {
    throw new InvalidArgumentError('--max-parallel must be a positive integer');
  }
  return parsed;
}

function parseChildTimeoutMs(value: string): number {
  return parsePositiveIntegerFlag(value, '--child-timeout-ms');
}

function parsePositiveIntegerFlag(value: string, flag: string): number {
  if (value === '') {
    throw new InvalidArgumentError(`${flag} requires a value`);
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || String(parsed) !== value) {
    throw new InvalidArgumentError(`${flag} must be a positive integer`);
  }
  return parsed;
}

export function resolveInvocationCwd(overrides: Pick<CliOverrides, 'cwd'>): string {
  if (overrides.cwd) return path.resolve(overrides.cwd);
  return process.env.INIT_CWD ? path.resolve(process.env.INIT_CWD) : process.cwd();
}

function mapCommanderError(error: unknown): Error {
  if (!(error instanceof CommanderError)) {
    return error instanceof Error ? error : new Error(String(error));
  }

  const message = error.message;
  const unknownOption = message.match(/unknown option '([^']+)'/);
  if (unknownOption) return new Error(`Unknown argument: ${unknownOption[1]}`);

  const unknownCommand = message.match(/unknown command '([^']+)'/);
  if (unknownCommand) return new Error(`Unknown command: ${unknownCommand[1]}`);

  const missingOptionValue = message.match(/option '([^']+)' argument missing/);
  if (missingOptionValue) {
    const flag = missingOptionValue[1].split(/\s+/)[0];
    return new Error(`${flag} requires a value`);
  }

  const excessArgument = message.match(/too many arguments .* got \d+: ([^.]+)\./);
  if (excessArgument) {
    const extra = excessArgument[1].split(',').at(-1)?.trim() ?? excessArgument[1];
    return new Error(`Unknown argument: ${extra}`);
  }

  if (message.includes("missing required argument 'storyId'")) return new Error('run-story requires a story id');
  if (message.includes('--max-parallel requires a value')) {
    return new Error('--max-parallel requires a value');
  }
  if (message.includes('--max-parallel must be a positive integer')) {
    return new Error('--max-parallel must be a positive integer');
  }
  if (message.includes('--child-timeout-ms requires a value')) {
    return new Error('--child-timeout-ms requires a value');
  }
  if (message.includes('--child-timeout-ms must be a positive integer')) {
    return new Error('--child-timeout-ms must be a positive integer');
  }
  if (message.includes('--approval-policy must be one of')) {
    return new Error('--approval-policy must be one of untrusted, on-failure, on-request, never');
  }
  if (message.includes('--sandbox must be one of')) {
    return new Error('--sandbox must be one of read-only, workspace-write, danger-full-access');
  }
  return new Error(message.replace(/^error: /, ''));
}
