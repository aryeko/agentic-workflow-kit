import fc, { type Arbitrary } from 'fast-check';
import { describe, expect, it, vi } from 'vitest';
import {
  BUILT_IN_DEFAULTS,
  createConfigurationPolicy,
  stableHash,
  type ConfigSource,
  type DurableEventWriter,
  type PolicyLayerPatch,
} from '../src/index.js';
import { getPath, leafPaths as productionLeafPaths, setPath } from '../src/object-paths.js';

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

const valueAt = (value: unknown, path: string): unknown =>
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

const patchFromEntries = (entries: readonly PatchEntry[]): PolicyLayerPatch =>
  entries.reduce<Record<string, unknown>>(
    (patch, entry) => insertPath(patch, entry.path, entry.value),
    {},
  ) as PolicyLayerPatch;

const uniqueCases = (cases: readonly LeafCase[]): readonly LeafCase[] => {
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

const leafCases: readonly LeafCase[] = [
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

const defaultLeafPaths = leafPaths(BUILT_IN_DEFAULTS).sort();

describe('Configuration & Policy', () => {
  it('exposes safe defaults matching the domain snapshot', () => {
    expect(BUILT_IN_DEFAULTS).toMatchInlineSnapshot(`
      {
        "approval": {
          "mode": "assisted",
          "parkOnHumanLatency": true,
          "requireRecordedDecision": true,
        },
        "capabilities": {
          "auto-merge": {
            "desired": false,
            "requireFreshAttestation": true,
          },
          "auto-recover": {
            "desired": false,
            "requireFreshAttestation": true,
          },
          "unattended-run": {
            "desired": false,
            "requireFreshAttestation": true,
          },
        },
        "changePolicy": {
          "allowedChangePaths": [],
        },
        "credentialRefs": {
          "refs": [],
        },
        "egress": {
          "defaultAction": "deny",
          "negativeProbes": [],
          "requiredAttesters": [],
          "rules": [],
        },
        "escalationPolicy": {
          "allowedGrantScopes": [
            "per-command",
            "per-command-prefix",
          ],
          "denyByDefault": true,
          "grantRules": [
            {
              "prefixes": [
                "pnpm install",
                "pnpm add",
                "npm install",
                "npm ci",
                "yarn install",
              ],
              "reason": "dependency-install",
              "requiresOperator": false,
              "scope": "per-command-prefix",
            },
          ],
          "maxGrantScope": "per-command-prefix",
        },
        "merge": {
          "requiredEvidence": [
            "verification",
            "ci",
            "review",
            "threads-resolved",
            "protection",
          ],
          "runnerMayMerge": false,
          "runnerMayOpenPr": true,
          "runnerMayPush": true,
        },
        "provisioning": {
          "containmentRequired": true,
          "dependencyInstall": {
            "allowedPrefixes": [
              "pnpm install",
              "pnpm add",
              "npm install",
              "npm ci",
              "yarn install",
            ],
            "defaultGrant": "narrow",
          },
          "ownershipClass": "owned",
        },
        "run": {
          "maxConcurrentRuns": 1,
          "mode": "assisted",
          "requireCleanWorkspace": true,
        },
      }
    `);
  });

  it('proves defaults, profiles, and overrides resolve with matching provenance across every canonical leaf', () => {
    expect(leafCases.map((fieldCase) => fieldCase.path).sort()).toEqual(defaultLeafPaths);

    for (const fieldCase of leafCases) {
      const noiseCases = leafCases.filter((candidate) => candidate.path !== fieldCase.path);

      fc.assert(
        fc.property(
          fieldCase.profileArbitrary,
          fieldCase.overrideArbitrary,
          fc.array(fc.constantFrom(...noiseCases), { maxLength: 6 }),
          fc.array(fc.constantFrom(...noiseCases), { maxLength: 6 }),
          fc.boolean(),
          fc.boolean(),
          (profileValue, overrideValue, profileNoise, overrideNoise, profileFirst, overrideFirst) => {
            const profileEntry = { path: fieldCase.path, value: profileValue };
            const overrideEntry = { path: fieldCase.path, value: overrideValue };
            const profileNoiseEntries = uniqueCases(profileNoise).map((noiseCase) => ({
              path: noiseCase.path,
              value: noiseCase.profileSample,
            }));
            const overrideNoiseEntries = uniqueCases(overrideNoise).map((noiseCase) => ({
              path: noiseCase.path,
              value: noiseCase.overrideSample,
            }));
            const profilePatch = patchFromEntries(
              profileFirst ? [profileEntry, ...profileNoiseEntries] : [...profileNoiseEntries, profileEntry],
            );
            const overridePatch = patchFromEntries(
              overrideFirst ? [overrideEntry, ...overrideNoiseEntries] : [...overrideNoiseEntries, overrideEntry],
            );

            const defaultResult = resolve(sourceFor());
            const profileResult = resolve(sourceFor({ selected: profilePatch }), undefined, 'selected');
            const overrideResult = resolve(sourceFor({ selected: profilePatch }), overridePatch, 'selected');

            expect(defaultResult.ok).toBe(true);
            expect(profileResult.ok).toBe(true);
            expect(overrideResult.ok).toBe(true);
            if (!defaultResult.ok || !profileResult.ok || !overrideResult.ok) {
              return;
            }

            const defaultValue = valueAt(BUILT_IN_DEFAULTS, fieldCase.path);
            expect(valueAt(defaultResult.value.resolvedPolicy.policy, fieldCase.path)).toEqual(defaultValue);
            expect(defaultResult.value.resolvedPolicy.provenance[fieldCase.path]).toMatchObject({
              fieldPath: fieldCase.path,
              sourceLayer: 'built-in-defaults',
              sourceRef: 'kit-vnext.config.v1#built-in-defaults',
              valueHash: stableHash(defaultValue),
            });

            expect(valueAt(profileResult.value.resolvedPolicy.policy, fieldCase.path)).toEqual(profileValue);
            expect(profileResult.value.resolvedPolicy.provenance[fieldCase.path]).toMatchObject({
              fieldPath: fieldCase.path,
              sourceLayer: 'profile',
              profile: 'selected',
              sourceRef: 'kit.config.json#profiles.selected',
              valueHash: stableHash(profileValue),
            });

            expect(valueAt(overrideResult.value.resolvedPolicy.policy, fieldCase.path)).toEqual(overrideValue);
            expect(overrideResult.value.resolvedPolicy.provenance[fieldCase.path]).toMatchObject({
              fieldPath: fieldCase.path,
              sourceLayer: 'operator-override',
              sourceRef: 'kit.config.json#overrides',
              valueHash: stableHash(overrideValue),
            });
          },
        ),
        { seed: 12019, numRuns: 20 },
      );
    }
  });

  it('returns canonical provenance append intents before the summary intent', () => {
    const result = resolve(sourceFor());

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const fieldIntents = result.value.appendIntents.filter((intent) => intent.type === 'ConfigFieldResolved');
    const fieldPaths = fieldIntents.map((intent) => intent.payload.fieldPath);

    expect(fieldPaths).toEqual([...fieldPaths].sort());
    expect(fieldPaths).toEqual(Object.keys(result.value.resolvedPolicy.provenance).sort());
    expect(result.value.appendIntents.at(-1)).toMatchObject({
      type: 'ConfigResolved',
      durability: 'barrier',
      payload: { runId: 'run-1', fieldCount: fieldPaths.length, at: occurredAt },
    });
  });

  it('carries correlation IDs on successful field and summary resolution intents', () => {
    const result = createConfigurationPolicy().resolveRunPolicy(
      sourceFor(),
      {},
      {
        runId: 'run-1',
        occurredAt,
        correlationId: 'corr-success',
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.appendIntents.every((intent) => intent.correlationId === 'corr-success')).toBe(true);
  });

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

  it('returns adoption diagnostic and failure append intents when resolution sees missing or incompatible markers', () => {
    const policy = createConfigurationPolicy();
    const cases = [
      {
        source: { path: 'kit.config.json', content: JSON.stringify({ schema: 'legacy.config.v1' }) },
        state: 'adoption-incompatible',
      },
      {
        source: { path: 'kit.config.json', content: JSON.stringify({ project: { id: 'project-1' } }) },
        state: 'adoption-unknown-artifact',
      },
    ] as const;

    for (const markerCase of cases) {
      const result = policy.resolveRunPolicy(markerCase.source, {}, { runId: 'run-1', occurredAt });

      expect(result).toMatchObject({
        ok: false,
        error: {
          reason: markerCase.state,
          blockingState: markerCase.state,
          diagnostic: {
            state: markerCase.state,
            path: 'kit.config.json',
            guidanceRef:
              'docs/design/domains/foundation/fnd-01-configuration-and-policy/README.md#adoption-diagnostics',
          },
        },
      });
      if (!result.ok) {
        expect(result.error.appendIntents?.map((intent) => intent.type)).toEqual([
          'AdoptionDiagnosticEmitted',
          'PolicyResolutionFailed',
        ]);
        expect(result.error.appendIntents?.[0]).toMatchObject({
          type: 'AdoptionDiagnosticEmitted',
          payload: {
            diagnostic: {
              state: markerCase.state,
              path: 'kit.config.json',
              guidanceRef:
                'docs/design/domains/foundation/fnd-01-configuration-and-policy/README.md#adoption-diagnostics',
            },
          },
        });
      }
    }
  });

  it('rejects invalid operator overrides without partially applying them', () => {
    const result = resolve(sourceFor(), { run: { maxConcurrentRuns: 0 } });

    expect(result).toMatchObject({
      ok: false,
      error: { reason: 'override-invalid', blockingState: 'override-invalid' },
    });
  });

  it('keeps object path helpers deterministic for empty and missing paths', () => {
    expect(productionLeafPaths('root')).toEqual([]);
    expect(productionLeafPaths({ empty: {}, list: [1], scalar: true }).sort()).toEqual(['list', 'scalar']);
    expect(getPath({ nested: { value: 1 } }, 'nested.missing')).toBeUndefined();
    expect(setPath({}, '', 'leaf')).toBe('leaf');
  });

  it('treats known markers with unknown artifact classes as incompatible adoption evidence', () => {
    const result = createConfigurationPolicy().diagnoseAdoption(
      {
        config: sourceFor(),
        artifacts: [
          {
            path: '.kit/events.ndjson',
            class: 'unknown',
            marker: 'kit-vnext.event-log.v1',
            contentHash: 'sha256:events',
          },
        ],
      },
      { eventWriter: writer, occurredAt },
    );

    expect(result).toMatchObject({
      ok: true,
      value: {
        mayLaunch: false,
        diagnostics: [{ state: 'adoption-incompatible', path: '.kit/events.ndjson' }],
      },
    });
  });

  it('treats empty sparse profile and override objects as no-op patches', () => {
    const result = resolve(
      sourceFor({ empty: { run: {}, provisioning: { dependencyInstall: {} } } }),
      { approval: {}, merge: {} },
      'empty',
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const fieldPaths = result.value.appendIntents
      .filter((intent) => intent.type === 'ConfigFieldResolved')
      .map((intent) => intent.payload.fieldPath);

    expect(result.value.resolvedPolicy.policy).toEqual(BUILT_IN_DEFAULTS);
    expect(fieldPaths).toEqual(defaultLeafPaths);
    expect(Object.keys(result.value.resolvedPolicy.provenance).sort()).toEqual(defaultLeafPaths);
    expect(result.value.resolvedPolicy.provenance['run.mode']).toMatchObject({
      sourceLayer: 'built-in-defaults',
    });
  });

  it('rejects deferred orchestrator-decide capability in config, profile, and override', () => {
    const policy = createConfigurationPolicy();
    const configResult = policy.resolveRunPolicy(
      {
        path: 'kit.config.json',
        content: JSON.stringify({
          schema: 'kit-vnext.config.v1',
          project: { id: 'project-1', rootPolicy: 'single-repo' },
          profiles: { bad: { capabilities: { 'orchestrator-decide': { desired: true } } } },
        }),
      },
      { profile: 'bad' },
      { runId: 'run-1', occurredAt },
    );
    const overrideResult = resolve(sourceFor(), {
      capabilities: { 'orchestrator-decide': { desired: true } },
    } as unknown as PolicyLayerPatch);

    expect(configResult).toMatchObject({
      ok: false,
      error: { reason: 'unsupported-deferred-capability' },
    });
    expect(overrideResult).toMatchObject({
      ok: false,
      error: { reason: 'unsupported-deferred-capability' },
    });
  });

  it('records credential reference and egress source provenance from the selected profile', () => {
    const credential = {
      id: 'forge-runner',
      kind: 'forge' as const,
      purpose: 'open pull requests',
      secret: { source: 'env' as const, key: 'FORGE_RUNNER_CREDENTIAL_REF', version: '2026-06' },
      allowedParties: ['runner' as const],
      allowedPhases: ['merge'],
      allowedHosts: ['github.com'],
      ttlSeconds: 300,
    };
    const egressRule = {
      credentialRefIds: ['forge-runner'],
      protocols: ['https' as const],
      hosts: ['github.com'],
      ports: [443],
      phase: 'merge',
      purpose: 'GitHub Forge operations',
    };
    const result = resolve(
      sourceFor({
        github: {
          credentialRefs: { refs: [credential] },
          egress: {
            defaultAction: 'deny',
            rules: [egressRule],
            negativeProbes: [
              { host: 'example.com', protocol: 'https', expected: 'blocked', reason: 'deny-by-default' },
            ],
            requiredAttesters: [
              {
                point: 'execution-host',
                capability: 'egress-confinement',
                driverId: 'local-execution-host',
              },
            ],
          },
        },
      }),
      undefined,
      'github',
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.resolvedPolicy.policy.credentialRefs.refs).toEqual([credential]);
    expect(result.value.resolvedPolicy.policy.egress.rules).toEqual([egressRule]);
    expect(result.value.resolvedPolicy.provenance['credentialRefs.refs']).toMatchObject({
      sourceLayer: 'profile',
      profile: 'github',
      sourceRef: 'kit.config.json#profiles.github',
    });
    expect(result.value.resolvedPolicy.provenance['egress.rules']).toMatchObject({
      sourceLayer: 'profile',
      profile: 'github',
      sourceRef: 'kit.config.json#profiles.github',
    });
  });
});
