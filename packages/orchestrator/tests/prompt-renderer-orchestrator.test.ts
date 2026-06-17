import { describe, expect, it } from 'vitest';
import { resolveCwdOnlyConfig } from '../src/config/configLoader';
import { renderResumeMessage, renderStoryImplementerPrompt } from '../src/drivers/promptRenderer';
import type { ResolvedWorkflowConfig, ReviewVerdict, WorkflowStory } from '../src/types';

type PrePrMode = ResolvedWorkflowConfig['implement']['review']['prePr']['mode'];

function makeConfig(mode: PrePrMode, enabled = true): ResolvedWorkflowConfig {
  return {
    version: '0.6.0',
    configPath: '/repo/.workflow/config.yaml',
    workspace: { rootAbs: '/repo' },
    paths: {
      tracksDir: 'docs/tracks',
      tracksDirAbs: '/repo/docs/tracks',
      archiveDir: 'docs/tracks/archive',
      archiveDirAbs: '/repo/docs/tracks/archive',
    },
    artifacts: {
      rootDir: '.codex/agentic-workflow-kit',
      rootDirAbs: '/repo/.codex/agentic-workflow-kit',
      runsDirAbs: '/repo/.codex/agentic-workflow-kit/runs',
    },
    statuses: { eligible: ['specced'], inProgress: 'implementing', complete: ['done'] },
    tracker: { idPattern: '^[A-Z]+[0-9]+$' },
    git: {
      strategy: 'worktree',
      branchPattern: '{track}/{id-lc}-{slug}',
      baseBranch: 'main',
      commitOnBase: 'forbid',
      worktreeDir: '.worktrees',
    },
    pr: {
      create: true,
      ci: { wait: true, command: null },
      review: {
        wait: 'bot',
        bot: 'codex',
        triageComments: true,
        maxFixBatches: 1,
        rerequestAfterFix: false,
        waitTimeoutMinutes: 30,
      },
      merge: { auto: true, method: 'squash', deleteBranch: true },
    },
    implement: {
      review: {
        prePr: { enabled, mode, maxLoops: 2, loopMode: 'incremental', downgradeTo: 'none' },
        semanticChecks: { enabled: true },
      },
      subagents: { enabled: true, maxParallel: 2, allowWorkers: false },
    },
    agents: resolveCwdOnlyConfig('/repo').agents,
    orchestrator: {
      driver: 'codex-mcp',
      maxParallel: 2,
      stopLaunchingOnBlocked: true,
      watch: { enabled: false, wait: false, intervalMs: 300_000, timeoutMs: 300_000 },
      childTimeoutMs: 1_800_000,
      childNoProgressTimeoutMs: 1_800_000,
      childStartupTimeoutMs: 60_000,
      childMaxRuntimeMs: 7_200_000,
      childReviewWaitTimeoutMs: 1_800_000,
    },
    childSession: { cwdAbs: '/repo', speed: 'derive' },
    codex: { childSession: { cwdAbs: '/repo', speed: 'derive' } },
  };
}

const story: WorkflowStory = {
  id: 'L002',
  title: 'Pilot',
  status: 'specced',
  owner: null,
  dependencies: ['L001'],
  eligible: true,
  blockedReason: null,
  metadata: {
    trackId: 'linkly',
    trackTitle: 'Linkly tracker',
    trackerPath: 'docs/tracks/linkly/README.md',
    order: 2,
    wave: '2',
    spec: '[spec](../../specs/l002.md)',
    plan: '—',
  },
};

const ORCHESTRATOR_MARKER = 'Pre-PR review checkpoint (orchestrator mode';

describe('renderStoryImplementerPrompt orchestrator pre-PR block', () => {
  it('includes the orchestrator checkpoint block when prePr mode is orchestrator', () => {
    const prompt = renderStoryImplementerPrompt(story, makeConfig('orchestrator'));

    expect(prompt).toContain(ORCHESTRATOR_MARKER);
    expect(prompt).toContain('do NOT self-review');
    expect(prompt).toContain('do NOT open the PR');
    expect(prompt).toContain('review-request packet');
    expect(prompt).toContain('structuredContent.prePrReview');
    expect(prompt).toContain('"status": "awaiting_review"');
    expect(prompt).toContain('packetPath');
    expect(prompt).toContain('diffRef');
    expect(prompt).toContain('PASS');
    expect(prompt).toContain('BLOCK');
    expect(prompt).toContain('turn-boundary yield');
    expect(prompt).toContain('never open the PR without a PASS verdict');
    expect(prompt).toContain('up to 2');
  });

  it.each<PrePrMode>([
    'auto',
    'inline',
    'subagent',
  ])('does not include the orchestrator checkpoint block when mode is %s', (mode) => {
    const prompt = renderStoryImplementerPrompt(story, makeConfig(mode));
    expect(prompt).not.toContain(ORCHESTRATOR_MARKER);
  });

  it('does not include the orchestrator block when prePr is disabled even if mode is orchestrator', () => {
    const prompt = renderStoryImplementerPrompt(story, makeConfig('orchestrator', false));
    expect(prompt).not.toContain(ORCHESTRATOR_MARKER);
  });

  it('keeps the existing pre-PR policy summary line for orchestrator mode', () => {
    const prompt = renderStoryImplementerPrompt(story, makeConfig('orchestrator'));
    expect(prompt).toContain('- Pre-PR review: enabled, mode orchestrator');
  });
});

describe('renderResumeMessage', () => {
  it('on PASS instructs to open the PR and report evidence, without listing findings', () => {
    const verdict: ReviewVerdict = { decision: 'PASS', summary: 'Looks good', loop: 1 };
    const msg = renderResumeMessage(verdict);

    expect(msg).toContain('PASS');
    expect(msg).toContain('approved');
    expect(msg).toMatch(/open the PR/i);
    expect(msg).toMatch(/Git\/PR policy/i);
    expect(msg).not.toContain('Findings:');
  });

  it('on BLOCK enumerates each finding and instructs to re-verify and re-yield', () => {
    const verdict: ReviewVerdict = {
      decision: 'BLOCK',
      summary: 'Needs work',
      loop: 1,
      findings: [
        { title: 'Missing null check', severity: 'high', path: 'src/a.ts', detail: 'guard input' },
        { title: 'Flaky test', severity: 'medium' },
      ],
    };
    const msg = renderResumeMessage(verdict, { loop: 1, loopMode: 'incremental' });

    expect(msg).toContain('BLOCK');
    expect(msg).toContain('Missing null check');
    expect(msg).toContain('Flaky test');
    expect(msg).toContain('high');
    expect(msg).toContain('src/a.ts');
    expect(msg).toContain('guard input');
    expect(msg).toMatch(/re-run.*verification/i);
    expect(msg).toContain('awaiting_review');
    expect(msg).toMatch(/do not open the PR/i);
    // loop is incremented for the next yield
    expect(msg).toContain('loop 2');
    expect(msg).toContain('incremental');
  });

  it('omits the loop/loopMode reminder when no opts are provided', () => {
    const verdict: ReviewVerdict = { decision: 'BLOCK', findings: [{ title: 'X' }] };
    const msg = renderResumeMessage(verdict);
    expect(msg).toContain('X');
    expect(msg).not.toContain('loop mode');
  });
});
