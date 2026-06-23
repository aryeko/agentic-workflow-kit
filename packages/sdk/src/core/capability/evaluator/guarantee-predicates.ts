import type { RunProjections, RunReplay } from '../../run-lifecycle/contracts/index.js';
import { capabilityPostureCatalog, guaranteeRequirementCatalog } from '../registry/index.js';

import { deriveExpectedProviderDomain, evaluateAttestationRequirement } from './attestation-consumption.js';
import { collectRecordedEvidence, isEvidenceAmbiguous, isEvidenceSelfReportOnly } from './evidence-records.js';
import type { CapabilityGateFailureReason, CapabilityGateRequest, GuaranteeEvaluation } from './types.js';

type GuaranteeResult = {
  readonly evaluation: GuaranteeEvaluation;
  readonly failureReason?: CapabilityGateFailureReason;
};

const sortEvidenceRefs = (evidenceRefs: readonly string[]): string[] =>
  [...evidenceRefs].sort((left, right) => left.localeCompare(right));

export const evaluateModeGuarantee = (request: CapabilityGateRequest): GuaranteeResult => ({
  evaluation: {
    guaranteeId: guaranteeRequirementCatalog[0],
    passed: request.mode === 'assisted',
    attestationRefs: [],
    evidenceRefs: [],
    failureReason: request.mode === 'assisted' ? undefined : 'mode-disallows-capability',
  },
  failureReason: request.mode === 'assisted' ? undefined : 'mode-disallows-capability',
});

export const evaluatePolicyGuarantee = (request: CapabilityGateRequest): GuaranteeResult => ({
  evaluation: {
    guaranteeId: guaranteeRequirementCatalog[1],
    passed: request.policyDecision.permits,
    attestationRefs: [],
    evidenceRefs: [],
    failureReason: request.policyDecision.permits ? undefined : 'policy-disallows-capability',
  },
  failureReason: request.policyDecision.permits ? undefined : 'policy-disallows-capability',
});

export const evaluateReplayHealthGuarantee = (
  replay: RunReplay,
  projections: RunProjections | undefined,
): GuaranteeResult => {
  const degraded =
    replay.health === 'interior-corrupt' ||
    replay.health === 'event-log-unavailable' ||
    projections === undefined ||
    projections.launch.linkage === 'ambiguous';

  return {
    evaluation: {
      guaranteeId: guaranteeRequirementCatalog[2],
      passed: !degraded,
      attestationRefs: [],
      evidenceRefs: [],
      failureReason: degraded ? 'run-log-degraded' : undefined,
    },
    failureReason: degraded ? 'run-log-degraded' : undefined,
  };
};

export const evaluateEvidenceGuarantee = (request: CapabilityGateRequest, replay: RunReplay): GuaranteeResult => {
  const recordedEvidence = collectRecordedEvidence(replay.events, request.evaluatedAt);
  const evidenceRefs = sortEvidenceRefs(request.evidenceRefs);

  if (
    evidenceRefs.length === 0 ||
    evidenceRefs.some((evidenceRef) => recordedEvidence.get(evidenceRef) === undefined)
  ) {
    return {
      evaluation: {
        guaranteeId: guaranteeRequirementCatalog[3],
        passed: false,
        attestationRefs: [],
        evidenceRefs,
        failureReason: 'required-evidence-absent',
      },
      failureReason: 'required-evidence-absent',
    };
  }

  if (
    evidenceRefs.some((evidenceRef) => {
      const records = recordedEvidence.get(evidenceRef);
      return records !== undefined && isEvidenceAmbiguous(records);
    })
  ) {
    return {
      evaluation: {
        guaranteeId: guaranteeRequirementCatalog[3],
        passed: false,
        attestationRefs: [],
        evidenceRefs,
        failureReason: 'required-evidence-ambiguous',
      },
      failureReason: 'required-evidence-ambiguous',
    };
  }

  const selfReportOnly =
    evidenceRefs.length > 0 &&
    evidenceRefs.every((evidenceRef) => {
      const records = recordedEvidence.get(evidenceRef);
      return records !== undefined && isEvidenceSelfReportOnly(records);
    });

  return {
    evaluation: {
      guaranteeId: guaranteeRequirementCatalog[3],
      passed: !selfReportOnly,
      attestationRefs: [],
      evidenceRefs,
      failureReason: selfReportOnly ? 'self-report-only' : undefined,
    },
    failureReason: selfReportOnly ? 'self-report-only' : undefined,
  };
};

export const evaluateAttestationGuarantee = (request: CapabilityGateRequest, replay: RunReplay): GuaranteeResult => {
  const posture = capabilityPostureCatalog[request.capability];
  const recordedEvidence = collectRecordedEvidence(replay.events, request.evaluatedAt);
  const attestationRefs = [];
  const evidenceRefs = [];
  let failureReason: CapabilityGateFailureReason | undefined;

  for (const capability of posture.requiredAttestations) {
    const expectedProvider = deriveExpectedProviderDomain(capability);
    if (expectedProvider === undefined) {
      failureReason = 'attestation-absent';
      continue;
    }

    const result = evaluateAttestationRequirement(
      capability,
      expectedProvider,
      request.scope,
      request.evaluatedAt,
      replay.events,
      recordedEvidence,
    );
    attestationRefs.push(...result.attestationRefs);
    evidenceRefs.push(...result.evidenceRefs);

    if (!result.passed && failureReason === undefined) {
      failureReason = result.failureReason;
    }
  }

  return {
    evaluation: {
      guaranteeId: guaranteeRequirementCatalog[4],
      passed: failureReason === undefined,
      attestationRefs,
      evidenceRefs: sortEvidenceRefs(evidenceRefs),
      failureReason,
    },
    failureReason,
  };
};
