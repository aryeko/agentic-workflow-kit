import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('orchestrator package wiring', () => {
  it('declares a pnpm workspace containing packages/*', () => {
    const workspace = readFileSync('pnpm-workspace.yaml', 'utf8');
    expect(workspace).toContain('packages/*');
  });

  it('declares the single publishable orchestrator package and package bins', () => {
    expect(existsSync('packages/orchestrator/package.json')).toBe(true);
    const pkg = JSON.parse(readFileSync('packages/orchestrator/package.json', 'utf8'));
    expect(pkg.name).toBe('@agentic-workflow-kit/orchestrator');
    expect(pkg.type).toBe('module');
    expect(pkg.private).toBeUndefined();
    expect(pkg.main).toBe('./dist/index.js');
    expect(pkg.types).toBe('./dist/index.d.ts');
    expect(pkg.exports).toMatchObject({
      '.': {
        types: './dist/index.d.ts',
        import: './dist/index.js',
      },
    });
    expect(pkg.files).toEqual(['dist']);
    expect(pkg.bin).toMatchObject({
      'agentic-workflow-kit': './dist/cli.js',
      'agentic-workflow-kit-mcp': './dist/mcp/server.js',
    });
    // config logic was folded in: no internal workspace dependency, zod is now direct
    expect(pkg.dependencies).not.toHaveProperty('@agentic-workflow-kit/core');
    expect(pkg.dependencies).toHaveProperty('zod');
    expect(pkg.scripts).toMatchObject({
      build: 'tsc -p tsconfig.build.json',
      'agentic-workflow-kit': 'tsx --tsconfig tsconfig.typecheck.json src/cli.ts',
      test: 'vitest run --config vitest.config.ts',
      typecheck: 'tsc -p tsconfig.typecheck.json',
      'generate-schema': 'tsx src/config/generate-schema.ts',
      prepack: 'pnpm build',
      'pack:dry-run': 'pnpm build && pnpm pack --dry-run',
    });
  });

  it('runs orchestrator package checks from the root check scripts', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(pkg.private).toBe(true);
    expect(pkg.scripts.typecheck).toContain('pnpm --filter @agentic-workflow-kit/orchestrator typecheck');
    expect(pkg.scripts.test).toContain('pnpm --filter @agentic-workflow-kit/orchestrator test');
    expect(pkg.scripts.build).toContain('pnpm --filter @agentic-workflow-kit/orchestrator build');
    expect(pkg.scripts['pack:dry-run']).toContain('pnpm --filter @agentic-workflow-kit/orchestrator pack:dry-run');
    expect(pkg.scripts['agentic-workflow-kit']).toBe(
      'pnpm --filter @agentic-workflow-kit/orchestrator agentic-workflow-kit',
    );
  });

  it('declares a root-local agentic-workflow-kit development command', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(pkg.scripts['agentic-workflow-kit']).toBe(
      'pnpm --filter @agentic-workflow-kit/orchestrator agentic-workflow-kit',
    );
    expect(pkg.scripts['smoke:codex-plugin']).toBe('vitest run --config vitest.codex-smoke.config.ts');
    expect(pkg.scripts.check).not.toContain('smoke:codex-plugin');
    expect(pkg.scripts.test).not.toContain('smoke:codex-plugin');
  });

  it('maps orchestrator package tests to the local source', () => {
    const config = readFileSync('packages/orchestrator/vitest.config.ts', 'utf8');
    expect(config).toContain("include: ['tests/**/*.test.ts']");
  });
});
