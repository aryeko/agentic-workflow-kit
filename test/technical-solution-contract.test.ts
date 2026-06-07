import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const doc = readFileSync('references/technical-solution-contract.md', 'utf8');

const requiredSections = [
  'Context and existing surfaces',
  'Technical requirements',
  'System architecture diagram',
  'Proposed modules/components',
  'Data/query design',
  'AI prompts/triggers/tools',
  'Observability/events/metrics',
  'Migration/deploy surfaces',
  'Testing strategy',
  'Open technical questions',
  'Inputs for delivery tracker/story briefs',
];

describe('technical solution contract', () => {
  it('documents every required technical solution section', () => {
    for (const section of requiredSections) {
      expect(doc).toContain(section);
    }
  });

  it('defines when plan-delivery-track must require a technical solution', () => {
    expect(doc).toContain('complex technical product work');
    expect(doc).toContain('plan-delivery-track');
    expect(doc).toContain('pause');
  });

  it('keeps PRD, technical solution, tracker, brief, spec, and plan responsibilities distinct', () => {
    expect(doc).toContain('PRD owns what/why');
    expect(doc).toContain('technical solution owns high-level how');
    expect(doc).toContain('delivery tracker owns delivery slicing');
    expect(doc).toContain('story brief is not implementation-ready');
    expect(doc).toContain('detailed technical story spec owns exact implementation design');
    expect(doc).toContain('implementation plan owns execution steps');
  });
});
