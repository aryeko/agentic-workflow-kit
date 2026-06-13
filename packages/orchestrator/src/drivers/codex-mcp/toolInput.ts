import path from 'node:path';

import { renderExpectedBranch, renderExpectedWorktreePath } from '../../runner/launchMetadata.js';
import type { CapabilityDowngrade, ResolvedAgentProfile, ResolvedWorkflowConfig, WorkflowStory } from '../../types.js';
import type { StoryPromptMetadata } from '../StoryRunner.js';

export interface CodexToolInput {
  cwd: string;
  prompt: string;
  config?: Record<string, unknown>;
  model?: string;
  'approval-policy'?: string;
  sandbox?: string;
}

export function buildCodexToolInput(
  config: ResolvedWorkflowConfig,
  story: WorkflowStory,
  prompt = buildGenericPrompt(story, config),
  cwdAbs = config.codex.childSession.cwdAbs,
  profile?: ResolvedAgentProfile,
  _promptMetadata?: StoryPromptMetadata,
): CodexToolInput {
  const childSession = config.codex.childSession;
  const input: CodexToolInput = {
    cwd: cwdAbs,
    prompt,
  };

  const model = profile?.effectiveModel ?? childSession.model;
  const approvalPolicy = profile?.approvalPolicy ?? childSession.approvalPolicy;
  const sandbox = profile?.sandbox ?? childSession.sandbox;

  if (model) input.model = model;
  if (approvalPolicy) input['approval-policy'] = approvalPolicy;
  if (sandbox) input.sandbox = sandbox;

  // D8 fix: inject the workspace .git and configured worktree directory as codex writable roots so
  // the child session can run `git commit` and `git worktree add` under --sandbox workspace-write.
  // Under workspace-write codex makes .git read-only by default, which prevents any git commit
  // (every commit updates a ref under .git/refs/heads). Granting these two paths as writable roots
  // keeps workspace-write restrictions intact for everything else (network, system dirs) while
  // allowing git isolation to work. This is harmless under danger-full-access (already writable)
  // and read-only (the child would not be committing anyway).
  //
  // Config shape: sandbox_workspace_write is a top-level TOML table in codex config, so we
  // represent it as a nested object { sandbox_workspace_write: { writable_roots: [...] } } — the
  // same mechanism used for scalar keys like model_reasoning_effort, but one level deeper because
  // sandbox_workspace_write is a table, not a bare key. Verified empirically on 2026-06-03 via
  // `codex exec -c 'sandbox_workspace_write.writable_roots=[...]'` (see d8-dispatch-sandbox-plan.md).
  const workspaceRoot = config.workspace.rootAbs;
  const gitAbs = path.join(workspaceRoot, '.git');
  const worktreesAbs = path.join(workspaceRoot, config.git.worktreeDir);
  const writableRootsEntry: Record<string, unknown> = {
    sandbox_workspace_write: { writable_roots: [gitAbs, worktreesAbs] },
  };

  input.config = {
    ...childSession.config,
    ...('model_reasoning_effort' in (childSession.config ?? {})
      ? {}
      : profile?.effectiveReasoning
        ? { model_reasoning_effort: profile.effectiveReasoning }
        : {}),
    ...writableRootsEntry,
  };

  return input;
}

export function codexDriverCapabilityDowngrades(promptMetadata?: StoryPromptMetadata): CapabilityDowngrade[] {
  if (!promptMetadata?.structuredOutputRequired) return [];
  return [
    {
      capability: 'structured-output-enforcement',
      reason: 'Codex MCP V1 records structured-output intent but does not expose a stable schema-enforcement knob.',
      severity: 'warning',
      source: 'driver',
    },
  ];
}

