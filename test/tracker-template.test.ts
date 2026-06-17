import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const DIR = 'references/templates/tracker';
const FILES = ['tracker-readme-template.md'];

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

  it('README template links grow-in-place story files instead of detailed specs', () => {
    const r = readFileSync(`${DIR}/tracker-readme-template.md`, 'utf8');
    expect(r).toContain('./stories/<PREFIX>01.md');
    expect(r).toContain('Existing trackers that link a detailed spec directly remain valid');
    expect(r).not.toContain('standalone-spec-template');
    expect(r).not.toContain('delta-spec-template');
  });
});
