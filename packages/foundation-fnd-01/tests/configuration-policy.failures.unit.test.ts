import fc, { type Arbitrary } from 'fast-check';
import { describe, expect, it, vi } from 'vitest';
import {
  BUILT_IN_DEFAULTS,
  type ConfigSource,
  createConfigurationPolicy,
  type DurableEventWriter,
  type PolicyLayerPatch,
  stableHash,
} from '../src/index.js';

const occurredAt = '2026-06-19T10:00:00.000Z';

const writer: DurableEventWriter = {
  appendConfigLoaded: () => ({ ok: true, value: { transactionId: 'tx-config-loaded' } }),
};

const failingWriter: DurableEventWriter = {
  appendConfigLoaded: () => ({ ok: false, error: 'append-failed' }),
};

const sourceFor = (profiles?: Record<string, PolicyLayerPatch>): ConfigSource => ({
  path: 'kit.config.json',
  content: JSON.stringify({
    schema: 'kit-vnext.config.v1',
    project: { id: 'project-1', rootPolicy: 'single-repo' },
    ...(profiles ? { profiles } : {}),
  }),
});

const resolve = (source: ConfigSource, overrides?: PolicyLayerPatch, profile?: string) =>
  createConfigurationPolicy().resolveRunPolicy(
    source,
    { profile, overrides, run: { taskId: 'task-1', trackId: 'track-a', dryRun: true } },
    { runId: 'run-1', occurredAt },
  );

