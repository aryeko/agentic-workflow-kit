import { describe, expect, it, vi } from 'vitest';

import {
  configurationPolicy,
  configurationSchemaMarker,
  type AdoptionContext,
  type AdoptionDiagnostic,
  type AdoptionDiagnosticFailure,
  type AdoptionReport,
  type ArtifactSource,
  type ConfigLoaded,
  type AdoptionConfigurationPolicy,
  type DurableEventWriter,
} from '../../../../src/foundation/configuration-policy/adoption/index.js';
import type { ConfigurationPolicy as RootConfigurationPolicy } from '../../../../src/index.js';

type RootPolicyMethods = Pick<RootConfigurationPolicy, 'diagnoseAdoption' | 'resolveRunPolicy'>;

const validConfigSource = {
  path: 'packages/sdk/config.json',
  content: JSON.stringify({
    schema: configurationSchemaMarker,
    project: {
      id: 'workflow-kit',
      rootPolicy: 'single-repo',
    },
  }),
} as const;

const recognizedArtifacts: readonly ArtifactSource[] = [
  {
    path: 'state/run-event-log.json',
    class: 'run-event-log',
    marker: 'kit-vnext.event-log.v1',
    contentHash: 'hash-event-log',
  },
  {
    path: 'state/projection.json',
    class: 'projection',
    marker: 'kit-vnext.projection.v1',
    contentHash: 'hash-projection',
  },
  {
    path: 'state/resolved-policy.json',
    class: 'resolved-policy',
    marker: 'kit-vnext.resolved-policy.v1',
    contentHash: 'hash-resolved-policy',
  },
  {
    path: 'state/capability-attestation.json',
    class: 'capability-attestation',
    marker: 'kit-vnext.capability-attestation.v1',
    contentHash: 'hash-capability-attestation',
  },
  {
    path: 'state/launch.json',
    class: 'launch-artifact',
    marker: 'kit-vnext.launch.v1',
    contentHash: 'hash-launch',
  },
] as const;

const makeWriter = (result: ReturnType<DurableEventWriter['appendConfigLoaded']>): DurableEventWriter => ({
  appendConfigLoaded: vi.fn(() => result),
});

const makeContext = (writer: DurableEventWriter): AdoptionContext => ({
  eventWriter: writer,
  occurredAt: '2026-06-22T12:00:00.000Z',
});

const expectReport = (result: { ok: true; value: AdoptionReport }): AdoptionReport => {
  expect(result.ok).toBe(true);
  return result.value;
};

const expectFailure = (result: { ok: false; error: AdoptionDiagnosticFailure }): AdoptionDiagnosticFailure => {
  expect(result.ok).toBe(false);
  return result.error;
};

