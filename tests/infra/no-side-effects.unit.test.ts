import * as childProcess from 'node:child_process';
import * as net from 'node:net';
import { describe, expect, it } from 'vitest';

// These tests run in the `unit` lane, which loads tooling/no-side-effects.setup.ts.
// They assert that the guard actually bites — i.e. real process/network calls throw.

describe('no-side-effects guard', () => {
  it('blocks child_process.spawn', () => {
    expect(() => childProcess.spawn('echo', ['hi'])).toThrow(/forbidden/);
  });

  it('blocks globalThis.fetch', () => {
    expect(() => (globalThis.fetch as unknown as (u: string) => unknown)('http://example.test')).toThrow(/forbidden/);
  });

  it('blocks net.connect', () => {
    expect(() => (net.connect as unknown as (p: number) => unknown)(80)).toThrow(/forbidden/);
  });
});
