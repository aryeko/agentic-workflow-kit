import { describe, expect, it } from 'vitest';

import { classifyApprovalRisk } from '../../../../src/core/approval/decision/index.js';

import {
  createBaseReplay,
  createEvidenceEvent,
  createPolicy,
  createProjections,
  createReplay,
  createRequest,
  evaluatedAt,
  sessionId,
} from './shared.js';

describe('core-03-s2 high-risk classification', () => {
  it.each([
    [
      'session scope',
      createRequest({ requestedScope: 'session' }),
      createBaseReplay(),
      createProjections(),
      'approval-high-session-scope',
    ],
    [
      'unsafe command',
      createRequest({ command: 'pnpm check && rm -rf /tmp' }),
      createBaseReplay(),
      createProjections(),
      'approval-high-command-unsafe-syntax',
    ],
    [
      'wildcard host',
      createRequest({ subject: 'network', host: '*.example.com' }),
      createBaseReplay(),
      createProjections(),
      'approval-high-host-wildcard-or-private',
    ],
    [
      'file path outside workspace',
      createRequest({ filePaths: ['/etc/passwd'] }),
      createBaseReplay(),
      createProjections(),
      'approval-high-file-outside-workspace',
    ],
    [
      'missing worktree path with file paths',
      createRequest({ worktreePath: undefined, filePaths: ['packages/sdk/src/index.ts'] }),
      createBaseReplay(),
      createProjections(),
      'approval-high-file-outside-workspace',
    ],
    [
      'ambiguous linkage',
      createRequest(),
      createBaseReplay(),
      createProjections({ launch: { linkage: 'ambiguous', currentSession: undefined, linkHistory: [] } }),
      'approval-high-session-linkage-ambiguous',
    ],
    [
      'missing relay attestation',
      createRequest(),
      createReplay([createEvidenceEvent('evt-evidence-request-01', 1, 'evidence:request-01')]),
      createProjections(),
      'approval-high-relay-missing',
    ],
    [
      'self-report-only evidence',
      createRequest(),
      createReplay([
        createEvidenceEvent('evt-evidence-request-01', 1, 'evidence:request-01', {
          supportKind: 'self-report',
          value: 'worker says this is safe',
        }),
        createEvidenceEvent('evt-evidence-relay-01', 2, 'evidence:canRelayApproval'),
        createEvidenceEvent('evt-evidence-persist-01', 3, 'evidence:canPersistApprovalAnswerChannel'),
        {
          ...createBaseReplay().events[3]!,
          payload: {
            ...(createBaseReplay().events[3]!.payload as never),
            scope: sessionId,
          },
        },
        {
          ...createBaseReplay().events[4]!,
          payload: {
            ...(createBaseReplay().events[4]!.payload as never),
            scope: sessionId,
          },
        },
      ]),
      createProjections(),
      'approval-high-self-report-only-evidence',
    ],
  ])('returns high risk for %s', (_name, request, replay, projections, expectedRule) => {
    const result = classifyApprovalRisk({
      request,
      policy: createPolicy(),
      replay,
      projections,
      classifiedAt: evaluatedAt,
      requestEvidenceRefs: ['evidence:request-01'],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error.reason);
    }

    expect(result.value.risk).toBe('high');
    expect(result.value.triggeredRuleIds).toContain(expectedRule);
  });
});
