import * as childProcess from 'node:child_process';
import * as http from 'node:http';
import { describe, expect, it } from 'vitest';

describe('conformance-mock no-side-effects guard', () => {
  it('blocks real process APIs in the conformance-mock lane', () => {
    expect(() => childProcess.execFileSync(process.execPath, ['--version'])).toThrow(/forbidden/);
  });

  it('blocks real network APIs in the conformance-mock lane', () => {
    expect(() => http.get('http://127.0.0.1')).toThrow(/forbidden/);
  });

  it('blocks fetch in the conformance-mock lane', () => {
    expect(() => (globalThis.fetch as unknown as (url: string) => unknown)('http://127.0.0.1')).toThrow(/forbidden/);
  });
});
