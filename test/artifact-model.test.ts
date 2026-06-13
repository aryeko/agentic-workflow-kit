import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

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
    const spec = readFileSync(
      'docs/superpowers/specs/2026-06-14-awk06-runtime-event-and-artifact-model-design.md',
      'utf8',
    );

    expect(spec).toContain('summary.json');
    expect(spec).toContain('rows.json');
    expect(spec).toContain('budgets.json');
    expect(spec).toContain('transcripts.json');
    expect(spec).toContain('Existing run artifacts without `summary.json`');
  });
});

function readSkillBody(skillName: string): { body: string } {
  const content = readFileSync(`skills/${skillName}/SKILL.md`, 'utf8');
  const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  if (!match) throw new Error(`${skillName} must have frontmatter`);
  return { body: match[1] ?? '' };
}
