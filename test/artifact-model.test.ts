import { existsSync, readFileSync } from 'node:fs';
import { chmod, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FileArtifactStore } from '../packages/orchestrator/src/artifacts/FileArtifactStore.js';
import { evaluateRecoveryGuard } from '../packages/orchestrator/src/runner/RecoveryGuard.js';

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('planning artifact model', () => {
  it('example delivery tracker links story briefs under the track directory', () => {
    const tracker = readFileSync('examples/example-tracker/README.md', 'utf8');

    expect(tracker).toContain('stories/LK01.md');
    expect(tracker).toContain('stories/LK02.md');
    expect(tracker).not.toContain('examples/example-tracker/specs/');
    expect(existsSync('examples/example-tracker/stories/LK01.md')).toBe(true);
    expect(existsSync('examples/example-tracker/stories/LK02.md')).toBe(true);
  });

  it('plan-delivery-track writes story briefs, not detailed specs', () => {
    const { body } = readSkillBody('plan-delivery-track');

    expect(body).toContain('<tracksDir>/<track>/stories/<ID>.md');
    expect(body).toContain('references/story-brief-contract.md');
    expect(body).not.toContain('standalone-spec-template.md');
    expect(body).not.toContain('delta-spec-template.md');
  });

  it('implement-next accepts old detailed specs and expands new story briefs before planning', () => {
    const { body } = readSkillBody('implement-next');

    expect(body).toContain('Backward compatibility');
    expect(body).toContain('<specsDir>');
    expect(body).toContain('story brief under `<tracksDir>/<track>/stories/<ID>.md`');
    expect(body).toContain('create/refine the detailed technical story spec first');
    expect(body).toContain('No implementation plan or code while the detailed technical story spec is missing');
  });

  it('tracker contract keeps old detailed spec links valid while redefining Spec for new trackers', () => {
    const contract = readFileSync('references/tracker-contract.md', 'utf8');

    expect(contract).toContain('For new trackers, Spec links to the story brief');
    expect(contract).toContain('Existing trackers that link a detailed spec directly remain valid');
  });

  it('AWK06 defines additive V1 runtime artifact filenames and compatibility', () => {
    const contract = readFileSync('references/runtime-artifact-contract.md', 'utf8');

    expect(contract).toContain('summary.json');
    expect(contract).toContain('rows.json');
    expect(contract).toContain('budgets.json');
    expect(contract).toContain('transcripts.json');
    expect(contract).toContain('analysis.json');
    expect(contract).toContain('report.md');
    expect(contract).toContain('subscriptions/<subscriptionId>.json');
    expect(contract).toContain('schemaVersion: 1');
    expect(contract).toContain('subscriptions/<subscriptionId>.wake');
    expect(contract).toContain('Existing run artifacts without these files');
  });

  it('serializes concurrent appends into complete NDJSON lines', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'awk-artifacts-'));
    tempRoots.push(root);
    const store = new FileArtifactStore(root);

    await Promise.all(
      Array.from({ length: 100 }, async (_, index) => {
        await store.appendEvent({
          recordedAt: `2026-06-14T10:00:${String(index % 60).padStart(2, '0')}.000Z`,
          eventAt: `2026-06-14T10:00:${String(index % 60).padStart(2, '0')}.000Z`,
          type: 'concurrent-event',
          index,
          payload: 'x'.repeat(2048),
        });
      }),
    );

    const lines = (await readFile(path.join(root, 'events.ndjson'), 'utf8')).trimEnd().split('\n');

    expect(lines).toHaveLength(100);
    expect(
      lines
        .map((line) => JSON.parse(line))
        .map((entry) => entry.index)
        .sort((a, b) => a - b),
    ).toEqual(Array.from({ length: 100 }, (_, index) => index));
  });

  it('atomically replaces full-file JSON artifacts', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'awk-artifacts-'));
    tempRoots.push(root);
    const store = new FileArtifactStore(root);

    await store.writeJson('state.json', { status: 'old-complete', runId: 'run-1' });
    await writeFile(path.join(root, 'state.json.partial'), '{"status":');
    await store.writeJson('state.json', { status: 'new-complete', runId: 'run-1' });

    expect(JSON.parse(await readFile(path.join(root, 'state.json'), 'utf8'))).toEqual({
      status: 'new-complete',
      runId: 'run-1',
    });
    expect(await readdir(root)).toContain('state.json.partial');
  });

  it('preserves existing artifact permissions when atomically replacing a file', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'awk-artifacts-'));
    tempRoots.push(root);
    const store = new FileArtifactStore(root);
    const filePath = path.join(root, 'state.json');

    await store.writeText('state.json', '{"status":"old"}\n');
    await chmod(filePath, 0o777);
    await store.writeText('state.json', '{"status":"new"}\n');

    expect((await stat(filePath)).mode & 0o777).toBe(0o777);
    expect(await readFile(filePath, 'utf8')).toBe('{"status":"new"}\n');
  });

  it('returns null for missing text artifacts', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'awk-artifacts-'));
    tempRoots.push(root);
    const store = new FileArtifactStore(root);

    await expect(store.readText('missing.json')).resolves.toBeNull();
  });

  it('cleans up atomic temp files when replacement fails', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'awk-artifacts-'));
    tempRoots.push(root);
    await mkdir(path.join(root, 'state.json'));
    const store = new FileArtifactStore(root);

    await expect(store.writeText('state.json', '{"status":"new"}\n')).rejects.toThrow();

    expect((await readdir(root)).filter((name) => name.endsWith('.tmp'))).toEqual([]);
  });

  it('round-trips recovery guard inputs through the real file artifact store', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'awk-artifacts-'));
    tempRoots.push(root);
    const writer = new FileArtifactStore(root);

    await writer.writeJson('state.json', {
      runId: 'run-1',
      status: 'running',
      active: ['AWK139'],
    });
    await writer.writeJson('children/AWK139.launch.json', {
      storyId: 'AWK139',
      sessionId: null,
      lastHeartbeatAt: null,
      expectedBranch: 'agentic-workflow-kit-redesign/awk139-run-state-write-atomicity',
    });

    const reader = new FileArtifactStore(root);
    const state = JSON.parse((await reader.readText('state.json')) ?? '{}');
    const launch = JSON.parse((await reader.readText('children/AWK139.launch.json')) ?? '{}');
    const result = evaluateRecoveryGuard({
      storyId: launch.storyId,
      now: '2026-06-15T20:00:00.000Z',
      staleAfterMs: 1000,
      session: {
        sessionId: launch.sessionId,
        lastHeartbeatAt: launch.lastHeartbeatAt,
      },
      git: {
        expectedBranch: launch.expectedBranch,
        remoteBranchExists: false,
        latestCommitSha: null,
        worktreeClean: true,
      },
      pr: {
        state: 'none',
        number: null,
        mergedAt: null,
      },
      trackerOnBase: {
        status: state.status,
        complete: false,
      },
    });

    expect(result).toMatchObject({
      storyId: 'AWK139',
      decision: 'safe_to_take_over',
    });
  });
});

function readSkillBody(skillName: string): { body: string } {
  const content = readFileSync(`skills/${skillName}/SKILL.md`, 'utf8');
  const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  if (!match) throw new Error(`${skillName} must have frontmatter`);
  return { body: match[1] ?? '' };
}
