import { MetricsError, supportedFormats } from './contracts.mjs';
import { analyzeAgentSessionMetrics } from './index.mjs';
import { renderJson } from './render-json.mjs';
import { renderMarkdown } from './render-markdown.mjs';

export async function runCli(argv = process.argv.slice(2), io = process) {
  try {
    const parsed = parseArgs(argv);
    if (parsed.help) {
      io.stdout.write(usage());
      return 0;
    }

    const report = await analyzeAgentSessionMetrics({
      provider: parsed.provider,
      providerHome: parsed.providerHome,
      scope: parsed.scope,
      target: parsed.target,
    });
    io.stdout.write(
      parsed.format === 'markdown' ? renderMarkdown(report) : renderJson(report, { pretty: parsed.pretty }),
    );
    return 0;
  } catch (error) {
    const code = error instanceof MetricsError ? error.code : 1;
    io.stderr.write(`${error.message}\n`);
    return code;
  }
}

export function parseArgs(argv) {
  const parsed = {
    provider: 'codex',
    scope: 'tree',
    format: 'json',
    pretty: false,
    providerHome: undefined,
    target: null,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
      continue;
    }
    if (['--current', '--cwd', '--codex-home'].includes(arg)) {
      throw new MetricsError(`Unsupported option: ${arg}`);
    }
    if (arg === '--pretty') {
      parsed.pretty = true;
      continue;
    }
    if (arg === '--provider') {
      parsed.provider = readValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === '--provider-home') {
      parsed.providerHome = readValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === '--scope') {
      parsed.scope = readValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === '--format') {
      parsed.format = readValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === '--session-id') {
      setTarget(parsed, { kind: 'session-id', sessionId: readValue(argv, index, arg) });
      index += 1;
      continue;
    }
    if (arg === '--session-file') {
      setTarget(parsed, { kind: 'session-file', sessionFile: readValue(argv, index, arg) });
      index += 1;
      continue;
    }
    throw new MetricsError(`Unknown option: ${arg}`);
  }

  if (parsed.help) {
    return parsed;
  }
  if (!parsed.target) {
    throw new MetricsError('Target required: pass --session-id <id> or --session-file <path>');
  }
  if (!supportedFormats.has(parsed.format)) {
    throw new MetricsError(`Unsupported format: ${parsed.format}`);
  }
  return parsed;
}

export function usage() {
  return `Usage:
  scripts/agent-session-metrics.mjs --provider codex (--session-id <id> | --session-file <path>) --scope tree|main|children --provider-home <path> --format json|markdown --pretty

Defaults:
  --provider codex
  --scope tree
  --format json

Options:
  --provider <name>       Provider adapter to use. Version 1 supports codex.
  --session-id <id>       Resolve a provider session/thread id.
  --session-file <path>   Analyze one explicit provider record file.
  --scope <scope>         tree, main, or children. Default: tree.
  --provider-home <path>  Override the provider's local data home.
  --format <format>       json or markdown. Default: json.
  --pretty                Pretty-print JSON only.
  --help                  Print this usage.
`;
}

function readValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new MetricsError(`Missing value for ${flag}`);
  }
  return value;
}

function setTarget(parsed, target) {
  if (parsed.target) {
    throw new MetricsError('Target flags are mutually exclusive');
  }
  parsed.target = target;
}
