import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

function expectNoPlaceholders(path: string): void {
  expect(read(path), `${path} should not contain template placeholders`).not.toMatch(/TODO|\[TODO|Replace with/);
}

function readSkill(path: string): { frontmatter: string; body: string } {
  const match = read(path).match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  expect(match, `${path} must have YAML frontmatter`).not.toBeNull();

  const [, frontmatter, body] = match as RegExpMatchArray;
  return { frontmatter, body };
}

describe('local coordinated worker kit', () => {
  it('tracks only the intended Codex config and agent files', () => {
    const gitignore = read('.gitignore');

    expect(gitignore).toContain('.codex/*');
    expect(gitignore).toContain('!.codex/config.toml');
    expect(gitignore).toContain('!.codex/agents/');
    expect(gitignore).toContain('!.codex/agents/*.toml');
    expect(gitignore).toContain('!.codex/agents/*.md');
    expect(gitignore).toContain('.codex/agentic-workflow-kit/**');
    expect(gitignore).not.toContain('\n.codex/\n');
  });

  it('keeps root Codex config minimal and non-recursive', () => {
    const config = read('.codex/config.toml');

    expect(config).toContain('[features]');
    expect(config).toContain('multi_agent = true');
    expect(config).toContain('[agents]');
    expect(config).toContain('max_threads = 6');
    expect(config).toContain('max_depth = 1');
    expect(config).not.toMatch(
      /compact_prompt|experimental_compact_prompt_file|mcp_servers|provider|auth|profile|hooks/,
    );
  });

  it('defines a scoped coordinator agent with nested delegation only there', () => {
    const coordinator = read('.codex/agents/wave-coordinator.toml');
    const instructionsIndex = coordinator.indexOf('developer_instructions =');
    const agentsIndex = coordinator.indexOf('[agents]');

    expect(coordinator).toContain('name = "wave-coordinator"');
    expect(coordinator).toContain('experimental_compact_prompt_file = "./wave-coordinator-compact.md"');
    expect(instructionsIndex).toBeGreaterThan(-1);
    expect(agentsIndex).toBeGreaterThan(-1);
    expect(instructionsIndex).toBeLessThan(agentsIndex);
    expect(coordinator).toContain('[agents]');
    expect(coordinator).toContain('max_depth = 2');
    expect(coordinator).toContain('max_threads = 6');
    expect(coordinator).toContain('Spawn task-implementer and task-reviewer agents only when');
    expect(coordinator).toContain('Do not push, open PRs, merge');
    expect(existsSync('.codex/agents/wave-coordinator-compact.md')).toBe(true);
  });

  it('keeps implementer and reviewer bounded', () => {
    const implementer = read('.codex/agents/task-implementer.toml');
    const reviewer = read('.codex/agents/task-reviewer.toml');

    expect(implementer).toContain('name = "task-implementer"');
    expect(implementer).toContain('Do not stage, commit, push, archive, create subagents');
    expect(implementer).toContain('write scope');
    expect(implementer).not.toContain('max_depth = 2');

    expect(reviewer).toContain('name = "task-reviewer"');
    expect(reviewer).toContain('sandbox_mode = "read-only"');
    expect(reviewer).toContain('Return exactly one verdict: APPROVE or CHANGES-NEEDED.');
    expect(reviewer).toContain('Do not edit files, stage');
    expect(reviewer).toContain('create subagents');
    expect(reviewer).not.toContain('max_depth = 2');
  });

  it('defines concise local skills with valid frontmatter and fail-closed rules', () => {
    const skillPaths = [
      '.agents/skills/create-coordinated-wave/SKILL.md',
      '.agents/skills/run-coordinated-wave/SKILL.md',
    ];

    for (const path of skillPaths) {
      expect(existsSync(path)).toBe(true);
      expectNoPlaceholders(path);
      const { frontmatter, body } = readSkill(path);

      expect(frontmatter).toMatch(/^name: [a-z0-9-]+$/m);
      expect(frontmatter).toMatch(/^description: .+/m);
      expect(body.length).toBeLessThan(9000);
    }

    const createSkill = read(skillPaths[0]);
    expect(createSkill).toMatch(/Do not\s+run the plan, spawn agents/);
    expect(createSkill).toContain('READY TO RUN');
    expect(createSkill).toContain('NOT READY');
    expect(createSkill).toContain('hard dependency targets exist');

    const runSkill = read(skillPaths[1]);
    expect(runSkill).toContain('Stop if the plan is not `READY TO RUN`');
    expect(runSkill).toContain('Spawn `task-implementer`');
    expect(runSkill).toContain('Spawn `task-reviewer`');
    expect(runSkill).toContain('Stage only the unit write scope');
    expect(runSkill).toContain('After compaction or thread resume, read the wave README');
  });

  it('keeps coordinated waves as docs, not runtime or plugin surfaces', () => {
    const docs = read('docs/coordinated-waves/README.md');

    expect(docs).toContain('local development infrastructure');
    expect(docs).toMatch(/not the\s+v1 runtime control plane/);
    expect(docs).toContain('not a public plugin surface');
    expect(docs).toContain('[workflow-report.md](workflow-report.md)');
    expect(docs).toContain('[design-spec.md](design-spec.md)');
    expect(docs).toContain('[usage.md](usage.md)');
    expect(docs).toContain('Do not add schemas, generated prompt folders, event logs, hooks');
    expect(docs).toContain('READY TO RUN | NOT READY');

    expect(existsSync('.codex-plugin')).toBe(false);
    expect(existsSync('.claude-plugin')).toBe(false);
    expect(existsSync('skills')).toBe(false);
    expect(readdirSync('packages')).toEqual(['README.md']);
    expect(existsSync('.codex/agentic-workflow-kit')).toBe(false);
  });

  it('documents the analyzed workflow and implemented local design', () => {
    const report = read('docs/coordinated-waves/workflow-report.md');
    const design = read('docs/coordinated-waves/design-spec.md');
    const usage = read('docs/coordinated-waves/usage.md');

    expectNoPlaceholders('docs/coordinated-waves/workflow-report.md');
    expectNoPlaceholders('docs/coordinated-waves/design-spec.md');
    expectNoPlaceholders('docs/coordinated-waves/usage.md');

    expect(report).toContain('019edc1f-5965-71e3-b0f4-79670f14585c');
    expect(report).toContain('019edc8d-0a25-7803-b7c2-401dca862003');
    expect(report).toContain('parallelism over stable inputs');
    expect(report).toContain('Same-Reviewer Incremental Loops');
    expect(report).toContain('It does not yet prove a full production run');

    expect(design).toContain('implemented local v1 design');
    expect(design).toContain('The same implementer handles fixes after review');
    expect(design).toContain('There is no separate repairer');
    expect(design).toContain('Wave plans are durable docs under `docs/coordinated-waves/<wave-id>/`');
    expect(design).toContain('Do not add these for local v1');
    expect(design).toContain('run databases');
    expect(design).toContain('The root config must not define provider, auth, profile, hooks, MCP servers');

    expect(usage).toContain('Official Codex docs basis');
    expect(usage).toContain('Normal Desktop App Flow');
    expect(usage).toContain('$create-coordinated-wave');
    expect(usage).toContain('$run-coordinated-wave');
    expect(usage).toMatch(/You are the coordinator in\s+this main thread/);
    expect(usage).toContain('Can I Select The Orchestrator Agent In The App?');
    expect(usage).toContain('The docs do not describe selecting a project custom agent');
    expect(usage).toContain('the visible main thread is the orchestrator');
    expect(usage).toContain('Optional Offloaded Coordinator');
  });

  it('keeps skill UI metadata lightweight when present', () => {
    const metadataPaths = [
      '.agents/skills/create-coordinated-wave/agents/openai.yaml',
      '.agents/skills/run-coordinated-wave/agents/openai.yaml',
    ];

    for (const path of metadataPaths) {
      expect(existsSync(path)).toBe(true);
      expectNoPlaceholders(path);
      expect(read(path)).toContain('interface:');
    }

    expect(existsSync(join('.agents', 'plugins'))).toBe(false);
  });
});
