import type {
  InspectRunParams,
  OperatorActorRef,
  OperatorCommandEnvelope,
  OperatorCommandResult,
  OperatorCommandTarget,
  OperatorEnvelopeError,
  RunInspectionView,
} from 'sdk';

import {
  buildOperatorCommandEnvelope,
  type OperatorCommandClock,
  type OperatorCommandControlSurface,
  type OperatorCommandIdentityResolver,
  type OperatorCommandIdGenerator,
} from 'sdk';

const actionKind = 'inspect-run';
const commandName = 'workflow run inspect';

type InspectRunDependencies = {
  controlSurface: OperatorCommandControlSurface;
  resolveIdentity: OperatorCommandIdentityResolver;
  clock: OperatorCommandClock;
  ids: OperatorCommandIdGenerator;
};

export const buildInspectRunEnvelope = (
  params: InspectRunParams,
  actor: OperatorActorRef,
  target: OperatorCommandTarget,
  clock: OperatorCommandClock,
  ids: OperatorCommandIdGenerator,
  envelopeErrors: readonly OperatorEnvelopeError[] = [],
): OperatorCommandEnvelope<InspectRunParams> =>
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

export const invokeInspectRun = (
  params: InspectRunParams,
  target: OperatorCommandTarget,
  dependencies: InspectRunDependencies,
  envelopeErrors: readonly OperatorEnvelopeError[] = [],
): OperatorCommandResult<RunInspectionView> => {
  const envelope = buildInspectRunEnvelope(
    params,
    dependencies.resolveIdentity('cli'),
    target,
    dependencies.clock,
    dependencies.ids,
    envelopeErrors,
  );

  return dependencies.controlSurface.inspectRun(envelope);
};
