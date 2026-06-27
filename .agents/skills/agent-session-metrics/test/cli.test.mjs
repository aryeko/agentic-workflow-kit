import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, '..');
const fixtureRoot = join(here, 'fixtures', 'codex');
const cliPath = join(packageRoot, 'scripts', 'agent-session-metrics.mjs');

test('CLI renders compact JSON by default and pretty JSON on request', async () => {
  const sessionFile = join(fixtureRoot, 'root-only', 'sessions', 'rollout-root-001.jsonl');
  const { stdout } = await execFileAsync('node', [
    cliPath,
    '--provider',
    'codex',
    '--session-file',
    sessionFile,
    '--format',
    'json',
  ]);

  assert.doesNotMatch(stdout, /\n {2}"/);
  const report = JSON.parse(stdout);
  assert.equal(report.main.id, 'root-001');
  assert.deepEqual(report.main.metrics.tokens, {
    in: 100,
    out: 30,
    cached: 25,
    total: 130,
  });
  assert.equal(report.target.sessionId, 'root-001');

  const pretty = await execFileAsync('node', [cliPath, '--session-file', sessionFile, '--format', 'json', '--pretty']);
  assert.match(pretty.stdout, /\n {2}"status"/);
});

test('CLI renders markdown and ignores pretty flag', async () => {
  const sessionFile = join(fixtureRoot, 'root-only', 'sessions', 'rollout-root-001.jsonl');
  const { stdout } = await execFileAsync('node', [
    cliPath,
    '--session-file',
    sessionFile,
    '--format',
    'markdown',
    '--pretty',
  ]);

  assert.match(stdout, /^# Agent Session Metrics/);
  assert.match(stdout, /Provider: codex/);
  assert.match(
    stdout,
    /\| Session \| Parent \| Provider \| Role \| Nickname \| Model \/ effort \| Duration \| Tokens \|/,
  );
});

test('CLI rejects removed and unsupported arguments', async () => {
  await assert.rejects(execFileAsync('node', [cliPath, '--current']), /Unsupported option: --current/);
  await assert.rejects(
    execFileAsync('node', [cliPath, '--provider', 'claude', '--session-id', 'abc']),
    /provider adapter not implemented: claude/,
  );
});
