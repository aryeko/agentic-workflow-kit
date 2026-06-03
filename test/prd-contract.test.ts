import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const doc = readFileSync('references/prd-contract.md', 'utf8');

describe('prd-contract.md', () => {
  it('documents every PRD section file', () => {
    for (const s of [
      'README',
      '01-context',
      '02-principles',
      '03-domain-model',
      '04-roles',
      '05-phases',
      '06-quality-bars',
      '07-success-metrics',
      '08-acceptance-criteria',
      '09-risks-and-open-questions',
      '10-glossary',
    ]) {
      expect(doc).toContain(s);
    }
  });

  it('documents the acceptance-criteria ID scheme and designations', () => {
    expect(doc).toContain('PREFIX-');
    expect(doc).toContain('[ship blocker]');
    expect(doc).toContain('[target]');
  });

  it('documents the PRD status vocabulary, distinct from story status', () => {
    for (const s of ['draft', 'approved', 'shipped', 'archived']) {
      expect(doc).toContain(s);
    }
  });

  it('states the PRD vs technical-design boundary', () => {
    const lower = doc.toLowerCase();
    expect(lower).toContain('boundary');
    expect(lower).toContain('technical');
  });
});
