import type { WorkflowStory } from '../types.js';

export interface SelectStoriesOptions {
  maxParallel: number;
  activeIds?: Set<string>;
}

export function selectDispatchableStories(stories: WorkflowStory[], options: SelectStoriesOptions): WorkflowStory[] {
  const activeIds = options.activeIds ?? new Set<string>();
  const slots = Math.max(0, options.maxParallel - activeIds.size);
  return stories.filter((story) => story.eligible && !activeIds.has(story.id)).slice(0, slots);
}

export function isCompleteStatus(status: string | undefined, completeStatuses: string[]): boolean {
  return status !== undefined && completeStatuses.includes(status);
}
