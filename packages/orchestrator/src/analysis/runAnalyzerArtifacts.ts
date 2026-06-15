import path from 'node:path';
import type { ArtifactEvidenceSummary, BudgetEvaluationSummary } from './runAnalyzerTypes.js';
import {
  readJsonObjectIfExists,
  readOptionalNumber,
  readOptionalString,
  readRecord,
  readRecordArray,
  readStringRecord,
} from './runAnalyzerUtils.js';

export async function readArtifactEvidence(runDirectory: string): Promise<ArtifactEvidenceSummary> {
  const [summary, rows, budgets, transcripts] = await Promise.all([
    readJsonObjectIfExists(path.join(runDirectory, 'summary.json')),
    readJsonObjectIfExists(path.join(runDirectory, 'rows.json')),
    readJsonObjectIfExists(path.join(runDirectory, 'budgets.json')),
    readJsonObjectIfExists(path.join(runDirectory, 'transcripts.json')),
  ]);
  const rowEntries = readRecordArray(rows?.rows);
  const budgetEvaluations = readRecordArray(budgets?.evaluations);
  const transcriptEntries = readRecordArray(transcripts?.transcripts);
  const budgetSummaries = budgetEvaluations.map(readBudgetEvaluationSummary);
  return {
    summary: {
      present: summary !== null,
      schemaVersion: readOptionalNumber(summary?.schemaVersion),
      artifactPaths: Object.values(readRecord(summary?.artifactPaths) ?? {}).filter(
        (entry): entry is string => typeof entry === 'string',
      ),
      unavailable: readStringRecord(summary?.unavailable),
    },
    rows: {
      present: rows !== null,
      schemaVersion: readOptionalNumber(rows?.schemaVersion),
      count: rowEntries.length,
      storyIds: rowEntries.flatMap((row) => {
        const storyId = readOptionalString(row.storyId);
        return storyId ? [storyId] : [];
      }),
    },
    budgets: {
      present: budgets !== null,
      schemaVersion: readOptionalNumber(budgets?.schemaVersion),
      evaluationCount: budgetEvaluations.length,
      unavailable: budgetSummaries.filter((entry) => entry.status === 'unavailable'),
      warnings: budgetSummaries.filter((entry) => entry.eventType === 'budget-warning'),
      stops: budgetSummaries.filter((entry) => entry.eventType === 'budget-stop'),
    },
    transcripts: {
      present: transcripts !== null,
      schemaVersion: readOptionalNumber(transcripts?.schemaVersion),
      count: transcriptEntries.length,
      linked: transcriptEntries.filter((entry) => entry.status === 'linked').length,
      missing: transcriptEntries.filter((entry) => entry.status === 'missing').length,
      unlinked: transcriptEntries.filter((entry) => entry.status === 'unlinked').length,
    },
  };
}

export function readBudgetEvaluationSummary(value: Record<string, unknown>): BudgetEvaluationSummary {
  return {
    profileName: readOptionalString(value.profileName),
    taskType: readOptionalString(value.taskType),
    dimension: readOptionalString(value.dimension),
    status: readOptionalString(value.status),
    eventType: readOptionalString(value.eventType),
    unavailableReason: readOptionalString(value.unavailableReason),
  };
}
