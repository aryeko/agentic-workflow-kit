import path from 'node:path';
import type { CapabilityDowngrade, ResolvedAgentProfile, ResolvedWorkflowConfig, WorkflowStory } from '../../types.js';
import { renderStoryImplementerPrompt } from '../promptRenderer.js';
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
  return renderStoryImplementerPrompt(story, policy);
}
