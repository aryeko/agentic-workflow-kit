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

const mergeQueueActions = new Set([
  'enqueue-pull-request',
  'merge-pull-request-via-queue',
  'enqueue-pull-request-and-complete-task',
]);
const taskCompletingActions = new Set([
  'merge-pull-request-and-complete-task',
  'enqueue-pull-request-and-complete-task',
]);
const knownLinkageCapabilities = new Set(['auto-recover', 'unattended-run']);

const requiredAttestationsForRequest = (request: CapabilityGateRequest): readonly string[] => {
  const posture = capabilityPostureCatalog[request.capability];
  if (request.capability !== 'auto-merge') {
    return posture.requiredAttestations;
  }

  const autoMergePosture = capabilityPostureCatalog['auto-merge'];
  return [
    ...autoMergePosture.requiredAttestations,
    ...(mergeQueueActions.has(request.requestedAction)
      ? autoMergePosture.conditionalAttestations.requiresMergeQueue
      : []),
    ...(taskCompletingActions.has(request.requestedAction)
      ? autoMergePosture.conditionalAttestations.marksTaskComplete
      : []),
  ];
};

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

export const evaluatePolicyGuarantee = (request: CapabilityGateRequest): GuaranteeResult => {
  const permitsRequestedPolicy =
    request.policyDecision.permits && request.policyDecision.policyRef === request.policyRef;

  return {
    evaluation: {
      guaranteeId: guaranteeRequirementCatalog[1],
      passed: permitsRequestedPolicy,
      attestationRefs: [],
      evidenceRefs: [],
      failureReason: permitsRequestedPolicy ? undefined : 'policy-disallows-capability',
    },
    failureReason: permitsRequestedPolicy ? undefined : 'policy-disallows-capability',
  };
};

export const evaluateReplayHealthGuarantee = (
  request: CapabilityGateRequest,
  replay: RunReplay,
  projections: RunProjections | undefined,
): GuaranteeResult => {
  const runMismatch =
    request.runId !== request.scope.runId ||
    replay.runId !== request.runId ||
    (projections !== undefined && projections.summary.runId !== request.runId);
  const degraded =
    replay.health !== 'ok' ||
    projections === undefined ||
    runMismatch ||
    projections.launch.linkage === 'ambiguous' ||
    (knownLinkageCapabilities.has(request.capability) && projections.launch.linkage === 'unknown');

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

  const hasSelfReportOnlyEvidence =
    evidenceRefs.length > 0 &&
    evidenceRefs.some((evidenceRef) => {
      const records = recordedEvidence.get(evidenceRef);
      return records !== undefined && isEvidenceSelfReportOnly(records);
    });

  return {
    evaluation: {
      guaranteeId: guaranteeRequirementCatalog[3],
      passed: !hasSelfReportOnlyEvidence,
      attestationRefs: [],
      evidenceRefs,
      failureReason: hasSelfReportOnlyEvidence ? 'self-report-only' : undefined,
    },
    failureReason: hasSelfReportOnlyEvidence ? 'self-report-only' : undefined,
  };
};

export const evaluateAttestationGuarantee = (request: CapabilityGateRequest, replay: RunReplay): GuaranteeResult => {
  const recordedEvidence = collectRecordedEvidence(replay.events, request.evaluatedAt);
  const attestationRefs = [];
  const evidenceRefs = [];
  let failureReason: CapabilityGateFailureReason | undefined;

  for (const capability of requiredAttestationsForRequest(request)) {
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
