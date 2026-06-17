import { renderExpectedBranch, renderExpectedWorktreePath } from '../runner/launchMetadata.js';
import type { ResolvedWorkflowConfig, ReviewVerdict, WorkflowStory } from '../types.js';

export function renderStoryImplementerPrompt(
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
    pr.create
      ? '- Final evidence MUST include the PR URL and PR number. If PR creation/auth fails, stop and report that blocker.'
      : null,
    pr.ci.wait
      ? '- Final evidence MUST include CI/check evidence: command used, pass/fail/skipped status, and detail. Failed or unknown required checks block merge.'
      : null,
    pr.review.wait === 'bot'
      ? '- Final evidence MUST include bot review evidence: reviewer/bot, mechanism, signal, findings count, and triage/reply status for findings.'
      : null,
    pr.merge.auto
      ? '- Do not merge the PR or delete the remote branch yourself. The parent orchestrator verifies GitHub state and performs or authorizes irreversible merge/branch cleanup.'
      : null,
    pr.merge.auto
      ? '- Final evidence MUST include pre-merge readiness evidence: PR number/URL, base freshness, CI/check status, review signal, and any blocker. Parent-side GitHub verification is completion authority.'
      : null,
    '- Final evidence MUST identify blockers such as missing review signal, auth failure, stale base, merge conflict, failed checks, failed verification, missing PR state, or inconsistent artifacts.',
    pr.merge.auto
      ? `- Before reporting pre-merge readiness, fetch the latest \`${git.baseBranch}\`, rebase or otherwise update the story branch onto \`${git.baseBranch}\`, and rerun the required verification after the base update.`
      : null,
    pr.merge.auto
      ? '- If the base update conflicts or verification fails, stop and report the blocker instead of claiming readiness.'
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
    '- Validate reviewer payloads before calling; use exactly one accepted shape and do not mix message and items.',
    '- Review context must include product docs, architecture docs, story brief, spec, and plan, and ask for correctness, code quality, and spec compliance.',
    ...orchestratorCheckpointBlock(implement.review.prePr),
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
    '7. Do not re-request review after fix batches when rerequestAfterFix is false; reply/resolve findings and continue when configured gates pass.',
    '8. Update the tracker row through the repository workflow when the story is complete.',
    '9. The tracker row status is the only completion authority; child prose is not enough.',
    '10. Report changed files, verification evidence, and blockers.',
  ]
    .filter((line): line is string => line !== null)
    .join('\n');
}

/**
 * Extra child-prompt lines for orchestrator pre-PR review mode. The child must yield at the
 * pre-PR checkpoint (turn boundary) instead of self-reviewing or opening the PR, and resume on
 * the supervising orchestrator's PASS/BLOCK verdict. Returns [] for every other mode so the
 * non-orchestrator prompt text stays unchanged.
 */
function orchestratorCheckpointBlock(prePr: ResolvedWorkflowConfig['implement']['review']['prePr']): string[] {
  if (!prePr.enabled || prePr.mode !== 'orchestrator') return [];
  return [
    `- Pre-PR review checkpoint (orchestrator mode, max ${prePr.maxLoops} loops, loop mode ${prePr.loopMode}):`,
    '  - At the pre-PR checkpoint, do NOT self-review and do NOT open the PR. A supervising orchestrator owns the review.',
    '  - Write a review-request packet (the diff, spec/plan refs, and the verification output) so the orchestrator can review without re-deriving context.',
    '  - End the turn emitting `structuredContent.prePrReview = { "status": "awaiting_review", packetPath, loop, diffRef, summary }` pointing at that packet.',
    '  - This is a turn-boundary yield, not a blocking pause: end the turn cleanly; the orchestrator will resume this thread with a PASS/BLOCK verdict.',
    '  - On resume with PASS: review is approved; open the PR per the Git/PR policy above and report final evidence.',
    `  - On resume with BLOCK: apply the findings, re-run the configured verification, and yield again (status awaiting_review) with an incremented loop, up to ${prePr.maxLoops} loops.`,
    '  - Open the PR only after a PASS verdict; never open the PR without a PASS verdict from the orchestrator.',
  ];
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
    '- Bot review signal is reaction/comment based, not a native GitHub approval gate.',
    '- Check PR body reactions, issue comments, and PR review comments before deciding whether review is pending, approved, or has findings.',
    `- A +1 reaction from bot \`${review.bot}\` means approval / clear / no findings.`,
    `- An eyes reaction from bot \`${review.bot}\` means review is pending; it is not approval.`,
    `- PR review comments or PR comments are findings. ${triage}`,
    '- Do not require a GitHub PullRequestReview APPROVED or CHANGES_REQUESTED state from the review bot.',
    '- Do not re-request review after a +1 reaction has been observed.',
  ];
}

/**
 * Builds the message the supervising orchestrator sends to resume a child waiting in
 * `awaiting_review` (orchestrator pre-PR review mode). PASS approves and tells the child to
 * open the PR; BLOCK enumerates findings and tells the child to fix, re-verify, and re-yield.
 */
export function renderResumeMessage(
  verdict: ReviewVerdict,
  opts?: { loop?: number; loopMode?: 'incremental' | 'full' },
): string {
  const loop = opts?.loop ?? verdict.loop;
  const nextLoop = loop !== undefined ? loop + 1 : undefined;
  const loopMode = opts?.loopMode;

  if (verdict.decision === 'PASS') {
    return [
      'Pre-PR review verdict: PASS.',
      verdict.summary ? `Reviewer summary: ${verdict.summary}` : null,
      'The review is approved. Open the PR per the Git/PR policy and report final evidence (PR URL/number, CI status, verification results).',
      loop !== undefined ? `(Resolved review loop ${loop}.)` : null,
    ]
      .filter((line): line is string => line !== null)
      .join('\n');
  }

  const findings = verdict.findings ?? [];
  const findingLines =
    findings.length > 0
      ? [
          'Findings:',
          ...findings.map((finding, index) => {
            const meta = [finding.severity, finding.path].filter((part): part is string => Boolean(part)).join(', ');
            const head = `${index + 1}. ${finding.title}${meta ? ` (${meta})` : ''}`;
            return finding.detail ? `${head}: ${finding.detail}` : head;
          }),
        ]
      : ['No specific findings were enumerated; address the summary before re-yielding.'];

  return [
    'Pre-PR review verdict: BLOCK.',
    verdict.summary ? `Reviewer summary: ${verdict.summary}` : null,
    ...findingLines,
    'Apply these findings, re-run the configured verification, and re-yield for review (emit `structuredContent.prePrReview` with status awaiting_review).',
    nextLoop !== undefined ? `Increment the review loop to loop ${nextLoop} for the next yield.` : null,
    loopMode ? `Loop mode is ${loopMode}.` : null,
    'Do not open the PR until the orchestrator returns a PASS verdict.',
  ]
    .filter((line): line is string => line !== null)
    .join('\n');
}
