import type {
  RunEventEnvelope,
  RunLaunchProjection,
  SessionLinkedPayload,
  SessionLinkSupersededPayload,
} from '../contracts/index.js';

type LinkageClassification = 'known' | 'unknown' | 'ambiguous';

export type ResolvedSessionLinkage = {
  classification: LinkageClassification;
  currentSession?: SessionLinkedPayload;
  linkHistory: SessionLinkedPayload[];
  launch: Pick<RunLaunchProjection, 'linkage' | 'currentSession' | 'linkHistory'>;
};

function isSessionLinkedPayload(value: unknown): value is SessionLinkedPayload {
  return Boolean(
    value && typeof value === 'object' && 'linkOrdinal' in value && 'sessionId' in value && 'linkRole' in value,
  );
}

function isSessionLinkSupersededPayload(value: unknown): value is SessionLinkSupersededPayload {
  return Boolean(value && typeof value === 'object' && 'supersededOrdinal' in value && 'replacementOrdinal' in value);
}

function isOwningLink(link: SessionLinkedPayload): boolean {
  return link.linkRole === 'primary' || link.linkRole === 'recovery';
}

export function hasContiguousSessionLinkOrdinals(links: readonly SessionLinkedPayload[]): boolean {
  if (links.length === 0) {
    return true;
  }

  let expectedOrdinal = 1;

  for (const link of links) {
    if (link.linkOrdinal !== expectedOrdinal) {
      return false;
    }

    expectedOrdinal += 1;
  }

  return true;
}

export function resolveSessionLinkage(events: readonly RunEventEnvelope[]): ResolvedSessionLinkage {
  const linkHistory: SessionLinkedPayload[] = [];
  const supersededOrdinals = new Set<number>();

  for (const event of events) {
    if (event.type === 'SessionLinked' && isSessionLinkedPayload(event.payload)) {
      if (event.payload.supersedesOrdinal !== undefined) {
        supersededOrdinals.add(event.payload.supersedesOrdinal);
      }

      linkHistory.push(event.payload);
      continue;
    }

    if (event.type === 'SessionLinkSuperseded' && isSessionLinkSupersededPayload(event.payload)) {
      supersededOrdinals.add(event.payload.supersededOrdinal);
    }
  }

  const currentSession = [...linkHistory].reverse().find((link) => !supersededOrdinals.has(link.linkOrdinal));
  const nonSupersededOwningLinks = linkHistory.filter(
    (link) => isOwningLink(link) && !supersededOrdinals.has(link.linkOrdinal),
  );

  const classification: LinkageClassification =
    nonSupersededOwningLinks.length === 0 ? 'unknown' : nonSupersededOwningLinks.length === 1 ? 'known' : 'ambiguous';

  return {
    classification,
    currentSession,
    linkHistory,
    launch: {
      linkage: classification,
      currentSession,
      linkHistory,
    },
  };
}
