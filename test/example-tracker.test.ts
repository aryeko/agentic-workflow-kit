import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const VOCAB = new Set([
  'specced',
  'plan-approved',
  'implementing',
  'done',
  'verified',
  'blocked',
  'canceled',
  'deferred',
  'superseded',
]);
const ID = /^[A-Z]{2,}[0-9]+$/;

const md = readFileSync('examples/example-tracker/README.md', 'utf8');

const LK01 = 'examples/example-tracker/stories/LK01.md';
const LK02 = 'examples/example-tracker/stories/LK02.md';

function matrixRows(markdown: string): string[][] {
  return markdown
    .split('\n')
    .filter((l) => l.trim().startsWith('|'))
    .map((l) => l.split('|').map((c) => c.trim()))
    .filter((cells) => ID.test(cells[1] ?? ''));
}

describe('example tracker conforms to the contract', () => {
  it('has the canonical status-matrix header', () => {
    expect(md).toContain('| ID | Name | Depends on | Wave | Status | Spec | Plan | Owner | PR |');
  });
  it('has at least two story rows with valid IDs', () => {
    const rows = matrixRows(md);
    expect(rows.length).toBeGreaterThanOrEqual(2);
    for (const cells of rows) expect(ID.test(cells[1])).toBe(true);
  });
  it('uses only vocabulary statuses', () => {
    for (const cells of matrixRows(md)) {
      expect(VOCAB.has(cells[5])).toBe(true);
    }
  });
});

describe('example tracker story briefs and PRD linkage', () => {
  it('ships worked story briefs under the track', () => {
    expect(existsSync(LK01)).toBe(true);
    expect(existsSync(LK02)).toBe(true);
  });
  it('maps stories to example-prd acceptance-criteria IDs', () => {
    expect(md).toMatch(/L-1/);
    expect(md).toMatch(/L-2/);
    expect(md).toMatch(/A-1/);
  });
  it('worked story files carry the brief-level note and no status mirror', () => {
    const a = readFileSync(LK01, 'utf8');
    const b = readFileSync(LK02, 'utf8');
    expect(a).toContain('brief-level — not implementation-ready until enriched to plan-approved');
    expect(b).toContain('brief-level — not implementation-ready until enriched to plan-approved');
    expect(a).not.toMatch(/linkly-status:/);
    expect(b).not.toMatch(/linkly-status:/);
  });

  it('worked story files record assumptions and artifact boundaries', () => {
    const a = readFileSync(LK01, 'utf8');
    const b = readFileSync(LK02, 'utf8');
    for (const brief of [a, b]) {
      expect(brief).toContain('## Assumptions and blockers');
      expect(brief).toContain('## Artifact boundaries');
      expect(brief).toContain('Runtime artifacts');
    }
  });

  it('worked story files carry a Canonical impact line', () => {
    const a = readFileSync(LK01, 'utf8');
    const b = readFileSync(LK02, 'utf8');
    expect(a).toContain('## Canonical impact');
    expect(b).toContain('## Canonical impact');
  });
});
