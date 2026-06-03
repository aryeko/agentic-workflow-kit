import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('repo toolchain', () => {
  it('package.json declares the agentic-workflow-kit package as ESM', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(pkg.name).toBe('agentic-workflow-kit');
    expect(pkg.type).toBe('module');
  });
});
