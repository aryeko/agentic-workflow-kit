import type { RunEventEnvelope } from '../../run-lifecycle/contracts/index.js';

type EvidenceSupportKind = 'probe' | 'artifact-digest' | 'self-report' | 'schema-only' | 'feature-list';

export interface RecordedEvidence {
  readonly eventId: string;
  readonly evidenceRef: string;
  readonly payloadDigest: string;
  readonly supportKind: EvidenceSupportKind;
  readonly value: string;
}

const SELF_REPORT_SUPPORT: ReadonlySet<EvidenceSupportKind> = new Set(['self-report', 'schema-only', 'feature-list']);
const REPLAYABLE_SUPPORT: ReadonlySet<EvidenceSupportKind> = new Set(['probe', 'artifact-digest']);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isEvidenceSupportKind = (value: unknown): value is EvidenceSupportKind =>
  value === 'probe' ||
  value === 'artifact-digest' ||
  value === 'self-report' ||
  value === 'schema-only' ||
  value === 'feature-list';

export const collectRecordedEvidence = (
  events: readonly RunEventEnvelope[],
): ReadonlyMap<string, readonly RecordedEvidence[]> => {
  const records = new Map<string, RecordedEvidence[]>();

  for (const event of events) {
    if (event.type === 'CapabilityAttestation') {
      continue;
    }

    if (!isRecord(event.payload) || typeof event.payload.evidenceRef !== 'string') {
      continue;
    }

    const evidenceRef = event.payload.evidenceRef;
    const record: RecordedEvidence = {
      eventId: event.eventId,
      evidenceRef,
      payloadDigest: event.payloadDigest,
      supportKind: isEvidenceSupportKind(event.payload.supportKind) ? event.payload.supportKind : 'probe',
      value:
        typeof event.payload.value === 'string'
          ? event.payload.value
          : typeof event.payload.payloadDigest === 'string'
            ? event.payload.payloadDigest
            : event.payloadDigest,
    };

    const existing = records.get(evidenceRef);
    if (existing === undefined) {
      records.set(evidenceRef, [record]);
      continue;
    }

    existing.push(record);
  }

  return records;
};

export const isEvidenceAmbiguous = (records: readonly RecordedEvidence[]): boolean => {
  const values = new Set(records.map((record) => record.value));
  return values.size > 1;
};

export const isEvidenceSelfReportOnly = (records: readonly RecordedEvidence[]): boolean =>
  records.length > 0 && records.every((record) => SELF_REPORT_SUPPORT.has(record.supportKind));

export const isEvidenceReplayable = (records: readonly RecordedEvidence[]): boolean =>
  records.some((record) => REPLAYABLE_SUPPORT.has(record.supportKind));
