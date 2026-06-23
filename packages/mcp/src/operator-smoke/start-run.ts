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
  type OperatorCommandClock,
  type OperatorCommandControlSurface,
  type OperatorCommandIdentityResolver,
  type OperatorCommandIdGenerator,
} from 'sdk';

const actionKind = 'start-run';
const commandName = 'workflow run start';

type StartRunDependencies = {
  controlSurface: OperatorCommandControlSurface;
  resolveIdentity: OperatorCommandIdentityResolver;
  clock: OperatorCommandClock;
  ids: OperatorCommandIdGenerator;
};

export const buildStartRunEnvelope = (
  params: StartRunParams,
  actor: OperatorActorRef,
  target: OperatorCommandTarget,
  clock: OperatorCommandClock,
  ids: OperatorCommandIdGenerator,
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
