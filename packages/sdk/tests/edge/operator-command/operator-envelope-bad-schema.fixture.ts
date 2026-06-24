import type { OperatorCommandEnvelope, PreviewRunParams } from '../../../src/edge/operator-command/index.js';

const invalidEnvelope: OperatorCommandEnvelope<PreviewRunParams> = {
  schema: 'kit-vnext.operator-command.v2',
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
  params: {
    workSource: {
      workSourceId: 'work-source:tracker',
    },
    profileName: 'standard',
    dryRun: true,
  },
  paramsDigest: 'sha256:params',
  idempotencyKey: 'idem-1',
  requestedAt: '2026-06-23T12:00:00.000Z',
};

void invalidEnvelope;
