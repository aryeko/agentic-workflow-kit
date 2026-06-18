import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';

const skillNames = [
  'workflow-init',
  'define-product',
  'design-technical-solution',
  'plan-delivery-track',
  'implement-next',
  'promote-to-canonical',
  'workflow-autopilot',
] as const;

type SkillName = (typeof skillNames)[number];

type SkillDocument = {
  frontmatter: Record<string, unknown>;
  body: string;
};

const implicitPolicy: Record<SkillName, boolean> = {
  'workflow-init': true,
  'define-product': true,
  'design-technical-solution': true,
  'plan-delivery-track': true,
  'implement-next': false,
  'promote-to-canonical': false,
  'workflow-autopilot': false,
};

const sideEffectfulSkills = new Set<SkillName>(['implement-next', 'promote-to-canonical', 'workflow-autopilot']);

const skillsWithArguments: Partial<Record<SkillName, string>> = {
  'define-product': 'slug_or_notes',
  'design-technical-solution': 'prd_slug_or_notes',
  'plan-delivery-track': 'prd_slug_or_notes',
  'implement-next': 'story_id',
  'workflow-autopilot': 'command',
};

function readSkill(skillName: SkillName): SkillDocument {
  const content = readFileSync(`skills/${skillName}/SKILL.md`, 'utf8');
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  expect(match, `${skillName} must have YAML frontmatter`).not.toBeNull();

  const [, frontmatterSource, body] = match as RegExpMatchArray;

  return {
    frontmatter: YAML.parse(frontmatterSource) as Record<string, unknown>,
    body,
  };
}

function readOpenAiMetadata(skillName: SkillName): Record<string, unknown> {
  return YAML.parse(readFileSync(`skills/${skillName}/agents/openai.yaml`, 'utf8')) as Record<string, unknown>;
}

