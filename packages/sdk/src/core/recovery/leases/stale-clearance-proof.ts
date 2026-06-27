import type { LeaseSnapshot } from '../../../foundation/storage/index.js';

import type { RecoveryEvidenceSnapshot } from '../contracts/index.js';
import type { EvidenceEventRef } from '../../run-lifecycle/contracts/index.js';

import type { RequestStaleLaunchClearanceFailure } from './types.js';

const hasEvidenceRefs = (value: readonly unknown[] | undefined): boolean => value !== undefined && value.length > 0;
const hasManualEdits = (value: readonly EvidenceEventRef[] | undefined): value is readonly EvidenceEventRef[] =>
  hasEvidenceRefs(value);

const failGap = (missingEvidence: string): RequestStaleLaunchClearanceFailure => ({
  reason: 'provider-evidence-gap',
  failureState: 'provider-evidence-gap',
  missingEvidence,
});

const failDuplicate = (blockingSignal: string): RequestStaleLaunchClearanceFailure => ({
  reason: 'duplicate-launch-active',
  failureState: 'launch-duplicate-active',
  blockingSignal,
});

export const proveStaleLaunchClearance = (
  snapshot: RecoveryEvidenceSnapshot,
):
  | { readonly ok: true; readonly storyLaunch: LeaseSnapshot }
  | { readonly ok: false; readonly error: RequestStaleLaunchClearanceFailure } => {
  if (hasManualEdits(snapshot.manualEditRefs)) {
    return {
      ok: false,
      error: {
        reason: 'manual-edits-forbidden',
        failureState: 'manual-edits-forbidden',
        evidenceRefs: snapshot.manualEditRefs,
      },
    };
  }

  if (snapshot.leases.leaseHealth !== 'ok') {
    return {
      ok: false,
      error: {
        reason: 'lease-store-unavailable',
        failureState: 'lease-unavailable',
        leaseHealth: snapshot.leases.leaseHealth,
      },
    };
  }

  if (!hasEvidenceRefs(snapshot.evidenceRefs)) {
    return { ok: false, error: failGap('leases.evidenceRefs') };
  }

  if (snapshot.leases.storyLaunch === undefined) {
    return {
      ok: false,
      error: {
        reason: 'lease-store-unavailable',
        failureState: 'lease-unavailable',
      },
    };
  }

  if (snapshot.leases.storyLaunch.expiresAt.getTime() > globalThis.Date.parse(snapshot.observedAt)) {
    return { ok: false, error: failDuplicate('story-launch-live') };
  }

  if (snapshot.leases.runWriter !== undefined) {
    return { ok: false, error: failDuplicate('run-writer-live') };
  }

  if (snapshot.ownership === undefined) {
    return { ok: false, error: failGap('ownership') };
  }

  if (snapshot.ownership.ownerState === 'owned' || snapshot.ownership.ownerState === 'foreign') {
    return { ok: false, error: failDuplicate(`ownership:${snapshot.ownership.ownerState}`) };
  }

  if (snapshot.ownership.ownerState === 'unknown' || snapshot.ownership.ownerState === 'ambiguous') {
    return { ok: false, error: failGap(`ownership:${snapshot.ownership.ownerState}`) };
  }

  if (snapshot.process === undefined) {
    return { ok: false, error: failGap('process') };
  }

  if (!hasEvidenceRefs(snapshot.process.evidenceRefs)) {
    return { ok: false, error: failGap('process.evidenceRefs') };
  }

  if (snapshot.process.state === 'active') {
    return { ok: false, error: failDuplicate('process:active') };
  }

  if (snapshot.process.state === 'unknown' || snapshot.process.state === 'ambiguous') {
    return { ok: false, error: failGap(`process:${snapshot.process.state}`) };
  }

  if (snapshot.approval === undefined) {
    return { ok: false, error: failGap('approval') };
  }

  if (!hasEvidenceRefs(snapshot.approval.evidenceRefs)) {
    return { ok: false, error: failGap('approval.evidenceRefs') };
  }

  if (snapshot.approval.state === 'pending' || snapshot.approval.state === 'parked') {
    return { ok: false, error: failDuplicate(`approval:${snapshot.approval.state}`) };
  }

  if (snapshot.approval.state === 'unknown' || snapshot.approval.state === 'ambiguous') {
    return { ok: false, error: failGap(`approval:${snapshot.approval.state}`) };
  }

  if (snapshot.workSource === undefined) {
    return { ok: false, error: failGap('workSource') };
  }

  if (!hasEvidenceRefs(snapshot.workSource.evidenceRefs)) {
    return { ok: false, error: failGap('workSource.evidenceRefs') };
  }

  if (snapshot.workSource.claimState === 'claimed') {
    return { ok: false, error: failDuplicate('workSource:claimed') };
  }

  if (snapshot.workSource.claimState === 'unknown' || snapshot.workSource.claimState === 'ambiguous') {
    return { ok: false, error: failGap(`workSource:${snapshot.workSource.claimState}`) };
  }

  return {
    ok: true,
    storyLaunch: snapshot.leases.storyLaunch,
  };
};
