import { describe, expect, it } from 'vitest';
import { parseCommand } from '../src/cli/args';

describe('parseCommand', () => {
  it('parses help forms', () => {
    expect(parseCommand([])).toEqual({ kind: 'help' });
    expect(parseCommand(['--help'])).toEqual({ kind: 'help' });
    expect(parseCommand(['-h'])).toEqual({ kind: 'help' });
  });

  it('parses list commands', () => {
    expect(parseCommand(['list-tracks', '--json'])).toEqual({ kind: 'list-tracks', overrides: { json: true } });
    expect(parseCommand(['list-stories', '--track', 'linkly'])).toEqual({
      kind: 'list-stories',
      overrides: { track: 'linkly' },
    });
    expect(parseCommand(['list-eligible', '--max-parallel=3'])).toEqual({
      kind: 'list-eligible',
      overrides: { maxParallel: 3 },
    });
    expect(parseCommand(['list-eligible', '--track=linkly'])).toEqual({
      kind: 'list-eligible',
      overrides: { track: 'linkly' },
    });
    expect(parseCommand(['list-eligible', '--track', 'linkly'])).toEqual(
      parseCommand(['list-eligible', '--track=linkly']),
    );
  });

  it('parses run commands', () => {
    expect(parseCommand(['run-story', 'L002', '--force'])).toEqual({
      kind: 'run-story',
      storyId: 'L002',
      overrides: { force: true },
    });
    expect(parseCommand(['run-eligible', '--track', 'linkly', '--dry-run', '--watch'])).toEqual({
      kind: 'run-eligible',
      overrides: { track: 'linkly', dryRun: true, watch: true },
    });
    expect(
      parseCommand([
        'run-eligible',
        '--config=custom.yaml',
        '--tracks-dir',
        'tracks',
        '--model',
        'gpt-5',
        '--reasoning=high',
        '--approval-policy',
        'never',
        '--sandbox=danger-full-access',
        '--child-timeout-ms',
        '3000',
        '--cwd',
        '/repo',
      ]),
    ).toEqual({
      kind: 'run-eligible',
      overrides: {
        configPath: 'custom.yaml',
        tracksDir: 'tracks',
        model: 'gpt-5',
        reasoning: 'high',
        approvalPolicy: 'never',
        sandbox: 'danger-full-access',
        childTimeoutMs: 3000,
        cwd: '/repo',
      },
    });
  });

  it('parses product facade commands', () => {
    expect(parseCommand(['project', 'inspect', '--json'])).toEqual({
      kind: 'project-inspect',
      overrides: { json: true },
    });
    expect(parseCommand(['run', 'preview', '--track', 'linkly', '--story', 'LK02', '--json'])).toEqual({
      kind: 'run-preview',
      target: { type: 'story', trackId: 'linkly', storyId: 'LK02' },
      overrides: { json: true },
    });
    expect(parseCommand(['run', 'preview', '--track', 'linkly', '--mode', 'eligible'])).toEqual({
      kind: 'run-preview',
      target: { type: 'track', trackId: 'linkly', mode: 'eligible' },
      overrides: {},
    });
  });

  it('parses watch/analyze/mcp commands', () => {
    expect(parseCommand(['watch-run', '.codex/agentic-workflow-kit/runs/run-1', '--json'])).toEqual({
      kind: 'watch-run',
      runPath: '.codex/agentic-workflow-kit/runs/run-1',
      overrides: { json: true },
    });
    expect(
      parseCommand([
        'watch-run',
        '.codex/agentic-workflow-kit/runs/run-1',
        '--wait',
        '--interval-ms',
        '1000',
        '--timeout-ms',
        '5000',
      ]),
    ).toEqual({
      kind: 'watch-run',
      runPath: '.codex/agentic-workflow-kit/runs/run-1',
      overrides: { wait: true, intervalMs: 1000, timeoutMs: 5000 },
    });
    expect(parseCommand(['watch-run', '.codex/agentic-workflow-kit/runs/run-1', '--no-wait'])).toEqual({
      kind: 'watch-run',
      runPath: '.codex/agentic-workflow-kit/runs/run-1',
      overrides: { wait: false },
    });
    expect(parseCommand(['run-eligible', '--no-watch'])).toEqual({
      kind: 'run-eligible',
      overrides: { watch: false },
    });
    expect(parseCommand(['analyze-run', 'runs/run-1', '--session-root', 'sessions'])).toEqual({
      kind: 'analyze-run',
      runPath: 'runs/run-1',
      overrides: { sessionRoot: 'sessions' },
    });
    expect(parseCommand(['mcp', 'check'])).toEqual({ kind: 'mcp-check', overrides: {} });
    expect(parseCommand(['mcp', 'check', '--json'])).toEqual({ kind: 'mcp-check', overrides: { json: true } });
  });

  it('rejects unknown arguments', () => {
    expect(() => parseCommand(['run-eligible', '--bogus'])).toThrow('Unknown argument: --bogus');
  });

  it('restores legacy errors for missing option values', () => {
    expect(() => parseCommand(['list-tracks', '--config'])).toThrow('--config requires a value');
    expect(() => parseCommand(['list-stories', '--track'])).toThrow('--track requires a value');
    expect(() => parseCommand(['run-eligible', '--tracks-dir'])).toThrow('--tracks-dir requires a value');
  });

  it('restores legacy errors for excess positional arguments', () => {
    expect(() => parseCommand(['list-tracks', 'extra'])).toThrow('Unknown argument: extra');
    expect(() => parseCommand(['run-story', 'L002', 'EXTRA'])).toThrow('Unknown argument: EXTRA');
    expect(() => parseCommand(['mcp', 'check', 'EXTRA'])).toThrow('Unknown argument: EXTRA');
    expect(() => parseCommand(['run-eligible', '--json', 'EXTRA'])).toThrow('Unknown argument: EXTRA');
  });

  it('rejects invalid command shapes', () => {
    expect(() => parseCommand(['unknown'])).toThrow('Unknown command: unknown');
    expect(() => parseCommand(['--json', 'list-tracks'])).toThrow('Unknown command: --json');
    expect(() => parseCommand(['mcp'])).toThrow('Expected `mcp check`');
    expect(() => parseCommand(['run-story'])).toThrow('run-story requires a story id');
    expect(() => parseCommand(['watch-run'])).toThrow('watch-run requires a run directory');
    expect(() => parseCommand(['analyze-run'])).toThrow('analyze-run requires a run directory');
  });

  it('rejects invalid option values', () => {
    expect(() => parseCommand(['list-eligible', '--max-parallel', '0'])).toThrow(
      '--max-parallel must be a positive integer',
    );
    expect(() => parseCommand(['list-eligible', '--max-parallel', 'abc'])).toThrow(
      '--max-parallel must be a positive integer',
    );
    expect(() => parseCommand(['list-eligible', '--max-parallel='])).toThrow('--max-parallel requires a value');
    expect(() => parseCommand(['list-eligible', '--child-timeout-ms', '0'])).toThrow(
      '--child-timeout-ms must be a positive integer',
    );
    expect(() => parseCommand(['list-eligible', '--child-timeout-ms='])).toThrow('--child-timeout-ms requires a value');
    expect(() => parseCommand(['run-eligible', '--approval-policy=maybe'])).toThrow(
      '--approval-policy must be one of untrusted, on-failure, on-request, never',
    );
    expect(() => parseCommand(['run-eligible', '--sandbox=none'])).toThrow(
      '--sandbox must be one of read-only, workspace-write, danger-full-access',
    );
  });
});
