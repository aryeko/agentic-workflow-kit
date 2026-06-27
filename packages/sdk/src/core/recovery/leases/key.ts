import type { StoryLaunchKeyParts } from './types.js';

const DELIMITER = ':';

const assertSafePart = (label: keyof StoryLaunchKeyParts, value: string): string => {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new TypeError(`Story launch key requires a non-empty ${label}.`);
  }

  if (trimmed.includes(DELIMITER)) {
    throw new TypeError(`Story launch key ${label} must not contain "${DELIMITER}".`);
  }

  return trimmed;
};

export const buildStoryLaunchKey = ({ workSourceId, trackId, taskId }: StoryLaunchKeyParts): string =>
  `story-launch:${assertSafePart('workSourceId', workSourceId)}:${assertSafePart('trackId', trackId)}:${assertSafePart('taskId', taskId)}`;
