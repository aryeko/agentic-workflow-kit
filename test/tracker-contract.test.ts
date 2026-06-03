import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const doc = readFileSync('references/tracker-contract.md', 'utf8');

describe('tracker-contract.md', () => {
  it('documents all status-matrix columns', () => {
    for (const col of ['ID', 'Name', 'Depends on', 'Wave', 'Status', 'Spec', 'Plan', 'Owner', 'PR']) {
      expect(doc).toContain(col);
    }
  });
  it('documents the full status vocabulary', () => {
    for (const s of [
      'specced',
      'plan-approved',
      'implementing',
      'done',
      'verified',
      'blocked',
      'canceled',
      'deferred',
      'superseded',
    ]) {
      expect(doc).toContain(s);
    }
  });
  it('states the eligibility rule', () => {
    const lower = doc.toLowerCase();
    expect(lower).toContain('eligib');
    expect(lower).toContain('depend');
    expect(lower).toContain('owner');
  });
});
