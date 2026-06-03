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

const STANDALONE = 'examples/example-tracker/specs/2026-06-02-lk01-short-code-foundation.md';
const DELTA = 'examples/example-tracker/specs/linkly/endpoints/2026-06-02-lk02-redirect-endpoint.md';

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

describe('example tracker worked specs and PRD linkage', () => {
  it('ships a worked standalone (Pattern A) spec', () => {
    expect(existsSync(STANDALONE)).toBe(true);
  });
  it('ships a worked delta (Pattern B) spec under the track/category subfolder', () => {
    expect(existsSync(DELTA)).toBe(true);
  });
  it('maps stories to example-prd acceptance-criteria IDs', () => {
    expect(md).toMatch(/L-1/);
    expect(md).toMatch(/L-2/);
    expect(md).toMatch(/A-1/);
  });
  it('worked specs carry no status-mirror frontmatter field', () => {
    const a = readFileSync(STANDALONE, 'utf8');
    const b = readFileSync(DELTA, 'utf8');
    expect(a).not.toMatch(/linkly-status:/);
    expect(b).not.toMatch(/linkly-status:/);
  });
  it('the delta spec includes a forbidden-behavioural-changes section', () => {
    const b = readFileSync(DELTA, 'utf8');
    expect(b).toContain('## Behavioural changes (forbidden)');
  });
});
