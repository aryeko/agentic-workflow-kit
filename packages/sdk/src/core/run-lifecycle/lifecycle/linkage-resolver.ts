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
  const replacementSupersessions: SessionLinkSupersededPayload[] = [];

  for (const event of events) {
    if (event.type === 'SessionLinked' && isSessionLinkedPayload(event.payload)) {
      linkHistory.push(event.payload);
      continue;
    }

    if (event.type === 'SessionLinkSuperseded' && isSessionLinkSupersededPayload(event.payload)) {
      replacementSupersessions.push(event.payload);
    }
  }

  const linkOrdinals = new Set(linkHistory.map((link) => link.linkOrdinal));
  const supersededOrdinals = new Set(
    linkHistory.flatMap((link) =>
      link.supersedesOrdinal !== undefined &&
      link.linkOrdinal > link.supersedesOrdinal &&
      linkOrdinals.has(link.linkOrdinal)
        ? [link.supersedesOrdinal]
        : [],
    ),
  );
  for (const supersession of replacementSupersessions) {
    if (
      supersession.replacementOrdinal > supersession.supersededOrdinal &&
      linkOrdinals.has(supersession.replacementOrdinal)
    ) {
      supersededOrdinals.add(supersession.supersededOrdinal);
    }
  }

  const currentSession = [...linkHistory]
    .reverse()
    .find((link) => isOwningLink(link) && !supersededOrdinals.has(link.linkOrdinal));
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