function findPluginRootReferences(body: string): string[] {
  const references = [...body.matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/([^\s)`"'|,]+)/g)];
  return references.map((match) => match[1] ?? '');
}

describe('skill authoring', () => {
  it.each(skillNames)('%s has parseable required frontmatter', (skillName) => {
    const { frontmatter } = readSkill(skillName);

    expect(frontmatter.name).toBe(skillName);
    expect(frontmatter.description).toEqual(expect.any(String));
    expect((frontmatter.description as string).trim()).not.toBe('');
    expect((frontmatter.description as string).length).toBeLessThanOrEqual(1200);
    expect(frontmatter['argument-hint']).toEqual(expect.any(String));
    expect(frontmatter['user-invocable']).toBe(true);

    if (skillsWithArguments[skillName]) {
      expect(frontmatter.arguments).toBe(skillsWithArguments[skillName]);
    }
  });

  it('marks side-effectful skills explicit-invocation only for Claude Code', () => {
    for (const skillName of skillNames) {
      const { frontmatter } = readSkill(skillName);
      expect(frontmatter['disable-model-invocation']).toBe(sideEffectfulSkills.has(skillName) ? true : undefined);
    }
  });

  it.each(skillNames)('%s has Codex app metadata with the expected invocation policy', (skillName) => {
    expect(existsSync(`skills/${skillName}/agents/openai.yaml`)).toBe(true);
    const metadata = readOpenAiMetadata(skillName);
    const ui = metadata.interface as Record<string, unknown> | undefined;
    const policy = metadata.policy as Record<string, unknown> | undefined;

    expect(ui?.display_name).toEqual(expect.any(String));
    expect(ui?.short_description).toEqual(expect.any(String));
    expect(ui?.default_prompt).toEqual(expect.any(String));
    expect(policy?.allow_implicit_invocation).toBe(implicitPolicy[skillName]);
  });

  it('does not ship a separate commands layer', () => {
    expect(existsSync('commands')).toBe(false);
  });

  it('workflow-init points at the current preset implementation', () => {
    const { body } = readSkill('workflow-init');

    expect(body).not.toContain('src/config/selectPreset.ts');
    expect(body).toContain('packages/orchestrator/src/config/preset.ts');
  });

  it('workflow-init scaffolds the bundled example-tracker path', () => {
    const { body } = readSkill('workflow-init');

    expect(body).toContain('<tracksDir>/example-tracker/README.md');
    expect(body).not.toContain('<tracksDir>/example-track/README.md');
  });

  it('does not ship the old public planning skill names', () => {
    expect(existsSync('skills/plan-product')).toBe(false);
    expect(existsSync('skills/plan-architecture')).toBe(false);
    expect(existsSync('skills/plan-track')).toBe(false);
  });

  it('define-product documents context-rich fast path and next-step routing', () => {
    const { body } = readSkill('define-product');

    expect(body).toContain('context-rich fast path');
    expect(body).toContain('notes, brainstorming output, existing docs, or session context');
    expect(body).toContain('show the assumed flow');
    expect(body).toContain('ask only blocking questions');
    expect(body).toContain('record safe assumptions');
    expect(body).toContain('Assumptions and blockers');
    expect(body).toContain('Artifact boundaries');
    expect(body).toContain('simple feature -> `plan-delivery-track`');
    expect(body).toContain('technical feature -> `design-technical-solution`');
    expect(body).toContain('research-heavy feature -> validation/research first');
  });

  it('design-technical-solution documents the technical solution artifact contract', () => {
    const { body, frontmatter } = readSkill('design-technical-solution');
    const description = frontmatter.description as string;

    expect(description).toContain('PRD, existing design docs, technical notes, or session context');
    expect(description).not.toContain('Use after a PRD exists');
    expect(body).toContain('technical solution gate');
    expect(body).toContain('PRD, existing design docs, technical notes, or session context');
    expect(body).toContain('derive a short kebab-case');
    expect(body).toContain('references/technical-solution-contract.md');
    expect(body).toContain('references/templates/technical-solution-template.md');
    expect(body).toContain('ask only blocking questions');
    expect(body).toContain('record safe assumptions');
    expect(body).toContain('Assumptions and blockers');
    expect(body).toContain('Artifact boundaries');
    expect(body).toContain('<prdsDir>/<slug>/technical-solution.md');
    expect(body).toContain('suggest `/plan-delivery-track`');
  });

  it('plan-delivery-track emits lightweight story briefs instead of detailed specs', () => {
    const { body, frontmatter } = readSkill('plan-delivery-track');
    const description = frontmatter.description as string;

    expect(description).toContain(
      'PRD plus technical solution, a technical solution alone, or explicit backlog/design context',
    );
    expect(description).not.toContain('Use after a PRD exists');
    expect(description).not.toContain('If no PRD exists, stop');
    expect(body).toContain('Technical solution gate');
    expect(body).toContain(
      'PRD plus technical solution, a technical solution alone, or explicit backlog/design context',
    );
    expect(body).toContain('complex technical PRD');
    expect(body).toContain('If technical solution is required and missing, stop');
    expect(body).toContain('Assumptions and blockers');
    expect(body).toContain('Artifact boundaries');
    expect(body).toContain('<tracksDir>/<track>/stories/<ID>.md');
    expect(body).toContain('story files are lightweight and not implementation-ready');
    expect(body).toContain('Do not enrich story files');
    expect(body).toContain('PRD criteria and technical solution sections');
  });

  it('implement-next owns enrichment to implementation-ready and implementation plan before code', () => {
    const { body } = readSkill('implement-next');

    expect(body).toContain('story file under `<tracksDir>/<track>/stories/<ID>.md`');
    expect(body).toContain('a detailed spec link (not a story file)');
    expect(body).toContain('No implementation plan or code while the detailed technical story spec is missing');
    expect(body).toContain('blocking technical questions');
    expect(body).toContain('<specsDir>');
    expect(body).toContain('<plansDir>');
  });

  it('implement-next documents canonical done semantics before human or CI verification', () => {
    const { body } = readSkill('implement-next');

    expect(body).toContain('The implementer writes `statuses.complete[0]`');
    expect(body).toContain('`verified` is a terminal state applied later by CI or a human');
  });

  it('implement-next documents Codex bot review as reaction/comment based', () => {
    const { body } = readSkill('implement-next');

    expect(body).toContain('Codex-style GitHub reaction/comment review');
    expect(body).toContain('eyes reaction on the PR body means Codex review started or is pending');
    expect(body).toContain('thumbs-up reaction on the PR body means Codex found no issues');
    expect(body).toContain('Codex PR review comments or PR comments are findings');
    expect(body).toContain('does not have to submit a native GitHub `PullRequestReview`');
    expect(body).toContain('Mentioning `@codex` is a fallback/manual trigger only');
  });

  it('implement-next documents configured review loops, subagent policy, and interactive journals', () => {
    const { body } = readSkill('implement-next');

    expect(body).toContain('implement.review.prePr.enabled');
    expect(body).toContain('implement.review.prePr.mode');
    expect(body).toContain('implement.review.prePr.maxLoops');
    expect(body).toContain('implement.review.prePr.loopMode');
    expect(body).toContain('implement.subagents.allowWorkers');
    expect(body).toContain('review context packet');
    expect(body).toContain('Do not include `items: []` alongside `message`');
    expect(body).toContain('clear `PASS` or `BLOCK` verdict');
    expect(body).toContain('incremental');
    expect(body).toContain('Pre-PR review happens before tracker completion and PR creation');
    expect(body).toContain('Review fixes rerun configured verification');
    expect(body).toContain('Stop after the configured review fix-batch limit');
    expect(body).toContain('Workers require disjoint write scopes');
    expect(body).toContain('pr.review.maxFixBatches');
    expect(body).toContain('pr.review.rerequestAfterFix');
    expect(body).toContain('.codex/agentic-workflow-kit/runs/<run-id>');
    expect(body).toContain('analyzable by `analyze-run`');
    expect(body).toContain('pre_pr_review_blocked');
    expect(body).toContain('pre_pr_review_completed');
    expect(body).toContain('pre_pr_review_fix_batch_applied');
    expect(body).toContain('fail closed before PR creation');
    expect(body).toContain(
      'You are explicitly authorized to delegate the pre-PR review to a read-only review subagent if configured.',
    );
    expect(body).toContain('Never record `actualMode: "subagent"`');
    expect(body).toContain('acceptance criteria against actual behavior');
    expect(body).toContain('Do not request visible UX changes unless those sources explicitly require them');
    expect(body).toContain('percent vs count/unit formatting');
    expect(body).toContain('locale-backed Hebrew copy semantics');
    expect(body).toContain('append a final verification completion event before merge');
    expect(body).toContain('Before editing, run a child preflight');
    expect(body).toContain('git top-level');
    expect(body).toContain('expected worktree path');
    expect(body).toContain('configured base branch');
    expect(body).toContain('Validate `spawn_agent` payloads before calling');
    expect(body).toContain('correctness, code quality, and spec compliance');
    expect(body).toContain('If Browser rendered verification is unavailable');
    expect(body).toContain('fall back to repo Playwright/e2e gates');
    expect(body).toContain('record the rendered-verification downgrade reason and evidence');
    expect(body).toContain('Do not re-request Codex review after fix batches when rerequestAfterFix is false');
  });

  it('workflow-autopilot prefers the plugin-provided MCP runtime with CLI fallback', () => {
    const { body } = readSkill('workflow-autopilot');

    expect(body).toContain('plugin-provided MCP runtime');
    expect(body).toContain('CLI fallback');
    expect(body).toContain('WK4 v1 supports only `orchestrator.driver: codex-mcp`');
    expect(body).toContain('If the `agentic-workflow-kit` MCP tools are not present');
    expect(body).toContain('full local disk access without interactive approval');
    expect(body).toContain('Operation requested: $ARGUMENTS');
    expect(body).toContain('Codex review as');
    expect(body).toContain('Do not require a native GitHub approval or');
    expect(body).toContain('workflow_run_status');
    expect(body).toContain('workflow_run_stream');
    expect(body).toContain('workflow_run_subscribe');
    expect(body).toContain('workflow_run_subscription_poll');
    expect(body).toContain('workflow_run_unsubscribe');
    expect(body).toContain('workflow_run_inspect');
    expect(body).toContain('workflow_run_report');
    expect(body).toContain('workflow_run_export');
    expect(body).toContain('workflow_run_control');
    expect(body).toContain('watch_run_start');
    expect(body).toContain('watch_run_poll');
    expect(body).toContain('watch_run_stop');
    expect(body).toContain('workflow_child_reply');
    expect(body).toContain('workflow_child_interrupt');
    expect(body).toContain('workflow_driver_check');
    expect(body).toContain('codex_reply');
    expect(body).toContain('codex_interrupt');
  });

  it.each(skillNames)('%s only references existing plugin-root paths', (skillName) => {
    const { body } = readSkill(skillName);
    const missingPaths = findPluginRootReferences(body).filter((rawPath) => {
      const cleanedPath = rawPath.replace(/[).,;:]+$/, '');
      const normalizedPath = normalize(cleanedPath);
      const candidate = join(process.cwd(), normalizedPath);
      return !existsSync(candidate) && !existsSync(dirname(candidate));
    });

    expect(missingPaths).toEqual([]);
  });
});