export function buildGenericPrompt(
  story: WorkflowStory,
  policy: Pick<ResolvedWorkflowConfig, 'workspace' | 'git' | 'implement' | 'pr'>,
): string {
  const { git, implement, pr } = policy;
  const metadata = story.metadata;
  const expectedBranch = renderExpectedBranch(story, git);
  const expectedWorktreePath = renderExpectedWorktreePath(policy.workspace.rootAbs, git, story);
  const commitOnBase =
    git.commitOnBase === 'forbid'
      ? `Committing directly on \`${git.baseBranch}\` is forbidden.`
      : `Committing directly on \`${git.baseBranch}\` is allowed by this repo policy.`;
  return [
    'Implement exactly one workflow tracker story from the current repository.',
    '',
    'Story:',
    `- ID: ${story.id}`,
    `- Title: ${story.title}`,
    `- Status: ${story.status}`,
    story.owner ? `- Owner: ${story.owner}` : '- Owner: unowned',
    story.dependencies.length > 0 ? `- Dependencies: ${story.dependencies.join(', ')}` : '- Dependencies: none',
    `- Track ID: ${metadata.trackId}`,
    `- Track: ${metadata.trackTitle}`,
    `- Tracker file: ${metadata.trackerPath}`,
    metadata.wave ? `- Wave/phase: ${metadata.wave}` : null,
    metadata.spec ? `- Spec: ${metadata.spec}` : null,
    metadata.plan ? `- Plan: ${metadata.plan}` : null,
    metadata.pr ? `- PR: ${metadata.pr}` : null,
    '',
    'Git policy (from .workflow/config.yaml - follow exactly):',
    `- Isolation strategy: ${git.strategy}`,
    `- Create/use branch: ${expectedBranch} (base: ${git.baseBranch})`,
    git.strategy === 'worktree' ? `- Worktree directory: ${git.worktreeDir} under the workspace root.` : null,
    expectedWorktreePath ? `- Expected worktree path: ${expectedWorktreePath}` : null,
    expectedWorktreePath ? '- The parent orchestrator has already prepared the expected branch/worktree.' : null,
    expectedWorktreePath ? '- You are launched in the expected worktree cwd.' : null,
    `- ${commitOnBase}`,
    expectedWorktreePath
      ? '- You MUST use the parent-prepared branch/worktree, commit your work there, and confirm the commit exists BEFORE reporting the story done. An uncommitted tracker edit is not acceptance.'
      : '- You MUST create or use the isolated branch, commit your work there, and confirm the commit exists BEFORE reporting the story done. An uncommitted tracker edit is not acceptance.',
    '- Do not create story worktrees outside the workspace root unless the repo config explicitly says so.',
    '- Do not symlink node_modules from another checkout. Use the package manager/store normally, and stop for approval if dependencies require network or privileged setup.',
    '',
    'PR policy (from .workflow/config.yaml - follow exactly):',
    `- Create PR: ${pr.create ? 'yes' : 'no'}.`,
    `- CI gate: ${pr.ci.wait ? `wait${pr.ci.command ? ` with \`${pr.ci.command}\`` : ' with the default PR checks command'}` : 'do not wait'}.`,
    reviewGateLine(pr.review),
    ...reviewGateDetails(pr.review),
    `- PR review fix batches: ${pr.review.maxFixBatches}.`,
    `- Re-request review after fixes: ${pr.review.rerequestAfterFix ? 'yes' : 'no'}.`,
    `- Review wait timeout: ${pr.review.waitTimeoutMinutes} minutes.`,
    `- Auto-merge: ${pr.merge.auto ? `yes (${pr.merge.method})` : 'no'}.`,
    `- Delete branch after merge: ${pr.merge.deleteBranch ? 'yes' : 'no'}.`,
    pr.merge.auto
      ? `- Before merge, fetch the latest \`${git.baseBranch}\`, rebase or otherwise update the story branch onto \`${git.baseBranch}\`, and rerun the required verification after the base update.`
      : null,
    pr.merge.auto
      ? '- If the base update conflicts or verification fails, stop and report the blocker instead of merging.'
      : null,
    '',
    'Implementation policy (from .workflow/config.yaml - follow exactly):',
    `- Pre-PR review: ${implement.review.prePr.enabled ? 'enabled' : 'disabled'}, mode ${implement.review.prePr.mode}, max loops ${implement.review.prePr.maxLoops}, loop mode ${implement.review.prePr.loopMode}.`,
    `- Semantic checks: ${implement.review.semanticChecks.enabled ? 'enabled' : 'disabled'}.`,
    `- Sidecar subagents: ${implement.subagents.enabled ? 'enabled' : 'disabled'}, max parallel ${implement.subagents.maxParallel}.`,
    `- Worker subagents may write files: ${implement.subagents.allowWorkers ? 'yes' : 'no'}.`,
    '- Subagents are for bounded sidecar analysis/review; do not delegate blocking critical-path implementation.',
    '- Workers require disjoint write scopes and explicit permission.',
    '- If pre-PR review mode auto downgrades to inline, record/report the downgrade and use the full review checklist.',
    '- If pre-PR review mode subagent cannot spawn a reviewer, fail closed and report the blocker.',
    '- Validate `spawn_agent` payloads before calling; use exactly one accepted shape and do not mix message and items.',
    '- Review context must include product docs, architecture docs, story brief, spec, and plan, and ask for correctness, code quality, and spec compliance.',
    '',
    'Instructions:',
    '1. Read repository instructions first, including AGENTS.md when present.',
    '2. Read the selected tracker row and any linked spec, plan, related docs, or acceptance notes.',
    expectedWorktreePath
      ? `3. Before editing, verify the parent-prepared worktree: cwd must be \`${expectedWorktreePath}\`, git top-level must be \`${expectedWorktreePath}\`, current branch must be \`${expectedBranch}\`, and the configured base branch \`${git.baseBranch}\` must exist. If cwd, git top-level, branch, or worktree path verification fails, stop and report the blocker before editing.`
      : '3. Before editing, run a child preflight: verify cwd, git top-level, current branch, expected branch, and configured base branch against the Git policy above.',
    '4. Implement only this story. Do not bundle adjacent tracker rows or unrelated cleanup.',
    '5. Follow the Git policy above and the repository documentation, review, and verification rules.',
    '6. If Browser rendered verification is unavailable or local browser env is missing, fall back to repo Playwright/e2e gates, record the rendered-verification downgrade reason and evidence, and avoid ad hoc browser scripts unless explicitly required.',
    '7. Do not re-request Codex review after fix batches when rerequestAfterFix is false; reply/resolve findings and continue when configured gates pass.',
    '8. Update the tracker row through the repository workflow when the story is complete.',
    '9. The tracker row status is the only completion authority; child prose is not enough.',
    '10. Report changed files, verification evidence, and blockers.',
  ]
    .filter((line): line is string => line !== null)
    .join('\n');
}