const _valueAt = (value: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((current, segment) => {
    if (current && typeof current === 'object' && segment in current) {
      return (current as Record<string, unknown>)[segment];
    }
    return undefined;
  }, value);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const leafPaths = (value: unknown, prefix = ''): readonly string[] => {
  if (!isRecord(value)) {
    return prefix ? [prefix] : [];
  }

  const entries = Object.entries(value);
  if (entries.length === 0) {
    return prefix ? [prefix] : [];
  }

  return entries.flatMap(([key, entry]) => leafPaths(entry, prefix ? `${prefix}.${key}` : key));
};

const insertPath = (target: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> => {
  const [head, ...tail] = path.split('.');
  if (!head) {
    return target;
  }
  if (tail.length === 0) {
    return { ...target, [head]: value };
  }
  const next = isRecord(target[head]) ? target[head] : {};
  return { ...target, [head]: insertPath(next, tail.join('.'), value) };
};

type PatchEntry = {
  readonly path: string;
  readonly value: unknown;
};

const _patchFromEntries = (entries: readonly PatchEntry[]): PolicyLayerPatch =>
  entries.reduce<Record<string, unknown>>(
    (patch, entry) => insertPath(patch, entry.path, entry.value),
    {},
  ) as PolicyLayerPatch;

const _uniqueCases = (cases: readonly LeafCase[]): readonly LeafCase[] => {
  const seen = new Set<string>();
  return cases.filter((fieldCase) => {
    if (seen.has(fieldCase.path)) {
      return false;
    }
    seen.add(fieldCase.path);
    return true;
  });
};

type LeafCase = {
  readonly path: string;
  readonly profileArbitrary: Arbitrary<unknown>;
  readonly overrideArbitrary: Arbitrary<unknown>;
  readonly profileSample: unknown;
  readonly overrideSample: unknown;
};

const smallText = fc.string({ minLength: 1, maxLength: 12 });
const pathList = fc.array(
  smallText.map((text) => `packages/${text}/**`),
  { maxLength: 4 },
);
const prefixList = fc.array(
  smallText.map((text) => `tool ${text}`),
  { minLength: 1, maxLength: 4 },
);
const parties = fc.array(fc.constantFrom('runner' as const, 'worker' as const), { minLength: 1, maxLength: 2 });
const hosts = fc.array(
  smallText.map((text) => `${text}.example.test`),
  { minLength: 1, maxLength: 3 },
);
const phases = fc.array(smallText, { minLength: 1, maxLength: 3 });
const credentialRefs = fc.array(
  fc.record({
    id: smallText,
    kind: fc.constantFrom(
      'forge' as const,
      'registry-read' as const,
      'registry-publish' as const,
      'tool-api' as const,
      'verification' as const,
    ),
    purpose: smallText,
    secret: fc.record({
      source: fc.constantFrom('env' as const, 'secret-manager' as const),
      key: smallText,
      version: fc.option(smallText, { nil: undefined }),
    }),
    allowedParties: parties,
    allowedPhases: phases,
    allowedHosts: hosts,
    ttlSeconds: fc.integer({ min: 1, max: 3600 }),
  }),
  { maxLength: 3 },
);
const egressRules = fc.array(
  fc.record({
    credentialRefIds: fc.array(smallText, { maxLength: 3 }),
    protocols: fc.array(fc.constantFrom('https' as const, 'ssh' as const), { minLength: 1, maxLength: 2 }),
    hosts,
    ports: fc.option(fc.array(fc.integer({ min: 1, max: 65535 }), { minLength: 1, maxLength: 3 }), { nil: undefined }),
    phase: smallText,
    purpose: smallText,
  }),
  { maxLength: 3 },
);
const negativeProbes = fc.array(
  fc.record({
    host: smallText.map((text) => `${text}.blocked.test`),
    protocol: fc.constantFrom('https' as const, 'ssh' as const),
    expected: fc.constant('blocked' as const),
    reason: smallText,
  }),
  { maxLength: 3 },
);
const requiredAttesters = fc.array(
  fc.record({
    point: fc.constant('execution-host' as const),
    capability: fc.constant('egress-confinement' as const),
    driverId: smallText,
  }),
  { maxLength: 3 },
);
const grantRules = fc.array(
  fc.record({
    reason: fc.constantFrom(
      'dependency-install' as const,
      'verification' as const,
      'worker-tool' as const,
      'other' as const,
    ),
    scope: fc.constantFrom('per-command' as const, 'per-command-prefix' as const),
    prefixes: fc.option(prefixList, { nil: undefined }),
    requiresOperator: fc.option(fc.boolean(), { nil: undefined }),
  }),
  { maxLength: 4 },
);
const evidence = fc.array(
  fc.constantFrom(
    'verification' as const,
    'ci' as const,
    'review' as const,
    'threads-resolved' as const,
    'protection' as const,
  ),
  {
    maxLength: 5,
  },
);

const _leafCases: readonly LeafCase[] = [
  {
    path: 'approval.mode',
    profileArbitrary: fc.constant('manual'),
    overrideArbitrary: fc.constant('assisted'),
    profileSample: 'manual',
    overrideSample: 'assisted',
  },
  {
    path: 'approval.parkOnHumanLatency',
    profileArbitrary: fc.boolean(),
    overrideArbitrary: fc.boolean(),
    profileSample: false,
    overrideSample: true,
  },
  {
    path: 'approval.requireRecordedDecision',
    profileArbitrary: fc.boolean(),
    overrideArbitrary: fc.boolean(),
    profileSample: false,
    overrideSample: true,
  },
  {
    path: 'capabilities.auto-merge.desired',
    profileArbitrary: fc.boolean(),
    overrideArbitrary: fc.boolean(),
    profileSample: true,
    overrideSample: false,
  },
  {
    path: 'capabilities.auto-merge.requireFreshAttestation',
    profileArbitrary: fc.constant(true),
    overrideArbitrary: fc.constant(true),
    profileSample: true,
    overrideSample: true,
  },
  {
    path: 'capabilities.auto-recover.desired',
    profileArbitrary: fc.boolean(),
    overrideArbitrary: fc.boolean(),
    profileSample: true,
    overrideSample: false,
  },
  {
    path: 'capabilities.auto-recover.requireFreshAttestation',
    profileArbitrary: fc.constant(true),
    overrideArbitrary: fc.constant(true),
    profileSample: true,
    overrideSample: true,
  },
  {
    path: 'capabilities.unattended-run.desired',
    profileArbitrary: fc.boolean(),
    overrideArbitrary: fc.boolean(),
    profileSample: true,
    overrideSample: false,
  },
  {
    path: 'capabilities.unattended-run.requireFreshAttestation',
    profileArbitrary: fc.constant(true),
    overrideArbitrary: fc.constant(true),
    profileSample: true,
    overrideSample: true,
  },
  {
    path: 'changePolicy.allowedChangePaths',
    profileArbitrary: pathList,
    overrideArbitrary: pathList,
    profileSample: ['docs/**'],
    overrideSample: ['packages/**'],
  },
  {
    path: 'credentialRefs.refs',
    profileArbitrary: credentialRefs,
    overrideArbitrary: credentialRefs,
    profileSample: [],
    overrideSample: [],
  },
  {
    path: 'egress.defaultAction',
    profileArbitrary: fc.constant('deny'),
    overrideArbitrary: fc.constant('deny'),
    profileSample: 'deny',
    overrideSample: 'deny',
  },
  {
    path: 'egress.negativeProbes',
    profileArbitrary: negativeProbes,
    overrideArbitrary: negativeProbes,
    profileSample: [],
    overrideSample: [],
  },
  {
    path: 'egress.requiredAttesters',
    profileArbitrary: requiredAttesters,
    overrideArbitrary: requiredAttesters,
    profileSample: [],
    overrideSample: [],
  },
  {
    path: 'egress.rules',
    profileArbitrary: egressRules,
    overrideArbitrary: egressRules,
    profileSample: [],
    overrideSample: [],
  },
  {
    path: 'escalationPolicy.allowedGrantScopes',
    profileArbitrary: fc.array(
      fc.constantFrom('per-command' as const, 'per-command-prefix' as const, 'per-host' as const, 'session' as const),
      { maxLength: 4 },
    ),
    overrideArbitrary: fc.array(
      fc.constantFrom('per-command' as const, 'per-command-prefix' as const, 'per-host' as const, 'session' as const),
      { maxLength: 4 },
    ),
    profileSample: ['per-command'],
    overrideSample: ['per-command-prefix'],
  },
  {
    path: 'escalationPolicy.denyByDefault',
    profileArbitrary: fc.boolean(),
    overrideArbitrary: fc.boolean(),
    profileSample: false,
    overrideSample: true,
  },
  {
    path: 'escalationPolicy.grantRules',
    profileArbitrary: grantRules,
    overrideArbitrary: grantRules,
    profileSample: [],
    overrideSample: [],
  },
  {
    path: 'escalationPolicy.maxGrantScope',
    profileArbitrary: fc.constantFrom(
      'per-command' as const,
      'per-command-prefix' as const,
      'per-host' as const,
      'session' as const,
    ),
    overrideArbitrary: fc.constantFrom(
      'per-command' as const,
      'per-command-prefix' as const,
      'per-host' as const,
      'session' as const,
    ),
    profileSample: 'per-command',
    overrideSample: 'per-host',
  },
  {
    path: 'merge.requiredEvidence',
    profileArbitrary: evidence,
    overrideArbitrary: evidence,
    profileSample: ['verification'],
    overrideSample: ['ci', 'review'],
  },
  {
    path: 'merge.runnerMayMerge',
    profileArbitrary: fc.boolean(),
    overrideArbitrary: fc.boolean(),
    profileSample: true,
    overrideSample: false,
  },
  {
    path: 'merge.runnerMayOpenPr',
    profileArbitrary: fc.boolean(),
    overrideArbitrary: fc.boolean(),
    profileSample: false,
    overrideSample: true,
  },
  {
    path: 'merge.runnerMayPush',
    profileArbitrary: fc.boolean(),
    overrideArbitrary: fc.boolean(),
    profileSample: false,
    overrideSample: true,
  },
  {
    path: 'provisioning.containmentRequired',
    profileArbitrary: fc.boolean(),
    overrideArbitrary: fc.boolean(),
    profileSample: false,
    overrideSample: true,
  },
  {
    path: 'provisioning.dependencyInstall.allowedPrefixes',
    profileArbitrary: prefixList,
    overrideArbitrary: prefixList,
    profileSample: ['pnpm install'],
    overrideSample: ['npm ci'],
  },
  {
    path: 'provisioning.dependencyInstall.defaultGrant',
    profileArbitrary: fc.constantFrom('none' as const, 'narrow' as const),
    overrideArbitrary: fc.constantFrom('none' as const, 'narrow' as const),
    profileSample: 'none',
    overrideSample: 'narrow',
  },
  {
    path: 'provisioning.ownershipClass',
    profileArbitrary: fc.constantFrom('owned' as const, 'owned-remote' as const, 'observe-only' as const),
    overrideArbitrary: fc.constantFrom('owned' as const, 'owned-remote' as const, 'observe-only' as const),
    profileSample: 'observe-only',
    overrideSample: 'owned-remote',
  },
  {
    path: 'run.maxConcurrentRuns',
    profileArbitrary: fc.integer({ min: 1, max: 4 }),
    overrideArbitrary: fc.integer({ min: 5, max: 9 }),
    profileSample: 2,
    overrideSample: 7,
  },
  {
    path: 'run.mode',
    profileArbitrary: fc.constant('manual'),
    overrideArbitrary: fc.constant('assisted'),
    profileSample: 'manual',
    overrideSample: 'assisted',
  },
  {
    path: 'run.requireCleanWorkspace',
    profileArbitrary: fc.boolean(),
    overrideArbitrary: fc.boolean(),
    profileSample: false,
    overrideSample: true,
  },
];

const _defaultLeafPaths = leafPaths(BUILT_IN_DEFAULTS).sort();

describe('Configuration & Policy', () => {
  it('treats malformed config content as an unknown artifact during resolution', () => {
    const result = createConfigurationPolicy().resolveRunPolicy(
      { path: 'kit.config.json', content: '{' },
      {},
      { runId: 'run-1', occurredAt, correlationId: 'corr-1' },
    );

    expect(result).toMatchObject({
      ok: false,
      error: {
        reason: 'adoption-unknown-artifact',
        blockingState: 'adoption-unknown-artifact',
        diagnostic: { state: 'adoption-unknown-artifact', path: 'kit.config.json' },
        appendIntents: [
          { type: 'AdoptionDiagnosticEmitted', correlationId: 'corr-1' },
          { type: 'PolicyResolutionFailed', correlationId: 'corr-1' },
        ],
      },
    });
  });

  it('fails closed when vNext config content does not match the schema', () => {
    const result = createConfigurationPolicy().resolveRunPolicy(
      {
        path: 'kit.config.json',
        content: JSON.stringify({
          schema: 'kit-vnext.config.v1',
          project: { id: 'project-1', rootPolicy: 'multi-repo' },
        }),
      },
      {},
      { runId: 'run-1', occurredAt },
    );

    expect(result).toMatchObject({
      ok: false,
      error: { reason: 'config-invalid', blockingState: 'config-invalid' },
    });
  });

  it('fails closed when run input is invalid after override validation', () => {
    const result = createConfigurationPolicy().resolveRunPolicy(
      sourceFor(),
      { profile: '' },
      { runId: 'run-1', occurredAt },
    );

    expect(result).toMatchObject({
      ok: false,
      error: { reason: 'config-invalid', blockingState: 'config-invalid' },
    });
  });

  it('fails closed when the selected profile is unknown', () => {
    const result = resolve(sourceFor({ selected: { run: { mode: 'manual' } } }), undefined, 'missing-profile');

    expect(result).toMatchObject({
      ok: false,
      error: {
        reason: 'profile-unknown',
        blockingState: 'profile-unknown',
        appendIntents: [
          {
            type: 'PolicyResolutionFailed',
            durability: 'barrier',
            occurredAt,
            payload: { reason: 'profile-unknown', blockingState: 'profile-unknown', at: occurredAt },
          },
        ],
      },
    });
  });

  it('carries correlation IDs on resolution failure intents', () => {
    const result = createConfigurationPolicy().resolveRunPolicy(
      sourceFor(),
      { run: { maxConcurrentRuns: 0 } },
      { runId: 'run-1', occurredAt, correlationId: 'corr-override' },
    );

    expect(result).toMatchObject({
      ok: false,
      error: {
        reason: 'config-invalid',
        appendIntents: [{ type: 'PolicyResolutionFailed', correlationId: 'corr-override' }],
      },
    });
  });

  it('fails closed when ConfigLoaded cannot be recorded', () => {
    const result = createConfigurationPolicy().diagnoseAdoption(
      { config: sourceFor(), artifacts: [] },
      { eventWriter: failingWriter, occurredAt },
    );

    expect(result).toEqual({
      ok: false,
      error: { reason: 'config-loaded-write-failed', blockingState: 'config-loaded-unrecorded' },
    });
  });

  it('does not attempt ConfigLoaded writes for configs that already block launch', () => {
    const appendConfigLoaded = vi.fn(writer.appendConfigLoaded);
    const recordingWriter: DurableEventWriter = {
      appendConfigLoaded,
    };

    const result = createConfigurationPolicy().diagnoseAdoption(
      { config: { path: 'kit.config.json', content: JSON.stringify({ schema: 'legacy.config.v1' }) }, artifacts: [] },
      { eventWriter: recordingWriter, occurredAt },
    );

    expect(result).toMatchObject({
      ok: true,
      value: {
        mayLaunch: false,
        diagnostics: [{ state: 'adoption-incompatible', path: 'kit.config.json' }],
      },
    });
    expect(appendConfigLoaded).not.toHaveBeenCalled();
  });

  it('records ConfigLoaded for valid config after recognizing known vNext artifacts', () => {
    const appendConfigLoaded = vi.fn(writer.appendConfigLoaded);
    const source = sourceFor();
    const result = createConfigurationPolicy().diagnoseAdoption(
      {
        config: source,
        artifacts: [
          {
            path: '.kit/events.ndjson',
            class: 'run-event-log',
            marker: 'kit-vnext.event-log.v1',
            contentHash: 'sha256:events',
          },
        ],
      },
      { eventWriter: { appendConfigLoaded }, occurredAt },
    );

    expect(result).toMatchObject({ ok: true, value: { mayLaunch: true, diagnostics: [], appendIntents: [] } });
    expect(appendConfigLoaded).toHaveBeenCalledWith({
      configRef: 'kit.config.json',
      schema: 'kit-vnext.config.v1',
      contentHash: stableHash(source.content),
      at: occurredAt,
    });
  });

  it('fails closed with adoption diagnostics for incompatible config and artifacts', () => {
    const policy = createConfigurationPolicy();
    const legacyConfig = policy.diagnoseAdoption(
      { config: { path: 'kit.config.json', content: JSON.stringify({ schema: 'legacy.config.v1' }) }, artifacts: [] },
      { eventWriter: writer, occurredAt },
    );
    const unknownArtifact = policy.diagnoseAdoption(
      {
        config: sourceFor(),
        artifacts: [
          {
            path: '.kit/state.bin',
            class: 'unknown',
            contentHash: 'sha256:abc',
          },
        ],
      },
      { eventWriter: writer, occurredAt },
    );

    expect(legacyConfig).toMatchObject({
      ok: true,
      value: {
        mayLaunch: false,
        diagnostics: [{ state: 'adoption-incompatible', path: 'kit.config.json' }],
      },
    });
    expect(unknownArtifact).toMatchObject({
      ok: true,
      value: {
        mayLaunch: false,
        diagnostics: [{ state: 'adoption-unknown-artifact', path: '.kit/state.bin' }],
      },
    });
  });
});
