import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const DIR = 'references/templates/tracker';
const FILES = ['tracker-readme-template.md', 'standalone-spec-template.md', 'delta-spec-template.md'];

describe('tracker templates', () => {
  for (const f of FILES) {
    it(`ships ${f}`, () => {
      expect(existsSync(`${DIR}/${f}`)).toBe(true);
    });
  }

  it('README template matrix header matches the tracker contract exactly', () => {
    const contract = readFileSync('references/tracker-contract.md', 'utf8');
    const headerLine = contract
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.startsWith('| ID | Name |'));
    expect(headerLine).toBeDefined();
    if (!headerLine) throw new Error('tracker contract matrix header missing');
    const r = readFileSync(`${DIR}/tracker-readme-template.md`, 'utf8');
    expect(r).toContain(headerLine);
  });

  it('README template carries dependency-graph, parallelism, and prefix sections', () => {
    const r = readFileSync(`${DIR}/tracker-readme-template.md`, 'utf8');
    expect(r).toMatch(/flowchart TD/);
    expect(r).toContain('## Parallelism rules');
    expect(r).toMatch(/<PREFIX>/);
  });

  it('standalone template has contract sections and no status mirror', () => {
    const s = readFileSync(`${DIR}/standalone-spec-template.md`, 'utf8');
    expect(s).toContain('## Goal');
    expect(s).toContain('## Non-goals');
    expect(s).toContain('## Validation gate');
    expect(s).not.toMatch(/<track>-status/);
  });

  it('delta template is thin-on-rules with a forbidden-changes section', () => {
    const d = readFileSync(`${DIR}/delta-spec-template.md`, 'utf8');
    expect(d).toContain('## Behavioural changes (forbidden)');
    expect(d).not.toMatch(/<track>-status/);
  });
});
