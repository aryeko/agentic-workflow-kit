import { z } from 'zod';

const hexDigest = z.string().regex(/^[a-f0-9]{64}$/u);
const isoDate = z.string().datetime({ offset: true });

export const recordFrameSchema = z.object({
  schema: z.literal('kit-vnext.log-frame.v1'),
  kind: z.literal('record'),
  sequence: z.number().int().positive(),
  writerEpoch: z.number().int().nonnegative(),
  leaseName: z.string().min(1),
  payloadLength: z.number().int().nonnegative(),
  payloadDigest: hexDigest,
  payloadBase64: z.string(),
  byteStart: z.number().int().nonnegative(),
  byteEnd: z.number().int().nonnegative(),
  frameDigest: hexDigest,
});

export const commitFrameSchema = z.object({
  schema: z.literal('kit-vnext.log-frame.v1'),
  kind: z.literal('commit'),
  firstSequence: z.number().int().positive(),
  lastSequence: z.number().int().positive(),
  recordCount: z.number().int().positive(),
  writerEpoch: z.number().int().nonnegative(),
  leaseName: z.string().min(1),
  recordDigests: z.array(hexDigest),
  batchDigest: hexDigest,
  byteStart: z.number().int().nonnegative(),
  byteEnd: z.number().int().nonnegative(),
  frameDigest: hexDigest,
});

export const leaseRecordSchema = z.object({
  schema: z.literal('kit-vnext.lease-record.v1'),
  name: z.string().min(1),
  epoch: z.number().int().nonnegative(),
  holder: z.string().min(1),
  tokenDigest: hexDigest,
  acquiredAt: isoDate,
  expiresAt: isoDate,
  recordDigest: hexDigest,
});

export const guardRecordSchema = z.object({
  schema: z.literal('kit-vnext.lease-guard.v1'),
  name: z.string().min(1),
  holder: z.string().min(1),
  operationId: z.string().min(1),
  operation: z.enum(['acquire', 'renew', 'release']),
  guardExpiresAt: isoDate,
});

export const artifactMetadataSchema = z.object({
  schema: z.literal('kit-vnext.artifact-metadata.v1'),
  id: z.string().min(1),
  digest: hexDigest,
  size: z.number().int().nonnegative(),
  mediaType: z.string().min(1),
  retentionClass: z.string().min(1),
  classification: z.string().min(1),
  redactionState: z.enum(['raw', 'redacted', 'tombstoned']),
  producer: z.string().optional(),
  createdAt: isoDate,
  expiresAt: isoDate.optional(),
  replacementId: z.string().optional(),
  replacementDigest: hexDigest.optional(),
  recordDigest: hexDigest,
});

export type RecordFrame = z.infer<typeof recordFrameSchema>;
export type CommitFrame = z.infer<typeof commitFrameSchema>;
export type LeaseRecord = z.infer<typeof leaseRecordSchema>;
export type GuardRecord = z.infer<typeof guardRecordSchema>;
export type ArtifactMetadata = z.infer<typeof artifactMetadataSchema>;
