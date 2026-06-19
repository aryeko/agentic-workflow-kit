import type { ArtifactRef } from '@kit-vnext/foundation-fnd-02';
import {
  capabilityAttestationSchema,
  evaluateCapabilityGate,
  type CapabilityAttestation,
  type InjectedClock,
} from './attestation.js';
import { runSchemaProbe, type SchemaProbeFailure } from './schema-probe.js';

export type ConformanceLane = 'conformance-mock' | 'smoke-real';

export interface CapabilityProbeResponse {
  readonly payload?: unknown;
  readonly elapsedMs: number;
}

export interface CapabilityProbeDriver {
  probeCapability(capability: string): CapabilityProbeResponse | Promise<CapabilityProbeResponse>;
}

export type ConformanceFailure =
  | SchemaProbeFailure
  | {
      readonly token: 'probe-delayed' | 'probe-threw' | 'capability-mismatch';
      readonly field?: string;
      readonly message: string;
    }
  | {
      readonly token: 'attestation-stale' | 'attestation-absent' | 'attestation-negative';
      readonly field?: string;
      readonly message: string;
    };

export type ConformanceCaseResult =
  | {
      readonly id: string;
      readonly status: 'pass';
    }
  | {
      readonly id: string;
      readonly status: 'fail';
      readonly failure: ConformanceFailure;
    }
  | {
      readonly id: string;
      readonly status: 'skip';
      readonly reason: string;
    };

export interface ConformanceContext {
  readonly lane: ConformanceLane;
  readonly clock: InjectedClock;
}

export type ConformanceCase =
  | {
      readonly kind: 'case';
      readonly id: string;
      run(
        driver: CapabilityProbeDriver,
        context: ConformanceContext,
      ): ConformanceCaseResult | Promise<ConformanceCaseResult>;
    }
  | {
      readonly kind: 'real-smoke';
      readonly id: string;
      run?(
        driver: CapabilityProbeDriver,
        context: ConformanceContext,
      ): ConformanceCaseResult | Promise<ConformanceCaseResult>;
    };

export interface CapabilityAttestationCaseOptions {
  readonly id: string;
  readonly capability: string;
  readonly maxProbeMs: number;
  readonly resolveEvidence?: (ref: ArtifactRef) => boolean | Promise<boolean>;
}

export interface RealSmokeSlotOptions {
  readonly id: string;
  readonly run?: (
    driver: CapabilityProbeDriver,
    context: ConformanceContext,
  ) => ConformanceCaseResult | Promise<ConformanceCaseResult>;
}

export interface ConformanceRunInput {
  readonly lane: ConformanceLane;
  readonly driver: CapabilityProbeDriver;
  readonly cases: readonly ConformanceCase[];
  readonly clock: InjectedClock;
}

export interface ConformanceRunResult {
  readonly status: 'pass' | 'fail';
  readonly lane: ConformanceLane;
  readonly cases: readonly ConformanceCaseResult[];
}

export const createCapabilityAttestationCase = (options: CapabilityAttestationCaseOptions): ConformanceCase => ({
  kind: 'case',
  id: options.id,
  run: async (driver, context) => {
    const response = await safeProbe(driver, options.capability, options.id);
    if (response.status === 'fail') {
      return response.result;
    }

    if (response.value.elapsedMs > options.maxProbeMs) {
      return {
        id: options.id,
        status: 'fail',
        failure: {
          token: 'probe-delayed',
          message: `probe elapsed ${response.value.elapsedMs}ms beyond ${options.maxProbeMs}ms`,
        },
      };
    }

    const probe = await runSchemaProbe(capabilityAttestationSchema, response.value.payload, {
      schemaName: 'CapabilityAttestation',
      resolveEvidence: options.resolveEvidence,
    });

    if (probe.status === 'fail') {
      return {
        id: options.id,
        status: 'fail',
        failure: probe.failure,
      };
    }

    if (probe.value.capability !== options.capability) {
      return {
        id: options.id,
        status: 'fail',
        failure: {
          token: 'capability-mismatch',
          field: 'capability',
          message: `expected ${options.capability}, received ${probe.value.capability}`,
        },
      };
    }

    return resultFromGate(options.id, probe.value, options.capability, context.clock);
  },
});

export const registerRealSmokeSlot = (options: RealSmokeSlotOptions): ConformanceCase => ({
  kind: 'real-smoke',
  id: options.id,
  run: options.run,
});

export const runConformanceSuite = async (input: ConformanceRunInput): Promise<ConformanceRunResult> => {
  const cases = await Promise.all(input.cases.map((testCase) => runOneCase(testCase, input)));
  const failed = cases.some((testCase) => testCase.status === 'fail');

  return {
    status: failed ? 'fail' : 'pass',
    lane: input.lane,
    cases,
  };
};

const safeProbe = async (
  driver: CapabilityProbeDriver,
  capability: string,
  id: string,
): Promise<
  | {
      readonly status: 'pass';
      readonly value: CapabilityProbeResponse;
    }
  | {
      readonly status: 'fail';
      readonly result: ConformanceCaseResult;
    }
> => {
  try {
    return {
      status: 'pass',
      value: await driver.probeCapability(capability),
    };
  } catch {
    return {
      status: 'fail',
      result: {
        id,
        status: 'fail',
        failure: {
          token: 'probe-threw',
          message: 'probe threw instead of returning a typed response',
        },
      },
    };
  }
};

const resultFromGate = (
  id: string,
  attestation: CapabilityAttestation,
  capability: string,
  clock: InjectedClock,
): ConformanceCaseResult => {
  const gate = evaluateCapabilityGate([attestation], capability, clock);

  if (!gate.allowed) {
    return {
      id,
      status: 'fail',
      failure: {
        token: gate.token,
        message: `${capability} is not freshly and positively attested`,
      },
    };
  }

  return {
    id,
    status: 'pass',
  };
};

const runOneCase = async (testCase: ConformanceCase, input: ConformanceRunInput): Promise<ConformanceCaseResult> => {
  if (testCase.kind === 'real-smoke') {
    if (input.lane === 'conformance-mock') {
      return {
        id: testCase.id,
        status: 'skip',
        reason: 'real-smoke slots are skipped in conformance-mock',
      };
    }

    if (!testCase.run) {
      return {
        id: testCase.id,
        status: 'skip',
        reason: 'real-smoke slot has no registered runner',
      };
    }

    return runRegisteredCase(testCase.id, testCase.run, input);
  }

  return runRegisteredCase(testCase.id, testCase.run, input);
};

const runRegisteredCase = async (
  id: string,
  run: (
    driver: CapabilityProbeDriver,
    context: ConformanceContext,
  ) => ConformanceCaseResult | Promise<ConformanceCaseResult>,
  input: ConformanceRunInput,
): Promise<ConformanceCaseResult> => {
  try {
    return await run(input.driver, {
      lane: input.lane,
      clock: input.clock,
    });
  } catch {
    return {
      id,
      status: 'fail',
      failure: {
        token: 'probe-threw',
        message: 'conformance case threw instead of returning a typed result',
      },
    };
  }
};
