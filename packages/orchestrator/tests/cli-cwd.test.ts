import { afterEach, describe, expect, it } from 'vitest';
import { resolveInvocationCwd } from '../src/cli/args.js';

describe('resolveInvocationCwd', () => {
  const original = process.env.INIT_CWD;
  afterEach(() => {
    if (original === undefined) delete process.env.INIT_CWD;
    else process.env.INIT_CWD = original;
  });

  it('prefers an explicit --cwd override (resolved absolute)', () => {
    process.env.INIT_CWD = '/from/pnpm';
    expect(resolveInvocationCwd({ cwd: '/explicit' })).toBe('/explicit');
  });

  it('falls back to INIT_CWD when no override is given', () => {
    process.env.INIT_CWD = '/from/pnpm';
    expect(resolveInvocationCwd({})).toBe('/from/pnpm');
  });

  it('falls back to process.cwd() when neither is set', () => {
    delete process.env.INIT_CWD;
    expect(resolveInvocationCwd({})).toBe(process.cwd());
  });
});
