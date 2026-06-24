import type { OperatorActionRecordedPayload } from '../../../src/edge/operator-command/index.js';

const invalidPayload: OperatorActionRecordedPayload = {
  schema: 'kit-vnext.operator-action-recorded.v1',
  actionId: 'action-1',
  actionKind: 'preview-run',
  commandName: 'workflow run preview',
  surface: 'cli',
  actor: {
    schema: 'kit-vnext.operator-actor.v1',
    kind: 'os-user',
    username: 'arye',
    hostname: 'build-host',
    processId: 3210,
    surfaceClient: 'cli',
    resolvedAt: '2026-06-23T12:00:00.000Z',
    identityConfidence: 'verified-os',
  },
  target: {},
  paramsDigest: 'sha256:params',
  idempotencyKey: 'idem-1',
  requestedAt: '2026-06-23T12:00:00.000Z',
  acceptedAt: '2026-06-23T12:00:01.000Z',
  resultIntent: 'queue',
};

void invalidPayload;
