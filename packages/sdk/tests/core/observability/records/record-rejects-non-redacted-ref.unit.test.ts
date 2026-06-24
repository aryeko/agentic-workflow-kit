import { describe, expect, it } from 'vitest';
import { recordAnalysisOutcome } from '../../../../src/core/observability/records/index.js';
import type { ArtifactStore } from '../../../../src/foundation/storage/artifacts/index.js';

import {
  createArtifactStore,
  createRecordInput,
  createWriter,
  onlyPayload,
  rawReportRef,
  reportArtifactInput,
  scratchReportRef,
} from './shared.js';

const createScratchReturningArtifactStore = (): ArtifactStore =>
  ({
    ...createArtifactStore(rawReportRef),
    async put() {
      return scratchReportRef;
    },
  }) as unknown as ArtifactStore;

describe('core-07-s3 report ref redaction guard', () => {
  it('rejects scratch and raw report refs by recording analysis-redaction-unavailable', async () => {
    for (const artifactStore of [createScratchReturningArtifactStore(), createArtifactStore(rawReportRef)]) {
      const writer = createWriter();
      const result = await recordAnalysisOutcome(createRecordInput(), writer, {
        artifactStore,
        reportArtifact: reportArtifactInput,
      });

      expect(result.ok).toBe(true);
      expect(writer.appendCalls).toHaveLength(1);
      expect(writer.appendCalls[0]?.[0]?.type).toBe('AnalysisFailed');

      const payload = onlyPayload(writer);
      expect(payload.schema).toBe('kit-vnext.analysis-failed.v1');
      if (payload.schema !== 'kit-vnext.analysis-failed.v1') {
        throw new Error('expected failed payload');
      }
      expect(payload.reason).toBe('analysis-redaction-unavailable');
    }
  });
});
