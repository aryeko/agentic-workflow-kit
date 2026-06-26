import { describe, expect, it } from 'vitest';

import { resumePendingApproval } from '../../../../src/core/approval/pending/index.js';

import {
  createAttestationEvent,
  createDecision,
  createEvent,
  createPendingPayload,
  createProjections,
  createReplay,
  createWriter,
  decisionEventId,
  evaluatedAt,
  requestId,
  runId,
  sessionId,
} from './fixtures.js';

const decisionEvent = () =>
  createEvent({
    eventId: decisionEventId,
    sequence: 2,
    type: 'ApprovalDecisionRecorded',
    payload: {
      schema: 'kit-vnext.approval-decision-recorded.v1',
      decision: createDecision(),
      sourceEventIds: ['evt-pending-01'],
    },
  });

describe('resumePendingApproval fail-closed behavior', () => {
  it.each([
    {
      name: 'known linkage missing current session',
      replay: createReplay([
        createEvent({
          eventId: 'evt-pending-01',
          sequence: 1,
          type: 'ApprovalPendingPersisted',
          payload: createPendingPayload(),
        }),
        decisionEvent(),
      ]),
      projections: createProjections({ launch: { linkage: 'known', currentSession: undefined, linkHistory: [] } }),
      failureState: 'approval-session-ambiguous',
    },
    {
      name: 'ambiguous linkage',
      replay: createReplay([
        createEvent({
          eventId: 'evt-pending-01',
          sequence: 1,
          type: 'ApprovalPendingPersisted',
          payload: createPendingPayload(),
        }),
        decisionEvent(),
      ]),
      projections: createProjections({ launch: { linkage: 'ambiguous', currentSession: undefined, linkHistory: [] } }),
      failureState: 'approval-session-ambiguous',
    },
    {
      name: 'observe-only ownership',
      replay: createReplay([
        createEvent({
          eventId: 'evt-pending-01',
          sequence: 1,
          type: 'ApprovalPendingPersisted',
          payload: createPendingPayload(),
        }),
        decisionEvent(),
      ]),
      projections: createProjections({
        launch: {
          linkage: 'known',
          currentSession: {
            linkOrdinal: 1,
            sessionId,
            linkRole: 'observer',
            startedAt: evaluatedAt,
            sourceEventId: 'evt-session-linked-01',
          },
          linkHistory: [],
        },
      }),
      failureState: 'approval-owner-missing',
    },
    {
      name: 'missing canResumeOwned',
      replay: createReplay([
        createEvent({
          eventId: 'evt-pending-01',
          sequence: 1,
          type: 'ApprovalPendingPersisted',
          payload: createPendingPayload(),
        }),
        decisionEvent(),
        createAttestationEvent('evt-relay-01', 4, 'canRelayApproval'),
        createAttestationEvent('evt-persist-01', 5, 'canPersistApprovalAnswerChannel'),
      ]),
      projections: createProjections(),
      failureState: 'approval-resume-capability-missing',
    },
    {
      name: 'stale canResumeOwned',
      replay: createReplay([
        createEvent({
          eventId: 'evt-pending-01',
          sequence: 1,
          type: 'ApprovalPendingPersisted',
          payload: createPendingPayload(),
        }),
        decisionEvent(),
        createAttestationEvent('evt-resume-01', 3, 'canResumeOwned', { expiry: '2026-06-23T10:00:00.000Z' }),
        createAttestationEvent('evt-relay-01', 4, 'canRelayApproval'),
        createAttestationEvent('evt-persist-01', 5, 'canPersistApprovalAnswerChannel'),
      ]),
      projections: createProjections(),
      failureState: 'approval-resume-capability-missing',
    },
    {
      name: 'negative canRelayApproval',
      replay: createReplay([
        createEvent({
          eventId: 'evt-pending-01',
          sequence: 1,
          type: 'ApprovalPendingPersisted',
          payload: createPendingPayload(),
        }),
        decisionEvent(),
        createAttestationEvent('evt-resume-01', 3, 'canResumeOwned'),
        createAttestationEvent('evt-relay-01', 4, 'canRelayApproval', { result: 'negative' }),
        createAttestationEvent('evt-persist-01', 5, 'canPersistApprovalAnswerChannel'),
      ]),
      projections: createProjections(),
      failureState: 'approval-relay-missing',
    },
    {
      name: 'wrong-scope canRelayApproval',
      replay: createReplay([
        createEvent({
          eventId: 'evt-pending-01',
          sequence: 1,
          type: 'ApprovalPendingPersisted',
          payload: createPendingPayload(),
        }),
        decisionEvent(),
        createAttestationEvent('evt-resume-01', 3, 'canResumeOwned'),
        createAttestationEvent('evt-relay-01', 4, 'canRelayApproval', { scope: 'session-other' }),
        createAttestationEvent('evt-persist-01', 5, 'canPersistApprovalAnswerChannel'),
      ]),
      projections: createProjections(),
      failureState: 'approval-relay-missing',
    },
    {
      name: 'missing persistable-channel attestation',
      replay: createReplay([
        createEvent({
          eventId: 'evt-pending-01',
          sequence: 1,
          type: 'ApprovalPendingPersisted',
          payload: createPendingPayload(),
        }),
        decisionEvent(),
        createAttestationEvent('evt-resume-01', 3, 'canResumeOwned'),
        createAttestationEvent('evt-relay-01', 4, 'canRelayApproval'),
      ]),
      projections: createProjections(),
      failureState: 'approval-relay-missing',
    },
    {
      name: 'committed decision without grant',
      replay: createReplay([
        createEvent({
          eventId: 'evt-pending-01',
          sequence: 1,
          type: 'ApprovalPendingPersisted',
          payload: createPendingPayload(),
        }),
        createEvent({
          eventId: decisionEventId,
          sequence: 2,
          type: 'ApprovalDecisionRecorded',
          payload: {
            schema: 'kit-vnext.approval-decision-recorded.v1',
            decision: createDecision({ decision: 'deny', grant: undefined }),
            sourceEventIds: ['evt-pending-01'],
          },
        }),
      ]),
      projections: createProjections(),
      failureState: 'approval-event-log-unavailable',
    },
    {
      name: 'lost answer channel',
      replay: createReplay([
        createEvent({
          eventId: 'evt-pending-01',
          sequence: 1,
          type: 'ApprovalPendingPersisted',
          payload: createPendingPayload(),
        }),
        decisionEvent(),
        createAttestationEvent('evt-resume-01', 3, 'canResumeOwned'),
        createAttestationEvent('evt-relay-01', 4, 'canRelayApproval'),
        createAttestationEvent('evt-persist-01', 5, 'canPersistApprovalAnswerChannel'),
      ]),
      projections: createProjections(),
      channelAvailable: false,
      failureState: 'approval-answer-channel-lost',
    },
    {
      name: 'unavailable replay',
      replay: createReplay([]),
      projections: createProjections(),
      failureState: 'approval-event-log-unavailable',
    },
  ] as const)('$name blocks with $failureState and no ApprovalResumed', async (fixture) => {
    const writer = createWriter();

    const result = await resumePendingApproval(
      {
        requestId,
        runId,
        sessionId,
        decisionEventId,
        evaluatedAt,
        replay: fixture.replay,
        projections: fixture.projections,
        channelAvailable: fixture.channelAvailable,
      },
      writer,
    );

    expect(result.ok).toBe(true);
    expect(result.value.decision).toMatchObject({ outcome: 'blocked', failureState: fixture.failureState });
    expect(writer.appendCalls.flat().some((intent) => intent.type === 'ApprovalResumed')).toBe(false);
  });
});
