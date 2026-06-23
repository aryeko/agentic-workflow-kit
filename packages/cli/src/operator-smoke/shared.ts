import type {
  InspectRunParams,
  OperatorActionKind,
  OperatorActorRef,
  OperatorCommandEnvelope,
  OperatorCommandResult,
  OperatorCommandTarget,
  OperatorEnvelopeError,
  OperatorSurface,
  PreviewRunParams,
  PreviewRunView,
  RunInspectionView,
  RunStartedView,
  StartRunParams,
} from 'sdk';

export type Clock = () => string;
export type IdGenerator = () => string;
export type OsIdentityResolver = (surface: Extract<OperatorSurface, 'cli' | 'mcp'>) => OperatorActorRef;

export type OperatorSmokeControlSurface = {
  previewRun: (envelope: OperatorCommandEnvelope<PreviewRunParams>) => OperatorCommandResult<PreviewRunView>;
  startRun: (envelope: OperatorCommandEnvelope<StartRunParams>) => OperatorCommandResult<RunStartedView>;
  inspectRun: (envelope: OperatorCommandEnvelope<InspectRunParams>) => OperatorCommandResult<RunInspectionView>;
};

type BuildEnvelopeInput<TParams> = {
  actionKind: OperatorActionKind;
  commandName: string;
  surface: Extract<OperatorSurface, 'cli' | 'mcp'>;
  actor: OperatorActorRef;
  target: OperatorCommandTarget;
  params: TParams;
  clock: Clock;
  ids: IdGenerator;
  envelopeErrors?: readonly OperatorEnvelopeError[];
};

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalize(entry));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, canonicalize(nestedValue)]),
    );
  }

  return value;
};

const stableStringify = (value: unknown): string => JSON.stringify(canonicalize(value));

const hashString = (value: string): string => {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
};

const buildParamsDigest = (params: unknown): string => `fnv1a:${hashString(stableStringify(params))}`;

const normalizeActor = (
  actor: OperatorActorRef,
  surface: Extract<OperatorSurface, 'cli' | 'mcp'>,
): OperatorActorRef => {
  if (actor.kind === 'os-user' || actor.kind === 'os-user-unavailable') {
    return {
      ...actor,
      surfaceClient: surface,
    };
  }

  return actor;
};

const extractDryRun = (params: unknown): boolean | undefined => {
  if (
    params &&
    typeof params === 'object' &&
    'dryRun' in params &&
    typeof (params as { dryRun?: unknown }).dryRun === 'boolean'
  ) {
    return (params as { dryRun: boolean }).dryRun;
  }

  return undefined;
};

const deriveIdempotencyKey = <TParams>(params: TParams, actionId: string): string => {
  if (
    params &&
    typeof params === 'object' &&
    'idempotencyKey' in params &&
    typeof (params as { idempotencyKey?: unknown }).idempotencyKey === 'string' &&
    (params as { idempotencyKey: string }).idempotencyKey.length > 0
  ) {
    return (params as { idempotencyKey: string }).idempotencyKey;
  }

  return actionId;
};

export const buildOperatorCommandEnvelope = <TParams>({
  actionKind,
  commandName,
  surface,
  actor,
  target,
  params,
  clock,
  ids,
  envelopeErrors = [],
}: BuildEnvelopeInput<TParams>): OperatorCommandEnvelope<TParams> => {
  const requestedAt = clock();
  const actionId = ids();
  const dryRun = extractDryRun(params);

  return {
    schema: 'kit-vnext.operator-command.v1',
    actionId,
    actionKind,
    commandName,
    surface,
    actor: normalizeActor(actor, surface),
    target,
    params,
    paramsDigest: buildParamsDigest(params),
    idempotencyKey: deriveIdempotencyKey(params, actionId),
    requestedAt,
    ...(dryRun === undefined ? {} : { dryRun }),
    ...(envelopeErrors.length === 0 ? {} : { envelopeErrors: [...envelopeErrors] }),
  };
};
