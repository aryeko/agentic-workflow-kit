import type {
  OperatorActorRef,
  OperatorCommandEnvelope,
  OperatorCommandResult,
  OperatorCommandTarget,
  OperatorEnvelopeError,
  PreviewRunParams,
  PreviewRunView,
} from 'sdk';

import {
  buildOperatorCommandEnvelope,
  type OperatorCommandClock,
  type OperatorCommandControlSurface,
  type OperatorCommandIdentityResolver,
  type OperatorCommandIdGenerator,
} from 'sdk';

const actionKind = 'preview-run';
const commandName = 'workflow run preview';

type PreviewRunDependencies = {
  controlSurface: OperatorCommandControlSurface;
  resolveIdentity: OperatorCommandIdentityResolver;
  clock: OperatorCommandClock;
  ids: OperatorCommandIdGenerator;
};

export const buildPreviewRunEnvelope = (
  params: PreviewRunParams,
  actor: OperatorActorRef,
  target: OperatorCommandTarget,
  clock: OperatorCommandClock,
  ids: OperatorCommandIdGenerator,
  envelopeErrors: readonly OperatorEnvelopeError[] = [],
): OperatorCommandEnvelope<PreviewRunParams> =>
  buildOperatorCommandEnvelope({
    actionKind,
    commandName,
    surface: 'mcp',
    actor,
    target,
    params,
    clock,
    ids,
    envelopeErrors,
  });

export const invokePreviewRun = (
  params: PreviewRunParams,
  target: OperatorCommandTarget,
  dependencies: PreviewRunDependencies,
  envelopeErrors: readonly OperatorEnvelopeError[] = [],
): OperatorCommandResult<PreviewRunView> => {
  const envelope = buildPreviewRunEnvelope(
    params,
    dependencies.resolveIdentity('mcp'),
    target,
    dependencies.clock,
    dependencies.ids,
    envelopeErrors,
  );

  return dependencies.controlSurface.previewRun(envelope);
};