function reviewGateLine(review: ResolvedWorkflowConfig['pr']['review']): string {
  if (review.wait === 'none') return '- Review gate: do not wait.';
  if (review.wait === 'human') return '- Review gate: wait for human review; do not auto-merge.';
  return `- Review gate: wait for bot \`${review.bot}\`.`;
}

function reviewGateDetails(review: ResolvedWorkflowConfig['pr']['review']): string[] {
  if (review.wait !== 'bot') return [];

  const triage = review.triageComments
    ? 'When triageComments is true, fix or explicitly reply to every bot finding before merge.'
    : 'When triageComments is false, report bot findings but do not block solely on triage.';

  if (review.bot.toLowerCase() !== 'codex') {
    return [`- Bot review comments: ${triage}`];
  }

  return [
    '- Codex review signal is reaction/comment based, not a native GitHub approval gate.',
    '- Check PR body reactions, issue comments, and PR review comments before deciding whether Codex review is pending, approved, or has findings.',
    `- A +1 reaction from bot \`${review.bot}\` means approval / clear / no findings.`,
    `- An eyes reaction from bot \`${review.bot}\` means review is pending; it is not approval.`,
    `- Codex PR review comments or PR comments are findings. ${triage}`,
    '- Do not require a GitHub PullRequestReview APPROVED or CHANGES_REQUESTED state from Codex.',
    '- Do not re-request Codex review after a +1 reaction has been observed.',
    '- Do not mention @codex unless auto review failed to start or a manual retry is needed.',
  ];
}
