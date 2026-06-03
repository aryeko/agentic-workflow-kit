import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const DIR = 'examples/example-prd';
const PRD_STATUS = new Set(['draft', 'approved', 'shipped', 'archived']);
const AC_ID = /^[A-Z]{1,3}-[0-9]+$/;

const readme = readFileSync(`${DIR}/README.md`, 'utf8');
const acceptance = readFileSync(`${DIR}/08-acceptance-criteria.md`, 'utf8');

function frontmatterStatus(md: string): string | undefined {
  return md.match(/status:\s*(\S+)/)?.[1];
}

function acceptanceRows(md: string): string[][] {
  return md
    .split('\n')
    .filter((l) => l.trim().startsWith('|'))
    .map((l) => l.split('|').map((c) => c.replace(/\*/g, '').trim()))
    .filter((cells) => AC_ID.test(cells[1] ?? ''));
}

describe('example PRD conforms to the contract', () => {
  it('has a README index and the required section files', () => {
    for (const f of ['README.md', '01-context.md', '08-acceptance-criteria.md']) {
      expect(existsSync(`${DIR}/${f}`)).toBe(true);
    }
  });

  it('README frontmatter status is from the PRD vocabulary', () => {
    expect(PRD_STATUS.has(frontmatterStatus(readme) ?? '')).toBe(true);
  });

  it('has acceptance criteria with valid IDs and a ship-blocker designation', () => {
    const rows = acceptanceRows(acceptance);
    expect(rows.length).toBeGreaterThanOrEqual(2);
    for (const cells of rows) expect(AC_ID.test(cells[1])).toBe(true);
    expect(acceptance).toContain('[ship blocker]');
  });
});
