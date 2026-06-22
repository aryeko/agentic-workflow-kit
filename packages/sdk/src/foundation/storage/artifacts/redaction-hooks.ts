import type { ArtifactMetadataRecord } from './artifact-evidence.js';

export type ArtifactRedactionHookContext = {
  readonly hookId: string;
  readonly artifact: ArtifactMetadataRecord;
  readonly bytes: Uint8Array;
};

export type ArtifactRedactionHookResult = {
  readonly content: Uint8Array;
  readonly mediaType?: string;
  readonly classification?: string;
  readonly retentionClass?: string;
  readonly expiry?: Date;
  readonly producer?: string;
};

export type ArtifactRedactionHook = (context: ArtifactRedactionHookContext) => ArtifactRedactionHookResult;

export type ArtifactRedactionHookRegistry = Readonly<Record<string, ArtifactRedactionHook>>;
