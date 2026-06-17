import { describe, expect, it } from 'vitest';

import { readAwaitingReviewMarker } from '../src/drivers/codex-mcp/evidenceParser.js';
import { classifyChildTurnOutcome } from '../src/drivers/codex-mcp/turnOutcome.js';
import type { StoryRunResult } from '../src/drivers/StoryRunner.js';

function makeResult(prePrReview?: unknown, overrides: Partial<StoryRunResult> = {}): StoryRunResult {
  return {
    storyId: 'DLD05',
    sessionId: 'sess-1',
    content: '',
    rawResult: null,
    invocation: {},
    evidence: prePrReview === undefined ? {} : { prePrReview },
    ...overrides,
  };
}

describe('readAwaitingReviewMarker', () => {
  it('parses a valid awaiting_review marker with all optional fields', () => {
    const marker = readAwaitingReviewMarker({
      status: 'awaiting_review',
      packetPath: 'runs/run-1/review-request.json',
      loop: 2,
      diffRef: 'HEAD~1',
      summary: 'Implemented the parser.',
      verification: [{ command: 'pnpm test', status: 'passed' }],
    });

    expect(marker).not.toBeNull();
    expect(marker?.status).toBe('awaiting_review');
    expect(marker?.packetPath).toBe('runs/run-1/review-request.json');
    expect(marker?.loop).toBe(2);
    expect(marker?.diffRef).toBe('HEAD~1');
    expect(marker?.summary).toBe('Implemented the parser.');
    expect(marker?.verification).toEqual([{ command: 'pnpm test', status: 'passed', phase: null, detail: null }]);
  });

  it('parses a minimal marker with only status', () => {
    const marker = readAwaitingReviewMarker({ status: 'awaiting_review' });

    expect(marker).toEqual({ status: 'awaiting_review' });
  });

  it('returns null when status is missing', () => {
    expect(readAwaitingReviewMarker({ packetPath: 'x' })).toBeNull();
  });

  it('returns null when status is a different value', () => {
    expect(readAwaitingReviewMarker({ status: 'settled' })).toBeNull();
  });

  it('returns null for non-record input', () => {
    expect(readAwaitingReviewMarker(null)).toBeNull();
    expect(readAwaitingReviewMarker(undefined)).toBeNull();
    expect(readAwaitingReviewMarker('awaiting_review')).toBeNull();
    expect(readAwaitingReviewMarker(['awaiting_review'])).toBeNull();
  });

  it('coerces optional fields and drops malformed ones', () => {
    const marker = readAwaitingReviewMarker({
      status: 'awaiting_review',
      packetPath: 42,
      loop: 'two',
      diffRef: { ref: 'HEAD' },
      summary: '',
      verification: 'not-an-array',
    });

    expect(marker).toEqual({ status: 'awaiting_review' });
  });
});

describe('classifyChildTurnOutcome', () => {
  it('returns awaiting_review when orchestrator mode and a valid marker is present', () => {
    const result = makeResult({ status: 'awaiting_review', summary: 'yielded' });

    const outcome = classifyChildTurnOutcome(result, 'orchestrator');

    expect(outcome.kind).toBe('awaiting_review');
    if (outcome.kind === 'awaiting_review') {
      expect(outcome.marker.summary).toBe('yielded');
    }
  });

  it('returns settled when orchestrator mode but no marker is present', () => {
    const result = makeResult(undefined);

    expect(classifyChildTurnOutcome(result, 'orchestrator')).toEqual({ kind: 'settled' });
  });

  it('returns settled when orchestrator mode but the marker is malformed', () => {
    const result = makeResult({ status: 'something-else' });

    expect(classifyChildTurnOutcome(result, 'orchestrator')).toEqual({ kind: 'settled' });
  });

  it('returns settled for non-orchestrator modes even when a marker is present', () => {
    const result = makeResult({ status: 'awaiting_review' });

    expect(classifyChildTurnOutcome(result, 'auto')).toEqual({ kind: 'settled' });
    expect(classifyChildTurnOutcome(result, 'subagent')).toEqual({ kind: 'settled' });
    expect(classifyChildTurnOutcome(result, 'inline')).toEqual({ kind: 'settled' });
  });

  it('returns settled for a finished result that opened a PR', () => {
    const result = makeResult(undefined, {
      evidence: { prNumber: 108, prUrl: 'https://github.com/x/y/pull/108', merged: true },
    });

    expect(classifyChildTurnOutcome(result, 'orchestrator')).toEqual({ kind: 'settled' });
  });

  it('returns settled when evidence is absent entirely', () => {
    const result = makeResult(undefined, { evidence: undefined });

    expect(classifyChildTurnOutcome(result, 'orchestrator')).toEqual({ kind: 'settled' });
  });
});
