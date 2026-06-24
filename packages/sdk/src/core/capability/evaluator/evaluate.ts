import type { RunProjections, RunReplay } from '../../run-lifecycle/contracts/index.js';
import { capabilityPostureCatalog } from '../registry/index.js';

import {
  evaluateAttestationGuarantee,
  evaluateEvidenceGuarantee,
  evaluateModeGuarantee,
  evaluatePolicyGuarantee,
  evaluateReplayHealthGuarantee,
} from './guarantee-predicates.js';
import {
  type AttestationRef,
  type CapabilityGateFailureReason,
  type CapabilityGateRecordPayload,
  type CapabilityGateRequest,
  capabilityGateRecordSchema,
  type GuaranteeEvaluation,
} from './types.js';

const dedupeAttestationRefs = (refs: readonly AttestationRef[]): AttestationRef[] => {
  const unique = new Map<string, AttestationRef>();
  for (const ref of refs) {
    unique.set(ref.eventId, ref);
  }

  return [...unique.values()];
};

const dedupeEvidenceRefs = (refs: readonly string[]): string[] =>
  [...new Set(refs)].sort((left, right) => left.localeCompare(right));

const getPayloadFailureReason = (
  replayFailure: CapabilityGateFailureReason | undefined,
  modeFailure: CapabilityGateFailureReason | undefined,
  policyFailure: CapabilityGateFailureReason | undefined,
  deferredFailure: CapabilityGateFailureReason | undefined,
  evidenceFailure: CapabilityGateFailureReason | undefined,
  attestationFailure: CapabilityGateFailureReason | undefined,
): CapabilityGateFailureReason | undefined => {
  if (replayFailure === 'run-log-degraded') {
    return replayFailure;
  }

  if (modeFailure === 'mode-disallows-capability') {
    return modeFailure;
  }

  if (policyFailure === 'policy-disallows-capability') {
    return policyFailure;
  }

  if (deferredFailure === 'capability-deferred') {
    return deferredFailure;
  }

  if (evidenceFailure === 'required-evidence-absent' || evidenceFailure === 'required-evidence-ambiguous') {
    return evidenceFailure;
  }

  if (attestationFailure !== undefined) {
    return attestationFailure;
  }

  if (evidenceFailure === 'self-report-only') {
    return evidenceFailure;
  }

  return undefined;
};

export const evaluateCapabilityGate = (
  request: CapabilityGateRequest,
  replay: RunReplay,
  projections: RunProjections,
): CapabilityGateRecordPayload => {
  const posture = capabilityPostureCatalog[request.capability];
  const replayHealth = evaluateReplayHealthGuarantee(request, replay, projections);

  if (replayHealth.failureReason === 'run-log-degraded') {
    const evaluatedGuarantees: GuaranteeEvaluation[] = [replayHealth.evaluation];

    return {
      schema: capabilityGateRecordSchema,
      gateId: request.gateId,
      capability: request.capability,
      decision: 'deny',
      mode: request.mode,
      scope: request.scope,
      policyRef: request.policyRef,
      requestedByDomain: request.requestedByDomain,
      requestedAction: request.requestedAction,
      evaluatedAt: request.evaluatedAt,
      evaluatedGuarantees,
      attestationRefs: [],
      evidenceRefs: [],
      failureReason: replayHealth.failureReason,
    };
  }

  const mode = evaluateModeGuarantee(request);
  const policy = evaluatePolicyGuarantee(request);
  const evidence = evaluateEvidenceGuarantee(request, replay);
  const deferredFailure = posture.status === 'deferred' ? posture.denialToken : undefined;

  const shouldInspectAttestations =
    replayHealth.failureReason === undefined &&
    mode.failureReason === undefined &&
    policy.failureReason === undefined &&
    deferredFailure === undefined &&
    evidence.failureReason !== 'required-evidence-absent' &&
    evidence.failureReason !== 'required-evidence-ambiguous';

  const attestation = shouldInspectAttestations ? evaluateAttestationGuarantee(request, replay) : undefined;
  const failureReason = getPayloadFailureReason(
    replayHealth.failureReason,
    mode.failureReason,
    policy.failureReason,
    deferredFailure,
    evidence.failureReason,
    attestation?.failureReason,
  );

  const evaluatedGuarantees: GuaranteeEvaluation[] = [
    mode.evaluation,
    policy.evaluation,
    replayHealth.evaluation,
    evidence.evaluation,
  ];

  if (attestation !== undefined) {
    evaluatedGuarantees.push(attestation.evaluation);
  }

  const attestationRefs = dedupeAttestationRefs(evaluatedGuarantees.flatMap((guarantee) => guarantee.attestationRefs));
  const evidenceRefs = dedupeEvidenceRefs(evaluatedGuarantees.flatMap((guarantee) => guarantee.evidenceRefs));

  return {
    schema: capabilityGateRecordSchema,
    gateId: request.gateId,
    capability: request.capability,
    decision: failureReason === undefined ? 'allow' : 'deny',
    mode: request.mode,
    scope: request.scope,
    policyRef: request.policyRef,
    requestedByDomain: request.requestedByDomain,
    requestedAction: request.requestedAction,
    evaluatedAt: request.evaluatedAt,
    evaluatedGuarantees,
    attestationRefs,
    evidenceRefs,
    ...(failureReason === undefined ? {} : { failureReason }),
  };
};
