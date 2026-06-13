import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const contract = readFileSync('references/story-brief-contract.md', 'utf8');
const templatePath = 'references/templates/story-brief-template.md';
const template = readFileSync(templatePath, 'utf8');

const requiredSections = [
  'PRD criteria',
  'Technical solution sections',
  'Dependencies',
  'Scope boundary',
  'Assumptions and blockers',
  'Artifact boundaries',
  'Candidate surfaces',
  'Validation expectations',
  'Open technical questions',
];

describe('story brief contract and template', () => {
  it('ships a story brief contract and raw template', () => {
    expect(existsSync('references/story-brief-contract.md')).toBe(true);
    expect(existsSync(templatePath)).toBe(true);
    expect(template.startsWith('---\ntitle: <ID> story brief')).toBe(true);
  });

  it('documents every required story brief section', () => {
    for (const section of requiredSections) {
      expect(contract).toContain(section);
      expect(template).toContain(`## ${section}`);
    }
  });

  it('states story briefs are not implementation-ready', () => {
    const note = 'not implementation-ready; create a detailed technical story spec before plan/code';
    expect(contract).toContain(note);
    expect(template).toContain(note);
  });

  it('requires assumptions/blockers and artifact boundaries', () => {
    expect(contract).toContain('safe assumptions');
    expect(contract).toContain('blocking questions');
    expect(contract).toContain('Runtime artifacts');
    expect(contract).toContain('context-derived outcome labels');
    expect(template).toContain('## Assumptions and blockers');
    expect(template).toContain('## Artifact boundaries');
    expect(template).toContain('<PREFIX-n or context-derived outcome label>');
  });
});
