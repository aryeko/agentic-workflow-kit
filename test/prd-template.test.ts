import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const TEMPLATE_DIR = 'references/templates/prd';
const SECTION_FILES = [
  'README.md',
  '01-context.md',
  '02-principles.md',
  '03-domain-model.md',
  '04-roles.md',
  '05-phases.md',
  '06-quality-bars.md',
  '07-success-metrics.md',
  '08-acceptance-criteria.md',
  '09-risks-and-open-questions.md',
  '10-glossary.md',
];

describe('PRD templates', () => {
  for (const f of SECTION_FILES) {
    it(`ships a template for ${f}`, () => {
      expect(existsSync(`${TEMPLATE_DIR}/${f}`)).toBe(true);
    });
  }

  it('README template carries the index placeholders', () => {
    const r = readFileSync(`${TEMPLATE_DIR}/README.md`, 'utf8');
    expect(r).toContain('<Product name>');
    expect(r).toMatch(/status:/);
  });

  it('acceptance-criteria template shows the ID scheme and designations', () => {
    const a = readFileSync(`${TEMPLATE_DIR}/08-acceptance-criteria.md`, 'utf8');
    expect(a).toContain('PREFIX-');
    expect(a).toContain('[ship blocker]');
    expect(a).toContain('[target]');
  });
});
