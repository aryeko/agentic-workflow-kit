import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';

const skillNames = ['workflow-init', 'plan-product', 'plan-track', 'implement-next', 'workflow-autopilot'] as const;

type SkillName = (typeof skillNames)[number];

type SkillDocument = {
  frontmatter: Record<string, unknown>;
  body: string;
};

const implicitPolicy: Record<SkillName, boolean> = {
  'workflow-init': true,
  'plan-product': true,
  'plan-track': true,
  'implement-next': false,
  'workflow-autopilot': false,
};

const sideEffectfulSkills = new Set<SkillName>(['implement-next', 'workflow-autopilot']);

const skillsWithArguments: Partial<Record<SkillName, string>> = {
  'plan-product': 'slug_or_notes',
  'plan-track': 'prd_slug_or_notes',
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

  it('implement-next documents canonical done semantics before human or CI verification', () => {
    const { body } = readSkill('implement-next');

    expect(body).toContain('The implementer writes `statuses.complete[0]`');
    expect(body).toContain('`verified` is a terminal state applied later by CI or a human');
  });

  it('workflow-autopilot prefers the bundled MCP runtime with CLI fallback', () => {
    const { body } = readSkill('workflow-autopilot');

    expect(body).toContain('bundled MCP runtime');
    expect(body).toContain('CLI fallback');
    expect(body).toContain('WK4 v1 supports only `orchestrator.driver: codex-mcp`');
    expect(body).toContain('If the `agentic-workflow-kit` MCP tools are not present');
    expect(body).toContain('full local disk access without interactive approval');
    expect(body).toContain('Operation requested: $ARGUMENTS');
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
