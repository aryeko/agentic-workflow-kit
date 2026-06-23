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
  type Clock,
  type IdGenerator,
  type OperatorSmokeControlSurface,
  type OsIdentityResolver,
} from './shared.js';

const actionKind = 'preview-run';
const commandName = 'workflow run preview';

type PreviewRunDependencies = {
  controlSurface: OperatorSmokeControlSurface;
  resolveIdentity: OsIdentityResolver;
  clock: Clock;
  ids: IdGenerator;
};

export const buildPreviewRunEnvelope = (
  params: PreviewRunParams,
  actor: OperatorActorRef,
  target: OperatorCommandTarget,
  clock: Clock,
  ids: IdGenerator,
  envelopeErrors: readonly OperatorEnvelopeError[] = [],
): OperatorCommandEnvelope<PreviewRunParams> =>
  buildOperatorCommandEnvelope({
    actionKind,
    commandName,
    surface: 'cli',
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
    dependencies.resolveIdentity('cli'),
    target,
    dependencies.clock,
    dependencies.ids,
    envelopeErrors,
  );

  return dependencies.controlSurface.previewRun(envelope);
};
