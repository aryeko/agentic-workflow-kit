import { describe, expect, it } from 'vitest';
import { classifyLivenessAdvance, isLivenessRefreshingEvent } from '../../../../src/core/supervision/liveness/index.js';

import {
  agentSessionLinked,
  agentTerminal,
  approvalAnswered,
  approvalRequested,
  fold,
  makeEnvelope,
  makeLifecycle,
  progressObserved,
  sessionLinked,
  toolObserved,
  workerExited,
  workerSpawned,
} from './shared.js';

describe('core-04-s2 liveness coverage edges', () => {
  it('returns undefined for non-refreshing and malformed classification cases', () => {
    const missingLinkedSession = classifyLivenessAdvance(agentSessionLinked(0), {
      currentSessionId: 'session-01',
      linkage: 'known',
      linkedSessionIds: new Set<string>(),
      stableToolItemIds: new Set<string>(),
      currentWorkerHandleId: 'worker-01',
    });
    const fallbackWorkerHandle = classifyLivenessAdvance(
      makeEnvelope(0, 'AgentSessionLinked', { sessionId: 'session-01' }, { domain: 'Agent' }),
      {
        currentSessionId: 'session-01',
        linkage: 'known',
        linkedSessionIds: new Set(['session-01']),
        stableToolItemIds: new Set<string>(),
        currentWorkerHandleId: 'worker-fallback-01',
      },
    );
    const unknownLink = classifyLivenessAdvance(agentSessionLinked(1), {
      currentSessionId: 'session-01',
      linkage: 'unknown',
      linkedSessionIds: new Set(['session-01']),
      stableToolItemIds: new Set<string>(),
      currentWorkerHandleId: 'worker-01',
    });
    const missingApprovalChannel = classifyLivenessAdvance(
      makeEnvelope(2, 'AgentApprovalRequested', { sessionId: 'session-01', request: {} }, { domain: 'Agent' }),
      {
        currentSessionId: 'session-01',
        linkage: 'known',
        linkedSessionIds: new Set(['session-01']),
        stableToolItemIds: new Set<string>(),
        currentWorkerHandleId: 'worker-01',
      },
    );
    const missingToolFields = classifyLivenessAdvance(
      makeEnvelope(
        3,
        'AgentToolObserved',
        { sessionId: 'session-01', tool: { itemId: 'tool-01' } },
        { domain: 'Agent' },
      ),
      {
        currentSessionId: 'session-01',
        linkage: 'known',
        linkedSessionIds: new Set(['session-01']),
        stableToolItemIds: new Set(['tool-01']),
        currentWorkerHandleId: 'worker-01',
      },
    );
    const wrongTerminalSession = classifyLivenessAdvance(agentTerminal(4, 'session-02'), {
      currentSessionId: 'session-01',
      linkage: 'known',
      linkedSessionIds: new Set(['session-01']),
      stableToolItemIds: new Set<string>(),
      currentWorkerHandleId: 'worker-01',
    });
    const missingWorkerHandle = classifyLivenessAdvance(workerExited(5), {
      currentSessionId: 'session-01',
      linkage: 'known',
      linkedSessionIds: new Set(['session-01']),
      stableToolItemIds: new Set<string>(),
    });
    const wrongExitedHandle = classifyLivenessAdvance(workerExited(6, 'worker-02'), {
      currentSessionId: 'session-01',
      linkage: 'known',
      linkedSessionIds: new Set(['session-01']),
      stableToolItemIds: new Set<string>(),
      currentWorkerHandleId: 'worker-01',
    });
    const wrongProgressSession = classifyLivenessAdvance(progressObserved(7, 'session-02'), {
      currentSessionId: 'session-01',
      linkage: 'known',
      linkedSessionIds: new Set(['session-01']),
      stableToolItemIds: new Set<string>(),
      currentWorkerHandleId: 'worker-01',
    });
    const wrongApprovalSession = classifyLivenessAdvance(approvalRequested(8, 'session-02'), {
      currentSessionId: 'session-01',
      linkage: 'known',
      linkedSessionIds: new Set(['session-01']),
      stableToolItemIds: new Set<string>(),
      currentWorkerHandleId: 'worker-01',
    });

    expect(missingLinkedSession).toBeUndefined();
    expect(fallbackWorkerHandle?.workerHandleId).toBe('worker-fallback-01');
    expect(unknownLink).toBeUndefined();
    expect(missingApprovalChannel).toBeUndefined();
    expect(missingToolFields).toBeUndefined();
    expect(wrongTerminalSession).toBeUndefined();
    expect(missingWorkerHandle).toBeUndefined();
    expect(wrongExitedHandle).toBeUndefined();
    expect(wrongProgressSession).toBeUndefined();
    expect(wrongApprovalSession).toBeUndefined();
    expect(
      isLivenessRefreshingEvent(makeEnvelope(7, 'ProjectionRead', { ignored: true }, { domain: 'inert-domain' }), {
        currentSessionId: 'session-01',
        linkage: 'known',
        linkedSessionIds: new Set(['session-01']),
        stableToolItemIds: new Set<string>(),
        currentWorkerHandleId: 'worker-01',
      }),
    ).toBe(false);
  });

  it('stops approval and runtime timer evidence on answer, lifecycle terminal, and host exit branches', () => {
    const answered = fold([
      makeLifecycle(1, 'worker-starting', 'workspace-ready'),
      workerSpawned(2),
      sessionLinked(3),
      agentSessionLinked(4),
      approvalRequested(5),
      approvalAnswered(6),
    ]);
    const lifecycleTerminal = fold([
      makeLifecycle(1, 'worker-starting', 'workspace-ready'),
      workerSpawned(2),
      makeLifecycle(3, 'completed', 'running'),
    ]);
    const hostExitWithoutSession = fold([
      makeLifecycle(1, 'worker-starting', 'workspace-ready'),
      workerSpawned(2),
      workerExited(3),
    ]);

    expect(answered.timerEvidence['approval-SLA']?.stoppedAt).toBe('2026-06-25T10:00:06.000Z');
    expect(lifecycleTerminal.timerEvidence['max-runtime']?.stoppedAt).toBe('2026-06-25T10:00:03.000Z');
    expect(hostExitWithoutSession.timerEvidence['max-runtime']?.stoppedAt).toBe('2026-06-25T10:00:03.000Z');
    expect(hostExitWithoutSession.timerEvidence['approval-SLA']).toBeUndefined();
  });

  it('keeps terminated state when degraded observation arrives after terminal evidence', () => {
    const result = fold([
      makeLifecycle(1, 'worker-starting', 'workspace-ready'),
      workerSpawned(2),
      sessionLinked(3),
      agentSessionLinked(4),
      progressObserved(5),
      workerExited(6),
      makeEnvelope(
        7,
        'AgentObservationDegraded',
        {
          sessionId: 'session-01',
          failure: { reason: 'agent-linkage-lost', message: 'late degraded observation', retryable: false },
        },
        { domain: 'Agent' },
      ),
    ]);

    expect(result.projection.state).toBe('terminated');
    expect(result.projection.reason).toBe('worker-terminal-observed');
    expect(result.projection.terminal).toBe(true);
  });

  it('does not classify a mismatched stable tool session as refreshing', () => {
    const result = classifyLivenessAdvance(toolObserved(1, 'session-02', 'tool-01'), {
      currentSessionId: 'session-01',
      linkage: 'known',
      linkedSessionIds: new Set(['session-01']),
      stableToolItemIds: new Set(['tool-01']),
      currentWorkerHandleId: 'worker-01',
    });

    expect(result).toBeUndefined();
  });

  it('preserves terminated state when additional refreshing events arrive after terminal observation', () => {
    const result = fold([
      makeLifecycle(1, 'worker-starting', 'workspace-ready'),
      workerSpawned(2),
      sessionLinked(3),
      agentSessionLinked(4),
      progressObserved(5, 'session-01', 'tool-01'),
      workerExited(6),
      agentSessionLinked(7),
      progressObserved(8, 'session-01', 'tool-01'),
      toolObserved(9, 'session-01', 'tool-01'),
      approvalRequested(10),
    ]);

    expect(result.projection.state).toBe('terminated');
    expect(result.projection.reason).toBe('worker-terminal-observed');
    expect(result.projection.lastWorkerEventSequence).toBe(10);
    expect(result.projection.lastProgressSequence).toBe(9);
  });

  it('starts startup and max-runtime timers from WorkerSpawned when no lifecycle edge exists', () => {
    const result = fold([workerSpawned(1)]);

    expect(result.projection.state).toBe('starting');
    expect(result.timerEvidence.startup?.basisAt).toBe('2026-06-25T10:00:01.000Z');
    expect(result.timerEvidence['max-runtime']?.basisAt).toBe('2026-06-25T10:00:01.000Z');
  });

  it('falls back to the explicit sampled clock when no timer evidence exists', () => {
    const result = fold([]);

    expect(result.projection.timers.startup.deadline).toBe('2026-06-25T10:32:00.000Z');
    expect(result.projection.timers['max-runtime'].deadline).toBe('2026-06-25T18:30:00.000Z');
  });

  it('ignores malformed current-session tool observations without setting an unavailable reason', () => {
    const result = fold([
      makeLifecycle(1, 'worker-starting', 'workspace-ready'),
      workerSpawned(2),
      sessionLinked(3),
      agentSessionLinked(4),
      makeEnvelope(
        5,
        'AgentToolObserved',
        { sessionId: 'session-01', tool: { itemId: 'tool-01' } },
        { domain: 'Agent' },
      ),
    ]);

    expect(result.projection.reason).toBeUndefined();
    expect(result.projection.lastWorkerEventSequence).toBe(4);
  });
});
