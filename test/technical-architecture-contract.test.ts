import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const doc = readFileSync('references/technical-architecture-contract.md', 'utf8');

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
  'Inputs for delivery tracker/per-story specs',
];

describe('technical architecture contract', () => {
  it('documents every required architecture section', () => {
    for (const section of requiredSections) {
      expect(doc).toContain(section);
    }
  });

  it('defines when plan-track must require architecture', () => {
    expect(doc).toContain('complex technical product work');
    expect(doc).toContain('plan-track');
    expect(doc).toContain('pause');
  });

  it('keeps PRD, architecture, and tracker responsibilities distinct', () => {
    expect(doc).toContain('PRD owns what/why');
    expect(doc).toContain('architecture owns high-level how');
    expect(doc).toContain('tracker owns delivery slicing');
  });
});
