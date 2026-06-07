import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const templatePath = 'references/templates/technical-architecture-template.md';
const template = readFileSync(templatePath, 'utf8');

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

describe('technical architecture template', () => {
  it('ships a technical architecture template', () => {
    expect(existsSync(templatePath)).toBe(true);
  });

  it('carries every required architecture section', () => {
    for (const section of requiredSections) {
      expect(template).toContain(`## ${section}`);
    }
  });

  it('links architecture inputs back to PRD acceptance criteria and tracker specs', () => {
    expect(template).toContain('<PRD acceptance criteria IDs>');
    expect(template).toContain('<story/spec inputs>');
    expect(template).toContain('<architecture section IDs>');
  });
});