describe('fnd-01-s3 adoption diagnostics', () => {
  it('exposes adoption diagnostics through the integrated root policy contract', () => {
    const adoptionPolicy: AdoptionConfigurationPolicy = configurationPolicy;
    const rootPolicy: Partial<RootPolicyMethods> = {
      diagnoseAdoption: adoptionPolicy.diagnoseAdoption,
    };

    expect(rootPolicy.diagnoseAdoption).toBe(configurationPolicy.diagnoseAdoption);
  });

  it('accepts valid vNext config and recognized artifact markers', () => {
    const writer = makeWriter({
      ok: true,
      value: { transactionId: 'txn-1' },
    });

    const result = configurationPolicy.diagnoseAdoption(
      {
        config: validConfigSource,
        artifacts: recognizedArtifacts,
      },
      makeContext(writer),
    );

    const report = expectReport(result);

    expect(writer.appendConfigLoaded).toHaveBeenCalledTimes(1);
    expect(writer.appendConfigLoaded).toHaveBeenCalledWith(
      expect.objectContaining<ConfigLoaded>({
        configRef: validConfigSource.path,
        schema: configurationSchemaMarker,
        at: '2026-06-22T12:00:00.000Z',
      }),
    );
    expect(report).toEqual<AdoptionReport>({
      diagnostics: [],
      mayLaunch: true,
      appendIntents: [],
    });
  });

  it('returns adoption-incompatible for a known legacy config marker and emits blocking intents', () => {
    const writer = makeWriter({
      ok: true,
      value: { transactionId: 'txn-2' },
    });

    const result = configurationPolicy.diagnoseAdoption(
      {
        config: {
          path: 'packages/sdk/config.json',
          content: JSON.stringify({
            schema: 'kit-v1.config.v1',
            project: {
              id: 'workflow-kit',
              rootPolicy: 'single-repo',
            },
          }),
        },
        artifacts: [],
      },
      makeContext(writer),
    );

    const report = expectReport(result);

    expect(writer.appendConfigLoaded).not.toHaveBeenCalled();
    expect(report.mayLaunch).toBe(false);
    expect(report.diagnostics).toEqual<readonly AdoptionDiagnostic[]>([
      expect.objectContaining<AdoptionDiagnostic>({
        state: 'adoption-incompatible',
        path: 'packages/sdk/config.json',
        observedMarker: 'kit-v1.config.v1',
        guidanceRef:
          'docs/design/30-domain-reference/foundation/configuration-and-policy/README.md#adoption-diagnostics',
      }),
    ]);
    expect(report.appendIntents).toEqual([
      expect.objectContaining({
        domain: 'fnd-01',
        type: 'AdoptionDiagnosticEmitted',
        occurredAt: '2026-06-22T12:00:00.000Z',
        durability: 'barrier',
        payload: {
          diagnostic: expect.objectContaining({
            state: 'adoption-incompatible',
          }),
          at: '2026-06-22T12:00:00.000Z',
        },
      }),
      expect.objectContaining({
        domain: 'fnd-01',
        type: 'PolicyResolutionFailed',
        occurredAt: '2026-06-22T12:00:00.000Z',
        durability: 'barrier',
        payload: {
          reason: 'adoption-incompatible',
          blockingState: 'adoption-diagnostic-unrecorded',
          at: '2026-06-22T12:00:00.000Z',
        },
      }),
    ]);
  });

  it('returns adoption-unknown-artifact for missing or unrecognized markers', () => {
    const writer = makeWriter({
      ok: true,
      value: { transactionId: 'txn-3' },
    });

    const result = configurationPolicy.diagnoseAdoption(
      {
        config: validConfigSource,
        artifacts: [
          {
            path: 'state/mystery.json',
            class: 'unknown',
            contentHash: 'hash-mystery',
          },
          {
            path: 'state/future.json',
            class: 'projection',
            marker: 'kit-v2.projection.v1',
            contentHash: 'hash-future',
          },
        ],
      },
      makeContext(writer),
    );

    const report = expectReport(result);

    expect(writer.appendConfigLoaded).toHaveBeenCalledTimes(1);
    expect(report.mayLaunch).toBe(false);
    expect(report.diagnostics).toHaveLength(2);
    expect(report.diagnostics[0]).toMatchObject<AdoptionDiagnostic>({
      state: 'adoption-unknown-artifact',
      path: 'state/mystery.json',
    });
    expect(report.diagnostics[1]).toMatchObject<AdoptionDiagnostic>({
      state: 'adoption-unknown-artifact',
      path: 'state/future.json',
      observedMarker: 'kit-v2.projection.v1',
    });
    expect(report.appendIntents).toHaveLength(3);
    expect(report.appendIntents.map((intent) => intent.type)).toEqual([
      'AdoptionDiagnosticEmitted',
      'AdoptionDiagnosticEmitted',
      'PolicyResolutionFailed',
    ]);
  });

  it('returns adoption-unknown-artifact for config with missing or unrecognized markers', () => {
    const writer = makeWriter({
      ok: true,
      value: { transactionId: 'txn-unknown-config' },
    });

    const missingMarkerResult = configurationPolicy.diagnoseAdoption(
      {
        config: {
          path: 'packages/sdk/missing-marker.json',
          content: JSON.stringify({
            project: {
              id: 'workflow-kit',
              rootPolicy: 'single-repo',
            },
          }),
        },
        artifacts: [],
      },
      makeContext(writer),
    );
    const unknownMarkerResult = configurationPolicy.diagnoseAdoption(
      {
        config: {
          path: 'packages/sdk/future-config.json',
          content: JSON.stringify({
            schema: 'kit-v2.config.v1',
            project: {
              id: 'workflow-kit',
              rootPolicy: 'single-repo',
            },
          }),
        },
        artifacts: [],
      },
      makeContext(writer),
    );

    const missingMarkerReport = expectReport(missingMarkerResult);
    const unknownMarkerReport = expectReport(unknownMarkerResult);

    expect(writer.appendConfigLoaded).not.toHaveBeenCalled();
    expect(missingMarkerReport.mayLaunch).toBe(false);
    expect(unknownMarkerReport.mayLaunch).toBe(false);
    expect(missingMarkerReport.diagnostics).toEqual<readonly AdoptionDiagnostic[]>([
      expect.objectContaining<AdoptionDiagnostic>({
        state: 'adoption-unknown-artifact',
        path: 'packages/sdk/missing-marker.json',
      }),
    ]);
    expect(unknownMarkerReport.diagnostics).toEqual<readonly AdoptionDiagnostic[]>([
      expect.objectContaining<AdoptionDiagnostic>({
        state: 'adoption-unknown-artifact',
        path: 'packages/sdk/future-config.json',
        observedMarker: 'kit-v2.config.v1',
      }),
    ]);
  });

  it('diagnoses legacy artifacts when supplied in configured locations', () => {
    const writer = makeWriter({
      ok: true,
      value: { transactionId: 'txn-4' },
    });

    const result = configurationPolicy.diagnoseAdoption(
      {
        config: validConfigSource,
        artifacts: [
          {
            path: 'state/launch.json',
            class: 'launch-artifact',
            marker: 'kit-v1.launch.v1',
            contentHash: 'hash-legacy-launch',
          },
        ],
      },
      makeContext(writer),
    );

    const report = expectReport(result);

    expect(report.mayLaunch).toBe(false);
    expect(report.diagnostics).toEqual<readonly AdoptionDiagnostic[]>([
      expect.objectContaining<AdoptionDiagnostic>({
        state: 'adoption-incompatible',
        path: 'state/launch.json',
        observedMarker: 'kit-v1.launch.v1',
      }),
    ]);
  });

  it('returns config-loaded-unrecorded when the pre-run load cannot be committed', () => {
    const writer = makeWriter({
      ok: false,
      error: 'append-failed',
    });

    const result = configurationPolicy.diagnoseAdoption(
      {
        config: validConfigSource,
        artifacts: [],
      },
      makeContext(writer),
    );

    const error = expectFailure(result);

    expect(error).toEqual({
      reason: 'config-loaded-write-failed',
      blockingState: 'config-loaded-unrecorded',
    });
    expect(writer.appendConfigLoaded).toHaveBeenCalledTimes(1);
  });
});
