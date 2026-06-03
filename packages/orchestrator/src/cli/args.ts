import path from 'node:path';
import process from 'node:process';
import { Command, CommanderError, InvalidArgumentError, Option } from 'commander';
import type { ApprovalPolicy, CliOverrides, SandboxMode, WorkflowCommand } from '../types.js';

const APPROVAL_POLICIES = new Set<ApprovalPolicy>(['untrusted', 'on-failure', 'on-request', 'never']);
const SANDBOX_MODES = new Set<SandboxMode>(['read-only', 'workspace-write', 'danger-full-access']);

export function parseCommand(argv: string[]): WorkflowCommand {
  const args = argv.filter((arg) => arg !== '--');
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    return { kind: 'help' };
  }
  if (args[0].startsWith('-')) {
    throw new Error(`Unknown command: ${args[0]}`);
  }
  if (args[0] === 'mcp' && args[1] !== 'check') {
    throw new Error('Expected `mcp check`');
  }
  if (args[0] === 'run-story' && (!args[1] || args[1].startsWith('-'))) {
    throw new Error('run-story requires a story id');
  }
  if (args[0] === 'watch-run' && (!args[1] || args[1].startsWith('-'))) {
    throw new Error('watch-run requires a run directory');
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
    .option('--watch')
    .addOption(new Option('--max-parallel <n>').argParser(parsePositiveInteger))
    .addOption(new Option('--child-timeout-ms <n>').argParser(parseChildTimeoutMs))
    .option('--track <id>')
    .option('--tracks-dir <path>')
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
  watch?: boolean;
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
}

function toOverrides(options: CommanderOptions): CliOverrides {
  const overrides: CliOverrides = {};
  if (options.config !== undefined) overrides.configPath = options.config;
  if (options.json) overrides.json = true;
  if (options.force) overrides.force = true;
  if (options.dryRun) overrides.dryRun = true;
  if (options.watch) overrides.watch = true;
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
  return overrides;
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
