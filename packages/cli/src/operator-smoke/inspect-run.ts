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
  type Clock,
  type IdGenerator,
  type OperatorSmokeControlSurface,
  type OsIdentityResolver,
} from './shared.js';

const actionKind = 'inspect-run';
const commandName = 'workflow run inspect';

type InspectRunDependencies = {
  controlSurface: OperatorSmokeControlSurface;
  resolveIdentity: OsIdentityResolver;
  clock: Clock;
  ids: IdGenerator;
};

export const buildInspectRunEnvelope = (
  params: InspectRunParams,
  actor: OperatorActorRef,
  target: OperatorCommandTarget,
  clock: Clock,
  ids: IdGenerator,
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
