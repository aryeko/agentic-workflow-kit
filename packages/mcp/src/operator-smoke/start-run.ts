import type {
  OperatorActorRef,
  OperatorCommandEnvelope,
  OperatorCommandResult,
  OperatorCommandTarget,
  OperatorEnvelopeError,
  RunStartedView,
  StartRunParams,
} from 'sdk';

import {
  buildOperatorCommandEnvelope,
  type Clock,
  type IdGenerator,
  type OperatorSmokeControlSurface,
  type OsIdentityResolver,
} from './shared.js';

const actionKind = 'start-run';
const commandName = 'workflow run start';

type StartRunDependencies = {
  controlSurface: OperatorSmokeControlSurface;
  resolveIdentity: OsIdentityResolver;
  clock: Clock;
  ids: IdGenerator;
};

export const buildStartRunEnvelope = (
  params: StartRunParams,
  actor: OperatorActorRef,
  target: OperatorCommandTarget,
  clock: Clock,
  ids: IdGenerator,
  envelopeErrors: readonly OperatorEnvelopeError[] = [],
): OperatorCommandEnvelope<StartRunParams> =>
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

export const invokeStartRun = (
  params: StartRunParams,
  target: OperatorCommandTarget,
  dependencies: StartRunDependencies,
  envelopeErrors: readonly OperatorEnvelopeError[] = [],
): OperatorCommandResult<RunStartedView> => {
  const envelope = buildStartRunEnvelope(
    params,
    dependencies.resolveIdentity('mcp'),
    target,
    dependencies.clock,
    dependencies.ids,
    envelopeErrors,
  );

  return dependencies.controlSurface.startRun(envelope);
};
