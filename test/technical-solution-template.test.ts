import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const templatePath = 'references/templates/technical-solution-template.md';
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
  'Inputs for delivery tracker/story briefs',
];

describe('technical solution template', () => {
  it('ships a technical solution template', () => {
    expect(existsSync(templatePath)).toBe(true);
  });

  it('starts with YAML frontmatter and is directly copyable', () => {
    expect(template.startsWith('---\ntitle: <Product name> technical solution')).toBe(true);
    expect(template).not.toContain('```markdown');
  });

  it('carries every required technical solution section', () => {
    for (const section of requiredSections) {
      expect(template).toContain(`## ${section}`);
    }
  });

  it('links technical solution inputs back to PRD criteria and story briefs', () => {
    expect(template).toContain('<PRD acceptance criteria IDs>');
    expect(template).toContain('<story brief inputs>');
    expect(template).toContain('<technical solution section IDs>');
  });
});
