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
});
