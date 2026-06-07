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
  'workflow-autopilot': false,
};

const sideEffectfulSkills = new Set<SkillName>(['implement-next', 'workflow-autopilot']);

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
    expect(body).toContain('show the assumed flow');
    expect(body).toContain('ask only blocking questions');
    expect(body).toContain('record safe assumptions');
    expect(body).toContain('simple feature -> `plan-delivery-track`');
    expect(body).toContain('technical feature -> `design-technical-solution`');
    expect(body).toContain('research-heavy feature -> validation/research first');
  });

  it('design-technical-solution documents the technical solution artifact contract', () => {
    const { body } = readSkill('design-technical-solution');

    expect(body).toContain('technical solution gate');
    expect(body).toContain('references/technical-solution-contract.md');
    expect(body).toContain('references/templates/technical-solution-template.md');
    expect(body).toContain('ask only blocking questions');
    expect(body).toContain('<prdsDir>/<slug>/technical-solution.md');
    expect(body).toContain('suggest `/plan-delivery-track`');
  });

  it('plan-delivery-track emits lightweight story briefs instead of detailed specs', () => {
    const { body } = readSkill('plan-delivery-track');

    expect(body).toContain('Technical solution gate');
    expect(body).toContain('complex technical PRD');
    expect(body).toContain('If technical solution is required and missing, stop');
    expect(body).toContain('<tracksDir>/<track>/stories/<ID>.md');
    expect(body).toContain('story briefs are not implementation-ready');
    expect(body).toContain('Do not write detailed technical story specs');
    expect(body).toContain('PRD criteria and technical solution sections');
  });

  it('implement-next owns detailed technical spec and implementation plan before code', () => {
    const { body } = readSkill('implement-next');

    expect(body).toContain('story brief under `<tracksDir>/<track>/stories/<ID>.md`');
    expect(body).toContain('a detailed spec link (not a story brief)');
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
    expect(body).toContain('pass/block verdict');
    expect(body).toContain('incremental');
    expect(body).toContain('Pre-PR review happens before tracker completion and PR creation');
    expect(body).toContain('Review fixes rerun configured verification');
    expect(body).toContain('Stop after the configured review-loop limit');
    expect(body).toContain('Workers require disjoint write scopes');
    expect(body).toContain('pr.review.maxFixBatches');
    expect(body).toContain('pr.review.rerequestAfterFix');
    expect(body).toContain('.codex/agentic-workflow-kit/runs/<run-id>');
    expect(body).toContain('analyzable by `analyze-run`');
  });

  it('workflow-autopilot prefers the bundled MCP runtime with CLI fallback', () => {
    const { body } = readSkill('workflow-autopilot');

    expect(body).toContain('bundled MCP runtime');
    expect(body).toContain('CLI fallback');
    expect(body).toContain('WK4 v1 supports only `orchestrator.driver: codex-mcp`');
    expect(body).toContain('If the `agentic-workflow-kit` MCP tools are not present');
    expect(body).toContain('full local disk access without interactive approval');
    expect(body).toContain('Operation requested: $ARGUMENTS');
    expect(body).toContain('Codex review as');
    expect(body).toContain('Do not require a native GitHub approval or');
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
