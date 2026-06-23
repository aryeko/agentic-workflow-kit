import type { SessionLinkedPayload } from '../../../../src/index.js';

import { makeSessionLinkedPayload } from './fixtures.js';

export const linkageOrdinalViolationFixtures: Array<{
  name: string;
  links: SessionLinkedPayload[];
}> = [
  {
    name: 'gap',
    links: [
      makeSessionLinkedPayload({ linkOrdinal: 1, sessionId: 'session-1' }),
      makeSessionLinkedPayload({ linkOrdinal: 3, sessionId: 'session-3' }),
    ],
  },
  {
    name: 'duplicate',
    links: [
      makeSessionLinkedPayload({ linkOrdinal: 1, sessionId: 'session-1a' }),
      makeSessionLinkedPayload({ linkOrdinal: 1, sessionId: 'session-1b' }),
    ],
  },
  {
    name: 'non-1-start',
    links: [makeSessionLinkedPayload({ linkOrdinal: 2, sessionId: 'session-2' })],
  },
  {
    name: 'decrease',
    links: [
      makeSessionLinkedPayload({ linkOrdinal: 1, sessionId: 'session-1' }),
      makeSessionLinkedPayload({ linkOrdinal: 2, sessionId: 'session-2' }),
      makeSessionLinkedPayload({ linkOrdinal: 1, sessionId: 'session-1-repeat' }),
    ],
  },
];
